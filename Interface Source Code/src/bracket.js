//top 8 bracket editor. the server owns the bracket and writes Resources/Texts/Bracket.json
//for the Bracket.html overlay; this page edits it one slot at a time, so an edit here, an
//edit on another device and an import from a bracket site never overwrite each other

const bracketEditor = (() => {

    const DEFAULT_COLORS = { round: "#48bf91", text: "#ffffff", score: "#000000" };
    const MAX_PRESETS = 12;
    //how long to wait after the last edit before pushing it out to the overlay
    const EDIT_DELAY = 700;

    let state = null;          //{version, rounds, colors, colorPresets, autoImport}
    let round = "WinnersSemis";
    let importName = "start.gg";
    //slots edited here that the server hasn't got yet, as "round:index"
    const dirty = new Set();
    const inFlight = new Set();
    let sendTimer = null;
    let colorTimer = null;
    let colorsPending = false;
    let reloading = false;
    let slotEls = [];

    const roundSelect = document.getElementById('bracketRoundSelect');
    const encountersEl = document.getElementById('bracketEncounters');
    const importBtn = document.getElementById('bracketImport');
    const autoSelect = document.getElementById('bracketAutoSelect');
    const presetListEl = document.getElementById('bracketPresetList');
    const colorTypes = ["round", "text", "score"];
    const swatches = {}, hexInputs = {};
    for (const type of colorTypes) {
        swatches[type] = document.querySelector(`.bColorInput[data-type="${type}"]`);
        hexInputs[type] = document.querySelector(`.bHexInput[data-type="${type}"]`);
    }

    async function init() {

        document.getElementById('bracketGoBack').addEventListener('click', goBack);
        document.getElementById('bracketUpdate').addEventListener('click', update);
        document.getElementById('bracketPresetsButt').addEventListener('click', () => openPresetPanel("bracket"));
        importBtn.addEventListener('click', importFromSite);
        roundSelect.addEventListener('change', () => {
            round = roundSelect.value;
            renderRound();
        });
        autoSelect.addEventListener('change', () => postSettings({ autoImport: Number(autoSelect.value) }));

        for (const type of colorTypes) {
            //the swatch opens our own color wheel; while it's being dragged the new color
            //goes out at a sane rate
            swatches[type].addEventListener('click', () => {
                colorPicker.open(swatches[type], state.colors[type], (hex) => setColor(type, hex));
            });
            //the hex box is the same color, just typed out
            hexInputs[type].addEventListener('input', () => {
                const hex = readHex(hexInputs[type].value);
                if (hex) setColor(type, hex, false);
            });
            hexInputs[type].addEventListener('change', () => {
                //half typed codes are normal, only put the box back once they're done
                hexInputs[type].value = state.colors[type];
            });
        }
        for (const pickBtn of document.querySelectorAll('.bColorPick')) {
            //browsers without an eyedropper of their own don't get a button
            if (!isElectron && !window.EyeDropper) {
                pickBtn.style.display = "none";
                continue;
            }
            pickBtn.addEventListener('click', () => pickFromScreen(pickBtn.dataset.type, pickBtn));
        }
        document.getElementById('bracketColorReset').addEventListener('click', () => {
            for (const type of colorTypes) setColor(type, DEFAULT_COLORS[type], false);
        });
        document.getElementById('bracketPresetSave').addEventListener('click', addColorPreset);

        try {
            state = await fetch(API_BASE + '/api/bracket').then(r => r.json());
        } catch {
            return;
        }
        drawSettings();
        renderRound();

    }

    /* SLOTS */

    function slotData(i) {
        return state.rounds[round][i];
    }

    function iconSrc(slot) {
        if (!slot.character || slot.character == "None") return "";
        return charPath + '/Stock Icons/' + slot.character + '/' + (slot.skin || "1") + '.png';
    }

    //builds the current round's encounters, two slots to a pair
    function renderRound() {

        encountersEl.innerHTML = '';
        slotEls = [];
        if (!state) return;

        const slots = state.rounds[round];
        for (let i = 0; i < slots.length; i += 2) {

            const group = document.createElement('div');
            group.className = "bEncounterGroup";
            const pair = document.createElement('div');
            pair.className = "bEncounterPair";

            for (let j = i; j < i + 2; j++) pair.appendChild(makeSlotRow(j));
            group.appendChild(pair);

            const copyBtn = document.createElement('button');
            copyBtn.className = "bCopyGameButt";
            copyBtn.title = "Copy Player 1 and Player 2 (names, tags, scores, characters) from the scoreboard";
            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z"/></svg>`;
            copyBtn.addEventListener('click', () => copyFromGame(i));
            group.appendChild(copyBtn);

            encountersEl.appendChild(group);

        }

        refreshSlots();
        fitToViewport();

    }

    function makeSlotRow(i) {

        const row = document.createElement('div');
        row.className = "bEncounter";

        const charBtn = document.createElement('div');
        charBtn.className = "bCharBtn";
        charBtn.title = "Pick this player's character";
        const charImg = document.createElement('img');
        charBtn.appendChild(charImg);
        charBtn.addEventListener('click', () => openCharsForBracket(i));

        const input = (cls, placeholder) => {
            const inp = document.createElement('input');
            inp.type = "text";
            inp.className = `${cls} bInput textInput mousetrap`;
            inp.placeholder = placeholder;
            inp.spellcheck = false;
            inp.addEventListener('input', () => {
                readSlotInputs(i);
                markDirty(i);
            });
            return inp;
        };
        const tagInp = input("bTagInp", "Tag");
        const nameInp = input("bNameInp", "Player Name");
        const scoreInp = input("bScoreInp", "Score");

        row.append(charBtn, tagInp, nameInp, scoreInp);
        slotEls[i] = { charBtn, charImg, tagInp, nameInp, scoreInp };
        return row;

    }

    //"-" is how the overlay spells an empty seat, but it reads as a typo in a text box
    const shown = (value) => value == "-" ? "" : value;

    //puts the current round's data on screen, leaving alone whatever is being typed in
    function refreshSlots() {
        slotEls.forEach((els, i) => {
            const slot = slotData(i);
            for (const [inp, value] of [[els.tagInp, slot.tag], [els.nameInp, shown(slot.name)], [els.scoreInp, shown(slot.score)]]) {
                if (document.activeElement !== inp && inp.value !== value) inp.value = value;
            }
            const src = iconSrc(slot);
            els.charBtn.classList.toggle('empty', !src);
            if (src) {
                if (els.charImg.getAttribute('src') !== src) els.charImg.setAttribute('src', src);
                els.charBtn.title = `${slot.character} (skin ${slot.skin}) — click to change`;
            } else {
                els.charImg.removeAttribute('src');
                els.charBtn.title = "Pick this player's character";
            }
        });
    }

    function readSlotInputs(i) {
        const els = slotEls[i];
        const slot = slotData(i);
        slot.tag = els.tagInp.value;
        slot.name = els.nameInp.value.trim() ? els.nameInp.value : "-";
        slot.score = els.scoreInp.value.trim() ? els.scoreInp.value : "-";
    }

    function markDirty(i, targetRound = round) {
        dirty.add(`${targetRound}:${i}`);
        clearTimeout(sendTimer);
        sendTimer = setTimeout(flush, EDIT_DELAY);
    }

    //sends every edited slot right away
    async function flush() {
        clearTimeout(sendTimer);
        if (!dirty.size || !state) return;

        const keys = [...dirty];
        dirty.clear();
        keys.forEach(k => inFlight.add(k));
        const slots = keys.map(k => {
            const [r, i] = k.split(':');
            return { round: r, index: Number(i), data: state.rounds[r][Number(i)] };
        });

        try {
            const res = await fetch(API_BASE + '/api/bracket/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slots })
            });
            if (!res.ok) throw new Error();
        } catch {
            //try again shortly, unless it got edited again in the meantime anyway
            keys.forEach(k => dirty.add(k));
            sendTimer = setTimeout(flush, EDIT_DELAY);
        } finally {
            keys.forEach(k => inFlight.delete(k));
        }
    }

    //the update button: whatever is pending goes out now
    async function update() {
        //a box being typed in still holds the latest text
        slotEls.forEach((els, i) => {
            if ([els.tagInp, els.nameInp, els.scoreInp].includes(document.activeElement)) {
                readSlotInputs(i);
                markDirty(i);
            }
        });
        await flush();
        showToast("Bracket has been updated", 1000);
    }

    function setSlot(i, data) {
        Object.assign(slotData(i), data);
        markDirty(i);
        refreshSlots();
    }

    /** Gives a slot of the current round a character, from the roster */
    function setSlotCharacter(i, character, skin) {
        setSlot(i, { character, skin: skin || "1" });
    }

    //the scoreboard's Random is "nobody picked yet", which a bracket shows as no icon
    const bracketChar = (char) => (!char || char == "Random") ? "None" : char;

    //pastes Player 1 and Player 2 into the pair starting at slot i
    function copyFromGame(i) {
        const game = [
            { name: p1NameInp.value, tag: p1TagInp.value, score: p1NScoreInp.value, char: charP1, skin: skinP1 },
            { name: p2NameInp.value, tag: p2TagInp.value, score: p2NScoreInp.value, char: charP2, skin: skinP2 }
        ];
        game.forEach((p, j) => {
            Object.assign(slotData(i + j), {
                name: p.name.trim() || "-",
                tag: p.tag,
                score: String(p.score ?? "").trim() || "-",
                character: bracketChar(p.char),
                skin: p.skin || "1"
            });
            markDirty(i + j);
        });
        refreshSlots();
    }

    /** Drops a player preset into one of the current round's slots */
    function applyPreset(i, preset) {
        if (!slotData(i)) return;
        //whatever the loaded tournament says wins over what the preset remembers
        const imported = importData[preset.name.toLowerCase()];
        setSlot(i, {
            name: preset.name,
            tag: imported?.tag || preset.tag || "",
            character: bracketChar(preset.character),
            skin: preset.skin || "1"
        });
    }

    /* SERVER */

    /** Called by the GUI's poll with the server's bracket version */
    async function onServerVersion(version) {
        if (!state || version === state.version || reloading) return;
        reloading = true;
        try {
            const data = await fetch(API_BASE + '/api/bracket').then(r => r.json());
            //anything edited here that the server hasn't got yet stays as it is here
            for (const r in data.rounds) {
                data.rounds[r].forEach((slot, i) => {
                    const key = `${r}:${i}`;
                    if (dirty.has(key) || inFlight.has(key)) data.rounds[r][i] = state.rounds[r][i];
                });
            }
            if (colorsPending) data.colors = state.colors;
            state = data;
            drawSettings();
            refreshSlots();
        } catch {
        } finally {
            reloading = false;
        }
    }

    async function postSettings(body) {
        try {
            const res = await fetch(API_BASE + '/api/bracket/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            //keep our rounds, only the settings came back changed
            data.rounds = state.rounds;
            state = data;
            if (!colorsPending) drawSettings();
        } catch {}
    }

    async function importFromSite() {
        importBtn.disabled = true;
        showToast(`Importing top 8 from ${importName}...`, 1500);
        //edits made here go first, the import then decides what's in each slot
        await flush();
        try {
            const res = await fetch(API_BASE + '/api/bracket/import', { method: 'POST' });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);
            showToast(`Imported ${result.setsFound} sets from "${result.phaseName}"`, 2500);
            await onServerVersion(result.version);
        } catch (e) {
            showToast(`${importName} import failed: ${e.message}`, 4000);
        } finally {
            importBtn.disabled = false;
        }
    }

    function setImportName(name) {
        importName = name;
        document.getElementById('bracketImportText').textContent = `Import from ${name}`;
    }

    /* COLORS */

    //turns whatever was typed into a #rrggbb color, or "" if it isn't one
    function readHex(value) {
        const hex = String(value ?? "").trim().replace(/^#/, "");
        if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return "";
        const full = hex.length == 3 ? [...hex].map(d => d + d).join("") : hex;
        return `#${full.toLowerCase()}`;
    }

    function drawSettings() {
        for (const type of colorTypes) {
            swatches[type].style.backgroundColor = state.colors[type];
            if (document.activeElement !== hexInputs[type]) hexInputs[type].value = state.colors[type];
        }
        autoSelect.value = String(state.autoImport);
        drawColorPresets();
    }

    /**
     * Changes one of the overlay's colors, pushing it out once it stops moving
     * @param {Boolean} updateHexBox - Also rewrite the hex box, false while it's being typed in
     */
    function setColor(type, hex, updateHexBox = true) {
        state.colors[type] = hex;
        swatches[type].style.backgroundColor = hex;
        if (updateHexBox || document.activeElement !== hexInputs[type]) hexInputs[type].value = hex;
        //the wheel fires on every pointer move, so don't flood the server
        colorsPending = true;
        clearTimeout(colorTimer);
        colorTimer = setTimeout(async () => {
            await postSettings({ colors: state.colors });
            colorsPending = false;
        }, 100);
    }

    //grabs a color from anywhere on screen, outside this app included
    async function pickFromScreen(type, btn) {
        let hex;
        if (isElectron) {
            //chromium's own eyedropper can't see past this window, so the main process
            //lays a window over every monitor and reads the color off that instead
            btn.classList.add('bColorPickBusy');
            try {
                hex = await ipcRenderer.invoke('pick-screen-color');
            } finally {
                btn.classList.remove('bColorPickBusy');
            }
        } else if (window.EyeDropper) {
            //remote GUIs run in a real browser, which does have a proper one
            try {
                hex = (await new window.EyeDropper().open()).sRGBHex;
            } catch { return; } //they hit escape
        }
        hex = readHex(hex);
        if (hex) setColor(type, hex);
    }

    function drawColorPresets() {
        presetListEl.innerHTML = '';
        const presets = state.colorPresets || [];
        if (!presets.length) {
            const empty = document.createElement('span');
            empty.id = "bracketPresetEmpty";
            empty.textContent = "None saved yet";
            presetListEl.appendChild(empty);
        }
        presets.forEach((preset, i) => {
            const wrap = document.createElement('div');
            wrap.className = "bPresetWrap";

            const swatch = document.createElement('button');
            swatch.className = "bPreset";
            //each color gets its own stripe so the whole preset is visible at once
            swatch.style.background = `linear-gradient(${preset.round} 0% 34%, ` +
                `${preset.text} 34% 67%, ${preset.score} 67% 100%)`;
            swatch.title = `Round ${preset.round}\nPlayers ${preset.text}\nScore ${preset.score}`;
            swatch.addEventListener('click', () => {
                for (const type of colorTypes) setColor(type, preset[type]);
            });

            const del = document.createElement('span');
            del.className = "bPresetDel";
            del.textContent = "×";
            del.title = "Delete this color preset";
            del.addEventListener('click', () => {
                state.colorPresets.splice(i, 1);
                drawColorPresets();
                postSettings({ colorPresets: state.colorPresets });
            });

            wrap.append(swatch, del);
            presetListEl.appendChild(wrap);
        });
    }

    function addColorPreset() {
        const presets = state.colorPresets || (state.colorPresets = []);
        const c = state.colors;
        //no point in having the same three colors twice
        if (presets.some(p => p.round == c.round && p.text == c.text && p.score == c.score)) {
            return showToast("These colors are already a preset", 1500);
        }
        if (presets.length >= MAX_PRESETS) {
            return showToast(`Only ${MAX_PRESETS} color presets can be saved`, 1500);
        }
        presets.push({ ...c });
        drawColorPresets();
        postSettings({ colorPresets: presets });
        showToast("Color preset saved", 1000);
    }

    function getSlotCount() {
        return state ? state.rounds[round].length : 0;
    }

    function getRoundName() {
        return roundSelect.options[roundSelect.selectedIndex]?.textContent || "";
    }

    return {
        init, update, flush, onServerVersion, setImportName,
        setSlotCharacter, applyPreset, getSlotCount, getRoundName
    };

})();
