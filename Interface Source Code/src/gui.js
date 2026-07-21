const isElectron = typeof require !== 'undefined';
let fs, path, os, baseDir, ipcRenderer;

if (isElectron) {
    fs = require('fs');
    path = require('path');
    os = require('os');
    ({ ipcRenderer } = require('electron'));

    const isDev = process.execPath.includes('node_modules');
    if (isDev) {
        baseDir = path.resolve(__dirname, '..', '..', 'Stream Tool');
    } else if (process.env.PORTABLE_EXECUTABLE_DIR) {
        baseDir = process.env.PORTABLE_EXECUTABLE_DIR;
    } else {
        baseDir = path.dirname(process.execPath);
    }
    console.log("Electron mode. Base Dir:", baseDir);
} else {
    // browser mode
    baseDir = "";
    console.log("Browser mode.");
}

let mainPath, charPath;

if (isElectron) {
    mainPath = path.resolve(baseDir, 'Resources', 'Texts');
    charPath = path.resolve(baseDir, 'Resources', 'Characters');
} else {
    mainPath = "/Resources/Texts";
    charPath = "/Resources/Characters";
}

window.onload = init;

//yes we all like global variables
let charP1 = "Random";
let charP2 = "Random";
let skinP1 = "";
let skinP2 = "";
let colorP1, colorP2;
let currentP1WL = "Nada";
let currentP2WL = "Nada";
let currentBestOf = "Bo3";
let currentMatchType = "singles";

//doubles teammates (the second player of each side)
let charP1Teammate = "Random";
let charP2Teammate = "Random";
let skinP1Teammate = "";
let skinP2Teammate = "";

let movedSettings = false;
let presetPanelOpen = false;
//which character slot the roster will write to: "1", "2", "1Teammate" or "2Teammate"
let charTarget = "1";
let playerPresets = [];
let startGGData = {};
let countryCodes = null;


const viewport = document.getElementById('viewport');

const p1NameInp = document.getElementById('p1Name');
const p1TagInp = document.getElementById('p1Tag');
const p1PronInp = document.getElementById('p1Pron');
const p1NScoreInp = document.getElementById('p1NScore');
const p2NameInp = document.getElementById('p2Name');
const p2TagInp = document.getElementById('p2Tag');
const p2PronInp = document.getElementById('p2Pron');
const p2NScoreInp = document.getElementById('p2NScore');
const charImgP1 = document.getElementById('p1CharImg');
const charImgP2 = document.getElementById('p2CharImg');

const p1W = document.getElementById('p1W');
const p1L = document.getElementById('p1L');
const p2W = document.getElementById('p2W');
const p2L = document.getElementById('p2L');

const p1SeedInp    = document.getElementById('p1Seed');
const p1CountryInp = document.getElementById('p1Country');
const p1FlagImg    = document.getElementById('p1Flag');
const p2SeedInp    = document.getElementById('p2Seed');
const p2CountryInp = document.getElementById('p2Country');
const p2FlagImg    = document.getElementById('p2Flag');

const p1TeammateInp = document.getElementById('p1TeammateName');
const p2TeammateInp = document.getElementById('p2TeammateName');
const p1TeammateTagInp     = document.getElementById('p1TeammateTag');
const p2TeammateTagInp     = document.getElementById('p2TeammateTag');
const p1TeammatePronInp    = document.getElementById('p1TeammatePron');
const p2TeammatePronInp    = document.getElementById('p2TeammatePron');
const p1TeammateSeedInp    = document.getElementById('p1TeammateSeed');
const p2TeammateSeedInp    = document.getElementById('p2TeammateSeed');
const p1TeammateCountryInp = document.getElementById('p1TeammateCountry');
const p2TeammateCountryInp = document.getElementById('p2TeammateCountry');
const p1TeammateFlagImg    = document.getElementById('p1TeammateFlag');
const p2TeammateFlagImg    = document.getElementById('p2TeammateFlag');
const teamName1Inp  = document.getElementById('teamName1');
const teamName2Inp  = document.getElementById('teamName2');
const crewStocks1Inp = document.getElementById('crewStocks1');
const crewStocks2Inp = document.getElementById('crewStocks2');

const roundInp = document.getElementById('roundName');
const roundSelect = document.getElementById('roundSelect');
const boSelect    = document.getElementById('boSelect');
const matchTypeSelect = document.getElementById('matchTypeSelect');
const roundNumberInp = document.getElementById('roundNumber');
const useCustomRound = document.getElementById('useCustomRound');
const formatInp = document.getElementById('format');

const forceWL = document.getElementById('forceWLToggle');

let roundNames = [];

//extra window height needed by the team name bar (crew), and by the full
//teammate block on top of it (doubles). must track the #playerRegion heights in the css
const TEAM_ROW_HEIGHT = 33;
const DOUBLES_EXTRA_HEIGHT = 115;

let casterCount = 0;

const MIC_SVG = `<svg viewBox="0 0 261.075 261.075" xmlns="http://www.w3.org/2000/svg"><path d="M126.855,174.05h5.744c22.447,0,40.641-18.194,40.641-40.641V40.641C173.24,18.194,155.046,0,132.599,0h-5.744c-22.447,0-40.641,18.194-40.641,40.641v92.769C86.215,155.856,104.408,174.05,126.855,174.05z"/><path d="M124.288,201.147v43.61H86.215c-4.504,0-8.159,3.65-8.159,8.159s3.655,8.159,8.159,8.159h92.464c4.504,0,8.159-3.65,8.159-8.159s-3.655-8.159-8.159-8.159h-38.073v-43.823c34.832-3.138,63.262-34.44,63.262-71.208c0-4.509-3.655-8.159-8.159-8.159s-8.159,3.65-8.159,8.159c0,29.92-24.122,55.201-52.672,55.201h-8.686c-28.544,0-52.666-24.699-52.666-53.939c0-4.509-3.655-8.159-8.159-8.159s-8.159,3.65-8.159,8.159C57.208,169.073,87.134,200.109,124.288,201.147z"/></svg>`;
const TWITTER_SVG = `<svg class="casterIcon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M18.258,3.266c-0.693,0.405-1.46,0.698-2.277,0.857c-0.653-0.686-1.586-1.115-2.618-1.115c-1.98,0-3.586,1.581-3.586,3.53c0,0.276,0.031,0.545,0.092,0.805C6.888,7.195,4.245,5.79,2.476,3.654C2.167,4.176,1.99,4.781,1.99,5.429c0,1.224,0.633,2.305,1.596,2.938C2.999,8.349,2.445,8.19,1.961,7.925C1.96,7.94,1.96,7.954,1.96,7.97c0,1.71,1.237,3.138,2.877,3.462c-0.301,0.08-0.617,0.123-0.945,0.123c-0.23,0-0.456-0.021-0.674-0.062c0.456,1.402,1.781,2.422,3.35,2.451c-1.228,0.947-2.773,1.512-4.454,1.512c-0.291,0-0.575-0.016-0.855-0.049c1.588,1,3.473,1.586,5.498,1.586c6.598,0,10.205-5.379,10.205-10.045c0-0.153-0.003-0.305-0.01-0.456c0.7-0.499,1.308-1.12,1.789-1.827c-0.644,0.28-1.334,0.469-2.06,0.555C17.422,4.782,17.99,4.091,18.258,3.266"/></svg>`;
const TWITCH_SVG = `<svg class="casterIcon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m.975 4.175v16.694h5.749v3.131h3.139l3.134-3.132h4.705l6.274-6.258v-14.61h-21.434zm3.658-2.09h17.252v11.479l-3.66 3.652h-5.751l-3.134 3.127v-3.127h-4.707z"/><path d="m10.385 6.262h2.09v6.26h-2.09z"/><path d="m16.133 6.262h2.091v6.26h-2.091z"/></svg>`;

let activeCasterN = null;

function openSocialModal(n) {
    activeCasterN = n;
    document.getElementById('casterSocialTitle').textContent = 'Caster ' + n + ' Socials';
    document.getElementById('modalTwitter').value = document.getElementById('cTwitter' + n).value;
    document.getElementById('modalTwitch').value  = document.getElementById('cTwitch' + n).value;
    document.getElementById('casterSocialModal').classList.add('open');
    document.getElementById('modalTwitter').focus();
    document.querySelectorAll('.casterMicBtn').forEach(b => b.classList.remove('active'));
    const row = document.querySelector(`.caster[data-n="${n}"]`);
    if (row) row.querySelector('.casterMicBtn').classList.add('active');
}

function closeSocialModal() {
    if (activeCasterN !== null) {
        document.getElementById('cTwitter' + activeCasterN).value = document.getElementById('modalTwitter').value;
        document.getElementById('cTwitch'  + activeCasterN).value = document.getElementById('modalTwitch').value;
        const row = document.querySelector(`.caster[data-n="${activeCasterN}"]`);
        if (row) row.querySelector('.casterMicBtn').classList.remove('active');
        activeCasterN = null;
    }
    document.getElementById('casterSocialModal').classList.remove('open');
}

function createCasterRow(n) {
    const casterInfo = document.getElementById('casterInfo');
    const addBtn = document.getElementById('addCasterBtn');

    const row = document.createElement('div');
    row.className = 'caster';
    row.dataset.n = n;

    const micBtn = document.createElement('button');
    micBtn.className = 'casterMicBtn mousetrap';
    micBtn.title = 'Edit socials';
    micBtn.innerHTML = MIC_SVG;
    micBtn.addEventListener('click', () => openSocialModal(n));

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = 'cName' + n;
    nameInput.className = 'cName textInput mousetrap';
    nameInput.placeholder = 'Caster ' + n + ' name';
    nameInput.spellcheck = false;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'casterRemoveBtn';
    removeBtn.title = 'Remove caster';
    removeBtn.textContent = '−';
    removeBtn.addEventListener('click', () => {
        if (activeCasterN === n) closeSocialModal();
        row.remove();
        fitToViewport();
    });

    // Hidden inputs hold twitter/twitch data; modal reads/writes these
    const hiddenTwitter = document.createElement('input');
    hiddenTwitter.type = 'text';
    hiddenTwitter.id = 'cTwitter' + n;
    hiddenTwitter.style.display = 'none';

    const hiddenTwitch = document.createElement('input');
    hiddenTwitch.type = 'text';
    hiddenTwitch.id = 'cTwitch' + n;
    hiddenTwitch.style.display = 'none';

    row.appendChild(micBtn);
    row.appendChild(nameInput);
    row.appendChild(removeBtn);
    row.appendChild(hiddenTwitter);
    row.appendChild(hiddenTwitch);

    casterInfo.insertBefore(row, addBtn);
    casterCount = Math.max(casterCount, n);
}

async function init() {

    //first, add listeners for the bottom bar buttons
    document.getElementById('updateRegion').addEventListener("click", writeScoreboard);
    document.getElementById('settingsRegion').addEventListener("click", moveViewport);
    document.getElementById('closeSettings').addEventListener("click", goBack);

    createCasterRow(1);
    createCasterRow(2);
    document.getElementById('addCasterBtn').addEventListener('click', () => { createCasterRow(casterCount + 1); fitToViewport(); });
    document.getElementById('casterSocialClose').addEventListener('click', closeSocialModal);
    document.getElementById('casterSocialBackdrop').addEventListener('click', closeSocialModal);
    document.getElementById('casterSocialUpdate').addEventListener('click', () => { closeSocialModal(); writeScoreboard(); });
    document.getElementById('casterSocialModal').addEventListener('keydown', e => {
        if (e.key === 'Escape') closeSocialModal();
        if (e.key === 'Enter') { closeSocialModal(); writeScoreboard(); }
    });

    //if the viewport is moved, click anywhere on the center to go back
    document.getElementById('goBack').addEventListener("click", goBack);

    //move the viewport to the center (this is to avoid animation bugs)
    viewport.style.right = "100%";


    /* OVERLAY */

    //load color slot list
    await loadColors(1);
    await loadColors(2);

    //set initial values for the character selectors
    if (isElectron) {
        document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
        document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    } else {
        document.getElementById('p1CharSelector').setAttribute('src', '/Resources/Characters/CSS/Random.png');
        document.getElementById('p2CharSelector').setAttribute('src', '/Resources/Characters/CSS/Random.png');
    }
    document.getElementById('p1TeammateCharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    document.getElementById('p2TeammateCharSelector').setAttribute('src', charPath + '/CSS/Random.png');

    //if clicking them, show the character roster
    document.getElementById('p1CharSelector').addEventListener("click", openChars);
    document.getElementById('p2CharSelector').addEventListener("click", openChars);
    document.getElementById('p1TeammateCharSelector').addEventListener("click", openChars);
    document.getElementById('p2TeammateCharSelector').addEventListener("click", openChars);

    //create the character roster
    createCharRoster();
    //if clicking the entirety of the char roster div, hide it
    document.getElementById('charRoster').addEventListener("click", hideChars);

    const searchInput = document.getElementById('charSearchInput');
    searchInput.addEventListener("click", (e) => e.stopPropagation());
    searchInput.addEventListener("input", filterChars);
    searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            hideChars();
        }
    });

    //check whenever an image isnt found so we replace it with a "?"
    document.getElementById('p1CharImg').addEventListener("error", () => {
        if (isElectron) {
            document.getElementById('p1CharImg').setAttribute('src', charPath + '/Renders/Random.webp');
        } else {
            document.getElementById('p1CharImg').setAttribute('src', '/Resources/Characters/Renders/Random.webp');
        }
    });
    document.getElementById('p2CharImg').addEventListener("error", () => {
        if (isElectron) {
            document.getElementById('p2CharImg').setAttribute('src', charPath + '/Renders/Random.webp');
        } else {
            document.getElementById('p2CharImg').setAttribute('src', '/Resources/Characters/Renders/Random.webp');
        }
    });


    await loadCountryCodes();
    await loadSavedData();

    //set click listeners for the [W] and [L] buttons
    p1W.addEventListener("click", setWLP1);
    p1L.addEventListener("click", setWLP1);
    p2W.addEventListener("click", setWLP2);
    p2L.addEventListener("click", setWLP2);


    //check whenever the player's name has a skin
    p1NameInp.addEventListener("input", resizeInput);
    p2NameInp.addEventListener("input", resizeInput);

    //reset score, tag, and pronouns when name changes
    p1NameInp.addEventListener("change", () => {
        p1NScoreInp.value = "0";
        changeInputWidth(p1NScoreInp);
        applyStartGGToPlayer(p1NameInp.value, p1SeedInp, p1CountryInp, p1TagInp, p1PronInp, p1FlagImg);
    });
    p2NameInp.addEventListener("change", () => {
        p2NScoreInp.value = "0";
        changeInputWidth(p2NScoreInp);
        applyStartGGToPlayer(p2NameInp.value, p2SeedInp, p2CountryInp, p2TagInp, p2PronInp, p2FlagImg);
    });

    //preset save buttons
    document.getElementById('savePresetP1').addEventListener('pointerdown', () => savePreset(1));
    document.getElementById('savePresetP2').addEventListener('pointerdown', () => savePreset(2));
    document.getElementById('savePresetP1Teammate').addEventListener('pointerdown', () => savePreset(1, true));
    document.getElementById('savePresetP2Teammate').addEventListener('pointerdown', () => savePreset(2, true));

    //the teammate boxes behave like the main player ones
    for (const inp of [p1TeammateInp, p2TeammateInp, p1TeammateTagInp, p2TeammateTagInp,
                       p1TeammatePronInp, p2TeammatePronInp]) {
        inp.addEventListener("input", resizeInput);
    }
    p1TeammateCountryInp.addEventListener('input', () => updateFlagPreview(p1TeammateCountryInp.value, p1TeammateFlagImg));
    p2TeammateCountryInp.addEventListener('input', () => updateFlagPreview(p2TeammateCountryInp.value, p2TeammateFlagImg));

    //crew battle stock +/- buttons
    document.getElementById('p1StockPlus').addEventListener('click', () => {
        crewStocks1Inp.value = Number(crewStocks1Inp.value) + 1;
    });
    document.getElementById('p1StockMinus').addEventListener('click', () => {
        crewStocks1Inp.value = Math.max(0, Number(crewStocks1Inp.value) - 1);
    });
    document.getElementById('p2StockPlus').addEventListener('click', () => {
        crewStocks2Inp.value = Number(crewStocks2Inp.value) + 1;
    });
    document.getElementById('p2StockMinus').addEventListener('click', () => {
        crewStocks2Inp.value = Math.max(0, Number(crewStocks2Inp.value) - 1);
    });

    //mobile score +/- buttons
    document.getElementById('p1ScorePlus').addEventListener('click', () => {
        p1NScoreInp.value = Number(p1NScoreInp.value) + 1;
    });
    document.getElementById('p1ScoreMinus').addEventListener('click', () => {
        p1NScoreInp.value = Math.max(0, Number(p1NScoreInp.value) - 1);
    });
    document.getElementById('p2ScorePlus').addEventListener('click', () => {
        p2NScoreInp.value = Number(p2NScoreInp.value) + 1;
    });
    document.getElementById('p2ScoreMinus').addEventListener('click', () => {
        p2NScoreInp.value = Math.max(0, Number(p2NScoreInp.value) - 1);
    });

    //preset panel
    document.getElementById('presetsRegion').addEventListener('click', openPresetPanel);
    document.getElementById('closePresetPanel').addEventListener('click', closePresetPanel);
    document.getElementById('closePresetPanelBottom').addEventListener('click', closePresetPanel);
    document.getElementById('clearPresetSearch').addEventListener('click', clearPresetSearch);
    document.getElementById('presetSearchInp').addEventListener('input', (e) => renderPresetList(e.target.value));
    //mousetrap ignores keys typed inside the search box, so catch escape here too
    document.getElementById('presetPanel').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            closePresetPanel();
        }
    });

    await loadPresets();

    //resize the box whenever the user types
    p1TagInp.addEventListener("input", resizeInput);
    p2TagInp.addEventListener("input", resizeInput);

    p1PronInp.addEventListener("input", resizeInput);
    p2PronInp.addEventListener("input", resizeInput);

    p1NScoreInp.addEventListener("input", resizeInput);
    p2NScoreInp.addEventListener("input", resizeInput);

    fetch(API_BASE + '/api/json/BestOfModes')
        .then(r => r.json())
        .then(data => {
            data.forEach(entry => {
                const opt = document.createElement('option');
                opt.value = entry.value;
                opt.textContent = entry.name;
                boSelect.appendChild(opt);
            });
            boSelect.value = currentBestOf;
        });

    fetch(API_BASE + '/api/json/MatchTypes')
        .then(r => r.json())
        .then(data => {
            data.forEach(entry => {
                const opt = document.createElement('option');
                opt.value = entry.value;
                opt.textContent = entry.name;
                matchTypeSelect.appendChild(opt);
            });
            matchTypeSelect.value = currentMatchType;
        });

    matchTypeSelect.addEventListener('change', () => {
        if (currentMatchType === "wl") { //leaving wins/losses, drop the placeholder names
            p1NameInp.value = "";
            p2NameInp.value = "";
            changeInputWidth(p1NameInp);
            changeInputWidth(p2NameInp);
        }
        //"Crew Battle" only reads right in crew, so it leaves with the mode — but only when it
        //is still the one set below, never a round picked deliberately since
        const dropCrewRound = currentMatchType === "crew"
            && matchTypeSelect.value !== "crew"
            && roundSelect.value === "Crew Battle";
        currentMatchType = matchTypeSelect.value;
        //a different match type is a different match, so no score carries into it. this lives
        //on the dropdown rather than in applyMatchType() because that also runs on every load,
        //where the scores have just been read off the server and must not be thrown away
        p1NScoreInp.value = "0";
        p2NScoreInp.value = "0";
        changeInputWidth(p1NScoreInp);
        changeInputWidth(p2NScoreInp);
        //the crew counters are the score in crew battles, so they go back with the rest
        crewStocks1Inp.value = "0";
        crewStocks2Inp.value = "0";
        applyMatchType();
        //a crew battle isn't a bracket round, so it names itself. set after applyMatchType(),
        //which is where leaving wins/losses puts the round back to Winners Round 1
        if (currentMatchType === "crew") {
            roundSelect.value = "Crew Battle";
            updateRoundNumberVisibility();
            checkRound();
        } else if (dropCrewRound) {
            roundSelect.value = "Winners Round";
            roundNumberInp.value = "1";
            updateRoundNumberVisibility();
            checkRound();
        }
    });

    boSelect.addEventListener('change', () => {
        if (currentBestOf === "WL") {
            p1NameInp.value = "";
            p2NameInp.value = "";
            changeInputWidth(p1NameInp);
            changeInputWidth(p2NameInp);
        }
        currentBestOf = boSelect.value;
        applyWLMode();
    });


    //check if the round is grand finals
    roundInp.addEventListener("input", checkRound);

    // useCustomRound setting
    const savedCustomRound = localStorage.getItem('useCustomRound');
    if (savedCustomRound !== null) useCustomRound.checked = savedCustomRound === 'true';
    useCustomRound.addEventListener('change', () => {
        localStorage.setItem('useCustomRound', useCustomRound.checked);
        //coming back to the dropdown, whatever is still selected behind the custom box is stale
        //— and if custom text was reached through the dropdown, it is the "Custom Text" entry
        //itself, which would go out as the round name
        if (!useCustomRound.checked) {
            roundSelect.value = currentMatchType === "crew" ? "Crew Battle" : "Winners Round";
            roundNumberInp.value = "1";
        }
        applyRoundMode();
    });

    // abbreviateRounds setting
    const abbreviateRoundsCheck = document.getElementById('abbreviateRounds');
    const savedAbbreviate = localStorage.getItem('abbreviateRounds');
    if (savedAbbreviate !== null) abbreviateRoundsCheck.checked = savedAbbreviate === 'true';
    abbreviateRoundsCheck.addEventListener('change', () => {
        localStorage.setItem('abbreviateRounds', abbreviateRoundsCheck.checked);
        abbrevWLBox.style.display = abbreviateRoundsCheck.checked ? '' : 'none';
        applyWLMode();
    });

    const abbreviateWLCheck = document.getElementById('abbreviateWL');
    const abbrevWLBox = document.getElementById('abbrevWLBox');
    const savedAbbrevWL = localStorage.getItem('abbreviateWL');
    if (savedAbbrevWL !== null) abbreviateWLCheck.checked = savedAbbrevWL === 'true';
    abbrevWLBox.style.display = abbreviateRoundsCheck.checked ? '' : 'none';
    abbreviateWLCheck.addEventListener('change', () => {
        localStorage.setItem('abbreviateWL', abbreviateWLCheck.checked);
    });
    roundSelect.addEventListener('change', () => {
        const selected = roundNames.find(o => o.name === roundSelect.value);
        if (selected?.customText) {
            useCustomRound.checked = true;
            applyRoundMode();
            showToast("Switched to custom text. Re-enable predefined rounds in Settings.", 3500);
            return;
        }
        updateRoundNumberVisibility();
        checkRound();
    });

    // load predefined round names
    fetch(API_BASE + '/api/json/RoundNames')
        .then(r => r.json())
        .then(data => {
            roundNames = data;
            data.forEach(entry => {
                const opt = document.createElement('option');
                opt.value = entry.name;
                opt.textContent = entry.name;
                roundSelect.appendChild(opt);
            });
            applyRoundMode();
        })
        .catch(() => {
            useCustomRound.checked = true;
            applyRoundMode();
        });


    //add a listener to the swap button
    document.getElementById('swapButton').addEventListener("click", swap);
    //add a listener to the clear button
    document.getElementById('clearButton').addEventListener("click", clearPlayers);


    /* SETTINGS */

    //set a listener for the forceWL check
    forceWL.addEventListener("click", forceWLtoggles);

    const scoreHotkeys = document.getElementById('scoreHotkeysToggle');
    const backwardsHotkeys = document.getElementById('backwardsHotkeysToggle');
    scoreHotkeys.addEventListener('change', () => { if (scoreHotkeys.checked) backwardsHotkeys.checked = false; });
    backwardsHotkeys.addEventListener('change', () => { if (backwardsHotkeys.checked) scoreHotkeys.checked = false; });

    document.getElementById("copyMatch").addEventListener("click", copyMatch);

    const alwaysOnTopCheck = document.getElementById('alwaysOnTop');
    alwaysOnTopCheck.addEventListener('change', () => {
        ipcRenderer.send('set-always-on-top', alwaysOnTopCheck.checked);
    });

    const resizableCheck = document.getElementById('resizableToggle');
    resizableCheck.addEventListener('change', () => {
        ipcRenderer.send('set-resizable', resizableCheck.checked);
    });

    document.getElementById('restoreWindowSize').addEventListener('click', () => {
        ipcRenderer.send('restore-window-size');
    });

    document.getElementById('startggFetch').addEventListener('click', fetchStartGG);
    document.getElementById('rescanPresetsButt').addEventListener('click', rescanPresets);
    p1CountryInp.addEventListener('input', () => updateFlagPreview(p1CountryInp.value, p1FlagImg));
    p2CountryInp.addEventListener('input', () => updateFlagPreview(p2CountryInp.value, p2FlagImg));

    // check if API key is pre-loaded from app.properties.txt
    try {
        const keyStatus = await fetch(API_BASE + '/api/startgg-key').then(r => r.json());
        const tokenInp = document.getElementById('startggToken');
        const tokenStatus = document.getElementById('startggTokenStatus');
        if (keyStatus.fromFile) {
            tokenInp.value = '';
            tokenInp.placeholder = '••••••••••••••••';
            tokenInp.disabled = true;
            tokenStatus.textContent = '✓ Loaded from app.properties.txt';
            tokenStatus.style.color = 'var(--selected)';
        }
    } catch {}

    document.getElementById("openRemote").addEventListener("click", () => {
        const url = `http://localhost:${serverPort}`;
        if (isElectron) {
            require('electron').shell.openExternal(url);
        } else {
            window.open(url, '_blank');
        }
    });

    // document.getElementById("alwaysOnTop").addEventListener("click", alwaysOnTop);



    /* KEYBOARD SHORTCUTS */

    Mousetrap.bind('enter', () => {
        writeScoreboard();
        document.getElementById('botBar').style.backgroundColor = "var(--bg3)";
    }, 'keydown');
    Mousetrap.bind('enter', () => {
        document.getElementById('botBar').style.backgroundColor = "var(--bg5)";
    }, 'keyup');

    Mousetrap.bind('esc', () => {
        if (presetPanelOpen) { //just close the browser, never touch the player data
            closePresetPanel();
        } else if (movedSettings) { //if settings are open, close them
            goBack();
        } else if (document.getElementById('charRoster').style.opacity == 1) {
            hideChars(); //if charRoster is visible, hide it
        } else {
            clearPlayers();
        }
    });

    Mousetrap.bind('f1', () => {
        if (document.getElementById('scoreHotkeysToggle').checked) giveWinP1();
        else if (document.getElementById('backwardsHotkeysToggle').checked) takeWinP1();
    });
    Mousetrap.bind('f2', () => {
        if (document.getElementById('scoreHotkeysToggle').checked) giveWinP2();
        else if (document.getElementById('backwardsHotkeysToggle').checked) takeWinP2();
    });
    Mousetrap.bind('shift+f1', () => {
        if (document.getElementById('scoreHotkeysToggle').checked) takeWinP1();
        else if (document.getElementById('backwardsHotkeysToggle').checked) giveWinP1();
    });
    Mousetrap.bind('shift+f2', () => {
        if (document.getElementById('scoreHotkeysToggle').checked) takeWinP2();
        else if (document.getElementById('backwardsHotkeysToggle').checked) giveWinP2();
    });

    // display IP addresses if in Electron
    if (isElectron) {
        const remoteInfo = document.getElementById('remoteInfo');
        const ipListDisplay = document.getElementById('ipList');
        const interfaces = os.networkInterfaces();
        let addresses = [];

        for (const k in interfaces) {
            for (const k2 in interfaces[k]) {
                const address = interfaces[k][k2];
                // filter for IPv4 and non-internal (not 127.0.0.1)
                if (address.family === 'IPv4' && !address.internal) {
                    addresses.push(`http://${address.address}:${serverPort}`);
                }
            }
        }

        if (addresses.length > 0) {
            remoteInfo.style.display = "block";
            ipListDisplay.innerHTML = addresses.join('<br>');

            // Generate QR Code
            const qrContainer = document.getElementById("qrcode");
            qrContainer.innerHTML = "";
            new QRCode(qrContainer, {
                text: addresses[0],
                width: 64,
                height: 64,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        }
    }

    fitToViewport();
    window.addEventListener("resize", fitToViewport);

    // const numberedScoreOption = document.querySelector("#forceNS");
    // numberedScoreOption.addEventListener("click", () => {
    //     if (numberedScoreOption.checked) {
    //         p1NScoreInp.setAttribute("numbered", "1");
    //         p1NScoreInp.classList.remove("hiddenScoreInput");
    //         p1ScoreTicks.classList.add("hiddenScoreInput");

    //         p2NScoreInp.setAttribute("numbered", "1");
    //         p2NScoreInp.classList.remove("hiddenScoreInput");
    //         p2ScoreTicks.classList.add("hiddenScoreInput");
    //         return;
    //     }
    //     p1NScoreInp.setAttribute("numbered", "0");
    //     p1NScoreInp.classList.add("hiddenScoreInput");
    //     p1ScoreTicks.classList.remove("hiddenScoreInput");

    //     p2NScoreInp.setAttribute("numbered", "0");
    //     p2NScoreInp.classList.add("hiddenScoreInput");
    //     p2ScoreTicks.classList.remove("hiddenScoreInput");
    // })
}


//the whole stylesheet is fixed px, laid out for the 890x340 app window, so on a bigger
//viewport (a browser tab on a laptop, or a resized window) everything is scaled up rather
//than left sitting in the top corner. capped by width so the layout is never squeezed
//narrower than the width it was designed for
const DESIGN_WIDTH = 890;
const MAX_ZOOM = 3;
//matches `body.fillHeight #overlay` padding-top in the stylesheet
const TOP_PAD = 8;
//the renders are mostly transparent margin, which is why the stylesheet blows them up 5x to
//fill the 185px player strip — so the art the layout was drawn around is 925px of character
const ART_HEIGHT = 185 * 5;
const MIN_CHAR_ZOOM = 2.5;
const MAX_CHAR_ZOOM = 5;
//how far the player rows spread apart once the panel has the room for it
const MAX_ROW_GAP = 14;

function fitToViewport() {
    const overlay = document.getElementById('overlay');
    document.body.style.zoom = '';   //always measure the layout at 1:1
    document.body.classList.remove('fillHeight');
    //#overlay is stretched by its flex parent, so the rows are what give the real height
    const naturalHeight = [...overlay.children]
        .reduce((sum, el) => sum + el.offsetHeight, 0);
    //measured with fillHeight off, so this is the height the match type's rows actually need
    const packedPanel = document.getElementById('playerRegion').offsetHeight;
    if (!naturalHeight) return;
    const scale = Math.min(
        window.innerHeight / naturalHeight,
        window.innerWidth / DESIGN_WIDTH,
        MAX_ZOOM
    );
    //below ~1 there is nothing to gain, and mobile has its own stacked layout
    const zoom = scale > 1.01 ? scale : 1;
    if (zoom > 1) document.body.style.zoom = zoom;

    //scaling stops at the width the layout was designed for, so a tall window still has
    //height left over — the top padding takes its cut and the player panels take the rest,
    //whatever the match type needs
    const slack = window.innerHeight / zoom - naturalHeight;
    const filling = slack > 4;
    document.body.classList.toggle('fillHeight', filling);

    //the top gap comes first, but only out of height that actually exists — on a window
    //with a few px to spare it shrinks rather than costing the update row its place
    const pad = filling ? Math.min(TOP_PAD, slack) : 0;
    document.documentElement.style.setProperty('--overlayTopPad', pad + 'px');

    //.charImg is height:100% of the panel before the zoom is applied, so a fixed zoom draws
    //the art bigger in the modes with taller panels — that is why doubles (300px) was a
    //close-up while singles (185px) showed a whole body in the same window. holding the drawn
    //height fixed instead keeps every match type looking alike: a taller panel reveals more of
    //the same body rather than zooming further into it. re-measured rather than derived, since
    //the panel only takes the leftover height once the class above is on
    const panelHeight = document.getElementById('playerRegion').offsetHeight;

    //the rows spread out into whatever the panel gained over the height they need packed. a
    //quarter of it per gap leaves the score row well inside the panel even in crew, which
    //stacks the most rows of the modes this applies to — a flat gap would push it out the
    //bottom in a short window, where the panel has only a few px of growth to spend
    const rowGap = Math.min(MAX_ROW_GAP, Math.max(0, (panelHeight - packedPanel) / 4));
    document.documentElement.style.setProperty('--rowGap', rowGap.toFixed(1) + 'px');

    const charScale = Math.min(Math.max(ART_HEIGHT / panelHeight, MIN_CHAR_ZOOM), MAX_CHAR_ZOOM);
    document.documentElement.style.setProperty('--charScale', charScale);
    //0 in a panel that needs the full zoom, 1 once it has grown enough to ease off completely
    const closeUp = (charScale - MIN_CHAR_ZOOM) / (MAX_CHAR_ZOOM - MIN_CHAR_ZOOM);

    //what the panel shows is the slice of the render centred on `frame`, easing from a touch
    //left of centre — which keeps a big zoomed-out body clear of the inputs — back to dead
    //centre, the framing the art was cropped for, as the panel closes in on the strip height
    //it was designed around
    const frame = 0.44 + 0.06 * closeUp;
    //the origin has to be solved for, not picked: the slice a given origin lands on is
    //`o + (1 - 2o) / 2s`, so holding the origin still while the zoom climbs slides the art
    //right and crops it — which is what a crew panel does at most window sizes, its taller
    //base height leaving less room to grow and so a higher zoom than singles at the same size
    const origin = (2 * frame * charScale - 1) / (2 * (charScale - 1));
    document.documentElement.style.setProperty('--charOriginX', (origin * 100).toFixed(1) + '%');
}

function moveViewport() {
    if (!movedSettings) {
        if (window.innerWidth <= 850) {
            viewport.style.right = "200%";
        } else {
            viewport.style.right = "140%";
        }
        document.getElementById('overlay').style.opacity = "25%";
        document.getElementById('goBack').style.display = "block"
        movedSettings = true;
    }
}

function goBack() {
    viewport.style.right = "100%";
    document.getElementById('overlay').style.opacity = "100%";
    document.getElementById('goBack').style.display = "none";
    movedSettings = false;
}


//called whenever we need to read a json file
async function getJson(fileName) {
    if (isElectron) {
        try {
            let settingsRaw = fs.readFileSync(path.join(mainPath, fileName + ".json"));
            return JSON.parse(settingsRaw);
        } catch (error) {
            return undefined;
        }
    } else {
        try {
            const response = await fetch('/api/json/' + fileName);
            if (!response.ok) return undefined;
            return await response.json();
        } catch (error) {
            console.error("Error fetching JSON:", error);
            return undefined;
        }
    }
}

async function loadSavedData() {
    let data = await getJson("ScoreboardInfo");
    if (data) {
        // Player 1
        p1NameInp.value = data.p1Name || p1NameInp.value;
        p1TagInp.value = data.p1Team || p1TagInp.value;
        p1PronInp.value = data.p1Pron || p1PronInp.value;
        p1NScoreInp.value = data.p1NScore || p1NScoreInp.value;

        charP1 = data.p1Character || "Random";
        skinP1 = data.p1Skin || `1`;
        colorP1 = data.p1Color || "Red";
        currentP1WL = data.p1WL || "";

        // Player 2
        p2NameInp.value = data.p2Name || p2NameInp.value;
        p2TagInp.value = data.p2Team || p2TagInp.value;
        p2PronInp.value = data.p2Pron || p2PronInp.value;
        p2NScoreInp.value = data.p2NScore || p2NScoreInp.value;

        charP2 = data.p2Character || "Random";
        skinP2 = data.p2Skin || `1`;
        colorP2 = data.p2Color || "Blue";
        currentP2WL = data.p2WL || "";

        if (p1SeedInp)    p1SeedInp.value    = data.p1Seed    || "";
        if (p1CountryInp) { p1CountryInp.value = data.p1Country || ""; updateFlagPreview(data.p1Country || "", p1FlagImg); }
        if (p2SeedInp)    p2SeedInp.value    = data.p2Seed    || "";
        if (p2CountryInp) { p2CountryInp.value = data.p2Country || ""; updateFlagPreview(data.p2Country || "", p2FlagImg); }

        // Doubles teammates / crew battle
        currentMatchType = data.matchType || "singles";
        p1TeammateInp.value = data.p1TeammateName || "";
        p2TeammateInp.value = data.p2TeammateName || "";
        p1TeammateTagInp.value  = data.p1TeammateTag  || "";
        p2TeammateTagInp.value  = data.p2TeammateTag  || "";
        p1TeammatePronInp.value = data.p1TeammatePron || "";
        p2TeammatePronInp.value = data.p2TeammatePron || "";
        p1TeammateSeedInp.value = data.p1TeammateSeed || "";
        p2TeammateSeedInp.value = data.p2TeammateSeed || "";
        p1TeammateCountryInp.value = data.p1TeammateCountry || "";
        p2TeammateCountryInp.value = data.p2TeammateCountry || "";
        updateFlagPreview(data.p1TeammateCountry || "", p1TeammateFlagImg);
        updateFlagPreview(data.p2TeammateCountry || "", p2TeammateFlagImg);
        charP1Teammate = data.p1TeammateCharacter || "Random";
        charP2Teammate = data.p2TeammateCharacter || "Random";
        skinP1Teammate = data.p1TeammateSkin || "1";
        skinP2Teammate = data.p2TeammateSkin || "1";
        teamName1Inp.value = data.teamName1 || "";
        teamName2Inp.value = data.teamName2 || "";
        crewStocks1Inp.value = data.crewStocks1 ?? "0";
        crewStocks2Inp.value = data.crewStocks2 ?? "0";

        document.getElementById('p1TeammateCharSelector').setAttribute('src', charPath + '/CSS/' + charP1Teammate + '.png');
        document.getElementById('p2TeammateCharSelector').setAttribute('src', charPath + '/CSS/' + charP2Teammate + '.png');
        applyMatchType();

        currentBestOf = data.bestOf || "Bo3";
        applyBestOf();
        //which round control is in use is shared state, not a per-device preference — otherwise
        //a GUI left on the preset dropdown keeps showing the old round after the other one
        //types custom text, and overwrites it the moment someone hits update
        if (data.roundMode) {
            useCustomRound.checked = data.roundMode === "custom";
            if (data.roundCustom !== undefined) roundInp.value    = data.roundCustom;
            if (data.roundNumber !== undefined) roundNumberInp.value = data.roundNumber;
            //a name that isn't in this machine's RoundNames.json would blank the dropdown
            if (roundNames.some(o => o.name === data.roundName)) roundSelect.value = data.roundName;
            applyRoundMode();
        } else if (data.round) {
            //ScoreboardInfo.json written before the round controls were shared only has the
            //finished string, so it still has to be matched back to a preset
            const matched = roundNames.find(o => {
                if (o.showNumber) return data.round.startsWith(o.name + ' ');
                return data.round === o.name;
            });
            if (!useCustomRound.checked && matched) {
                roundSelect.value = matched.name;
                if (matched.showNumber) roundNumberInp.value = data.round.slice(matched.name.length + 1);
                updateRoundNumberVisibility();
            } else {
                roundInp.value = data.round;
            }
        }
        formatInp.value = data.format || formatInp.value;

        document.getElementById('tournamentName').value = data.tournamentName || "";
        for (let cn = 1; data[`caster${cn}Name`] !== undefined; cn++) {
            if (cn > casterCount) createCasterRow(cn);
            document.getElementById(`cName${cn}`).value    = data[`caster${cn}Name`]    || "";
            document.getElementById(`cTwitter${cn}`).value = data[`caster${cn}Twitter`] || "";
            document.getElementById(`cTwitch${cn}`).value  = data[`caster${cn}Twitch`]  || "";
        }

        document.getElementById('allowIntro').checked = data.allowIntro || false;


        if (isElectron) {
            document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/' + charP1 + '.png');
            document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/' + charP2 + '.png');
        } else {
            document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/' + charP1 + '.png');
            document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/' + charP2 + '.png');
        }

        charImgChange(charImgP1, charP1, skinP1);
        charImgChange(charImgP2, charP2, skinP2);

        // Colors
        let interfaceInfo = await getJson("InterfaceInfo");
        if (interfaceInfo) {
            for (let i = 0; i < Object.keys(interfaceInfo.colorSlots).length; i++) {
                if (interfaceInfo.colorSlots["color" + i].name == colorP1) {
                    document.getElementById("p1ColorRect").style.backgroundColor = interfaceInfo.colorSlots["color" + i].hex;
                    document.getElementById("player1").style.backgroundImage = "linear-gradient(to bottom left, " + interfaceInfo.colorSlots["color" + i].hex + "50, #00000000, #00000000)";
                }
                if (interfaceInfo.colorSlots["color" + i].name == colorP2) {
                    document.getElementById("p2ColorRect").style.backgroundColor = interfaceInfo.colorSlots["color" + i].hex;
                    document.getElementById("player2").style.backgroundImage = "linear-gradient(to bottom left, " + interfaceInfo.colorSlots["color" + i].hex + "50, #00000000, #00000000)";
                }
            }
        }

        if (currentP1WL == "W") p1W.click();
        else if (currentP1WL == "L") p1L.click();

        if (currentP2WL == "W") p2W.click();
        else if (currentP2WL == "L") p2L.click();

        applyBestOf();

        const resize = (el) => { if (el) resizeInput.call(el); };

        resize(p1NameInp);
        resize(p1TagInp);
        resize(p1PronInp);
        resize(p1NScoreInp);
        resize(p2NameInp);
        resize(p2TagInp);
        resize(p2PronInp);
        resize(p2NScoreInp);

        await addSkinIcons(1);
        await addSkinIcons(2);
        await addTeammateSkinIcons(1);
        await addTeammateSkinIcons(2);
    }
}

// polling logic
let localTimestamp = Date.now();
let isSaving = false;

const serverPort = new URLSearchParams(window.location.search).get('port') || '1111';
const API_BASE = isElectron ? `http://localhost:${serverPort}` : '';

async function pollForUpdates() {
    if (isSaving) return;

    try {
        const response = await fetch(API_BASE + '/api/last-update');
        const data = await response.json();

        if (data.timestamp > localTimestamp) {
            console.log("Remote update detected, reloading...");
            await loadSavedData();
            localTimestamp = data.timestamp;

            showToast('Overlay remotely updated', 1000);
        }
    } catch (error) {
        console.error("Polling error:", error);
    }
}

setInterval(pollForUpdates, 1000);


async function saveData(data) {
    isSaving = true;
    try {
        const response = await fetch(API_BASE + '/api/scoreboard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const updateResponse = await fetch(API_BASE + '/api/last-update');
            const updateData = await updateResponse.json();
            localTimestamp = updateData.timestamp;
            console.log("Data saved and timestamp updated");
        } else {
            console.error("Error saving data via API");
        }
    } catch (error) {
        console.error("Error saving data:", error);
    } finally {
        isSaving = false;
    }
}


//will load the color list to a color slot combo box
async function loadColors(pNum) {
    let colorList = await getJson("InterfaceInfo"); //check the color list

    //for each color found, add them to the color list
    for (let i = 0; i < Object.keys(colorList.colorSlots).length; i++) {

        //create a new div that will have the color info
        let newDiv = document.createElement('div');
        newDiv.style.display = "flex"; //so everything is in 1 line
        newDiv.title = "Also known as " + colorList.colorSlots["color" + i].hex;
        newDiv.className = "colorEntry";

        //if the div gets clicked, update the colors
        newDiv.addEventListener("click", updateColor);

        //create the color's name
        let newText = document.createElement('div');
        newText.innerHTML = colorList.colorSlots["color" + i].name;

        //create the color's rectangle
        let newRect = document.createElement('div');
        newRect.style.width = "13px";
        newRect.style.height = "13px";
        newRect.style.margin = "5px";
        newRect.style.backgroundColor = colorList.colorSlots["color" + i].hex;

        //add them to the div we created before
        newDiv.appendChild(newRect);
        newDiv.appendChild(newText);

        //now add them to the actual interface
        document.getElementById("dropdownColorP" + pNum).appendChild(newDiv);
    }

    //set the initial colors for the interface (the first color for p1, and the second for p2)
    if (pNum == 1) {
        document.getElementById("player1").style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + 0].hex + "50, #00000000, #00000000)";
        document.getElementById("p1ColorRect").style.backgroundColor = colorList.colorSlots["color" + 0].hex;
    } else {
        document.getElementById("player2").style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + 1].hex + "50, #00000000, #00000000)";
        document.getElementById("p2ColorRect").style.backgroundColor = colorList.colorSlots["color" + 1].hex;
    }

    //finally, set initial values for the global color variables
    colorP1 = "Red";
    colorP2 = "Blue";
}

async function updateColor() {

    let pNum; //you've seen this one enough already, right?
    if (this.parentElement.parentElement == document.getElementById("p1Color")) {
        pNum = 1;
    } else {
        pNum = 2;
    }

    let clickedColor = this.textContent;
    let colorList = await getJson("InterfaceInfo");

    //search for the color we just clicked
    for (let i = 0; i < Object.keys(colorList.colorSlots).length; i++) {
        if (colorList.colorSlots["color" + i].name == clickedColor) {
            let colorRectangle, colorGrad;

            colorRectangle = document.getElementById("p" + pNum + "ColorRect");
            colorGrad = document.getElementById("player" + pNum);

            //change the variable that will be read when clicking the update button
            if (pNum == 1) {
                colorP1 = colorList.colorSlots["color" + i].name;
            } else {
                colorP2 = colorList.colorSlots["color" + i].name;
            }

            //then change both the color rectangle and the background gradient
            colorRectangle.style.backgroundColor = colorList.colorSlots["color" + i].hex;
            colorGrad.style.backgroundImage = "linear-gradient(to bottom left, " + colorList.colorSlots["color" + i].hex + "50, #00000000, #00000000)";

            //also, if random is up, change its color
            if (pNum == 1) {
                if (charP1 == "Random") {
                    document.getElementById('p1CharImg').setAttribute('src', charPath + '/Renders/Random.webp');
                }
            } else {
                if (charP2 == "Random") {
                    document.getElementById('p2CharImg').setAttribute('src', charPath + '/Renders/Random.webp');
                }
            }

        }
    }

    //remove focus from the menu so it hides on click
    this.parentElement.parentElement.blur();
}


//change the image path depending on the character and skin
function charImgChange(charImg, charName, skinName = `1`) {
    if (charName != "Random") {
        charImg.setAttribute('src', charPath + '/Renders/' + charName + '/' + skinName + '.webp');
    } else {
        charImg.setAttribute('src', charPath + '/Renders/Random.webp');
    }
}


async function createCharRoster() {
    //checks the character list which we use to order stuff
    const guiSettings = await getJson("InterfaceInfo");

    const charGrid = document.getElementById("charGrid");

    for (let i = 0; i < guiSettings.charactersBase.length; i++) {
        let newImg = document.createElement('img');
        newImg.className = "charInRoster";
        newImg.setAttribute('src', charPath + '/CSS/' + guiSettings.charactersBase[i] + '.png');

        newImg.id = guiSettings.charactersBase[i]; //we will read this value later
        newImg.addEventListener("click", changeCharacter);

        charGrid.appendChild(newImg);
    }
}

//whenever we click on the character change button
function openChars() {
    //remember which slot we are editing, used on other functions
    if (this == document.getElementById('p1CharSelector')) {
        charTarget = "1";
    } else if (this == document.getElementById('p2CharSelector')) {
        charTarget = "2";
    } else if (this == document.getElementById('p1TeammateCharSelector')) {
        charTarget = "1Teammate";
    } else {
        charTarget = "2Teammate";
    }

    // Reset search
    const searchInput = document.getElementById('charSearchInput');
    searchInput.value = "";
    filterChars.call(searchInput);

    document.getElementById('charRoster').style.display = "flex"; //show the thing
    setTimeout(() => { //right after, change opacity and scale
        document.getElementById('charRoster').style.opacity = 1;
        document.getElementById('charRoster').style.transform = "scale(1)";
        searchInput.focus();
    }, 0);
}
//to hide the character grid
function hideChars() {
    document.getElementById('charRoster').style.opacity = 0;
    document.getElementById('charRoster').style.transform = "scale(1.2)";
    setTimeout(() => {
        document.getElementById('charRoster').style.display = "none";
    }, 200);
}

function filterChars() {
    const filter = this.value.toUpperCase();
    const images = document.getElementsByClassName("charInRoster");
    for (let i = 0; i < images.length; i++) {
        if (images[i].id.toUpperCase().indexOf(filter) > -1) {
            images[i].style.display = "";
        } else {
            images[i].style.display = "none";
        }
    }
}

//called whenever clicking an image in the character roster
function changeCharacter() {
    if (charTarget == "1") {
        charP1 = this.id;
        skinP1 = `1`;
        document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/' + charP1 + '.png');
        charImgChange(charImgP1, charP1);
        addSkinIcons(1);
    } else if (charTarget == "2") {
        charP2 = this.id;
        skinP2 = `1`;
        document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/' + charP2 + '.png');
        charImgChange(charImgP2, charP2);
        addSkinIcons(2);
    } else {
        changeTeammateCharacter(this.id, charTarget == "1Teammate" ? 1 : 2);
    }
}

//same as above but for the doubles teammates
function changeTeammateCharacter(char, pNum) {
    if (pNum == 1) {
        charP1Teammate = char;
        skinP1Teammate = `1`;
    } else {
        charP2Teammate = char;
        skinP2Teammate = `1`;
    }
    document.getElementById('p' + pNum + 'TeammateCharSelector').setAttribute('src', charPath + '/CSS/' + char + '.png');
    addTeammateSkinIcons(pNum);
}
//same as above but for the swap button
function changeCharacterManual(char, pNum) {
    document.getElementById('p' + pNum + 'CharSelector').setAttribute('src', charPath + '/CSS/' + char + '.png');
    if (pNum == 1) {
        charP1 = char;
        skinP1 = `1`;
        charImgChange(charImgP1, char);
        addSkinIcons(1);
    } else {
        charP2 = char;
        skinP2 = `1`;
        charImgChange(charImgP2, char);
        addSkinIcons(2);
    }
}
//also called when we click those images
async function addSkinIcons(pNum) {
    document.getElementById('skinListP' + pNum).innerHTML = ''; //clear everything before adding
    let charInfo;
    if (pNum == 1) { //ahh the classic 'which character am i' check
        charInfo = await getJson("Character Info/" + charP1);
    } else {
        charInfo = await getJson("Character Info/" + charP2);
    }


    if (charInfo != undefined) { //if character doesnt have a list (for example: Random), skip this
        //add an image for every skin on the list
        for (let i = 0; i < charInfo.skinList.length; i++) {
            let newImg = document.createElement('img');
            newImg.className = "skinIcon";
            newImg.id = charInfo.skinList[i];
            newImg.title = charInfo.skinList[i];

            if (pNum == 1) {
                newImg.setAttribute('src', charPath + '/Stock Icons/' + charP1 + '/' + charInfo.skinList[i] + '.png');
                newImg.addEventListener("click", changeSkinP1);
            } else {
                newImg.setAttribute('src', charPath + '/Stock Icons/' + charP2 + '/' + charInfo.skinList[i] + '.png');
                newImg.addEventListener("click", changeSkinP2);
            }

            document.getElementById('skinListP' + pNum).appendChild(newImg);
        }

    }

    //if the list only has 1 skin or none, hide the skin list
    if (document.getElementById('skinListP' + pNum).children.length <= 1) {
        document.getElementById('skinSelectorP' + pNum).style.opacity = 0;
    } else {
        document.getElementById('skinSelectorP' + pNum).style.opacity = 1;
    }
}
//same as addSkinIcons, but for the doubles teammate slots
async function addTeammateSkinIcons(pNum) {
    const listEL = document.getElementById('teammateSkinListP' + pNum);
    listEL.innerHTML = ''; //clear everything before adding

    const char = pNum == 1 ? charP1Teammate : charP2Teammate;
    const charInfo = await getJson("Character Info/" + char);

    if (charInfo != undefined) { //if character doesnt have a list (for example: Random), skip this
        for (let i = 0; i < charInfo.skinList.length; i++) {
            let newImg = document.createElement('img');
            newImg.className = "skinIcon";
            newImg.id = charInfo.skinList[i];
            newImg.title = charInfo.skinList[i];
            newImg.setAttribute('src', charPath + '/Stock Icons/' + char + '/' + charInfo.skinList[i] + '.png');
            newImg.addEventListener("click", () => {
                if (pNum == 1) skinP1Teammate = newImg.id;
                else skinP2Teammate = newImg.id;
            });
            listEL.appendChild(newImg);
        }
    }

    //if the list only has 1 skin or none, hide the skin list
    document.getElementById('teammateSkinSelectorP' + pNum).style.opacity =
        listEL.children.length <= 1 ? 0 : 1;
}

//whenever clicking on the skin images
function changeSkinP1() {
    skinP1 = this.id;
    charImgChange(charImgP1, charP1, skinP1);
}
function changeSkinP2() {
    skinP2 = this.id;
    charImgChange(charImgP2, charP2, skinP2);
}


//gives a victory to player 1
function giveWinP1() {
    p1NScoreInp.value = Number(p1NScoreInp.value) + 1;
}
//same with P2
function giveWinP2() {
    p2NScoreInp.value = Number(p2NScoreInp.value) + 1;
}
function takeWinP1() {
    p1NScoreInp.value = Math.max(0, Number(p1NScoreInp.value) - 1);
}
function takeWinP2() {
    p2NScoreInp.value = Math.max(0, Number(p2NScoreInp.value) - 1);
}


function setWLP1() {
    if (this == p1W) {
        currentP1WL = "W";
        this.style.color = "var(--text1)";
        p1L.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p1L.style.backgroundImage = "var(--bg4)";
    } else {
        currentP1WL = "L";
        this.style.color = "var(--text1)";
        p1W.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p1W.style.backgroundImage = "var(--bg4)";
    }
}
function setWLP2() {
    if (this == p2W) {
        currentP2WL = "W";
        this.style.color = "var(--text1)";
        p2L.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p2L.style.backgroundImage = "var(--bg4)";
    } else {
        currentP2WL = "L";
        this.style.color = "var(--text1)";
        p2W.style.color = "var(--text2)";
        this.style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
        p2W.style.backgroundImage = "var(--bg4)";
    }
}
function deactivateWL() {
    currentP1WL = "";
    currentP2WL = "";

    const pWLs = document.getElementsByClassName("wlBox");
    for (let i = 0; i < pWLs.length; i++) {
        pWLs[i].style.color = "var(--text2)";
        pWLs[i].style.backgroundImage = "var(--bg4)";
    }
}


//same code as above but just for the player tag
function resizeInput() {
    changeInputWidth(this);
}

//changes the width of an input box depending on the text
function changeInputWidth(input) {
    input.style.width = getTextWidth(input.value,
        window.getComputedStyle(input).fontSize + " " +
        window.getComputedStyle(input).fontFamily
    ) + 12 + "px";
}


//used to get the exact width of a text considering the font used
function getTextWidth(text, font) {
    let canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement("canvas"));
    let context = canvas.getContext("2d");
    context.font = font;
    let metrics = context.measureText(text);
    return metrics.width;
}


function applyBestOf() {
    boSelect.value = currentBestOf;
    applyWLMode();
}

//shows or hides the doubles/crew fields depending on the match type
function applyMatchType() {
    matchTypeSelect.value = currentMatchType;

    const doubles = currentMatchType === "doubles";
    const crew    = currentMatchType === "crew";
    const extras  = doubles || crew;

    for (const pNum of [1, 2]) {
        document.getElementById(`p${pNum}TeamNameRow`).style.display      = extras  ? '' : 'none';
        document.getElementById(`p${pNum}TeammateInfo`).style.display     = doubles ? '' : 'none';
        document.getElementById(`p${pNum}TeammateCharInfo`).style.display = doubles ? '' : 'none';
        //crew shows two counters side by side, so both of them get a label
        document.getElementById(`p${pNum}CrewStockBox`).style.display = crew    ? '' : 'none';
        document.getElementById(`p${pNum}ScoreLabel`).style.display   = crew    ? '' : 'none';
    }

    //the extra rows don't fit in the default window height
    document.body.classList.toggle('matchExtra', extras);
    document.body.classList.toggle('matchExtraDoubles', doubles);
    if (isElectron) {
        let extraHeight = 0;
        if (doubles)     extraHeight = DOUBLES_EXTRA_HEIGHT;
        else if (extras) extraHeight = TEAM_ROW_HEIGHT;
        ipcRenderer.send('set-extra-height', extraHeight);
    }

    //wins/losses fills the name boxes and drops the round
    applyWLMode();

    //the extra rows change how tall the layout is, so the scale has to be recalculated
    fitToViewport();
}

//applyWLMode() runs on both dropdowns and on every load, so leaving wins/losses has to be an
//actual transition — acting on "not in wins/losses" alone would reset the round on every poll
let wasWLMode = false;

function applyWLMode() {
    //wins/losses can come from either dropdown
    const wlMode = currentBestOf === "WL" || currentMatchType === "wl";
    //the character pickers and renders are hidden in this mode, which frees up the panel
    document.body.classList.toggle('matchWL', wlMode);
    if (wlMode) {
        const abbrev = document.getElementById('abbreviateRounds')?.checked;
        p1NameInp.value = abbrev ? "W" : "Wins";
        p2NameInp.value = abbrev ? "L" : "Losses";
        changeInputWidth(p1NameInp);
        changeInputWidth(p2NameInp);
        //it's a standings board, not a match, so no player info belongs on it
        clearPlayerPresetInfo();
    } else if (wasWLMode) {
        //the standings board blanked the round on the way in, so coming back out starts a
        //fresh bracket at the top rather than leaving the round empty
        roundSelect.value = "Winners Round";
        roundNumberInp.value = "1";
        updateRoundNumberVisibility();
        checkRound();
    }
    wasWLMode = wlMode;
    if (wlMode || currentBestOf === "CB") {
        roundSelect.value = "(None)";
        updateRoundNumberVisibility();
    }
}


function abbreviateRound(str) {
    if (!document.getElementById('abbreviateRounds')?.checked) return str;
    let result = str.replace(/\bRound\b/g, 'Rd').replace(/\bQuarters\b/g, 'Qrts');
    if (document.getElementById('abbreviateWL')?.checked) {
        result = result.replace(/\bWinners\b/g, 'Wnrs').replace(/\bLosers\b/g, 'Lsrs');
    }
    return result;
}

function showToast(message, duration = 1000) {
    const popup = document.getElementById('remoteUpdatePopup');
    if (!popup) return;
    popup.textContent = message;
    popup.classList.add('show');
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => { popup.textContent = 'Overlay remotely updated'; }, 500);
    }, duration);
}

function getRoundValue() {
    if (currentBestOf === "WL" || currentMatchType === "wl") return '';
    if (useCustomRound.checked) return roundInp.value;
    const selected = roundNames.find(o => o.name === roundSelect.value);
    if (selected?.none) return '';
    let value;
    if (selected?.showNumber && roundNumberInp.value) {
        value = `${roundSelect.value} ${roundNumberInp.value}`;
    } else {
        value = roundSelect.value || '';
    }
    return abbreviateRound(value);
}

function applyRoundMode() {
    const custom = useCustomRound.checked;
    roundInp.style.display = custom ? '' : 'none';
    roundSelect.style.display = custom ? 'none' : '';
    updateRoundNumberVisibility();
    checkRound();
}

function updateRoundNumberVisibility() {
    const selected = roundNames.find(o => o.name === roundSelect.value);
    const shouldShow = !useCustomRound.checked && selected?.showNumber;
    roundNumberInp.style.display = shouldShow ? '' : 'none';
    if (shouldShow && !roundNumberInp.value) roundNumberInp.value = "1";
}

function checkRound() {
    if (!forceWL.checked) {
        const wlButtons = document.getElementsByClassName("wlButtons");

        if (getRoundValue().toLocaleUpperCase().includes("Grand".toLocaleUpperCase())) {
            for (let i = 0; i < wlButtons.length; i++) {
                wlButtons[i].style.display = "inline";
            }
        } else {
            for (let i = 0; i < wlButtons.length; i++) {
                wlButtons[i].style.display = "none";
                deactivateWL();
            }
        }
    }
}

function swap() {
    let tempP1Name = p1NameInp.value;
    let tempP1Team = p1TagInp.value;
    let tempP1Pron = p1PronInp.value;
    let tempP1NScore = p1NScoreInp.value;
    let tempP1Seed = p1SeedInp.value;
    let tempP1Country = p1CountryInp.value;
    let tempP2Name = p2NameInp.value;
    let tempP2Team = p2TagInp.value;
    let tempP2Pron = p2PronInp.value;
    let tempP2NScore = p2NScoreInp.value;
    let tempP2Seed = p2SeedInp.value;
    let tempP2Country = p2CountryInp.value;

    p1NameInp.value = tempP2Name;
    p1TagInp.value = tempP2Team;
    p1PronInp.value = tempP2Pron;
    p1NScoreInp.value = tempP2NScore;
    p1SeedInp.value = tempP2Seed;
    p1CountryInp.value = tempP2Country;
    updateFlagPreview(tempP2Country, p1FlagImg);
    p2NameInp.value = tempP1Name;
    p2TagInp.value = tempP1Team;
    p2PronInp.value = tempP1Pron;
    p2NScoreInp.value = tempP1NScore;
    p2SeedInp.value = tempP1Seed;
    p2CountryInp.value = tempP1Country;
    updateFlagPreview(tempP1Country, p2FlagImg);

    changeInputWidth(p1NameInp);
    changeInputWidth(p1TagInp);
    changeInputWidth(p1PronInp);
    changeInputWidth(p1NScoreInp);
    changeInputWidth(p2NameInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2PronInp);
    changeInputWidth(p2NScoreInp);


    let tempP1Char = charP1;
    let tempP2Char = charP2;
    let tempP1Skin = skinP1;
    let tempP2Skin = skinP2;

    changeCharacterManual(tempP2Char, 1);
    changeCharacterManual(tempP1Char, 2);
    charImgChange(charImgP1, charP1, tempP2Skin);
    charImgChange(charImgP2, charP2, tempP1Skin);

    skinP1 = tempP2Skin;
    skinP2 = tempP1Skin;


    //the doubles/crew fields travel with their side
    const swapValues = (a, b, resize = false) => {
        const temp = a.value;
        a.value = b.value;
        b.value = temp;
        if (resize) { changeInputWidth(a); changeInputWidth(b); }
    };
    swapValues(p1TeammateInp, p2TeammateInp, true);
    swapValues(p1TeammateTagInp, p2TeammateTagInp, true);
    swapValues(p1TeammatePronInp, p2TeammatePronInp, true);
    swapValues(p1TeammateSeedInp, p2TeammateSeedInp);
    swapValues(p1TeammateCountryInp, p2TeammateCountryInp);
    swapValues(teamName1Inp, teamName2Inp);
    swapValues(crewStocks1Inp, crewStocks2Inp);
    updateFlagPreview(p1TeammateCountryInp.value, p1TeammateFlagImg);
    updateFlagPreview(p2TeammateCountryInp.value, p2TeammateFlagImg);

    let tempP1TeammateChar = charP1Teammate;
    let tempP1TeammateSkin = skinP1Teammate;
    let tempP2TeammateSkin = skinP2Teammate;
    changeTeammateCharacter(charP2Teammate, 1);
    changeTeammateCharacter(tempP1TeammateChar, 2);
    skinP1Teammate = tempP2TeammateSkin;
    skinP2Teammate = tempP1TeammateSkin;
}

async function loadPresets() {
    try {
        const res = await fetch(API_BASE + '/api/presets');
        playerPresets = await res.json();
    } catch (e) {
        playerPresets = [];
    }
}

async function savePreset(pNum, teammate = false) {
    const slot = getPlayerSlot(pNum, teammate);
    const name = slot.nameInp.value.trim();
    if (!name) return;
    await fetch(API_BASE + '/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tag: slot.tagInp.value, pronouns: slot.pronInp.value,
            character: slot.character, skin: slot.skin,
            seed: slot.seedInp.value, country: slot.countryInp.value })
    });
    await loadPresets();
}

//the four editable player slots: P1, P2 and their doubles teammates (P3 and P4)
function getPlayerSlot(pNum, teammate = false) {
    if (teammate) {
        return {
            nameInp:    pNum === 1 ? p1TeammateInp        : p2TeammateInp,
            tagInp:     pNum === 1 ? p1TeammateTagInp     : p2TeammateTagInp,
            pronInp:    pNum === 1 ? p1TeammatePronInp    : p2TeammatePronInp,
            seedInp:    pNum === 1 ? p1TeammateSeedInp    : p2TeammateSeedInp,
            countryInp: pNum === 1 ? p1TeammateCountryInp : p2TeammateCountryInp,
            flagImg:    pNum === 1 ? p1TeammateFlagImg    : p2TeammateFlagImg,
            character:  pNum === 1 ? charP1Teammate       : charP2Teammate,
            skin:       pNum === 1 ? skinP1Teammate       : skinP2Teammate
        };
    }
    return {
        nameInp:    pNum === 1 ? p1NameInp    : p2NameInp,
        tagInp:     pNum === 1 ? p1TagInp     : p2TagInp,
        pronInp:    pNum === 1 ? p1PronInp    : p2PronInp,
        seedInp:    pNum === 1 ? p1SeedInp    : p2SeedInp,
        countryInp: pNum === 1 ? p1CountryInp : p2CountryInp,
        flagImg:    pNum === 1 ? p1FlagImg    : p2FlagImg,
        character:  pNum === 1 ? charP1       : charP2,
        skin:       pNum === 1 ? skinP1       : skinP2
    };
}

async function deletePreset(name) {
    await fetch(API_BASE + '/api/presets/' + encodeURIComponent(name), { method: 'DELETE' });
    await loadPresets();
    renderPresetList(document.getElementById('presetSearchInp').value);
}

function openPresetPanel() {
    const panel = document.getElementById('presetPanel');
    panel.style.display = 'flex';
    requestAnimationFrame(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'scale(1)';
    });
    document.getElementById('presetSearchInp').value = '';
    renderPresetList('');
    document.getElementById('presetSearchInp').focus({ preventScroll: true });
    presetPanelOpen = true;
}

function closePresetPanel() {
    const panel = document.getElementById('presetPanel');
    panel.style.opacity = '0';
    panel.style.transform = 'scale(1.05)';
    setTimeout(() => { panel.style.display = 'none'; }, 200);
    presetPanelOpen = false;
}

function clearPresetSearch() {
    const searchInp = document.getElementById('presetSearchInp');
    searchInp.value = '';
    renderPresetList('');
    searchInp.focus({ preventScroll: true });
}

function renderPresetList(query) {
    const container = document.getElementById('presetListContainer');
    const matches = query
        ? playerPresets.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
        : playerPresets;
    container.innerHTML = '';
    if (!matches.length) {
        const msg = document.createElement('div');
        msg.style.cssText = 'padding: 12px; color: var(--text2); font-size: 12px; text-align: center;';
        msg.textContent = playerPresets.length ? 'No presets match your search.' : 'No presets saved yet. Use the ★ button to save a player.';
        container.appendChild(msg);
        return;
    }
    matches.forEach(preset => {
        const row = document.createElement('div');
        row.className = 'presetPanelEntry';

        const info = document.createElement('div');
        info.className = 'presetPanelInfo';
        const nameEl = document.createElement('div');
        nameEl.className = 'presetPanelName';
        nameEl.textContent = preset.name;
        const detailEl = document.createElement('div');
        detailEl.className = 'presetPanelDetails';
        detailEl.textContent = [preset.tag, preset.pronouns, preset.character].filter(Boolean).join(' · ');
        info.appendChild(nameEl);
        info.appendChild(detailEl);

        //the panel stays open after a pick, so several slots can be filled in one go
        const loadBtn = (label, title, load) => {
            const btn = document.createElement('button');
            btn.className = 'loadPBtn';
            btn.textContent = label;
            btn.title = title;
            btn.addEventListener('click', () => {
                load();
                showToast(`${preset.name} → ${label}`, 900);
            });
            return btn;
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'presetDeleteBtn';
        delBtn.textContent = '✕';
        delBtn.title = 'Delete preset';
        delBtn.addEventListener('click', () => deletePreset(preset.name));

        row.appendChild(info);
        //doubles teams are P1+P3 vs P2+P4, so keep each team's buttons together
        row.appendChild(loadBtn('P1', 'Load into Player 1', () => applyPreset(1, preset)));
        if (currentMatchType === "doubles") {
            row.appendChild(loadBtn('P3', "Load into Player 1's teammate", () => applyTeammatePreset(1, preset)));
        }
        row.appendChild(loadBtn('P2', 'Load into Player 2', () => applyPreset(2, preset)));
        if (currentMatchType === "doubles") {
            row.appendChild(loadBtn('P4', "Load into Player 2's teammate", () => applyTeammatePreset(2, preset)));
        }
        row.appendChild(delBtn);
        container.appendChild(row);
    });
}

function applyPreset(pNum, preset) {
    const nameInp    = pNum === 1 ? p1NameInp    : p2NameInp;
    const tagInp     = pNum === 1 ? p1TagInp     : p2TagInp;
    const pronInp    = pNum === 1 ? p1PronInp    : p2PronInp;
    const seedInp    = pNum === 1 ? p1SeedInp    : p2SeedInp;
    const countryInp = pNum === 1 ? p1CountryInp : p2CountryInp;
    const flagImg    = pNum === 1 ? p1FlagImg    : p2FlagImg;

    nameInp.value    = preset.name;
    tagInp.value     = preset.tag || '';
    pronInp.value    = preset.pronouns || '';
    seedInp.value    = preset.seed || '';
    countryInp.value = preset.country || '';
    updateFlagPreview(preset.country || '', flagImg);

    changeInputWidth(nameInp);
    changeInputWidth(tagInp);
    changeInputWidth(pronInp);

    if (preset.character) {
        changeCharacterManual(preset.character, pNum);
        const skin = preset.skin || '1';
        if (pNum === 1) { skinP1 = skin; charImgChange(charImgP1, preset.character, skin); }
        else            { skinP2 = skin; charImgChange(charImgP2, preset.character, skin); }
    }
}

//loads a preset into a doubles teammate slot (P3 and P4 in the preset panel)
function applyTeammatePreset(pNum, preset) {
    const slot = getPlayerSlot(pNum, true);

    slot.nameInp.value    = preset.name;
    slot.tagInp.value     = preset.tag || '';
    slot.pronInp.value    = preset.pronouns || '';
    slot.seedInp.value    = preset.seed || '';
    slot.countryInp.value = preset.country || '';
    updateFlagPreview(preset.country || '', slot.flagImg);

    changeInputWidth(slot.nameInp);
    changeInputWidth(slot.tagInp);
    changeInputWidth(slot.pronInp);

    if (preset.character) {
        changeTeammateCharacter(preset.character, pNum); //this resets the skin, so set it after
        const skin = preset.skin || '1';
        if (pNum === 1) skinP1Teammate = skin;
        else            skinP2Teammate = skin;
    }
}


//sends a player's character back to Random and empties their skin list
function resetCharacter(pNum) {
    document.getElementById('p' + pNum + 'CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    if (pNum == 1) {
        charP1 = "Random";
        skinP1 = "";
        charImgChange(charImgP1, charP1);
    } else {
        charP2 = "Random";
        skinP2 = "";
        charImgChange(charImgP2, charP2);
    }
    document.getElementById('skinListP' + pNum).innerHTML = '';
    document.getElementById('skinListP' + pNum + 'Sheik').innerHTML = '';
    document.getElementById('skinSelectorP' + pNum).style.opacity = 0;
}

//everything a player preset fills in, minus the name (W/L mode writes its own)
function clearPlayerPresetInfo() {
    for (const inp of [p1TagInp, p2TagInp, p1PronInp, p2PronInp]) {
        inp.value = "";
        changeInputWidth(inp);
    }
    for (const inp of [p1SeedInp, p2SeedInp, p1CountryInp, p2CountryInp]) {
        inp.value = "";
    }
    p1FlagImg.style.display = 'none';
    p2FlagImg.style.display = 'none';
    resetCharacter(1);
    resetCharacter(2);
}

function clearPlayers() {
    //clear player texts
    p1TagInp.value = "";
    p1NameInp.value = "";
    p1PronInp.value = "";
    p1NScoreInp.value = "0";
    p1SeedInp.value = "";
    p1CountryInp.value = "";
    p1FlagImg.style.display = 'none';
    p2TagInp.value = "";
    p2NameInp.value = "";
    p2PronInp.value = "";
    p2NScoreInp.value = "0";
    p2SeedInp.value = "";
    p2CountryInp.value = "";
    p2FlagImg.style.display = 'none';
    roundInp.value = "";
    roundSelect.selectedIndex = 0;
    roundNumberInp.value = "";
    updateRoundNumberVisibility();
    changeInputWidth(p1TagInp);
    changeInputWidth(p1NameInp);
    changeInputWidth(p1PronInp);
    changeInputWidth(p1NScoreInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2NameInp);
    changeInputWidth(p2PronInp);
    changeInputWidth(p2NScoreInp);


    //reset characters to random
    resetCharacter(1);
    resetCharacter(2);

    //doubles/crew fields (the match type itself is left alone)
    //only the auto-resizing boxes get their width recalculated, the rest are fixed width
    for (const inp of [p1TeammateInp, p2TeammateInp, p1TeammateTagInp, p2TeammateTagInp,
                       p1TeammatePronInp, p2TeammatePronInp]) {
        inp.value = "";
        changeInputWidth(inp);
    }
    for (const inp of [p1TeammateSeedInp, p2TeammateSeedInp, p1TeammateCountryInp,
                       p2TeammateCountryInp, teamName1Inp, teamName2Inp]) {
        inp.value = "";
    }
    p1TeammateFlagImg.style.display = 'none';
    p2TeammateFlagImg.style.display = 'none';
    crewStocks1Inp.value = "0";
    crewStocks2Inp.value = "0";

    for (const pNum of [1, 2]) {
        document.getElementById('p' + pNum + 'TeammateCharSelector').setAttribute('src', charPath + '/CSS/Random.png');
        document.getElementById('teammateSkinListP' + pNum).innerHTML = '';
        document.getElementById('teammateSkinSelectorP' + pNum).style.opacity = 0;
    }
    charP1Teammate = "Random";
    charP2Teammate = "Random";
    skinP1Teammate = "";
    skinP2Teammate = "";
}


function forceWLtoggles() {
    const wlButtons = document.getElementsByClassName("wlButtons");

    if (forceWL.checked) {
        for (let i = 0; i < wlButtons.length; i++) {
            wlButtons[i].style.display = "inline";
        }
    } else {
        for (let i = 0; i < wlButtons.length; i++) {
            wlButtons[i].style.display = "none";
            deactivateWL();
        }
    }
}

async function loadCountryCodes() {
    try {
        const res = await fetch(API_BASE + '/Resources/COUNTRY_CODES.json');
        countryCodes = await res.json();
    } catch {}
}

function updateFlagPreview(countryName, flagImg) {
    if (!countryCodes || !countryName) { flagImg.style.display = 'none'; return; }
    const code = Object.keys(countryCodes).find(k =>
        countryCodes[k].toLowerCase() === countryName.toLowerCase());
    if (code) {
        flagImg.src = API_BASE + '/Resources/Flags/' + code + '.png';
        flagImg.style.display = 'inline';
    } else {
        flagImg.style.display = 'none';
    }
}

function applyStartGGToPlayer(name, seedInp, countryInp, tagInp, pronInp, flagImg) {
    const d = startGGData[name.toLowerCase()];
    if (!d) return;
    if (d.seed)     seedInp.value    = d.seed;
    if (d.country)  { countryInp.value = d.country; updateFlagPreview(d.country, flagImg); }
    if (d.tag)      tagInp.value     = d.tag;
    if (d.pronouns) pronInp.value    = d.pronouns;
}

async function fetchStartGG() {
    const slug = document.getElementById('startggSlug').value.trim();
    const token = document.getElementById('startggToken').value.trim();
    const statusEl = document.getElementById('startggStatus');
    const fetchBtn = document.getElementById('startggFetch');
    if (!slug) return;
    statusEl.textContent = 'Fetching…';
    fetchBtn.disabled = true;
    startGGData = {};
    try {
        let page = 1, totalPages = 1;
        do {
            const res = await fetch(API_BASE + '/api/startgg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, page, perPage: 200, token: token || undefined })
            });
            const json = await res.json();
            const entrants = json.data?.event?.entrants;
            if (!entrants) throw new Error(json.errors?.[0]?.message || 'Bad response — check slug');
            totalPages = entrants.pageInfo.totalPages;
            for (const node of entrants.nodes) {
                const p = node.participants?.[0];
                if (!p) continue;
                startGGData[p.gamerTag.toLowerCase()] = {
                    name:     p.gamerTag,
                    seed:     node.initialSeedNum ?? "",
                    country:  p.user?.location?.country ?? "",
                    tag:      p.prefix ?? "",
                    pronouns: p.user?.genderPronoun ?? ""
                };
            }
            page++;
        } while (page <= totalPages);

        // upsert all fetched players into the preset list
        statusEl.textContent = 'Saving presets…';
        const existingPresets = await fetch(API_BASE + '/api/presets').then(r => r.json()).catch(() => []);
        let newCount = 0, updatedCount = 0;
        for (const d of Object.values(startGGData)) {
            const existing = existingPresets.find(p => p.name.toLowerCase() === d.name.toLowerCase());
            const preset = existing
                ? { ...existing, tag: d.tag || existing.tag, pronouns: d.pronouns || existing.pronouns, seed: d.seed, country: d.country }
                : { name: d.name, tag: d.tag || '', pronouns: d.pronouns || '', character: 'Random', skin: '1', seed: d.seed, country: d.country };
            await fetch(API_BASE + '/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(preset)
            });
            if (existing) updatedCount++; else newCount++;
        }
        await loadPresets();
        renderPresetList(document.getElementById('presetSearchInp').value);

        const total = Object.keys(startGGData).length;
        statusEl.textContent = `${total} players — ${newCount} new, ${updatedCount} updated`;
        applyStartGGToPlayer(p1NameInp.value, p1SeedInp, p1CountryInp, p1TagInp, p1PronInp, p1FlagImg);
        applyStartGGToPlayer(p2NameInp.value, p2SeedInp, p2CountryInp, p2TagInp, p2PronInp, p2FlagImg);
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
    } finally {
        fetchBtn.disabled = false;
    }
}

//presets live in a single PlayerPresets.json, so a "rescan" is just a re-fetch + redraw.
//mostly useful when a remote GUI or a hand edit changed the file since this window loaded it
async function rescanPresets() {
    const statusEl = document.getElementById('rescanPresetsStatus');
    const rescanBtn = document.getElementById('rescanPresetsButt');
    statusEl.textContent = 'Rescanning…';
    rescanBtn.disabled = true;
    try {
        await loadPresets();
        renderPresetList(document.getElementById('presetSearchInp').value);
        statusEl.textContent = `${playerPresets.length} preset${playerPresets.length === 1 ? '' : 's'} loaded`;
    } catch (e) {
        statusEl.textContent = 'Error: ' + e.message;
    } finally {
        rescanBtn.disabled = false;
    }
}

function copyMatch() {
    const tournament = document.getElementById('tournamentName').value;
    const round = getRoundValue();
    const copiedText = `${tournament} ${round} - ${p1NameInp.value} (${charP1}) Vs ${p2NameInp.value} (${charP2}) - SSBU`;
    navigator.clipboard.writeText(copiedText);
}


//time to write it down
async function writeScoreboard() {

    let scoreboardJson = {
        p1Name: p1NameInp.value,
        p1Team: p1TagInp.value,
        p1Pron: p1PronInp.value,
        p1NScore: p1NScoreInp.value,
        p1Character: charP1,
        p1Skin: skinP1,
        p1Color: colorP1,
        p1WL: currentP1WL,
        p1Seed: p1SeedInp.value,
        p1Country: p1CountryInp.value,
        p2Name: p2NameInp.value,
        p2Team: p2TagInp.value,
        p2Pron: p2PronInp.value,
        p2NScore: p2NScoreInp.value,
        p2Character: charP2,
        p2Skin: skinP2,
        p2Color: colorP2,
        p2WL: currentP2WL,
        p2Seed: p2SeedInp.value,
        p2Country: p2CountryInp.value,
        bestOf: currentBestOf,
        matchType: currentMatchType,
        round: getRoundValue(),
        //`round` above is the finished string for the overlays. these are the controls that
        //produced it, so the other GUI can land on the same ones instead of guessing: reading
        //the string backwards can't tell custom text from an unknown preset, and abbreviated
        //names ("Winners Rd 1") never match the preset they came from
        roundMode: useCustomRound.checked ? "custom" : "preset",
        roundName: roundSelect.value,
        roundNumber: roundNumberInp.value,
        roundCustom: roundInp.value,
        format: formatInp.value,
        tournamentName: document.getElementById('tournamentName').value,
        ...(() => {
            const c = {};
            document.querySelectorAll('#casterInfo .caster').forEach((row, i) => {
                const n = row.dataset.n;
                const idx = i + 1;
                c[`caster${idx}Name`]    = document.getElementById(`cName${n}`).value;
                c[`caster${idx}Twitter`] = document.getElementById(`cTwitter${n}`).value;
                c[`caster${idx}Twitch`]  = document.getElementById(`cTwitch${n}`).value;
            });
            return c;
        })(),
        allowIntro: document.getElementById('allowIntro').checked,
        writeSimpleTexts: document.getElementById('writeSimpleTexts').checked,
    };

    //only send what the current match type actually uses, so singles
    //never leaves stale teammate/crew data behind on the overlays
    if (currentMatchType === "doubles") {
        scoreboardJson.p1TeammateName      = p1TeammateInp.value;
        scoreboardJson.p1TeammateCharacter = charP1Teammate;
        scoreboardJson.p1TeammateSkin      = skinP1Teammate;
        scoreboardJson.p1TeammateTag       = p1TeammateTagInp.value;
        scoreboardJson.p1TeammatePron      = p1TeammatePronInp.value;
        scoreboardJson.p1TeammateSeed      = p1TeammateSeedInp.value;
        scoreboardJson.p1TeammateCountry   = p1TeammateCountryInp.value;
        scoreboardJson.p2TeammateName      = p2TeammateInp.value;
        scoreboardJson.p2TeammateCharacter = charP2Teammate;
        scoreboardJson.p2TeammateSkin      = skinP2Teammate;
        scoreboardJson.p2TeammateTag       = p2TeammateTagInp.value;
        scoreboardJson.p2TeammatePron      = p2TeammatePronInp.value;
        scoreboardJson.p2TeammateSeed      = p2TeammateSeedInp.value;
        scoreboardJson.p2TeammateCountry   = p2TeammateCountryInp.value;
    }
    if (currentMatchType === "doubles" || currentMatchType === "crew") {
        scoreboardJson.teamName1 = teamName1Inp.value;
        scoreboardJson.teamName2 = teamName2Inp.value;
    }
    if (currentMatchType === "crew") {
        scoreboardJson.crewStocks1 = crewStocks1Inp.value;
        scoreboardJson.crewStocks2 = crewStocks2Inp.value;
    }

    await saveData(scoreboardJson);
}