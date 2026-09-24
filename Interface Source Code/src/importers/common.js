const fs = require('fs');
const path = require('path');

/** Bracket round keys, paired with how many player slots each one holds */
const BRACKET_SLOTS = {
    WinnersSemis: 4,
    WinnersFinals: 2,
    GrandFinals: 2,
    TrueFinals: 2,
    LosersTop8: 4,
    LosersQuarters: 4,
    LosersSemis: 2,
    LosersFinals: 2
};

/** A bracket player slot that nobody has been placed into yet */
function blankBracketSlot() {
    return { name: "-", tag: "", character: "None", skin: "1", score: "-" };
}

/** A whole top 8 with every slot empty */
function blankBracket() {
    const bracket = {};
    for (const round in BRACKET_SLOTS) {
        bracket[round] = [];
        for (let i = 0; i < BRACKET_SLOTS[round]; i++) bracket[round].push(blankBracketSlot());
    }
    return bracket;
}

let countryByCode = {};
let codeByCountry = {};

/** Reads COUNTRY_CODES.json, called once the server knows where Resources is */
function loadCountryCodes(resourcesPath) {
    try {
        countryByCode = JSON.parse(fs.readFileSync(path.join(resourcesPath, 'COUNTRY_CODES.json'), 'utf8'));
    } catch (e) {
        countryByCode = {};
    }
    codeByCountry = Object.fromEntries(
        Object.entries(countryByCode).map(([code, name]) => [name.toLowerCase(), code])
    );
}

/** Turns an ISO 3166-1 alpha-2 code into a country name, "us" -> "United States" */
function countryNameFromCode(code) {
    if (!code) return "";
    return countryByCode[String(code).toLowerCase()] ?? "";
}

/** Turns a country name into its ISO 3166-1 alpha-2 code, used to find flag images */
function countryCodeFromName(name) {
    if (!name) return "";
    return codeByCountry[String(name).toLowerCase()] ?? "";
}

module.exports = {
    BRACKET_SLOTS,
    blankBracketSlot,
    blankBracket,
    loadCountryCodes,
    countryNameFromCode,
    countryCodeFromName
};
