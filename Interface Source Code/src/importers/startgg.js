const { BRACKET_SLOTS, blankBracketSlot } = require('./common');

const STARTGG_API = "https://api.start.gg/gql/alpha";

const SEEDING_QUERY = `
query EventSeeding($slug: String!, $page: Int!, $perPage: Int!) {
  event(slug: $slug) {
    entrants(query: { page: $page, perPage: $perPage }) {
      pageInfo { totalPages }
      nodes {
        initialSeedNum
        participants {
          gamerTag
          prefix
          user { location { country } genderPronoun }
        }
      }
    }
  }
}`;

const PHASES_QUERY = `
query EventPhases($slug: String!) {
  event(slug: $slug) {
    id
    phases { id name phaseOrder }
  }
}`;

const PHASE_SETS_QUERY = `
query PhaseSets($phaseId: ID!, $page: Int!, $perPage: Int!) {
  phase(id: $phaseId) {
    name
    sets(page: $page, perPage: $perPage, sortType: ROUND) {
      pageInfo { totalPages }
      nodes {
        id
        identifier
        round
        fullRoundText
        state
        slots {
          entrant {
            name
            participants { gamerTag prefix }
          }
          standing { stats { score { value } } }
        }
      }
    }
  }
}`;

class StartGG {

    #token = "";
    #slug = "";

    setToken(token) { this.#token = String(token ?? "").trim(); }

    /** Accepts a bare "tournament/x/event/y" slug or any start.gg url that contains one */
    setSlug(slug) {
        const text = String(slug ?? "").trim();
        const match = text.match(/tournament\/[^/]+\/event\/[^/?#]+/);
        this.#slug = match ? match[0] : text;
    }

    /** Runs a GraphQL query against start.gg, throwing on any API error */
    async #gql(query, variables) {

        if (!this.#token) throw new Error("No API key set.");

        const res = await fetch(STARTGG_API, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.#token}`
            },
            body: JSON.stringify({ query, variables })
        });

        if (res.status == 401 || res.status == 403) throw new Error("start.gg rejected the API key.");

        let json;
        try {
            json = await res.json();
        } catch (e) {
            throw new Error(`start.gg returned something that wasn't JSON (HTTP ${res.status}).`);
        }
        if (json.errors) throw new Error(json.errors[0].message);
        if (json.success === false) throw new Error(json.message || "start.gg refused the request.");

        return json.data;

    }

    /**
     * Every entrant of the event, one row per player. A doubles team gives one
     * row per teammate, all sharing the team's seed
     */
    async fetchEntrants() {

        if (!this.#slug) throw new Error("No event slug set.");

        const perPage = 200;
        let page = 1;
        let totalPages = 1;
        const entrants = [];

        do {

            const data = await this.#gql(SEEDING_QUERY, { slug: this.#slug, page, perPage });
            if (!data?.event) throw new Error("Event not found. Check the slug.");

            const conn = data.event.entrants;
            totalPages = conn.pageInfo.totalPages;

            for (const entrant of conn.nodes) {
                for (const participant of entrant.participants ?? []) {
                    if (!participant.gamerTag) continue;
                    entrants.push({
                        gamerTag: participant.gamerTag,
                        seed: entrant.initialSeedNum ?? "",
                        country: participant.user?.location?.country || "",
                        tag: participant.prefix || "",
                        pronouns: participant.user?.genderPronoun || ""
                    });
                }
            }

            page++;

        } while (page <= totalPages);

        return entrants;

    }

    /** Pulls the sets of the event's final phase and lays them out as bracket data */
    async fetchTop8Sets() {

        if (!this.#slug) throw new Error("No event slug set.");

        // the top 8 always lives in the last phase of an event
        const data = await this.#gql(PHASES_QUERY, { slug: this.#slug });
        const phases = data?.event?.phases;
        if (!phases?.length) throw new Error("Event not found, or it has no phases. Check the slug.");
        const phase = [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder).pop();

        const sets = [];
        let page = 1;
        let totalPages = 1;
        do {
            const pData = await this.#gql(PHASE_SETS_QUERY, { phaseId: phase.id, page, perPage: 60 });
            const conn = pData?.phase?.sets;
            if (!conn) break;
            totalPages = conn.pageInfo.totalPages;
            sets.push(...conn.nodes);
            page++;
        } while (page <= totalPages);

        if (!sets.length) throw new Error(`No sets found in phase "${phase.name}".`);

        return {
            phaseName: phase.name,
            setsFound: sets.length,
            bracket: this.#mapSetsToBracket(sets)
        };

    }

    /** Turns a phase's set list into this tool's top 8 bracket rounds */
    #mapSetsToBracket(sets) {

        const text = (set) => (set.fullRoundText || "").toLowerCase();

        // grand finals sit in the winners bracket, so pull them out before
        // we start counting winners rounds backwards
        const grands = sets.filter(s => text(s).includes("grand final"));
        const reset = grands.find(s => /reset|second/.test(text(s)));
        const grandFinal = grands.find(s => s != reset);

        // start.gg numbers winners rounds upwards and losers rounds downwards,
        // so in both cases the final round is the one furthest from zero
        const byRound = (list) => {
            const map = new Map();
            for (const set of list) {
                if (!map.has(set.round)) map.set(set.round, []);
                map.get(set.round).push(set);
            }
            return map;
        };
        const wRounds = [...byRound(sets.filter(s => s.round > 0 && !grands.includes(s))).entries()]
            .sort((a, b) => b[0] - a[0]);
        const lRounds = [...byRound(sets.filter(s => s.round < 0)).entries()]
            .sort((a, b) => a[0] - b[0]);

        // the deep rounds are usually named outright, so trust the text when
        // it's there and fall back to counting back from the final round
        const pick = (rounds, rank, pattern) => {
            if (pattern) {
                for (const [, roundSets] of rounds) {
                    if (roundSets.every(s => pattern.test(text(s)))) return roundSets;
                }
            }
            return rounds[rank] ? rounds[rank][1] : [];
        };

        const bracket = {};
        const fill = (key, roundSets) => {
            bracket[key] = this.#slotsFromSets(roundSets, BRACKET_SLOTS[key]);
        };

        fill("WinnersFinals",  pick(wRounds, 0, /winners final/));
        fill("WinnersSemis",   pick(wRounds, 1, /winners semi/));
        fill("LosersFinals",   pick(lRounds, 0, /losers final/));
        fill("LosersSemis",    pick(lRounds, 1, /losers semi/));
        fill("LosersQuarters", pick(lRounds, 2, /losers quarter/));
        fill("LosersTop8",     pick(lRounds, 3));
        fill("GrandFinals",    grandFinal ? [grandFinal] : []);
        fill("TrueFinals",     reset ? [reset] : []);

        return bracket;

    }

    /** Lays a round's sets out into the flat player slot list a bracket round uses */
    #slotsFromSets(roundSets, slotCount) {

        const slots = [];
        for (let i = 0; i < slotCount; i++) slots.push(blankBracketSlot());

        // start.gg labels sets A, B, C... going down the bracket, so that
        // ordering keeps encounters where the operator expects them
        const ordered = [...roundSets].sort((a, b) => String(a.identifier ?? a.id)
            .localeCompare(String(b.identifier ?? b.id), undefined, { numeric: true }));

        for (let i = 0; i < ordered.length && i * 2 < slotCount; i++) {
            for (let j = 0; j < 2; j++) {

                const slot = ordered[i].slots?.[j];
                if (!slot) continue;
                const target = slots[i * 2 + j];

                // an empty slot means that seat hasn't been decided yet
                if (slot.entrant) {
                    const parts = slot.entrant.participants || [];
                    if (parts.length == 1) {
                        target.name = parts[0].gamerTag;
                        target.tag = parts[0].prefix || "";
                    } else {
                        target.name = slot.entrant.name;
                    }
                }

                const score = slot.standing?.stats?.score?.value;
                if (score != null) target.score = score < 0 ? "DQ" : String(score);

            }
        }

        return slots;

    }

}

module.exports = { StartGG };
