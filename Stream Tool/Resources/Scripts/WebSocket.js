function readJson(path) {
    return new Promise((resolve) => {
        const req = new XMLHttpRequest();
        req.addEventListener("load", () => {
            try { resolve(JSON.parse(req.responseText)); }
            catch (e) { resolve(null); }
        });
        req.onerror = () => resolve(null);
        req.open("GET", path);
        req.send();
    });
}

window.initWebsocket = function(channel, callback) {
    let lastSerialized = null;

    async function poll() {
        const json = await readJson("Resources/Texts/ScoreboardInfo.json");
        if (!json) return;

        const serialized = JSON.stringify(json);
        if (serialized === lastSerialized) return;
        lastSerialized = serialized;

        callback({
            player: [
                { char: json.p1Character, tag: json.p1Team,  name: json.p1Name, pronouns: json.p1Pron, seed: json.p1Seed || "", country: json.p1Country || "" },
                { char: json.p2Character, tag: json.p2Team,  name: json.p2Name, pronouns: json.p2Pron, seed: json.p2Seed || "", country: json.p2Country || "" }
            ],
            score: [json.p1NScore, json.p2NScore],
            round:  json.round  || "",
            bestOf: json.bestOf || "",
            wl:    [json.p1WL   || "", json.p2WL || ""]
        });
    }

    poll();
    setInterval(poll, 500);
};
