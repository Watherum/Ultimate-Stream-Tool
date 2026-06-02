# Ultimate Stream Tool — V6.0.0

A desktop application for managing Smash Ultimate tournament livestream overlays. Built on Electron with a local HTTP server, it lets a streamer control OBS browser source overlays from a GUI or remotely from any device on the same network.

---

## Features

### Player Info
- Per-player fields: **name**, **team tag**, **pronouns**, **character**, **skin**, **color**
- **Player presets** — save, load, and delete named presets that store name, tag, pronouns, character, skin, seed, and country together
- Typing a player name autocompletes from saved presets

### Scores & Match State
- Score counters for both players with increment / decrement
- **Win/Loss (W/L)** indicators for Grand Finals bracket tracking
- **Series score** (game count) displayed on overlays separately from match score
- **Best Of mode** cycling button — cycles forward or backward through: Bo3 · Bo5 · BoX · Ft5 · Ft10 · FtX · WL · CB
- Each mode maps to a display prefix (e.g. "Best of", "First To") defined in `BestOfModes.json`

### Round Names
- **Preset mode** (default) — dropdown populated from `RoundNames.json`:
  - Winners bracket: Winners Round, Winners Pre-Top, Winners Top, Winners Quarters, Winners Semis, Winners Finals
  - Losers bracket: Losers Round, Losers Pre-Top, Losers Top, Losers Quarters, Losers Semis, Losers Finals
  - Finals: Grand Finals, Grand Finals Reset, True Finals
  - Other: Friendlies, Money Match, Exhibition Match, Custom Text, (None)
- Rounds marked with `showNumber` show a number input — composed as `Round Name <number>` (e.g. `Winners Round 4`)
- **Custom mode** — free text input instead of the dropdown
- Abbreviation settings (in the Settings panel):
  - **Abbreviate round names** — `Round` → `Rd`, `Quarters` → `Qrts`
  - **Abbreviate Winners & Losers** *(sub-setting, visible when the above is checked)* — `Winners` → `Wnrs`, `Losers` → `Lsrs`

### Player Flags & Seeds
- Per-player **country** field (full country name, e.g. `United States`) with flag preview in the GUI
- Per-player **tournament seed** number
- Both appear on the Watherum and Capital Region scoreboard overlays
- Both are saved and restored with player presets

### start.gg Import
- Enter a start.gg **API token** and **event slug** to bulk-import all entrants from a bracket
- Upserts tag, seed, and country into local player presets — preserves existing character/skin/pronoun data
- Reports how many players were found and how many were new vs. updated
- Imported players are available for autocomplete in the name fields

### Caster Info
- Two caster slots, each with **name**, **Twitter**, and **Twitch** handle
- The main scoreboard overlay alternates between Twitter and Twitch on a timed interval

### Overlays (OBS Browser Sources — 1920×1080)
- **Game Scoreboard.html** — main match overlay with character stock icons, scores, round, format, caster bar; animated with GSAP; includes an optional intro sequence
- **VS Screen.html** — between-game matchup display
- **Caster Screen.html** — commentator info display
- **Watherum Scoreboard.html** — alternate scoreboard layout with flags and seeds
- **Capital Region Scoreboard.html** — Capital Region branded scoreboard with flags and seeds

All overlays poll for data changes every 500 ms and update automatically — no refresh required.

### Remote Control
- The app runs a local HTTP server on port **1111** (configurable in Settings)
- The full GUI is accessible from any device on the same network at `http://<your-ip>:1111`
- The remote GUI is mobile-optimized with a sticky update bar, full-screen panels, and large score +/− buttons

### Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `Enter` | Update scoreboard |
| `ESC` | Clear player info |
| `Ctrl+Shift+I` | Open/close developer tools |
| `Ctrl+F5` | Hard-reload the interface |

**Score hotkeys** — two mutually exclusive modes selectable in Settings:

*Update on score hotkeys* (on by default):
| Shortcut | Action |
|---|---|
| `F1` | P1 score +1 |
| `F2` | P2 score +1 |
| `Shift+F1` | P1 score −1 |
| `Shift+F2` | P2 score −1 |

*Backwards hotkeys* — same keys, reversed direction. With neither checked, score hotkeys are disabled.

### Settings Panel
| Setting | Description |
|---|---|
| Use custom round | Switch the round field to a free text input |
| Abbreviate round names | Shortens Round → Rd, Quarters → Qrts |
| Abbreviate Winners & Losers | Sub-setting: Winners → Wnrs, Losers → Lsrs |
| Allow Intro | Plays the intro animation when the scoreboard loads |
| Force [W] / [L] | Always show the W/L bracket status buttons |
| Update on score hotkeys | F1/F2 trigger a full scoreboard update |
| Backwards hotkeys | Reverses F1/F2 score direction |
| Write simple texts | Writes individual `.txt` files for OBS text sources |
| Always on top | Keeps the app window above other windows |
| Resizable window | Allows the app window to be freely resized |
| Port | HTTP server port (default 1111) |
| start.gg API Token | Token for the start.gg import feature |

All settings are persisted across sessions.

### Simple Texts
When **Write simple texts** is enabled, the app writes individual `.txt` files to `Stream Tool/Resources/Texts/Simple Texts/` for every scoreboard field — usable as OBS text sources without a browser source.

### Copy Match to Clipboard
The **Copy match info** button in Settings copies a formatted match string to the clipboard:
`Tournament Name - Player1 (Character1) vs Player2 (Character2) - Round`

---

## Setup Guide

You can watch [this video](https://www.youtube.com/watch?v=417QjymeOMk) or follow the steps below.

These instructions are for OBS Studio:
1. Download the ZIP file and extract it somewhere.
2. Drag and drop `Stream Tool/Game Scoreboard.html` into OBS as a browser source.
3. Set the source properties to **1920 × 1080**.
4. Set *Use custom frame rate* → `60` (if streaming at 60 fps).
5. **Tick** `Refresh browser when scene becomes active`.
6. Launch `Ultimate Stream Tool.exe` and start updating.

Repeat from step 2 to add `VS Screen.html`, `Caster Screen.html`, or either of the alternate scoreboards — recommended on a separate scene.

Two OBS transitions are included in `Resources/OBS Transitions/`:
- Add a new stinger transition, set the video to `Game In.webm` or `Swoosh.webm`, and set the transition point to `350 ms`.

---

## Customization

- Edit `RoundNames.json` to add, remove, or reorder round options.
- Edit `BestOfModes.json` to change the display name or prefix for each Best Of mode.
- Replace overlay images in `Resources/Overlay/` to reskin the scoreboards.
- Replace character renders in `Resources/Characters/` (WebP format).
- The overlay HTML/JS files are plain and fully editable.

---

## Original README

*Also available for [Melee](https://github.com/Readek/Melee-Stream-Tool), [Rivals of Aether](https://github.com/Readek/RoA-Stream-Tool) and [Rushdown Revolt](https://github.com/Readek/Rushdown-Revolt-Stream-Tool)!*

So you're interested in doing Smash Ultimate streams, huh? Luckily for you, with this tool you'll be able to update all the variables you need for the provided overlays with the provided GUI, and easily customize the overlays to make them your own! 

The tool is free, but if you want to keep supporting the project and other Smash and non related stuff, you can donate me something on [Paypal](https://www.paypal.me/robertof2712). Thanks in advance!

If you are also interested in adapting your layout with the stream tool or having a brand new one, lucky for you, I'm open for commisions! Contact me on Twitter [@pokeroby_beto](https://twitter.com/pokeroby_beto).

---

### Features
- [Handy interface](https://pbs.twimg.com/media/FMEbkQ2XEAgQV22?format=jpg&name=large) to quickly change everything you need, like player names, characters, scores, round, casters...
- Easy and fast setup using a browser source. Drag and drop!
- A [game overlay](https://pbs.twimg.com/media/FMEbkQ2XEAgQV22?format=jpg&name=large) is included, with renders for all characters and skins!
- A [VS Screen](https://pbs.twimg.com/media/E4AELv_VcAQTj5Q?format=jpg&name=large) is also included, to be used in pauses between games.
- A [Caster Screen](https://pbs.twimg.com/media/FMEbnOaXIAIqeye?format=jpg&name=large) is also included, with a simple overlay on which to write nicks and social networks .
- Easy to customize! Made in html/javascript, every file can be edited at will!
- This is **not** a Stream Control clone. It doesn't have anything to do with it, everything is custom made.
- If you have any feedback, whether it's an issue with the program or a feature you'd like to see in a future release, you can write down your suggestions in [this form](https://forms.gle/2TLLcnd1nxtHohZs5)

---

### Setup Guide
You can watch [this video](https://www.youtube.com/watch?v=417QjymeOMk) I made or follow the steps below. 

These are instructions for regular OBS Studio, but I imagine you can do the same with other streaming software:
- Dowmload the ZIP file.
- Extract somewhere.
- Drag and drop `Game Scoreboard.html` into OBS, or add a new browser source in OBS pointing at the local file.
- If the source looks weird, manually set the source's propierties to 1920 width and 1080 height, or set your OBS canvas resolution to 1080p, or make the source fit the screen.
- In the source's propierties, change *Use custom frame rate* -> `60` (if streaming at 60fps of course).
- **Also tick** `Refresh browser when scene becomes active`.
- Manage it all with the `Ultimate ST` executable.

Repeat from the 3rd step to add the `VS Screen.html` and `Caster Screen.html`, though I recommend you to do so on another scene.

#### Interface shortcuts!
- Press `Enter` to update.
- Press `ESC` to clear player info.
- Press `Ctrl+Shift+I` to open/close the developer tools.
- Press `Ctrl+F5` to hard-reload the interface.

##### Score hotkeys
Score hotkeys are controlled by two mutually exclusive settings (checking one unchecks the other):

**Update on score hotkeys** *(on by default)*
| Shortcut | Action |
|---|---|
| `F1` | P1 score +1 |
| `F2` | P2 score +1 |
| `Shift+F1` | P1 score -1 |
| `Shift+F2` | P2 score -1 |

**Backwards hotkeys** — same keys, reversed direction:
| Shortcut | Action |
|---|---|
| `F1` | P1 score -1 |
| `F2` | P2 score -1 |
| `Shift+F1` | P1 score +1 |
| `Shift+F2` | P2 score +1 |

With neither setting checked, all score hotkeys are disabled.

2 basic transitions are included in the `Resources/OBS Transitions` folder, if you don't have a transition yourself of course. To use them on OBS:
- Add a new stinger transition.
- Set the video file to `Game In.webm` or `Swoosh.webm`.
- Transition point -> `350 ms`.
- I recommend you to set the Audio Fade Style to crossfade, just in case.
- On the scene's right click menu, set it to Transition Override to the transition you just created.

The interface will also update basic text files with the match info at `Resources/Texts/Simple Texts/` so you can add them to OBS with ease.


---

### Player Flags & Seeds

Each player slot has two extra fields alongside their name:

- **Seed** — the player's tournament seeding number.
- **Country** — the player's country (full name, e.g. `United States`). A flag preview is shown next to the field.

Both fields are included when saving/loading player presets and are cleared alongside the rest of the player info when using the clear button.

The overlay (`Watherum Scoreboard.html`) reads these values and displays the corresponding flag image and seed number on the 1920×1080 canvas.

#### start.gg Import

The settings panel includes a **start.gg Import** section that can bulk-populate player data directly from a tournament bracket:

1. Enter your start.gg API token (or add it to `Resources/app.properties.txt` as `startgg.apiKey=your_token_here` to have it load automatically on startup).
2. Enter the tournament event slug in the format `tournament/your-tournament-name/event/your-event-name` (e.g. `tournament/genesis-10/event/ultimate-singles`).
3. Click **Fetch Data**.

On a successful fetch the tool pages through all entrants (200 at a time) and upserts them all into your local player presets — updating tag, seed, and country for existing presets while preserving character/skin/pronoun data, and creating a new preset for any player not already saved. A status line reports how many players were found and how many were new vs. updated.

Once fetched, typing a player name into either name field will automatically fill in their tag, seed, and country if they appear in the imported data.

---

### Round Names

The round field supports two modes, switchable via **Use custom round** in Settings (off by default):

**Preset mode** (default) — a dropdown populated from `Resources/Texts/RoundNames.json`:
- Winners bracket: Winners Round, Winners Pre-Top, Winners Top, Winners Quarters, Winners Semis, Winners Finals
- Losers bracket: Losers Round, Losers Pre-Top, Losers Top, Losers Quarters, Losers Semis, Losers Finals
- Finals: Grand Finals, Grand Finals Reset, True Finals
- Other: First to, Friendlies, Money Match, Exhibition Match

Rounds marked with a number (e.g. "Winners Round", "Losers Top") show a small number input next to the dropdown — the composed value written to the scoreboard is `Round Name <number>` (e.g. `Winners Round 4`).

Selecting **First to** automatically switches the Best Of mode to **First to X**.

**Custom mode** — the round field becomes a free text input, same as before.

**Abbreviate round names** (on by default) — when enabled, abbreviates the output: `Round` → `Rd`, `Quarters` → `Qrts`. Only affects the value written to the scoreboard, not the dropdown labels. Works in preset mode only.

You can edit `RoundNames.json` to add, remove, or reorder entries. Each entry supports:
- `"name"` — the display label and written value
- `"showNumber": true` — show a number input alongside the dropdown
- `"forceFirstTo": "X"` — switch the Best Of button to First to X when selected

---

### Customizing stuff

If you want to customize the GUI, thats going to be a bit complicated since you will have to learn how electron works yourself. In any case, the source code is also on this github!

It is possible to customize how your Scoreboard, VS Screen and Caster Screen look by replacing the files in the overlay folder.

You can also replace the logo simply by adding a 200x200 resolution one.

While to change the position of the icons and writings you should modify parts of the code contained in the `html` and `js` files.

---

### Credits

The "Ultimate Stream Tool" was made by [beto](https://twitter.com/pokeroby_beto) with the help of [Andrei](https://twitter.com/dpandreww) and [Loci](https://twitter.com/Loci_AF). 

This is an upgraded version of the [Melee Stream Tool](https://github.com/Readek/Melee-Stream-Tool) made by [Readek](https://twitter.com/Readeku).

All the renders were taken from [The Spriters Resource](https://www.spriters-resource.com/nintendo_switch/supersmashbrosultimate/), [Cuphead render](https://www.deviantart.com/unbecomingname/art/Cuphead-Smash-Ultimate-Fan-Render-828617953), [Cuphead stock icon](https://twitter.com/altermentality/status/1009894947762233344), [Sans render](https://www.deviantart.com/unbecomingname/art/Sans-Smash-Ultimate-Fan-Render-812380081), [Sans stock icon](https://smashboards.com/members/haunterspencer.403470/), [Vs screen template](https://www.deviantart.com/lkgamingart/art/SSBU-VS-Splash-Screen-Template-2P-796548756)

For any feedback you can fill [this form](https://forms.gle/2TLLcnd1nxtHohZs5) or contact [beto](https://twitter.com/pokeroby_beto) on Twitter.
