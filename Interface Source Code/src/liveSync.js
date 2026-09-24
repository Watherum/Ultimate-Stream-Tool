//keeps the app window and every remote GUI mirrored in real time, without touching
//the overlays (those still only change when someone presses UPDATE).
//
//every GUI snapshots its own state a few times a second and posts only the fields
//that changed since the last snapshot, so two people editing different things at
//the same time don't stomp on each other. the server merges them and keeps a short
//log, and each GUI pulls whatever the others posted since it last looked

const liveSync = (() => {

    const POLL_MS = 300;
    const origin = Math.random().toString(36).slice(2);

    let session = null; //changes when the app restarts
    let seq = 0;        //the last server change this GUI has seen
    let base = null;    //state as of the last send or apply
    let started = false;
    let busy = false;

    //one thing at a time touches the GUI: a tick, or a reload from ScoreboardInfo.json
    let lock = Promise.resolve();
    function exclusive(fn) {
        const run = lock.then(fn);
        lock = run.catch(() => {});
        return run;
    }

    function snapshot() {
        try {
            return JSON.parse(JSON.stringify(buildGuiState()));
        } catch (e) { //something is still loading
            return null;
        }
    }

    //[key, value] pairs for every field that differs
    function diff(a, b) {
        const out = [];
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
            if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) out.push([key, b[key] ?? null]);
        }
        return out;
    }

    async function post(body) {
        const res = await fetch(API_BASE + '/api/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return res.json();
    }

    //takes the server's shared state, or starts it off with ours if nobody has yet
    async function join(res) {
        session = res.session;
        seq = res.seq;
        if (res.state) {
            await applyGuiState(res.state);
        } else {
            const seeded = await post({ seed: snapshot() });
            session = seeded.session;
            seq = seeded.seq;
            //someone else got there first
            if (!seeded.accepted && seeded.state) await applyGuiState(seeded.state);
        }
        base = snapshot();
    }

    async function start() {
        if (started) return;
        started = true;
        await exclusive(async () => {
            try {
                await join(await fetch(API_BASE + '/api/live').then(r => r.json()));
            } catch (e) {
                console.error("Live sync couldn't reach the server", e);
            }
        });
        setInterval(tick, POLL_MS);
    }

    function tick() {
        if (busy) return;
        busy = true;
        exclusive(async () => {

            //ours first. base only moves once the server has them, so a failed send
            //is just tried again on the next tick
            const current = snapshot();
            if (current && base && session) {
                const changes = diff(base, current);
                if (changes.length) {
                    await post({ origin, changes });
                    base = current;
                }
            }

            //then everyone else's
            const res = await fetch(`${API_BASE}/api/live?since=${seq}&session=${session}`).then(r => r.json());

            if (res.resync) {
                if (res.session !== session) {
                    //the app restarted, and it clears the scoreboard when it does
                    session = res.session;
                    if (!res.state) await loadSavedData();
                    await join(res);
                } else {
                    //too far behind for the log, take the whole thing
                    seq = res.seq;
                    if (res.state) await applyGuiState(res.state);
                    base = snapshot();
                }
                return;
            }

            seq = res.seq;

            //the latest value of each field another GUI changed, dropping any field this
            //GUI changed after them in the same batch: the server already holds ours
            const theirs = new Map();
            for (const entry of res.entries) {
                for (const [key] of entry.changes) {
                    if (entry.origin === origin) theirs.delete(key);
                }
                if (entry.origin === origin) continue;
                for (const [key, value] of entry.changes) theirs.set(key, value);
            }
            if (theirs.size) await applyChanges(theirs);

        }).catch(() => {
            //server unreachable for a moment, the next tick tries again
        }).finally(() => {
            busy = false;
        });
    }

    async function applyChanges(changes) {
        const local = snapshot();
        if (!local || !base) return;
        for (const [key, value] of changes) local[key] = value;
        await applyGuiState(local, true);
        //whatever those values settled into on screen is the synced version of them,
        //so tidying one up (a blank skin becoming "1") doesn't bounce it back
        const after = snapshot();
        for (const key of changes.keys()) base[key] = after[key];
    }

    /**
     * Runs something that rewrites the GUI (a reload from ScoreboardInfo.json)
     * without live sync mistaking the result for edits made here
     */
    function whileApplying(fn) {
        return exclusive(async () => {
            await fn();
            if (base) base = snapshot();
        });
    }

    return { start, whileApplying };

})();
