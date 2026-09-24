const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { IMPORTERS, keyFromProps } = require('./importers');
const { BRACKET_SLOTS, blankBracket, blankBracketSlot, loadCountryCodes, countryCodeFromName } = require('./importers/common');

const app = express();
const port = 1111;

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

let baseDir;

const isDev = process.execPath.includes('node_modules');
if (process.env.USTOOL_BASE_DIR) {
    //lets a test run point the server at a throwaway copy of "Stream Tool"
    baseDir = path.resolve(process.env.USTOOL_BASE_DIR);
} else if (isDev) {
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
const flagsPath = path.resolve(resourcesPath, 'Flags');

console.log("Server Base Dir:", baseDir);

loadCountryCodes(resourcesPath);

//every key=value pair in app.properties.txt, re-read on each use so a key
//pasted in while the app is open is picked up without a restart
function readAppProperties() {
    const props = {};
    try {
        const content = fs.readFileSync(path.join(resourcesPath, 'app.properties.txt'), 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const eq = line.indexOf('=');
            if (eq === -1) continue;
            props[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
        }
    } catch { /* no file, no keys */ }
    return props;
}

function readJsonFile(filePath, fallback) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
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

//everything a GUI polls for: when the scoreboard was last written, and version
//counters for the other shared state, so it only re-fetches what actually moved
let bracketVersion = 1;
let presetsVersion = 1;
let importVersion = 1;
//a one-line message every GUI toasts once, for things that happen server side
let notice = { id: 0, text: "" };

function pushNotice(text) {
    notice = { id: notice.id + 1, text };
}

app.get('/api/last-update', (req, res) => {
    res.json({ timestamp: lastUpdateTimestamp, bracketVersion, presetsVersion, importVersion, notice });
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


/* PLAYER PRESETS */

const presetsPath = path.join(mainPath, 'PlayerPresets.json');

function readPresets() {
    const presets = readJsonFile(presetsPath, []);
    return Array.isArray(presets) ? presets : [];
}

function writePresets(presets) {
    fs.writeFileSync(presetsPath, JSON.stringify(presets, null, 2));
    presetsVersion++;
}

//seeds belong to one tournament, so none of them carry over into the next session
try {
    const presets = readPresets();
    let cleared = 0;
    for (const preset of presets) {
        if (preset.seed) {
            preset.seed = "";
            cleared++;
        }
    }
    if (cleared) {
        writePresets(presets);
        console.log(`Cleared ${cleared} stale preset seed${cleared == 1 ? '' : 's'} on startup`);
    }
} catch (error) {
    console.error("Failed to clear preset seeds on startup:", error);
}

app.get('/api/presets', (req, res) => {
    res.json(readPresets());
});

app.post('/api/presets', (req, res) => {
    try {
        const presets = readPresets();
        const incoming = req.body;
        const idx = presets.findIndex(p => p.name.toLowerCase() === incoming.name.toLowerCase() && (p.character || '').toLowerCase() === (incoming.character || '').toLowerCase());
        if (idx >= 0) presets[idx] = incoming; else presets.push(incoming);
        writePresets(presets);
        res.send({ status: 'success' });
    } catch (e) {
        res.status(500).send('Error saving preset');
    }
});

app.delete('/api/presets/:name', (req, res) => {
    try {
        let presets = readPresets();
        presets = presets.filter(p => p.name.toLowerCase() !== decodeURIComponent(req.params.name).toLowerCase());
        writePresets(presets);
        res.send({ status: 'success' });
    } catch (e) {
        res.status(500).send('Error deleting preset');
    }
});


/* TOOL SETTINGS */

//settings the server itself needs (import source, remembered slugs, bracket colors).
//API keys are never written here — they come from app.properties.txt, or are typed
//into a GUI and only kept in memory until the app closes
const toolSettingsPath = path.join(mainPath, 'ToolSettings.json');

const DEFAULT_BRACKET_COLORS = { round: "#48bf91", text: "#ffffff", score: "#000000" };
//what a fresh install starts with, so there's something to click on
const STARTER_COLOR_PRESETS = [
    { round: "#48bf91", text: "#ffffff", score: "#000000" },
    { round: "#ffffff", text: "#ffffff", score: "#000000" },
    { round: "#ffcc00", text: "#ffffff", score: "#000000" },
    { round: "#ff5e5e", text: "#ffffff", score: "#000000" }
];
const MAX_COLOR_PRESETS = 12;
//the only auto import intervals the GUI offers, so a typo'd setting can't spam a site
const AUTO_IMPORT_CHOICES = [0, 30, 60, 120, 300];

const toolSettings = Object.assign({
    importSource: "startgg",
    rememberSlug: false,
    slugs: {},
    events: {},
    bracketColors: { ...DEFAULT_BRACKET_COLORS },
    bracketColorPresets: STARTER_COLOR_PRESETS.map(p => ({ ...p })),
    bracketAutoImport: 0
}, readJsonFile(toolSettingsPath, {}));

function saveToolSettings() {
    try {
        fs.writeFileSync(toolSettingsPath, JSON.stringify(toolSettings, null, 2));
    } catch (e) {
        console.error("Error saving tool settings:", e);
    }
}

/** Turns whatever was typed into a #rrggbb color, or "" if it isn't one */
function readHex(value) {
    const hex = String(value ?? "").trim().replace(/^#/, "");
    if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return "";
    const full = hex.length == 3 ? [...hex].map(d => d + d).join("") : hex;
    return `#${full.toLowerCase()}`;
}

function readColors(colors, fallback) {
    return {
        round: readHex(colors?.round) || fallback.round,
        text: readHex(colors?.text) || fallback.text,
        score: readHex(colors?.score) || fallback.score
    };
}


/* TOURNAMENT IMPORT */

if (!IMPORTERS[toolSettings.importSource]) toolSettings.importSource = "startgg";

//slug and event of every site, so switching site doesn't make anyone retype them
const importState = {};
//keys typed into a GUI this session, never saved to disk
const sessionKeys = {};
//what the last fetch of each site found, lowercase name -> {seed, country, tag, pronouns}
const importedPlayers = {};
for (const source in IMPORTERS) {
    importState[source] = {
        slug: toolSettings.rememberSlug ? (toolSettings.slugs[source] || "") : "",
        event: toolSettings.rememberSlug ? (toolSettings.events[source] || "") : ""
    };
    sessionKeys[source] = "";
    importedPlayers[source] = {};
}

function getImportKey(source) {
    const fromFile = keyFromProps(readAppProperties(), source);
    return { key: fromFile || sessionKeys[source], fromFile: !!fromFile };
}

/** An importer with its key, slug and event loaded, ready to fetch */
function prepareImporter(source) {
    const config = IMPORTERS[source];
    const { key } = getImportKey(source);
    config.api.setToken(key);
    config.api.setSlug(importState[source].slug);
    if (config.api.setEvent) config.api.setEvent(importState[source].event);
    return config.api;
}

function rememberSlugs() {
    toolSettings.slugs = {};
    toolSettings.events = {};
    if (toolSettings.rememberSlug) {
        for (const source in IMPORTERS) {
            toolSettings.slugs[source] = importState[source].slug;
            toolSettings.events[source] = importState[source].event;
        }
    }
    saveToolSettings();
}

//everything a GUI needs to draw the import settings. keys never leave the server,
//only whether one is set and where it came from
function importConfig() {
    const sources = {};
    for (const source in IMPORTERS) {
        const config = IMPORTERS[source];
        const { key, fromFile } = getImportKey(source);
        sources[source] = {
            name: config.name,
            needsEvent: config.needsEvent,
            tokenLabel: config.tokenLabel,
            slugHint: config.slugHint,
            slugPlaceholder: config.slugPlaceholder,
            note: config.note,
            hasKey: !!key,
            keyFromFile: fromFile,
            slug: importState[source].slug,
            event: importState[source].event,
            loaded: Object.keys(importedPlayers[source]).length
        };
    }
    return { source: toolSettings.importSource, rememberSlug: toolSettings.rememberSlug, sources };
}

app.get('/api/import/config', (req, res) => {
    res.json(importConfig());
});

app.post('/api/import/config', (req, res) => {
    const body = req.body || {};
    const source = IMPORTERS[body.source] ? body.source : toolSettings.importSource;

    if (IMPORTERS[body.source] && body.select !== false) toolSettings.importSource = body.source;
    if (typeof body.token === "string") sessionKeys[source] = body.token.trim();
    if (typeof body.slug === "string") importState[source].slug = body.slug.trim();
    if (typeof body.event === "string") importState[source].event = body.event.trim();
    if (typeof body.rememberSlug === "boolean") toolSettings.rememberSlug = body.rememberSlug;

    rememberSlugs();
    importVersion++;
    res.json(importConfig());
});

/** Every player the loaded tournaments know about, the selected site winning ties */
function mergedImportedPlayers() {
    const active = toolSettings.importSource;
    const order = [active, ...Object.keys(IMPORTERS).filter(s => s != active)];
    const merged = {};
    for (const source of [...order].reverse()) {
        for (const [key, player] of Object.entries(importedPlayers[source])) {
            const current = merged[key] || {};
            //a field the preferred site doesn't know is still worth taking from another
            merged[key] = {
                name: player.name || current.name,
                seed: player.seed !== "" && player.seed != null ? player.seed : (current.seed ?? ""),
                country: player.country || current.country || "",
                tag: player.tag || current.tag || "",
                pronouns: player.pronouns || current.pronouns || ""
            };
        }
    }
    return merged;
}

app.get('/api/import/players', (req, res) => {
    res.json(mergedImportedPlayers());
});

/** Downloads any flag image the loaded players need but that isn't on disk yet */
async function downloadMissingFlags(entrants) {
    const codes = new Set(entrants.map(e => countryCodeFromName(e.country)).filter(Boolean));
    let downloaded = 0;
    for (const code of codes) {
        const flagPath = path.join(flagsPath, `${code}.png`);
        if (fs.existsSync(flagPath)) continue;
        try {
            const res = await fetch(`https://flagcdn.com/w40/${code}.png`);
            if (!res.ok) continue;
            fs.writeFileSync(flagPath, Buffer.from(await res.arrayBuffer()));
            downloaded++;
        } catch { /* skip on network error, the flag just won't show */ }
    }
    return downloaded;
}

/**
 * Creates or updates a preset for every imported player. A player with presets
 * for several characters gets all of them updated, and only the fields the site
 * actually knows are allowed to overwrite what was saved
 */
function upsertImportedPresets(entrants) {
    const presets = readPresets();
    let created = 0, updated = 0;
    const seen = new Set();

    for (const entrant of entrants) {
        const key = entrant.gamerTag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const matches = presets.filter(p => (p.name || "").toLowerCase() === key);
        if (matches.length) {
            for (const preset of matches) {
                if (entrant.seed !== "" && entrant.seed != null) preset.seed = entrant.seed;
                if (entrant.country) preset.country = entrant.country;
                if (entrant.tag) preset.tag = entrant.tag;
                if (entrant.pronouns) preset.pronouns = entrant.pronouns;
            }
            updated++;
        } else {
            presets.push({
                name: entrant.gamerTag,
                tag: entrant.tag || "",
                pronouns: entrant.pronouns || "",
                character: "Random",
                skin: "1",
                seed: entrant.seed ?? "",
                country: entrant.country || ""
            });
            created++;
        }
    }

    writePresets(presets);
    return { created, updated };
}

app.post('/api/import/fetch', async (req, res) => {
    const source = IMPORTERS[req.body?.source] ? req.body.source : toolSettings.importSource;
    const config = IMPORTERS[source];
    try {
        const entrants = await prepareImporter(source).fetchEntrants();

        const players = {};
        for (const e of entrants) {
            players[e.gamerTag.toLowerCase()] = {
                name: e.gamerTag, seed: e.seed ?? "", country: e.country || "",
                tag: e.tag || "", pronouns: e.pronouns || ""
            };
        }
        importedPlayers[source] = players;

        const { created, updated } = upsertImportedPresets(entrants);
        await downloadMissingFlags(entrants);
        importVersion++;

        res.json({ source, name: config.name, count: Object.keys(players).length, created, updated });
    } catch (e) {
        console.error(`${config.name} import error:`, e.message);
        res.status(502).json({ error: e.message, name: config.name });
    }
});


/* TOP 8 BRACKET */

//the rounds reset every launch like the scoreboard does; colors are a setting
const bracketPath = path.join(mainPath, 'Bracket.json');
let bracketRounds = blankBracket();

function bracketSnapshot() {
    return {
        version: bracketVersion,
        rounds: bracketRounds,
        colors: toolSettings.bracketColors,
        colorPresets: toolSettings.bracketColorPresets,
        autoImport: toolSettings.bracketAutoImport
    };
}

//the overlay only needs what it draws
function writeBracketFile() {
    bracketVersion++;
    try {
        fs.writeFileSync(bracketPath, JSON.stringify({
            colors: toolSettings.bracketColors,
            rounds: bracketRounds
        }, null, 2));
    } catch (e) {
        console.error("Error writing bracket:", e);
    }
}

/** A bracket slot as sent by a GUI, with anything unexpected knocked back into shape */
function cleanSlot(data) {
    const blank = blankBracketSlot();
    const text = (value, fallback) => (value == null ? fallback : String(value).slice(0, 80));
    return {
        name: text(data?.name, blank.name) || blank.name,
        tag: text(data?.tag, blank.tag),
        character: text(data?.character, blank.character) || blank.character,
        skin: text(data?.skin, blank.skin) || blank.skin,
        score: text(data?.score, blank.score) || blank.score
    };
}

writeBracketFile();

app.get('/api/bracket', (req, res) => {
    res.json(bracketSnapshot());
});

//GUIs send single slots rather than the whole bracket, so an edit on one device
//and an import (or an edit on another device) never overwrite each other's slots
app.post('/api/bracket/slots', (req, res) => {
    const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    for (const { round, index, data } of slots) {
        if (!BRACKET_SLOTS[round] || !(index >= 0 && index < BRACKET_SLOTS[round])) continue;
        bracketRounds[round][index] = cleanSlot(data);
    }
    writeBracketFile();
    res.json({ version: bracketVersion });
});

let autoImportTimer = null;
let autoImportBusy = false;
let autoImportFailed = false; //so a broken slug doesn't toast every single tick

function restartAutoImport() {
    clearInterval(autoImportTimer);
    autoImportTimer = null;
    autoImportFailed = false;
    const seconds = toolSettings.bracketAutoImport;
    if (seconds) autoImportTimer = setInterval(autoImport, seconds * 1000);
}

app.post('/api/bracket/settings', (req, res) => {
    const body = req.body || {};
    if (body.colors) {
        toolSettings.bracketColors = readColors(body.colors, toolSettings.bracketColors);
    }
    if (Array.isArray(body.colorPresets)) {
        toolSettings.bracketColorPresets = body.colorPresets.slice(0, MAX_COLOR_PRESETS)
            .map(p => readColors(p, DEFAULT_BRACKET_COLORS));
    }
    if (body.autoImport !== undefined && AUTO_IMPORT_CHOICES.includes(Number(body.autoImport))) {
        toolSettings.bracketAutoImport = Number(body.autoImport);
        restartAutoImport();
    }
    saveToolSettings();
    writeBracketFile();
    res.json(bracketSnapshot());
});

/**
 * Pulls the top 8 off the selected site and writes it over the bracket. The sites
 * know nothing about characters, so a slot keeps whatever character was picked for
 * it as long as the same player is still sitting there
 */
async function importBracket() {
    const source = toolSettings.importSource;
    const result = await prepareImporter(source).fetchTop8Sets();

    for (const round in result.bracket) {
        if (!bracketRounds[round]) continue;
        result.bracket[round].forEach((incoming, i) => {
            const old = bracketRounds[round][i];
            if (old && incoming.name != "-" && old.name == incoming.name) {
                incoming.character = old.character;
                incoming.skin = old.skin;
            }
            bracketRounds[round][i] = cleanSlot(incoming);
        });
    }

    writeBracketFile();
    return { ...result, name: IMPORTERS[source].name };
}

async function autoImport() {
    if (autoImportBusy) return; //last fetch hasn't come back yet
    autoImportBusy = true;
    try {
        await importBracket();
        if (autoImportFailed) pushNotice("Bracket auto import is working again");
        autoImportFailed = false;
    } catch (e) {
        //say it once, then stay quiet until it recovers
        if (!autoImportFailed) pushNotice(`Bracket auto import failed: ${e.message}`);
        autoImportFailed = true;
    } finally {
        autoImportBusy = false;
    }
}

restartAutoImport();

app.post('/api/bracket/import', async (req, res) => {
    try {
        const result = await importBracket();
        res.json({ setsFound: result.setsFound, phaseName: result.phaseName, name: result.name, version: bracketVersion });
    } catch (e) {
        console.error("Bracket import error:", e.message);
        res.status(502).json({ error: e.message, name: IMPORTERS[toolSettings.importSource].name });
    }
});


/* LIVE SYNC */

//every GUI (the app window and any remote browser) mirrors the others' unsent edits
//in real time. each one diffs its own state and posts the fields that changed; the
//server keeps the merged state plus a short log of those changes, and every GUI
//pulls whatever the others posted since it last looked. the overlays are untouched,
//they still only change when someone presses UPDATE
const live = {
    //changes on every launch, so a browser left open across a restart knows to start over
    session: String(Date.now()),
    seq: 0,
    state: null,
    log: []
};
const LIVE_LOG_MAX = 500;

app.get('/api/live', (req, res) => {
    const since = Number(req.query.since);
    const oldest = live.log.length ? live.log[0].seq : live.seq + 1;
    const fresh = req.query.session !== live.session || !Number.isFinite(since)
        || since > live.seq || since < oldest - 1;
    if (fresh) {
        return res.json({ session: live.session, seq: live.seq, state: live.state, resync: true });
    }
    res.json({ session: live.session, seq: live.seq, entries: live.log.filter(e => e.seq > since) });
});

app.post('/api/live', (req, res) => {
    const { origin, changes, seed } = req.body || {};

    //the first GUI to connect sets the starting state; everyone after takes it
    if (seed && typeof seed == "object") {
        const accepted = live.state === null;
        if (accepted) live.state = seed;
        return res.json({ session: live.session, seq: live.seq, state: live.state, accepted });
    }

    if (!Array.isArray(changes) || !changes.length) return res.json({ session: live.session, seq: live.seq });
    if (live.state === null) live.state = {};
    for (const [key, value] of changes) {
        if (typeof key != "string") continue;
        live.state[key] = value;
    }
    live.seq++;
    live.log.push({ seq: live.seq, origin: String(origin || ""), changes });
    if (live.log.length > LIVE_LOG_MAX) live.log.shift();
    res.json({ session: live.session, seq: live.seq });
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
