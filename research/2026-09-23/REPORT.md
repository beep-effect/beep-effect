# Nightly research packet — 2026-09-23

Window: `2026-09-22T08:56:00-05:00` → `2026-09-23T08:57:00-05:00` (America/Chicago, ~24h).  
Prior: `research/2026-09-22` / PR #1199 (merged). Status: **partial** (X client-not-enrolled).

## Delta-first

### New (window)

- **A2M MCP hijacking paper** (arXiv 2609.26761, Sep 22) + public `Lilaizhen/A2M` code: Attraction→Manipulation against MCP tool metadata/returns; GLM-4.6 MTIR 93.6% / ASR 74.4%; transfer MTIR 63.6%. Rising-edge threat for open MCP registries and legal MCP fabric. [f-agents-01] [f-agents-07]
- **Zero-Trust Enterprise MCP** (arXiv 2609.22573, PayPal, Sep 18): dual-persona credentials, pre-auth discovery, permission-filtered `list_tools` — forbidden attempts 152/720 → 0/720. Complements RAC/ACLE and #3306. [f-agents-02]
- **GraphSkillEvo** (arXiv 2609.21749): graph-structured skills + evolutionary optimization; +4.01% vs SkillOpt on GPT-5.4-nano. [f-agents-03]
- **Cimplifi Maestro + CI Lake** (Sep 22 GlobeNewswire / eDiscovery Today): AI orchestration extending Relativity aiR ahead of RelFest. [f-law-04] [f-law-06]
- **Astra for Law recap** (NeoTeo Sep 23): Trusted Access, 54.0% vs 38.7% web baseline, Harvey/Legora API path — new URL soft-follow of prior Astra claim. [f-law-05]
- **Zero `head` channel** advanced to `1.11.0-head-bbc6b8b0-20260923` (canary still `.11`). [f-effect-06]
- **MCP #3385** Infrastructure WG charter MERGED Sep 22; **#3371** SEP Consistent SDK extension points OPEN. [f-agents-08] [f-agents-05]
- **WorkOS MCP OAuth primer** + **Microsoft MAF skills-over-MCP** blog (compat note still pinned to Draft `skill://index.json` pending SDK ship). [f-agents-10] [f-agents-09]

### Moved / refreshed (no tip break)

- Effect **#8336** refreshed Sep 23 (mergeable clean) but **still OPEN** — tip remains **rc.117**; rc.118 not cut. [f-effect-01] [f-effect-02]
- SEP-2640 **Go SDK #1238** and **Python #3485** both saw Sep 23 push/update activity; still unmerged (python claims conformance green). [f-agents-04]

### Settled (unchanged from prior admit)

- SEP-3004 remains **CLOSED unmerged** (no reopen in-window) — keep closed-unmerged framing; no dedicated re-cite this packet to protect novelty.
- Prior retire-after-admit rows jazz-wire-v1, effect-rc115/rc116, effect-mcp-adapter, and sep2640-final-unmerged are **RETIRED** in `research/ledger/WATCHLIST.md` on this PR, pending human merge of #1215 (not #1199, which already merged). schema-jit stays `retire-after-admit` to watch npm inclusion via rc.118.

### Unchanged HOLDs (refute quota re-checked live)

- USPTO ODP four-field gate still mandatory. [f-law-01]
- iManage/TR CoCounsel MCP still “coming soon”. [f-law-02]
- Harvey–Everlaw MCP still “fall 2026” (not GA). [f-law-03]
- Instant Cloud sunset still **2027-08-31**. [f-effect-04]
- drizzle `#6162` TaggedErrorClass still OPEN (frozen since 2026-08-25). [f-effect-05]
- Evolu `#708` still OPEN; `@evolu/common@8.11.0` unpublished (npm latest 8.10.0). [f-effect-03] [f-effect-08]
- SEP-2640 Tier-1 SDK ship still OPEN (go #1238; ts #2818 draft; python #3485). [f-agents-04]
- MCP `#3306` Enterprise IdP docs still OPEN. [f-agents-06]
- jazz-tools alpha tip still **2.0.0-alpha.56**. [f-effect-07]

### Contradicted

- None hard this window: prior tip/rc.117, SchemaJIT-merged, SEP-3004-closed, jazz alpha.56, Zero canary.11 claims all still hold. Soft: Zero **head** channel moved while canary did not — do not read canary tip as frozen without checking `head`.

## Counts

| metric | value |
| --- | --- |
| total claims | 24 |
| window_new | 14 |
| refute | 12 |
| law / effect / agents | 6 / 8 / 10 |
| exclusion_collision_pct | 37.5% (9/24) — gate ≤40% pass |
| unique-URL novelty | 62.5% (15/24) |
| window_new collision | 0.0% (0/14) |

## Topical appendix

### IP-law / legal-AI

Short ~24h window: standing DMS/MCP clocks (iManage coming-soon; Harvey–Everlaw fall 2026) unchanged. Competitive delta is **Cimplifi/Relativity orchestration** (Sep 22) plus continued Astra-for-Law press (Sep 23 Trusted Access framing). USPTO four-field ODP gate still blocks casual API-key automation.

### Effect-TS / schema-first / local-first

Quiet tip day: **rc.117** holds; **#8336→rc.118** staged and refreshed but unmerged. Local-first: Zero **head** builds firehose; Jazz/Evolu/Instant/drizzle HOLDs flat. SchemaJIT + unstable-path migrations from prior packet still pending consumer uptake until rc.118.

### Agents / MCP / skills

Security research spike: **A2M** (attack) + **PayPal zero-trust** (defense) bookend the MCP tool boundary. Skills representation research (**GraphSkillEvo**) and MAF migration posts keep pressure on SEP-2640 SDK ship. Spec repo: Infrastructure WG charter merged; #3306/#3371 still open; Tier-1 Skills SDKs still the ship gate.

## Watchlist patch note (publisher)

Ledger edits are inlined in `research/ledger/WATCHLIST.md` and `research/ledger/stamp.json` (draft until human merge of #1215). Retired jazz-wire-v1, effect-rc115, effect-mcp-adapter, effect-rc116, and sep2640-final-unmerged; schema-jit stays retire-after-admit (watch npm inclusion via rc.118). Added A2M / zero-trust / GraphSkillEvo / Cimplifi / Zero-head / MCP Infrastructure WG / SEP-3371. Kept tip-rc117→rc.118 and SEP-2640 SDK ship.
