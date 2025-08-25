<p align="center">
  <!-- Replace with your own logo -->
  <img src="https://raw.githubusercontent.com/andremichelle/openDAW/refs/heads/main/packages/app/studio/public/favicon.svg" height="120" />
  <h1 align="center">Sona</h1>
  <h3 align="center">An AI-first web Digital Audio Workstation — a fork of <a href="https://github.com/andremichelle/openDAW">openDAW</a></h3>
</p>

<p align="center">
  <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="nofollow"><img src="https://img.shields.io/badge/license-GPLv3-blue.svg" alt="License: GPLv3"></a>
</p>

**Sona** is a privacy-first, browser-based **Digital Audio Workstation (DAW)** with **AI built in**.  
It’s a fork of the outstanding [openDAW](https://github.com/andremichelle/openDAW) project, extended with:

- **AI music generation** (describe a vibe → get clips/tracks/instruments).
- **Chat-to-mix**: ask in plain English to change **reverb, delay, EQ**, **tempo/speed**, and more.
- **Smart timing**: set **time signatures** (e.g., 4/4) and **quantize** to **1/2, 1/4, 1/8...**—just by asking.
- **Education-friendly onboarding**: contextual tips and explainers for every action.

No sign-ups. No tracking. No ads. Just music.

---

## Talk to Your DAW (Examples)

> Type these into Sona’s AI panel (or say them, if voice is enabled):

- “Make a **dreamy lo-fi** beat at **82 BPM**, vinyl hiss, soft keys.”
- “Set **time signature to 4/4** and **quantize** the drum clip to **1/8**.”
- “On **Vocals**, add a **plate reverb**: **35% wet**, **1.6s** decay.”
- “Give the snare a **dotted 1/8 delay**, low feedback.”
- “**EQ** the vocals: **HPF at 90Hz**, **-2 dB at 3 kHz**, **Q 1.2**.”
- “**Speed up** the whole song by **3%**.”
- “Tighten the **bass** timing: **quantize 1/4**, light strength.”
- “Make the chorus feel **wider and brighter**; keep verse warm.”
- “Turn this loop into **UK garage** at **132 BPM** with swung hats.”
- “Render a **30-second preview** starting at bar 17.”

---

## Why Sona

- **AI where it helps**: creation, mixing, and arrangement—without hiding the “how.”
- **Radically simple**: minimal UI, powerful under the hood.
- **Privacy by default**: local-first workflows wherever possible.

---

## Open Source & Credits

Sona is a **fork of [openDAW](https://github.com/andremichelle/openDAW)** by André Michelle (GPLv3).  
Huge respect to the original project and its philosophy of transparency and simplicity. This fork focuses on AI features and removes sections not applicable to this repo (community patrons, ambassador rosters, etc.).

---

## Tech & External Libraries

Sona inherits openDAW’s “avoid framework sprawl” approach. Current studio deps:

- [jszip](https://www.npmjs.com/package/jszip) — project bundle files  
- [markdown-it](https://www.npmjs.com/package/markdown-it) + [markdown-it-table](https://www.npmjs.com/package/markdown-it-table) — help pages  
- [d3-force](https://d3js.org/d3-force) — graph debugging

**Requirements**

- [Git](https://git-scm.com/)
- [mkcert](https://github.com/FiloSottile/mkcert#installation) — local HTTPS certs
- [Node.js](https://nodejs.org) **>= 23**
- [Sass](https://sass-lang.com/) (CLI/binaries available in env)
- [TypeScript](https://www.typescriptlang.org/)
- [OpenSSL](https://www.openssl.org/) (for cert tooling; usually preinstalled on macOS/Linux)

---

## Install & Run

> Replace `your-username/sona` with your repo path.

```bash
git clone https://github.com/your-username/sona.git
cd sona

# First time only
npm run cert

# Optional: revert to clean slate
npm run clean

# Install deps
npm install

# Build
npm run build

# Dev servers
npm run dev:studio     # Studio UI
# or
npm run dev:headless   # Headless mode

# Open the studio (note the port for CORS samples)
# https://localhost:8080
