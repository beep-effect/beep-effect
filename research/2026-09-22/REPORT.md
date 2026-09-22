# Nightly research packet — 2026-09-22

Window: `2026-09-17T08:45:00-05:00` → `2026-09-22T08:51:00-05:00` (America/Chicago).  
Prior: `research/2026-09-17` / PR #1171 (merged 2026-09-21). Status: **partial** (X client-not-enrolled).

## Delta-first

### Settled / moved

- **Effect tip broke hard:** `#8201` MERGED 2026-09-18 → `effect@4.0.0-rc.116` on npm; tip already **`4.0.0-rc.117`** (published 2026-09-21). Open `#8336` stages **rc.118**.
- **SchemaJIT `#7908` MERGED** 2026-09-18 (gcanti) — experimental JIT/AOT on main.
- **Effect MCP publish-gap closed:** `#7265` adapter now reachable via published rc.116+.
- **`#8354` MERGED** 2026-09-22 — `effect/unstable/*` → top-level `effect/*` (no compat exports; `@unstable` retained). SchemaJIT import paths move with it.
- **`#8365` MERGED** 2026-09-22 — `effect/httpapi` → `effect/http-api`.
- **jazz-tools alpha tip → `2.0.0-alpha.56`** (published 2026-09-21); prior alpha.55 HOLD broken.
- **Zero canary tip → `1.11.0-canary.11`** (was `1.10.0-canary.22`).
- **SEP-3004 CLOSED unmerged** 2026-09-22 (~7:39 AM CT) — not Final; audit-record contract did not ship.

### New (window)

- **OpenAI Astra for Law** (Legal IT Insider, Sep 17): GPT-6 Astra legal configuration + legal search index + 26 partner plugins (Harvey, Legora, iManage, TR, DeepJudge, Intapp). API path for Harvey/Legora.
- **Everlaw evidence-layer press** (ILTACON): TR CoCounsel + Harvey MCP expected fall 2026; Gemini/Copilot MCP connectors also fall 2026.
- **arXiv 2609.23498 RAC** (submitted Sep 20): authorization-drift guard for MCP workflows; TraceBench + live filesystem case study.

### Unchanged HOLDs (refuted attempt)

- USPTO ODP four-field gate still mandatory.
- iManage/TR CoCounsel MCP still “coming soon”.
- Harvey–Everlaw MCP still “fall 2026” (not GA).
- Evolu `#708` still OPEN; `@evolu/common@8.11.0` unpublished (npm latest 8.10.0).
- Instant Cloud sunset still 2027-08-31.
- drizzle `#6162` still OPEN (frozen since 2026-08-25).
- SEP-2640 remains Final-on-main; Tier-1 SDKs still OPEN (ts `#2818` draft, go `#1238`, python `#3485` — python claims conformance green but unmerged).
- MCP `#3306` Enterprise IdP docs still OPEN (frozen since Sep 1).

### Contradicted

- Prior “tip still rc.115 / `#8201` OPEN” — **false** as of Sep 18–21.
- Prior “SchemaJIT `#7908` draft OPEN” — **false** as of Sep 18.
- Prior “jazz tip alpha.55” — **false** as of Sep 21 (now alpha.56).
- Prior “Zero canary.22” — **false** (now 1.11.0-canary.11).
- Prior “SEP-3004 OPEN toward Final” — **false** (closed unmerged Sep 22).

## Counts

| metric | value |
| --- | --- |
| total claims | 25 |
| window_new | 14 |
| refute | 18 |
| law / effect / agents | 5 / 12 / 8 |
| novelty (hard URL collisions among window_new) | 35.7% (5/14) — gate &lt;40% pass |

## Topical appendix

### IP-law / legal-AI

OpenAI’s Astra for Law entry (Sep 17) is the largest in-window competitor move: foundation-model vendor + legal search index + plugin ecosystem that names Harvey, Legora, iManage, and Thomson Reuters as first-class partners. DMS/evidence MCP fabric clocks are unchanged — iManage/TR and Harvey–Everlaw remain pre-GA fall/coming-soon. USPTO ODP four-field profile gate remains mandatory for API-key continuity.

### Effect-TS / schema-first / local-first

This was an Effect release week: rc.116 cut, tip to rc.117, SchemaJIT landed, unstable modules promoted to top-level paths, HttpApi path renamed. Kits should plan an import migration (`unstable/` drop; `http-api` rename) against rc.117+ / forthcoming rc.118. Jazz and Zero tips advanced; Evolu 8.11.0 and Instant sunset HOLDs unchanged; drizzle Effect-v4 TaggedError gap still open.

### Agents / MCP / skills

SEP-2640 Final status unchanged; ship gate remains Tier-1 SDKs (python closest on paper, still blocked). SEP-3004 closed without merge — drop “toward Final” framing. New RAC paper (2609.23498) strengthens the runtime-authorization / IntentCap / Stochastic Deputy cluster for matter-scoped legal MCP tools.
