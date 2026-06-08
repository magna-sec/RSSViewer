# Cyber Feed Reader

A browser-based cybersecurity RSS aggregator. Loads 45 feeds in parallel, merges them into a single chronological timeline, and caches results for 30 minutes.

## Features

- Aggregated timeline view (default) — all 45 feeds merged and sorted by date
- Individual feed view — click any feed in the sidebar to read it in isolation
- Category filters — CERT, News, Vulnerabilities, Vendor Blog, Malware Research, Exploit Research, Community
- 8 colour themes — Phantom, Matrix, Hellfire, Abyss, Reactor, Caveman, Win 95, Aero
- 30-minute localStorage cache — instant load on repeat visits
- CORS proxy via a personal Cloudflare Worker with allowlisted URLs only

## Feed Sources

Feed list sourced from [mr-r3b00t/cyber_rss](https://github.com/mr-r3b00t/cyber_rss).

6 feeds were removed after live testing (blocked all proxy IPs):
- ASD ACSC Alerts — `cyber.gov.au` blocks Cloudflare IP ranges
- Check Point Research — HTTP 403
- Rapid7 Blog + Rapid7 Emergent Threats — HTTP 403
- Google TAG — HTTP 404
- Zero Day Initiative Blog — HTTP 403

## Architecture

```
index.html          HTML structure
css/skins.css       Colour themes (ported from brainstuffer)
css/style.css       Component styles
js/feeds.js         Feed list (45 feeds, 8 categories)
js/skin.js          Theme switcher (ported from brainstuffer)
js/app.js           Application logic
```

### Cloudflare Worker

All RSS fetches are proxied through a personal Cloudflare Worker (`git.benjaminbarnes.workers.dev`) to bypass browser CORS restrictions. The worker has an explicit allowlist — it will 403 any URL not in the feed list, so it cannot be abused as a general proxy.

Public proxy services (allorigins.win, corsproxy.io) are used as fallbacks if the worker fails.

## Running Locally

Open `index.html` directly in a browser. No build step required.
