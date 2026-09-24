'use strict';

//top 8 bracket overlay. the GUI's bracket editor writes Resources/Texts/Bracket.json,
//and this polls it the same way the scoreboards poll ScoreboardInfo.json

const ROUNDS = {
    WinnersSemis: 4,
    WinnersFinals: 2,
    GrandFinals: 2,
    TrueFinals: 2,
    LosersTop8: 4,
    LosersQuarters: 4,
    LosersSemis: 2,
    LosersFinals: 2
};
const playerSize = '28px';
const tagSize = '16px';
const fadeOutTime = .3;
const fadeInTime = .3;

let bracketData;
const playerData = {};


class BracketPlayer {

    constructor(round, pos, rowEl) {

        this.round = round;
        this.pos = pos;
        this.char = null;
        this.skin = null;

        this.nameEl = rowEl.querySelector(".playerName");
        this.tagEl = rowEl.querySelector(".playerTag");
        this.charEl = rowEl.querySelector(".playerIcon");
        this.scoreEl = rowEl.querySelector(".score");

    }

    data() {
        return bracketData.rounds[this.round][this.pos];
    }

    update() {

        const data = this.data();

        if (this.nameEl.textContent != data.name || this.tagEl.textContent != data.tag) {
            this.updateName();
        }

        if (this.scoreEl.textContent !== data.score) {
            this.updateScore();
        }

        //a new skin of the same character is a new icon too
        if (this.char != data.character || this.skin != data.skin) {
            this.updateChar();
        }

    }

    updateName() {

        const data = this.data();
        fadeOut(this.nameEl.parentElement).then(() => {

            this.nameEl.style.fontSize = playerSize;
            this.nameEl.textContent = data.name;
            this.tagEl.style.fontSize = tagSize;
            this.tagEl.textContent = data.tag;

            // remove tag from flow if not visible
            if (data.tag == "") {
                this.tagEl.style.display = "none";
                this.tagEl.parentElement.style.transform = "translate(3px, 0px)";
            } else {
                this.tagEl.style.display = "block";
                this.tagEl.parentElement.style.transform = "translate(3px, -3px)";
            }

            resizeText(this.nameEl.parentElement);
            fadeIn(this.nameEl.parentElement);

        });

    }

    updateScore() {

        this.scoreEl.textContent = this.data().score;
        this.updateScoreColor();

        // this will activate icon recolor for the other player
        playerData[this.round][this.rival()].updateScoreColor();

    }

    rival() {
        return this.pos % 2 ? this.pos - 1 : this.pos + 1;
    }

    updateScoreColor() {

        const homeScore = this.scoreEl.textContent;
        const awayScore = bracketData.rounds[this.round][this.rival()].score;

        // names keep their color either way, but the loser's icon greys out
        if (homeScore == awayScore) {
            this.charEl.style.filter = "grayscale(0)";
        } else if (Number.isFinite(Number(homeScore)) &&
        (Number(homeScore) > Number(awayScore) || !Number.isFinite(Number(awayScore)))) {
            this.charEl.style.filter = "grayscale(0)";
        } else {
            this.charEl.style.filter = "grayscale(1)";
        }

    }

    updateChar() {

        const data = this.data();
        this.char = data.character;
        this.skin = data.skin;

        fadeOut(this.charEl).then(() => {
            // hide character icon if none
            if (data.character == "None" || !data.character) {
                this.charEl.style.display = "none";
                this.charEl.removeAttribute("src");
            } else {
                this.charEl.src = `Resources/Characters/Stock Icons/${data.character}/${data.skin || "1"}.png`;
                this.charEl.style.display = "block";
            }
            fadeIn(this.charEl);
        });

    }

}


//every round gets its encounters built here, so the html only has to name them
for (const round in ROUNDS) {

    const roundEl = document.getElementById(round);
    playerData[round] = [];

    for (let i = 0; i < ROUNDS[round]; i += 2) {

        const encounter = document.createElement("div");
        encounter.className = "encounter";

        for (let j = 0; j < 2; j++) {
            const row = document.createElement("div");
            row.className = "encounterRow";
            row.innerHTML = `
                <div class="playerDiv">
                    <img class="playerIcon">
                    <div class="playerWrapper">
                        <div class="playerTag"></div>
                        <div class="playerName"></div>
                    </div>
                </div>
                <span class="score"></span>`;
            encounter.appendChild(row);
            playerData[round].push(new BracketPlayer(round, i + j, row));
        }

        roundEl.appendChild(encounter);

    }

}


// text colors, as chosen on the GUI's bracket editor
function updateColors(colors) {

    if (!colors) return; // keep the css defaults

    const root = document.documentElement;
    if (colors.round) root.style.setProperty("--roundColor", colors.round);
    if (colors.text) root.style.setProperty("--textColor", colors.text);
    if (colors.score) root.style.setProperty("--scoreColor", colors.score);

}


function updateData(data) {

    bracketData = data;
    updateColors(data.colors);

    for (const round in playerData) {
        if (!data.rounds?.[round]) continue;
        for (const player of playerData[round]) player.update();
    }

    // true finals only happen if the grand finals get reset
    const trueFinals = document.getElementById("TrueFinals");
    const trueFinalsUsed = data.rounds.TrueFinals.some(p => p.name != "-");
    if (trueFinalsUsed && trueFinals.style.display != "flex") {
        trueFinals.style.display = "flex";
        // the names were sized while hidden, so give them another go now they have a width
        for (const player of playerData.TrueFinals) resizeText(player.nameEl.parentElement);
    } else if (!trueFinalsUsed) {
        trueFinals.style.display = "none";
    }

}


//OBS local files won't do fetch, so it's XHR
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

let lastSerialized = null;
async function poll() {
    const json = await readJson("Resources/Texts/Bracket.json");
    if (!json?.rounds) return;

    const serialized = JSON.stringify(json);
    if (serialized === lastSerialized) return;
    lastSerialized = serialized;

    updateData(json);
}

poll();
setInterval(poll, 500);


// text resize, keeps making the text smaller until it fits
function resizeText(textEL) {
    // nothing to measure while hidden, and a zero width would never fit
    if (!textEL.offsetWidth) return;
    const childrens = textEL.children;
    let guard = 60;
    while (textEL.scrollWidth > textEL.offsetWidth && guard--) {
        if (childrens.length > 0) { //for tag+player texts
            Array.from(childrens).forEach((child) => {
                child.style.fontSize = getFontSize(child);
            });
        } else {
            textEL.style.fontSize = getFontSize(textEL);
        }
    }
}
// returns a smaller fontSize for the given element
function getFontSize(textElement) {
    return (parseFloat(textElement.style.fontSize.slice(0, -2)) * .90) + 'px';
}


// animations
async function fadeOut(itemID, dur = fadeOutTime) {
    itemID.style.animation = `fadeOut ${dur}s both`;
    // this function will return a promise when the animation ends
    await new Promise(resolve => setTimeout(resolve, dur * 1000));
}
function fadeIn(itemID, delay = 0, dur = fadeInTime) {
    itemID.style.animation = `fadeIn ${dur}s ${delay}s both`;
}
