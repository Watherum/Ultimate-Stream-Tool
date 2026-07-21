const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const net = require('net');

const app = express();
const port = 1111;

app.use(cors());
app.use(bodyParser.json());

let baseDir;

const isDev = process.execPath.includes('node_modules');
if (isDev) {
    baseDir = path.resolve(__dirname, '..', '..', 'Stream Tool');
} else if (process.env.PORTABLE_EXECUTABLE_DIR) {
    baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
} else {
    baseDir = path.dirname(process.execPath);
}

const mainPath = path.resolve(baseDir, 'Resources', 'Texts');
const guiPath = __dirname;
const resourcesPath = path.resolve(baseDir, 'Resources');
const iconPath = path.resolve(resourcesPath, 'Characters', 'Stock Icons');

console.log("Server Base Dir:", baseDir);

function readAppProperties() {
    const propsPath = path.join(baseDir, 'Resources', 'app.properties.txt');
    try {
        const content = fs.readFileSync(propsPath, 'utf8');
        const match = content.match(/startgg\.apiKey\s*=\s*(.+)/);
        return match ? match[1].trim() : null;
    } catch { return null; }
}

const blankScoreboard = {
    p1Name: "", p1Team: "", p1Pron: "", p1NScore: "0",
    p1Character: "Random", p1Skin: "1", p1Color: "Red", p1WL: "",
    p1Seed: "", p1Country: "",
    p2Name: "", p2Team: "", p2Pron: "", p2NScore: "0",
    p2Character: "Random", p2Skin: "1", p2Color: "Blue", p2WL: "",
    p2Seed: "", p2Country: "",
    matchType: "singles",
    p1TeammateName: "", p1TeammateCharacter: "Random", p1TeammateSkin: "1",
    p1TeammateTag: "", p1TeammatePron: "", p1TeammateSeed: "", p1TeammateCountry: "",
    p2TeammateName: "", p2TeammateCharacter: "Random", p2TeammateSkin: "1",
    p2TeammateTag: "", p2TeammatePron: "", p2TeammateSeed: "", p2TeammateCountry: "",
    teamName1: "", teamName2: "", crewStocks1: "0", crewStocks2: "0",
    bestOf: "Bo3", round: "", format: "0", tournamentName: "",
    caster1Name: "", caster1Twitter: "", caster1Twitch: "",
    caster2Name: "", caster2Twitter: "", caster2Twitch: "",
    allowIntro: false
};
// writes the individual OBS text files (and character icons) from a scoreboard object;
// shared by the POST handler and the startup reset so they can't drift apart
function writeSimpleTexts(scoreboardJson) {
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 1.txt"), scoreboardJson.p1Name || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 1 Pronouns.txt", scoreboardJson.p1Pron || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 1 Tag.txt", scoreboardJson.p1Team || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 1 Character.txt", scoreboardJson.p1Character || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Left Winnerslosers.txt", scoreboardJson.p1WL || "");

    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 2.txt"), scoreboardJson.p2Name || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 2 Pronouns.txt", scoreboardJson.p2Pron || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 2 Tag.txt", scoreboardJson.p2Team || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Player 2 Character.txt", scoreboardJson.p2Character || "");
    fs.writeFileSync(mainPath + "/Simple Texts/Right Winnerslosers.txt", scoreboardJson.p2WL || "");

    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Score 1.txt"), scoreboardJson.p1NScore || "0");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Score 2.txt"), scoreboardJson.p2NScore || "0");

    // doubles teammates and crew battle info — always written (blank when unused) so switching
    // back to singles, or a fresh startup reset, doesn't leave stale P3/P4 text behind
    for (const pn of [1, 2]) {
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate.txt`),           scoreboardJson[`p${pn}TeammateName`]      || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate Character.txt`), scoreboardJson[`p${pn}TeammateCharacter`] || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate Tag.txt`),       scoreboardJson[`p${pn}TeammateTag`]       || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate Pronouns.txt`),  scoreboardJson[`p${pn}TeammatePron`]      || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate Seed.txt`),      scoreboardJson[`p${pn}TeammateSeed`]      || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Player ${pn} Teammate Country.txt`),   scoreboardJson[`p${pn}TeammateCountry`]   || "");
    }
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Team 1 Name.txt"), scoreboardJson.teamName1 || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Team 2 Name.txt"), scoreboardJson.teamName2 || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Crew Stocks 1.txt"), String(scoreboardJson.crewStocks1 ?? "0"));
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Crew Stocks 2.txt"), String(scoreboardJson.crewStocks2 ?? "0"));

    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Round.txt"), scoreboardJson.round || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Format.txt"), scoreboardJson.format || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "bestOf.txt"), scoreboardJson.bestOf || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Tournament Name.txt"), scoreboardJson.tournamentName || "");

    for (let cn = 1; scoreboardJson[`caster${cn}Name`] !== undefined && cn <= 10; cn++) {
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Caster ${cn} Name.txt`),    scoreboardJson[`caster${cn}Name`]    || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Caster ${cn} Twitter.txt`), scoreboardJson[`caster${cn}Twitter`] || "");
        fs.writeFileSync(path.join(mainPath, "Simple Texts", `Caster ${cn} Twitch.txt`),  scoreboardJson[`caster${cn}Twitch`]  || "");
    }

    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 1 Seed.txt"), scoreboardJson.p1Seed || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 2 Seed.txt"), scoreboardJson.p2Seed || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 1 Country.txt"), scoreboardJson.p1Country || "");
    fs.writeFileSync(path.join(mainPath, "Simple Texts", "Player 2 Country.txt"), scoreboardJson.p2Country || "");

    fs.copyFileSync(iconPath + "/" + scoreboardJson.p1Character + "/1.png", mainPath + "/Simple Texts/Player 1 Character Icon/1.png");
    fs.copyFileSync(iconPath + "/" + scoreboardJson.p2Character + "/1.png", mainPath + "/Simple Texts/Player 2 Character Icon/1.png");
}

try {
    fs.writeFileSync(path.join(mainPath, "ScoreboardInfo.json"), JSON.stringify(blankScoreboard, null, 2));
    writeSimpleTexts(blankScoreboard);
    console.log("Scoreboard cleared on startup");
} catch (error) {
    console.error("Failed to clear scoreboard on startup:", error);
}

app.use(express.static(guiPath));
app.use('/Resources', express.static(resourcesPath));

app.get(/\/api\/json\/(.*)/, (req, res) => {
    try {
        const fileParam = req.params[0];
        const filePath = path.resolve(mainPath, fileParam + '.json');

        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            res.json(JSON.parse(data));
        } else {
            console.error("File not found:", filePath);
            res.status(404).send('File not found');
        }
    } catch (error) {
        console.error("Error reading file:", error);
        res.status(500).send('Error reading file');
    }
});

let lastUpdateTimestamp = Date.now();

app.get('/api/last-update', (req, res) => {
    res.json({ timestamp: lastUpdateTimestamp });
});

// API to update ScoreboardInfo and text files
app.post('/api/scoreboard', (req, res) => {
    try {
        const scoreboardJson = req.body;
        const data = JSON.stringify(scoreboardJson, null, 2);

        fs.writeFileSync(path.join(mainPath, "ScoreboardInfo.json"), data);

        if (scoreboardJson.writeSimpleTexts !== false) {
            writeSimpleTexts(scoreboardJson);
        }

        lastUpdateTimestamp = Date.now();

        console.log("Scoreboard updated");
        res.send({ status: 'success' });
    } catch (error) {
        console.error("Error writing scoreboard:", error);
        res.status(500).send('Error writing scoreboard');
    }
});

app.get('/api/startgg-key', (req, res) => {
    const fileToken = readAppProperties();
    res.json({ fromFile: !!fileToken, hasKey: !!fileToken });
});

app.post('/api/startgg', async (req, res) => {
    const { slug, page = 1, perPage = 200, token: bodyToken } = req.body;
    const token = readAppProperties() || bodyToken;
    if (!token) return res.status(400).json({ error: 'No API key set. Enter your start.gg token in Settings.' });

    const query = `query($slug: String, $page: Int, $perPage: Int) {
        event(slug: $slug) {
            entrants(query: { page: $page, perPage: $perPage }) {
                pageInfo { totalPages }
                nodes {
                    initialSeedNum
                    participants { gamerTag prefix user { location { country } genderPronoun } }
                }
            }
        }
    }`;

    try {
        const response = await fetch('https://api.start.gg/gql/alpha', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables: { slug, page, perPage } })
        });
        const json = await response.json();
        res.json(json);
    } catch (error) {
        console.error("start.gg fetch error:", error);
        res.status(500).json({ error: error.message });
    }
});

const presetsPath = path.join(mainPath, 'PlayerPresets.json');

app.get('/api/presets', (req, res) => {
    try {
        if (fs.existsSync(presetsPath)) {
            res.json(JSON.parse(fs.readFileSync(presetsPath, 'utf8')));
        } else {
            res.json([]);
        }
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/presets', (req, res) => {
    try {
        let presets = fs.existsSync(presetsPath)
            ? JSON.parse(fs.readFileSync(presetsPath, 'utf8'))
            : [];
        const incoming = req.body;
        const idx = presets.findIndex(p => p.name.toLowerCase() === incoming.name.toLowerCase() && (p.character || '').toLowerCase() === (incoming.character || '').toLowerCase());
        if (idx >= 0) presets[idx] = incoming; else presets.push(incoming);
        fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
        res.send({ status: 'success' });
    } catch (e) {
        res.status(500).send('Error saving preset');
    }
});

app.delete('/api/presets/:name', (req, res) => {
    try {
        let presets = fs.existsSync(presetsPath)
            ? JSON.parse(fs.readFileSync(presetsPath, 'utf8'))
            : [];
        presets = presets.filter(p => p.name.toLowerCase() !== decodeURIComponent(req.params.name).toLowerCase());
        fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
        res.send({ status: 'success' });
    } catch (e) {
        res.status(500).send('Error deleting preset');
    }
});

function findAvailablePort(startPort) {
    return new Promise((resolve) => {
        const tester = net.createServer();
        tester.once('error', () => resolve(findAvailablePort(startPort + 1)));
        tester.once('listening', () => tester.close(() => resolve(startPort)));
        tester.listen(startPort);
    });
}

const serverReady = findAvailablePort(port).then(availablePort => {
    return new Promise((resolve) => {
        app.listen(availablePort, () => {
            console.log(`Web interface running at http://localhost:${availablePort}`);
            resolve(availablePort);
        });
    });
});

module.exports = { app, serverReady };
