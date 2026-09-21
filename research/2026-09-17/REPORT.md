# Research packet — 2026-09-17

Window: `2026-09-13T08:20:00-05:00` → `2026-09-17T08:45:00-05:00` (~96h). Prior successful packet on main: `research/2026-09-13` (PR #1136). Orphan: local `research/2026-09-16/` (29 claims, publisher never opened PR) absorbed via re-verify + soft-exclusion. Weekday: Thursday — no Sunday consolidation.

## Delta (lead)

### NEW
- **Legora legal research ontology + AI-native citator** (Sep 14 press): full ontology via Qura/Wexler; limited beta → Q4 GA (`f-law-05`).
- **Salesforce adopts Legora globally** (NA/EMEA/APAC, Sep 16 Dreamforce week) (`f-law-07`).
- **Effect #8269 HttpApi.ParseOptions** MERGED 2026-09-17 — schema decode/encode precedence on main, pending rc.116 (`f-effect-09`).
- **Effect #8261 HTTP QUERY** MERGED 2026-09-17 — clients/routers/HttpApi, pending rc.116 (`f-effect-10`).
- Absorbed still-true orphaned 09-16 window_new never on main: Harvey first-party MCP docs, Arcangel Cursor plugin, SEP-2640 docs #3353, arXiv After the Party / Stochastic Deputy / EvoOntology (`f-law-04`, `f-law-06`, `f-agents-02`, `f-agents-07`…`09`).

### MOVED
- Effect `#8201` still OPEN; **updated 2026-09-17T08:12:24Z** after more main churn (`f-effect-03`).
- SchemaJIT `#7908` still draft OPEN; **updated 2026-09-17T12:52:52Z** (`f-effect-04`).
- Evolu `#708` still OPEN; **updated 2026-09-17T10:08:15Z** — still unpublished 8.11.0 (`f-effect-06`).

### CONTRADICTED / BROKEN
- None new vs 09-13 main stamp. Orphaned 09-16 already recorded jazz alpha.55 + SEP-2640 merges; today **re-confirms** those settles as tip HOLDs (`f-effect-05`, `f-agents-01`).

### SETTLED
- **SEP-2640 Final on main** (merged 2026-09-13) remains settled; Tier-1 SDKs still OPEN (`f-agents-01`, `f-agents-05`, `f-agents-06`).
- **jazz-tools@2.0.0-alpha.55** (wire v2) remains tip; no alpha.56 (`f-effect-05`).

### HOLD (standing refute — unchanged)
- USPTO ODP four-field gate; iManage/TR MCP coming soon; Harvey–Everlaw MCP fall 2026 (`f-law-01`…`03`).
- effect tip rc.115; #7265 unpublished; #8201 OPEN (`f-effect-01`…`03`).
- SchemaJIT draft; drizzle #6162 frozen; Instant sunset 2027-08-31; Evolu 8.11.0 unpublished; Zero canary.22 (`f-effect-04`, `f-effect-06`…`08`, `f-effect-11`).
- MCP #3306 frozen since Sep 1; SEP-3004 not Final (`f-agents-03`, `f-agents-04`).

## Intersection lens
Legal MCP fabric still has **three Harvey-adjacent clocks** plus Legora’s ontology/citator + Salesforce in-house adoption. Effect MCP adapter remains **main-only** while SEP-2640 is **Final-on-main** — kits implement against Effect main + Skills docs, pin npm at rc.116. Jazz wire v2 tip stable; Evolu quarantine/HLC still staged.

## Appendix by axis
See `claims.jsonl` / `SOURCES.md`. Soft-exclusion of 09-16 URLs applied; intentional re-cites marked absorb/refute.

## Frictions
- X `search_posts_all` / `search_news`: client-not-enrolled.
- arXiv `export.arxiv.org` API: HTTP 429 this run (absorbed prior verified arXiv claims).
- local `gh` unused (bad credentials); cursor-github MCP as kriegcloud.
