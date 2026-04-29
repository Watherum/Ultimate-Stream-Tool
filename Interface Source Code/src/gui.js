const isElectron = typeof require !== 'undefined';
let fs, path, os, baseDir;

if (isElectron) {
    fs = require('fs');
    path = require('path');
    os = require('os');

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

let movedSettings = false;
let charP1Active = false;
let playerPresets = [];


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

const roundInp = document.getElementById('roundName');
const formatInp = document.getElementById('format');

const forceWL = document.getElementById('forceWLToggle');


async function init() {

    //first, add listeners for the bottom bar buttons
    document.getElementById('updateRegion').addEventListener("click", writeScoreboard);
    document.getElementById('settingsRegion').addEventListener("click", moveViewport);
    document.getElementById('closeSettings').addEventListener("click", goBack);

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

    //if clicking them, show the character roster
    document.getElementById('p1CharSelector').addEventListener("click", openChars);
    document.getElementById('p2CharSelector').addEventListener("click", openChars);

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
    });
    p2NameInp.addEventListener("change", () => {
        p2NScoreInp.value = "0";
        changeInputWidth(p2NScoreInp);
    });

    //preset save buttons
    document.getElementById('savePresetP1').addEventListener('pointerdown', () => savePreset(1));
    document.getElementById('savePresetP2').addEventListener('pointerdown', () => savePreset(2));

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
    document.getElementById('presetSearchInp').addEventListener('input', (e) => renderPresetList(e.target.value));

    await loadPresets();

    //resize the box whenever the user types
    p1TagInp.addEventListener("input", resizeInput);
    p2TagInp.addEventListener("input", resizeInput);

    p1PronInp.addEventListener("input", resizeInput);
    p2PronInp.addEventListener("input", resizeInput);

    p1NScoreInp.addEventListener("input", resizeInput);
    p2NScoreInp.addEventListener("input", resizeInput);

    //set click listeners to cycle between best of values
    document.getElementById("boToggleDiv").addEventListener("click", changeBestOf);
    document.getElementById("boPrevDiv").addEventListener("click", changeBestOfPrev);
    document.getElementById("boToggleDiv").style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";
    document.getElementById("boPrevDiv").style.backgroundImage = "linear-gradient(to top, #575757, #00000000)";


    //check if the round is grand finals
    roundInp.addEventListener("input", checkRound);


    //add a listener to the swap button
    document.getElementById('swapButton').addEventListener("click", swap);
    //add a listener to the clear button
    document.getElementById('clearButton').addEventListener("click", clearPlayers);


    /* SETTINGS */

    //set a listener for the forceWL check
    forceWL.addEventListener("click", forceWLtoggles);

    document.getElementById("copyMatch").addEventListener("click", copyMatch);

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
        if (movedSettings) { //if settings are open, close them
            goBack();
        } else if (document.getElementById('charRoster').style.opacity == 1) {
            hideChars(); //if charRoster is visible, hide it
        } else {
            clearPlayers();
        }
    });

    Mousetrap.bind('f1', () => { giveWinP1() });
    Mousetrap.bind('f2', () => { giveWinP2() });

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

        currentBestOf = data.bestOf || "Bo3";
        roundInp.value = data.round || roundInp.value;
        formatInp.value = data.format || formatInp.value;

        document.getElementById('tournamentName').value = data.tournamentName || "";
        document.getElementById('cName1').value = data.caster1Name || "";
        document.getElementById('cTwitter1').value = data.caster1Twitter || "";
        document.getElementById('cTwitch1').value = data.caster1Twitch || "";
        document.getElementById('cName2').value = data.caster2Name || "";
        document.getElementById('cTwitter2').value = data.caster2Twitter || "";
        document.getElementById('cTwitch2').value = data.caster2Twitch || "";

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

            // show notification
            const popup = document.getElementById('remoteUpdatePopup');
            if (popup) {
                popup.classList.add('show');
                setTimeout(() => {
                    popup.classList.remove('show');
                }, 1000);
            }
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
    charP1Active = false; //simple check to know if this is P1 or P2, used on other functions
    if (this == document.getElementById('p1CharSelector')) {
        charP1Active = true;
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
    if (charP1Active) {
        charP1 = this.id;
        skinP1 = `1`;
        document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/' + charP1 + '.png');
        charImgChange(charImgP1, charP1);
        addSkinIcons(1);
    } else {
        charP2 = this.id;
        skinP2 = `1`;
        document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/' + charP2 + '.png');
        charImgChange(charImgP2, charP2);
        addSkinIcons(2);
    }
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


function changeBestOf() {
    if (currentBestOf === "Bo3") currentBestOf = "Bo5";
    else if (currentBestOf === "Bo5") currentBestOf = "BoX";
    else if (currentBestOf === "BoX") currentBestOf = "Ft5";
    else if (currentBestOf === "Ft5") currentBestOf = "Ft10";
    else if (currentBestOf === "Ft10") currentBestOf = "FtX";
    else currentBestOf = "Bo3";
    applyBestOf();
}

function changeBestOfPrev() {
    if (currentBestOf === "Bo3") currentBestOf = "FtX";
    else if (currentBestOf === "FtX") currentBestOf = "Ft10";
    else if (currentBestOf === "Ft10") currentBestOf = "Ft5";
    else if (currentBestOf === "Ft5") currentBestOf = "BoX";
    else if (currentBestOf === "BoX") currentBestOf = "Bo5";
    else currentBestOf = "Bo3";
    applyBestOf();
}

function applyBestOf() {
    const btn = document.getElementById("boToggleDiv");
    if (!btn) return;
    const labels = { Bo3: "Best of 3", Bo5: "Best of 5", BoX: "Best of X", Ft5: "First to 5", Ft10: "First to 10", FtX: "First to X" };
    btn.textContent = labels[currentBestOf] || "Best of 3";
}


function checkRound() {
    if (!forceWL.checked) {
        const wlButtons = document.getElementsByClassName("wlButtons");

        if (roundInp.value.toLocaleUpperCase().includes("Grand".toLocaleUpperCase())) {
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
    let tempP2Name = p2NameInp.value;
    let tempP2Team = p2TagInp.value;
    let tempP2Pron = p2PronInp.value;
    let tempP2NScore = p2NScoreInp.value;

    p1NameInp.value = tempP2Name;
    p1TagInp.value = tempP2Team;
    p1PronInp.value = tempP2Pron;
    p1NScoreInp.value = tempP2NScore;
    p2NameInp.value = tempP1Name;
    p2TagInp.value = tempP1Team;
    p2PronInp.value = tempP1Pron;
    p2NScoreInp.value = tempP1NScore;

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


}

async function loadPresets() {
    try {
        const res = await fetch(API_BASE + '/api/presets');
        playerPresets = await res.json();
    } catch (e) {
        playerPresets = [];
    }
}

async function savePreset(pNum) {
    const nameInp = pNum === 1 ? p1NameInp : p2NameInp;
    const tagInp  = pNum === 1 ? p1TagInp  : p2TagInp;
    const pronInp = pNum === 1 ? p1PronInp : p2PronInp;
    const name = nameInp.value.trim();
    if (!name) return;
    const character = pNum === 1 ? charP1 : charP2;
    const skin      = pNum === 1 ? skinP1 : skinP2;
    await fetch(API_BASE + '/api/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tag: tagInp.value, pronouns: pronInp.value, character, skin })
    });
    await loadPresets();
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
}

function closePresetPanel() {
    const panel = document.getElementById('presetPanel');
    panel.style.opacity = '0';
    panel.style.transform = 'scale(1.05)';
    setTimeout(() => { panel.style.display = 'none'; }, 200);
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

        const p1Btn = document.createElement('button');
        p1Btn.className = 'loadPBtn';
        p1Btn.textContent = 'P1';
        p1Btn.addEventListener('click', () => { applyPreset(1, preset); closePresetPanel(); });

        const p2Btn = document.createElement('button');
        p2Btn.className = 'loadPBtn';
        p2Btn.textContent = 'P2';
        p2Btn.addEventListener('click', () => { applyPreset(2, preset); closePresetPanel(); });

        const delBtn = document.createElement('button');
        delBtn.className = 'presetDeleteBtn';
        delBtn.textContent = '✕';
        delBtn.title = 'Delete preset';
        delBtn.addEventListener('click', () => deletePreset(preset.name));

        row.appendChild(info);
        row.appendChild(p1Btn);
        row.appendChild(p2Btn);
        row.appendChild(delBtn);
        container.appendChild(row);
    });
}

function applyPreset(pNum, preset) {
    const nameInp = pNum === 1 ? p1NameInp : p2NameInp;
    const tagInp  = pNum === 1 ? p1TagInp  : p2TagInp;
    const pronInp = pNum === 1 ? p1PronInp : p2PronInp;
    nameInp.value = preset.name;
    tagInp.value  = preset.tag || '';
    pronInp.value = preset.pronouns || '';
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


function clearPlayers() {
    //clear player texts
    p1TagInp.value = "";
    p1NameInp.value = "";
    p1PronInp.value = "";
    p1NScoreInp.value = "0";
    p2TagInp.value = "";
    p2NameInp.value = "";
    p2PronInp.value = "";
    p2NScoreInp.value = "0";
    roundInp.value = "";
    changeInputWidth(p1TagInp);
    changeInputWidth(p1NameInp);
    changeInputWidth(p1PronInp);
    changeInputWidth(p1NScoreInp);
    changeInputWidth(p2TagInp);
    changeInputWidth(p2NameInp);
    changeInputWidth(p2PronInp);
    changeInputWidth(p2NScoreInp);


    //reset characters to random
    document.getElementById('p1CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    charP1 = "Random";
    skinP1 = "";
    charImgChange(charImgP1, charP1);
    document.getElementById('skinListP1').innerHTML = '';
    document.getElementById('skinListP1Sheik').innerHTML = '';
    document.getElementById('skinSelectorP1').style.opacity = 0;

    document.getElementById('p2CharSelector').setAttribute('src', charPath + '/CSS/Random.png');
    charP2 = "Random";
    skinP2 = "";
    charImgChange(charImgP2, charP2);
    document.getElementById('skinListP2').innerHTML = '';
    document.getElementById('skinListP2Sheik').innerHTML = '';
    document.getElementById('skinSelectorP2').style.opacity = 0;

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

function copyMatch() {

    //initialize the string
    let copiedText = document.getElementById('tournamentName').value + " " + roundInp.value + " - ";

    if (p1TagInp.value) {
        copiedText += p1TagInp.value + " | ";
    }
    copiedText += p1NameInp.value + " (" + charP1 + ") Vs. ";
    if (p2TagInp.value) {
        copiedText += p2TagInp.value + " | ";
    }
    copiedText += p2NameInp.value + " (" + charP2 + ")";
    // } else {
    //     if(tNameInps[0] == "" && tNameInps == ""){
    //         copiedText += 
    //     }
    //     copiedText += tNameInps[0].value + " Vs " + tNameInps[1].value;
    // }
    // copiedText += " - " + roundInp.value + " - " + document.getElementById('tournamentName').value;

    //send the string to the user's clipboard
    navigator.clipboard.writeText(copiedText);
}


// sends the signal to electron to activate always on top
// function alwaysOnTop() {
//     ipc.send('alwaysOnTop', this.checked);
//     saveGUISettings();
// }


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
        p2Name: p2NameInp.value,
        p2Team: p2TagInp.value,
        p2Pron: p2PronInp.value,
        p2NScore: p2NScoreInp.value,
        p2Character: charP2,
        p2Skin: skinP2,
        p2Color: colorP2,
        p2WL: currentP2WL,
        bestOf: currentBestOf,
        round: roundInp.value,
        format: formatInp.value,
        tournamentName: document.getElementById('tournamentName').value,
        caster1Name: document.getElementById('cName1').value,
        caster1Twitter: document.getElementById('cTwitter1').value,
        caster1Twitch: document.getElementById('cTwitch1').value,
        caster2Name: document.getElementById('cName2').value,
        caster2Twitter: document.getElementById('cTwitter2').value,
        caster2Twitch: document.getElementById('cTwitch2').value,
        allowIntro: document.getElementById('allowIntro').checked,
        // alwaysOnTop: document.getElementById('alwaysOnTop').checked,
    };

    await saveData(scoreboardJson);
}