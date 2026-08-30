# REPORT — 2026-08-29

Window 2026-08-28 08:27 → 2026-08-29 08:27 America/Chicago. Status: **partial** (X search still `client-not-enrolled`). 15 claims. Collision rate 0.33 against prior digests (all five collisions are intentional refute re-cites of standing URLs; 0 novel-URL collisions). Refutation quota: 5 standing claims challenged (all hold). Saturday; no weekly consolidation.

The 2026-08-28 packet (#875) merged 2026-08-29T09:13Z. The 2026-08-27 packet (#862) remains closed-unmerged with claims at `research/ledger/excluded-packets/2026-08-27.jsonl`.

## Delta

### New

- **Litigation and matter data keep joining the MCP fabric from new edges.** Harvey + PacerPro put the firm's state/federal litigation record (filings + docs as they post) into Harvey workflows (LawNext 2026-08-24). LawToolBox MCP exposes 70 tools over AI-ready matter containers inside the org's own M365 (2026-08-24). Trellis added a ChatGPT plugin and Trellis Chat beside its Claude MCP for state trial-court data (2026-08-17). Yesterday was DMS/research write-back; today is docket spine + M365 containers + multi-host court data.
- **Agent-to-agent handoff is a new layer above MCP.** DeepJudge's Agent Handoff Protocol (AHP) moves user + objective + conversation sample + resources between independently operated AI apps and returns a prepared URL. Built on MCP, not a replacement. Harvey beta this month; Thomson Reuters says CoCounsel for Legal will support it.
- **Effect Schema.mutable pipe order is now load-bearing; Jazz is freezing wire/identity.** #7519 (merged after yesterday's cut) fixes encoded-array mutability and documents `mutable` before `withDecodingDefaultType`. Still no rc.113. Jazz overnight reset sync wire to v1 and hardened per-browser-replica node identity.
- **Skills evolve on the attacker side too; enterprise MCP gets a charter.** RedEvoAgent (2608.27439) evolves red-team attack skills with a validation ratchet against product harnesses. Contract-centered architecture (2608.27086) names Skill / Harness / Scaffold as organizational contracts with a falsifiable P1. MCP Enterprise Interest Group charter merged (#2626). webMCP compiles human intent into a bounded WebMCP tool contract (repo born today).

### Moved

- **Legal MCP market.** 2026-08-28 added DMS write-back. 2026-08-29 adds docket/matter-container hosts (Harvey↔PacerPro, LawToolBox M365, Trellis multi-host) and an app↔app handoff layer (AHP) sitting on MCP.
- **w-schema-binary / effect pin.** Still on rc.112; SchemaBinary overnight fixes remain unreleased. #7519 is adjacent Schema work, not a cluster-wire release.
- **w-skills-over-mcp.** SEP-2640 still open; Enterprise IG charter landed beside it without closing the skills fork.

### Contradicted

None of the standing claims broke.

### Settled (refutation quota)

- **USPTO ODP four-field gate — HOLDS.** patent.dev / ODP messaging unchanged; petition `includeDocuments` 500s not walked back.
- **drizzle TaggedErrorClass — HOLDS.** #6162 still OPEN (updated 2026-08-25).
- **Instant Cloud sunset 2027-08-31 — HOLDS.** Official essay unchanged.
- **SEP-2640 — HOLDS (unsettled).** #2640 still OPEN (last update 2026-08-25).
- **effect@4.0.0-rc.112 / no rc.113 — HOLDS.** Latest published tags remain rc.112.

## Intersections with today's repo-replay

Merged since the 2026-08-28 packet cut: #875 (this prior nightly), #876/#877 agent/MCP defaults, #878/#879 repo-cli journal admission and lock reaping. Read #877 next to Effect #7495 structuredContent and MCP EIG. Open and relevant: #867 patent-document-schema, #865 court-reporter-vocabulary (Harvey↔PacerPro / Trellis), #880 ontology-foundational-auditor skill, #881 remove basic-memory/codegraph, #882 quality diagnostics, #869 Oppold T7, #872/#873 corpus, #874 ship-velocity.

## Frictions

- X search is connected but API-forbidden (`client-not-enrolled`). Same resume cursor as 2026-08-26/27/28.
- No Sol/Luna verify seat in this harness.
- GitHub MCP needsAuth; `gh` + cloud agent publishes this packet.

## Appendix — topical notes

Law: the post-ILTACON wave is no longer only DMS write-back. Docket providers and M365 matter containers are joining the MCP graph, and DeepJudge AHP proposes product-to-product continuity without sharing tools or credentials.

Effect: Schema correctness patches continue on main without an RC cut. Jazz is versioning wire and replica identity while Instant's sunset clock still ticks.

Agents: constructive (Skill/Harness/Scaffold contracts, webMCP codegen) and adversarial (RedEvoAgent skill evolution) both treat skills as the evolving unit. Enterprise IG charter is governance; SEP-2640 is still the open transport fight.
