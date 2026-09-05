# REPORT — 2026-09-05

Window 2026-09-03 08:49 → 2026-09-05 08:20 America/Chicago (~47h31m). Status: **partial** (X search `client-not-enrolled` on every axis, x=0; no Sol/Luna). 17 claims. Collision rate 0.529 against prior digests (nine intentional refute URL re-cites: ODP, iManage/TR, Everlaw-CoCounsel, Effect #7446, Effect #7265, drizzle #6162, Instant sunset, SEP-2640, MCP #3306; novel-URL collision 0). selfReject false. Refutation quota: 10 standing claims challenged (7 HOLD; 2 HOLD+MOVED (#7265, SEP-2640 Accepted-not-Final); 1 MOVED (Jazz #2361 closed-obsolete→#2118); none broken). Saturday: no weekly consolidation, no tombstone reaper. Leave prior tombstones as-is.

The 2026-09-03 packet (#980) merged 2026-09-03 ~1:27 PM CT. No open research PR at preflight.

## Delta

### New

- **Harvey formalizes an Everlaw MCP evidence bridge for fall 2026; CoCounsel/iManage MCP still not GA.** Harvey Team blog dated 2026-09-03 (after stamp) announces a partnership with Everlaw building an MCP integration so joint users can query/retrieve Everlaw evidence (including multi-million-document matters) from Harvey with citations back to source documents. Expected availability to joint customers in fall 2026 — not GA. Distinct from standing Everlaw-CoCounsel (Sept 1, still future-facing "will be able") and from iManage/TR (APIs today; MCP "coming soon"). Same fabric story; three different GA clocks.
- **Public-law jurisdiction MCP fabric keeps rising.** Claimed: Iceland public-law/EEA read-only PoC (`gunnaroi/iceland-context-mcp-poc`, created Sep 4). Appendix-only: ArthurLegal 10-jurisdiction/62-tool no-auth Fly endpoint; prawmi-mcp Polish/EU stdio shim; `korean-patent-mcp` (KIPRIS `rights_alive` / `verify_citations` / `search_ip`, created Sep 4) — IP-law tech MCP adjacent to ODP watches.
- **Jazz alpha.54 path moved; V1 formats settled; Effect schema JIT draft opened.** `garden-co/jazz#2361` (pkg.pr.new alpha.54 RC shell) CLOSED unmerged 2026-09-04 as obsolete; authoritative packaging tip is #2118 (still OPEN). #2583 MERGED 2026-09-05 settles unreleased storage/schema/ResultKey formats on V1 ahead of alpha.54 (not a freeze declaration). Effect #7908 draft SchemaJITCompiler (+5448/−603) is experimental opt-in under `effect/unstable/schema` — not in any published RC. #8079 MCP.md Schema.Struct/NodeStdio docs repair noted under #7265 story.
- **HookPry + Cisco CEL scanner + SWE-Gate land on the harness/skills edge.** HookPry (arXiv 2609.03884) reports lifecycle-hook update supply-chain steering across 7 harnesses (author-reported peak ASR 92.5%; Defender 0% recall). Cisco `skill-scanner` #210 merges a shadow CEL decision layer (cel-go v0.32.0; rules stay shadow). SWE-Gate (2609.04167) shows 34.3% of functionally successful coding-agent repairs fail review-constraint tests — green tests ≠ approval gates. NLIP / Terminal-Universe / SEP-3004 noted in appendix.

### Moved

- **w-jazz-wire-v1.** #2361 CLOSED obsolete → watch path is now #2118 Changesets/packaging tip + #2583 V1 settlement. alpha.54 still not cut.
- **w-effect-mcp-adapter.** #7265 still OPEN and still unpublished. Updated 2026-09-04 with lifecycle/MRTR/subscriptions/JSON tool outputs. HOLD+MOVED. Do not pin beep kits on it.
- **w-skills-over-mcp / SEP-2640.** Accepted by Core Maintainers 2026-09-03T22:32:50Z; PR still OPEN, draft label, needs reference implementation / conformance tests / ext-skills repo. Accepted ≠ Final ≠ shipped. Disk Agent Plugins vs wire SEP-2640 fork remains live.
- **w-schema-binary / w-effect-rc113.** Still no published rc.113. #7446 updated 2026-09-05T10:00:05Z and still stages it.
- **w-legal-dms-mcp / Harvey-Everlaw.** Add Harvey-Everlaw fall-2026 MCP as a new GA clock beside Everlaw-CoCounsel future-facing and iManage/TR MCP-coming-soon.

### Contradicted

None of the standing claims broke.

### Settled (refutation quota)

- **USPTO ODP four-field gate -- HOLDS.** Live data.uspto.gov/support on Sep 5 still requires Job Title, Organization Name, Organization Type, Intended Use. No rollback. includeDocuments HTTP 500 remains unverified.
- **iManage/TR CoCounsel MCP -- HOLDS (not GA).** Press page still: APIs available today; MCP support coming soon.
- **Everlaw-CoCounsel -- HOLDS (future-facing).** Sept 1 blog still will be able; no GA language.
- **effect rc.112 / no rc.113 -- HOLDS.** npm/GitHub still rc.112; Changesets PR 7446 OPEN staging unpublished rc.113.
- **Effect MCP PR 7265 adapter -- HOLDS, moved.** Still OPEN. Body advanced 2026-09-04. Unpublished pending rc.113.
- **drizzle TaggedErrorClass -- HOLDS.** Issue 6162 still OPEN; last update 2026-08-25.
- **Jazz PR 2361 alpha.54 RC -- MOVED.** CLOSED unmerged as obsolete pkg.pr.new shell; path to PR 2118. Do not treat alpha.54 as cut.
- **Instant Cloud sunset 2027-08-31 -- HOLDS.** Essay + homepage banner unchanged on 2026-09-05.
- **SEP-2640 -- MOVE+HOLD.** Accepted by Core Maintainers; still OPEN not Final.
- **MCP Enterprise PR 3306 IdP docs -- HOLDS.** Still OPEN; last update pre-window (2026-09-01).

## Intersections with todays repo-replay

Merged since the 2026-09-03 packet cut (titles only): FreshBooks driver; yeet PR body snapshot on updatedAt; residue/worktree reap / admission journal / shard census; Semantica lab graduate v1.1 re-entry; Codex security findings closeout. No open research PR. Do not babysit non-research opens from this packet.

Harvey-Everlaw MCP sits next to gov-legal-mcp / legal-DMS watches and the standing Everlaw-CoCounsel / iManage clocks -- capture the fall-2026 expected date, do not call GA. Public-law Iceland/ArthurLegal/prawmi sit next to w-public-law-mcp. HookPry + skill-scanner CEL sit next to SkillShift / skillscan / Agent Plugins: hook-update supply chain and shadow-CEL correlators are the new scanner gap. SWE-Gate sits next to yeet/review gates and coding-agent-effectiveness: functional green does not equal review-constraint compliance. PR 7265 + PR 7446 + PR 7908 remain the effect-v4 pin/schema watch. Jazz PR 2118/PR 2583 is the live alpha.54 stack.

## Frictions

- Native X post/news search attempted across all axes; all returned client-not-enrolled. x=0. Same resume: enroll App in a Project at console.x.com, then re-search this window.
- Sol/Luna blinded verify unavailable. Packet stays partial. Resume: retry verify on the same 17 records.
- GitHub / arXiv / web worked. Writer composed from structured sanitized records only. firecrawl CLI unavailable this box.

## Appendix -- topical notes

Law: Harvey-Everlaw is the in-window formalization of an MCP evidence bridge with fall-2026 joint availability. Everlaw-CoCounsel and iManage/TR MCP remain not-GA. ODP four-field HOLD unchanged. Public-law MCP cluster (Iceland PoC + ArthurLegal + prawmi) and korean-patent-mcp are rising-edge jurisdiction/IP tooling foils for gov-legal-mcp -- not substitutes.

Effect: still no rc.113. PR 7265 moved on the body and not on the registry. SchemaJITCompiler (PR 7908) is draft experimental. Jazz PR 2361 obsolete; PR 2583 V1 settlement merged; PR 2118 packaging tip OPEN; alpha.54 not cut. Instant sunset HOLD.

Agents: SEP-2640 Accepted toward Final (not shipped). HookPry is the lifecycle-hook supply-chain paper (add watch). Cisco skill-scanner CEL shadow layer is rising-edge next to SkillShift scanner-miss thesis (add watch). SWE-Gate is the review-constraint gap for coding agents. Also noted: NLIP (Ecma agent interop vs MCP/A2A), Terminal-Universe trajectory-to-env reconstruction, SEP-3004 tamper-evident audit records (still OPEN), MCP PR 3306 Enterprise IdP docs HOLD.
