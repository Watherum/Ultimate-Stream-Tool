const { StartGG } = require('./startgg');
const { ParryGG } = require('./parrygg');
const { Challonge } = require('./challonge');

/**
 * Every importer exposes the same thing, so the server never has to care which
 * bracket site it is talking to:
 *   setToken, setSlug, fetchEntrants, fetchTop8Sets
 * Ones with `needsEvent` also take a setEvent, since their slug points at a
 * whole tournament rather than a single event.
 */
const IMPORTERS = {
    startgg: {
        name: "start.gg",
        api: new StartGG(),
        needsEvent: false,
        tokenLabel: "API Key",
        slugHint: "Paste the event URL, or tournament/slug/event/slug",
        slugPlaceholder: "tournament/genesis-x/event/ultimate-singles",
        note: "",
        propsKey: "startgg.apiKey"
    },
    parrygg: {
        name: "parry.gg",
        api: new ParryGG(),
        needsEvent: true,
        tokenLabel: "API Key",
        slugHint: "Paste the bracket URL, or the tournament slug",
        slugPlaceholder: "tournament-slug",
        note: "",
        propsKey: "parrygg.apiKey"
    },
    challonge: {
        name: "Challonge",
        api: new Challonge(),
        needsEvent: false,
        tokenLabel: "API Key, or clientId:clientSecret",
        slugHint: "Paste the bracket URL, or the tournament slug",
        slugPlaceholder: "tournament-slug",
        note: "Challonge only gives seeds and sponsor tags (from entry names written as TAG | Player).",
        propsKey: "challonge.apiKey",
        // challonge issues an application rather than a key, so its two
        // halves are joined into the one credential the importer takes
        propsKeyPair: ["challonge.clientId", "challonge.clientSecret"]
    }
};

/**
 * The key for a site as written in app.properties.txt, or "" if there is none
 * @param {Object} props - Every key=value pair in the file
 * @param {String} source - Importer key
 */
function keyFromProps(props, source) {
    const config = IMPORTERS[source];
    let value = props[config.propsKey] || "";
    if (!value && config.propsKeyPair) {
        const [idKey, secretKey] = config.propsKeyPair;
        if (props[idKey] && props[secretKey]) value = `${props[idKey]}:${props[secretKey]}`;
    }
    return value;
}

module.exports = { IMPORTERS, keyFromProps };
