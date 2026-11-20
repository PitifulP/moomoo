# MooMoo.io — Self-Hosted Server

MooMoo.io is a multiplayer browser survival game. Gather resources, craft weapons, build structures, and survive against other players and AI. This repository is the complete self-hosted server for game version **1.7.6** — fully standalone, no external dependencies.

---

## What You Get

- Complete game server with all original mechanics
- Runs entirely on your machine — one command, one process
- Two game modes: **normal** and **sandbox**
- Works on Mac, Linux, and Windows

---

## Requirements

- [Node.js](https://nodejs.org/) **v18 or newer**

Fully standalone — no external dependencies.

---

## Quick Start

### macOS / Linux

```bash
git clone https://github.com/PitifulP/moomoo.git
cd moomoo
npm install
npm start
```

### Windows

1. Install [Node.js](https://nodejs.org/) (LTS version)
2. Open **Command Prompt** or **PowerShell**

```bat
git clone https://github.com/PitifulP/moomoo.git
cd moomoo
npm install
npm start
```

Then open your browser and go to `http://localhost:3000`. You'll land on the server automatically.

> **No Git?** Download the repo as a ZIP from GitHub, extract it, then run `npm install` and `npm start` from inside the folder.

---

## Playing the Game

Enter a name and click **Enter Game**. Gather resources by clicking near trees, rocks, and bushes. Buy hats and accessories from the shop. Form alliances and climb the leaderboard.

**Controls:**

| Action | Key |
|---|---|
| Move | W A S D |
| Look / Aim | Mouse |
| Attack / Gather | Left Click or Space |
| Auto Attack | E |
| Select Item | 1–9 or Click |
| Quick Food | Q |
| Lock Rotation | X |
| Ping Minimap | R |
| Chat | Enter |
| Close Menus | Escape |

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | port range: `1–65535` |
| `MODE` | `normal` | `normal` or `sandbox` |

**macOS / Linux:**
```bash
PORT=8080 MODE=sandbox npm start
```

**Windows (Command Prompt):**
```bat
set PORT=8080 && set MODE=sandbox && npm start
```

**Windows (PowerShell):**
```powershell
$env:PORT="8080"; $env:MODE="sandbox"; npm start
```

**Sandbox mode** removes building limits — useful for testing or casual play with friends.

---

## Docker

```bash
docker build -t moomoo .
docker run -p 3000:3000 moomoo
```

With custom settings:
```bash
docker run -p 8080:8080 -e PORT=8080 -e MODE=sandbox moomoo
```

---

## Hosting for Others

### Local Network (LAN)

Players on the same Wi-Fi can connect using your local IP:

1. Find your local IP:
   - **macOS / Linux:** `ifconfig` or `ip addr` — look for `192.168.x.x`
   - **Windows:** `ipconfig` — look for **IPv4 Address**
2. Share `http://192.168.x.x:3000` with anyone on the same network

### Opening to the Internet — Read This First

Exposing your machine directly to the internet comes with real risks:

- Anyone who finds your IP can connect and abuse the server
- Your home IP address becomes publicly visible
- DDoS attacks, port scanners, and bots regularly probe open ports
- Your ISP may not allow hosting on residential connections

**If you still want to expose your home machine**, forward port `3000` on your router to your local machine, then find your public IP at [whatismyip.com](https://www.whatismyip.com/). Share `http://your-public-ip:3000`. How to port forward varies by router — search for your router model + "port forwarding".

### Safer Alternative — Tunnels (No Port Forwarding Required)

Tunneling tools create a secure public URL that forwards traffic to your local server without exposing your IP or touching your router. Much safer for casual use.

**[ngrok](https://ngrok.com/)** — the most popular option, free tier available:
```bash
# Install from https://ngrok.com/download, then:
ngrok http 3000
```
ngrok gives you a public HTTPS URL like `https://abc123.ngrok.io`. Share it and you're done. Free tier has connection limits and the URL changes every restart.

**[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)** — completely free, no connection limits, stable URLs if you have a domain:
```bash
# Install cloudflared, then:
cloudflared tunnel --url http://localhost:3000
```
Best choice if you want something more permanent and reliable. Requires a free Cloudflare account.

Both options are significantly safer than opening a port on your router because your real IP stays hidden.

---

## Easy Cloud Hosting — [pashka.host](https://www.pashka.host)

The simplest way to get your MooMoo server online 24/7. No hardware, no setup headaches, no technical knowledge required.

**Starting from just 0.95€/month.**

1. Go to [pashka.host/products/app](https://pashka.host/products/app) and pick a package
2. After deployment, either:
   - **Upload the files** from this repository directly through the panel file manager, or
   - **Install from GitHub** by setting the repository to `github.com/PitifulP/moomoo` in the startup variables
3. That's it — the panel handles installation automatically. Your server is live within minutes.

Share the server IP with your friends and start playing. No commands to run, no coding knowledge required. A cheap way to keep your game running around the clock.

---

## Project Structure

```
moomoo/
  server.js                  — entry point: HTTP server, WebSocket, game loop
  package.json               — dependencies and start script
  Dockerfile                 — container build for Docker deployments
  LICENSE                    — GNU GPL v3
  README.md

  source/                    — server-side game modules (dependency-injected)
    config.js                — map size, speeds, biome settings, weapon variants
    utils.js                 — math helpers, packet code maps, random utilities
    items.js                 — all weapons, tools, and buildable item definitions
    store.js                 — hat and accessory shop catalogue with prices
    player.js                — player state, movement, combat, resource gathering
    ai.js                    — individual AI entity (animals and enemies)
    aiManager.js             — AI spawning, behaviour, and respawn logic
    gameObject.js            — placeable structure (wall, spike, windmill, etc.)
    objectManager.js         — grid-based collision, object placement and removal
    projectile.js            — individual projectile (arrow, bullet)
    projectileManager.js     — projectile spawning, travel, and hit detection
    tribe.js                 — single alliance data (members, join queue)
    tribeManager.js          — alliance creation, deletion, and lookup
    worldGen.js              — map population: trees, rocks, bushes, gold, animals

  public/                    — static files served directly to the browser
    index.html               — game page (menu, canvas, UI elements)

    assets/
      bundle.js              — compiled game client (rendering, input, networking)
      manifest.json          — PWA manifest for home-screen install

    css/
      main.css               — core game and menu styles
      icons.css              — Material Icons font
      fonts.css              — custom font declarations
      fonts/                 — WOFF2 font files

    img/
      favicon.png            — browser tab icon
      icon.png               — PWA / home-screen icon
      accessories/           — 21 accessory sprites (access_1 – access_21)
      animals/               — animal and enemy sprites (cow, pig, wolf, bull…)
      hats/                  — hat sprites including helmet and crown variants
      weapons/               — weapon sprites with material variants (_g _d _r _e)
      icons/                 — crown.png (kill leader), skull.png (death)
      resources/             — HUD icons for wood, food, stone, gold
      promotion/             — banner.png used in the main menu
      sound/
        menu.mp3             — main menu music (old game file, no longer used)

    docs/
      versions.txt           — game changelog
      privacy.txt            — privacy policy
      terms.txt              — terms of service
```

---

## License

[GNU General Public License v3.0](LICENSE) — free to run, modify, and distribute. Any distributed version must remain open source under the same license.
