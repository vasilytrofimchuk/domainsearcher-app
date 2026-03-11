# Startup Domain Search

[![Live Site](https://img.shields.io/badge/live-domainsearcher.app-brightgreen)](https://domainsearcher.app)
[![GitHub Stars](https://img.shields.io/github/stars/vasilytrofimchuk/domainsearcher-app?style=flat)](https://github.com/vasilytrofimchuk/domainsearcher-app/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Built with Groq](https://img.shields.io/badge/AI-Groq-orange)](https://console.groq.com)

**Score and choose the best domain name for your startup — not just generate and check.**

Describe your startup idea → get 60 creative, brandable domain name candidates → check real-time availability across the TLDs you care about → score each name on Length, Pronounceability, Memorability, Brandability, and AI Fit → pick the winner with confidence.

**Live site:** https://domainsearcher.app

## What it does

Most domain tools stop at availability. This one helps you **decide**. Every candidate is scored across five dimensions, weighted by you, so you can rank names objectively rather than going with gut feeling:

| Score | What it measures |
|-------|----------------|
| **LEN** | Length — 5 chars = perfect 10; score drops off for shorter/longer names |
| **PRO** | Pronounceability — syllable count, consonant clusters, vowel balance |
| **MEM** | Memorability — penalizes generic `-er`/`-or` suffixes, rewards distinctive endings |
| **BRD** | Brandability — rewards invented/coined words; penalizes generic compounds |
| **ZON** | Zone score — fraction of your "Compare zones" TLDs that are available |
| **FIT** | AI fit — how well the name evokes your app idea (requires FIT context input) |

Each score is 0–10. Weights are adjustable via the number inputs in the header row.

## Run locally

No build step. Serve the repo root over HTTP:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Open http://localhost:8080. Must use an HTTP server (not `file://`) for ES modules to work.

## How to use

1. **Type your startup idea** in the "Describe your idea" box
2. **Select TLDs** — toggle .ai, .com, .io, .app, .dev, etc.
3. **Click "Search Domains"** — names stream in as each domain is checked
4. **Star ★ domains** you like — they appear in the Favorites/Scoring panel
5. **Adjust score weights** to match what matters most to you (length vs. brandability vs. fit)
6. **Enter a FIT context** and click "Re-score FIT" to AI-score name relevance
7. **Save & Clear** to snapshot a favorite set — restore later

## API key

The tool uses a bundled Groq key by default (free tier, no setup needed).

To use your own key or switch to OpenAI/Anthropic, paste it in the **AI provider** row at the top of the Search form. Keys are stored in your browser's localStorage only.

| Provider | Key prefix | Where to get |
|----------|-----------|-------------|
| Groq (recommended) | `gsk_` | https://console.groq.com |
| OpenAI | `sk-` | https://platform.openai.com |
| Anthropic/Claude | `sk-ant-` | https://console.anthropic.com |

## Tech

- Static HTML + vanilla JS (ES modules)
- [rdap.org](https://rdap.org) for real-time domain availability (CORS-enabled, no auth)
- [Groq](https://console.groq.com) / OpenAI / Anthropic for AI name generation and scoring
- localStorage for all persistence (no backend, no account)
- GitHub Pages for hosting
