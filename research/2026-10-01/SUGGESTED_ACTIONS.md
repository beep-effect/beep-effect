# SUGGESTED_ACTIONS — 2026-10-01

Executable capture lines + ledger/watchlist ops for publisher/human admit. Never auto-merge.

## Captures (window_new / BREAK)

```bash
bun run beep research capture https://www.lawnext.com/2026/09/clio-acquires-learned-hand-giving-its-new-judiciary-business-an-existing-product.html --tags law,clio,judiciary,learned-hand
bun run beep research capture https://www.prnewswire.com/news-releases/clio-acquires-learned-hand-302893566.html --tags law,clio,judiciary,press
bun run beep research capture https://www.gov.ca.gov/2026/09/30/californias-nation-leading-ai-framework-just-got-stronger-governor-newsom-signs-more-first-in-the-nation-worker-protections-and-more/ --tags law,california,sb574,genai
bun run beep research capture https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB574 --tags law,california,sb574,statute
bun run beep research capture https://www.npmjs.com/package/effect/v/4.0.0 --tags effect,npm,stable,4.0.0
bun run beep research capture https://github.com/Effect-TS/effect/pull/8577 --tags effect,github,changesets,8577
# #8577 merged 2026-10-01 (effect@4.0.0). Refresh a prior capture of this URL;
# a skip would leave the vault card on the open / rc.119 state.
bun run beep research capture https://www.npmjs.com/package/@rocicorp/zero/v/1.11.0-canary.21 --tags zero,canary,local-first
bun run beep research capture https://www.npmjs.com/package/@evolu/common/v/8.14.0 --tags evolu,npm,local-first
bun run beep research capture https://arxiv.org/abs/2609.39607 --tags agents,skills,security,arxiv,pretext
bun run beep research capture https://arxiv.org/abs/2609.39450 --tags agents,skills,authorization,arxiv
bun run beep research capture https://arxiv.org/abs/2609.39065 --tags agents,skills,trust,arxiv
bun run beep research capture https://arxiv.org/abs/2609.39352 --tags agents,skills,poisoning,arxiv
bun run beep research capture https://arxiv.org/abs/2609.38822 --tags agents,skills,retrieval,arxiv
```

## Ledger / watchlist ops (after admit)

Publisher-only sidecars (`LEDGER_PATCH/stamp.json`, `WATCHLIST_PATCH.md`) are not
in this packet. The admit deltas are already on the tip:

- Stamp: `research/ledger/stamp.json` — `lastSuccessfulRun: 2026-10-01T08:19:00-05:00`, `lastSuccessfulPacket: research/2026-10-01`, `lastSuccessfulPr: 1391`, `lastAttemptedStatus: partial` (lastAttempted* mirrors lastSuccessful*).
- Watchlist: `research/ledger/WATCHLIST.md` (`updated: 2026-10-01`).
- Retired `w-effect-rc118` / `w-effect-rc119`; tip watch is **effect@4.0.0** (`w-effect-400`).
- Retargeted `w-zero-canary` → **1.11.0-canary.21**; head → **20261001**.
- Retargeted Evolu tip → **@evolu/common@8.14.0** (`w-evolu-8140`; 8.12.0 retired).
- Kept HOLDs: USPTO four-field, Harvey–Everlaw fall 2026, iManage/TR coming soon, Instant 2027-08-31, drizzle #6162, MCP #3306, SEP-3004 closed, SEP-2640 SDK ship, jazz alpha.58, Patlytics MCP.
- Added watches: Clio judiciary / Learned Hand; CA SB 574 compliance; Pretext / ActionGuard / TrustProbe.

## Do not

- Auto-merge any PR.
- Bump JSDoc baseline to clear unrelated findings.
- Re-capture excluded Legora UK/Munich / prior tip version URLs as window_new.
