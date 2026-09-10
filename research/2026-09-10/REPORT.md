# REPORT — 2026-09-10

Window 2026-09-05 08:20 → 2026-09-10 09:10 America/Chicago (~120h50m). Status: **partial** (X search `client-not-enrolled` on every axis, x=0; no Sol/Luna). 21 claims. Novel-URL collision rate 0 against exclusion digest (8 intentional refute URL re-cites). selfReject false. Refutation quota: 10 standing claims challenged (6 HOLD; 2 BROKEN — effect rc.113 + Jazz alpha.54; 2 HOLD on MCP adapter / SEP-2640 / #3306 / ODP / partnership clocks / Instant / drizzle counted in the six). Thursday: no weekly consolidation, no tombstone reaper.

The 2026-09-05 packet (#1015) merged 2026-09-08 ~2:02 PM CT. No open research PR at preflight. Stamp was 2026-09-05T08:20-05:00 / lastSuccessfulPr=1015.

## Delta

### New

- **Legal DMS MCP fabric splits: first-party servers are GA; partner bridges are not.** iManage first-party MCP Server was GA in May 2026 (ILTACON update; Control Center MCP Settings July 2026; write expansion + platform GA October 2026). Everlaw hosts first-party MCP at `api.everlaw.com/v1/mcp` (OAuth, read-only search tools). LawToolBox ships a governed M365 matter-container MCP (70+ tools). Standing TR CoCounsel / Harvey-Everlaw partnership clocks remain coming-soon / fall 2026 — do not call those GA.
- **effect@4.0.0-rc.113 published; Jazz alpha.54 cut.** Changesets #7446 merged Sep 7; GitHub/npm rc.113 on Sep 10. SchemaBinary default transport ships in this RC. jazz-tools@2.0.0-alpha.54 on npm alpha tag Sep 10 (after #2118 closed unmerged). Evolu @evolu/common@8.10.0 + @evolu/relay@4.0.0 published Sep 6.
- **Harness supply-chain + trajectory provenance papers.** Scanning the Harness (2609.07360): 16% of public multi-component coding-agent setups have confirmed security defects (unpinned MCP, scoped-looking shell pre-approvals). TrajMark (2609.10416) watermarks coding-agent trajectories for ownership and segment-level tamper localization. Glyph (2609.10430) does agentic sensitivity-ontology tagging. Arcade (Sep 8) documents OpenAI shipping Skills-over-MCP as snapshot import while SEP-2640 stays unmerged.
- **IP/patent MCP tooling keeps rising.** parkerhancock/patent-client-agents pushed in-window; DianShi-RxnDB (2609.06703) exposes USPTO/EPO patent reactions over MCP.

### Moved

- **w-effect-rc113 / w-schema-binary.** rc.113 is published — tip moves off rc.112. SchemaBinary default is in the published RC; keep watching next Version Packages PR and unpublished MCP adapter.
- **w-jazz-wire-v1.** alpha.54 is cut on npm; #2118 closed unmerged. Watch post-cut RN recovery / V1 consumers.
- **w-legal-dms-mcp / w-imanage-mcp-write / w-harvey-everlaw-mcp.** Split first-party MCP (GA / live) from partnership MCP (still future). iManage write expansion remains October 2026 watch.
- **w-skills-over-mcp.** OpenAI snapshot-import implementation (Arcade Sep 8) widens disk-vs-wire fork while SEP-2640 stays Accepted-not-Final.

### Contradicted (broken standing claims)

- **effect@4.0.0-rc.112 holds / no rc.113 — BROKEN.** rc.113 published.
- **Jazz alpha.54 not cut — BROKEN.** jazz-tools@2.0.0-alpha.54 on npm alpha tag.

### Settled (refutation quota HOLDS)

- USPTO ODP four-field gate — HOLDS (live Sep 10).
- iManage/TR partnership MCP — HOLDS (coming soon; not GA).
- Harvey-Everlaw MCP — HOLDS (fall 2026 expected; not GA).
- Effect MCP #7265 adapter — HOLDS OPEN (even after rc.113).
- drizzle #6162 TaggedErrorClass — HOLDS OPEN (no update since Aug 25).
- Instant Cloud sunset 2027-08-31 — HOLDS.
- SEP-2640 — HOLDS Accepted-not-Final / still OPEN.
- MCP #3306 Enterprise IdP docs — HOLDS OPEN.

## Intersections with today's repo-replay

Merged since the 2026-09-05 stamp (titles only, sample): pin Effect packages to c8349ed / v4 RC breaking changes (#1060); yeet regenerate ignored projections; graft cache sync / deep build docs; quality lanes / JSDoc ratchet / repo-cli eslint policy; many CI/coverage fixes. No open research PR. Do not babysit non-research opens from this packet.

rc.113 publish + beep #1060 pin sit on the same Effect v4 migration edge. Scanning the Harness + TrajMark sit next to yeet/review gates and approval firewalls. First-party iManage/Everlaw MCP vs partnership clocks sit next to gov-legal-mcp / legal-DMS assumptions.

## Frictions

- Native X post/news search attempted across all axes; all returned client-not-enrolled (client_id 29986667). x=0. Resume: enroll App in a Project at console.x.com, then re-search this window.
- Sol/Luna blinded verify unavailable. Packet stays partial. Resume: retry verify on the same 21 records.
- Everlaw support KB sometimes Cloudflare-walled; claim also grounded in secondary indexes + partnership press for GA clocks.
- Writer composed from structured sanitized records only.

## Appendix — topical notes

Law: First-party MCP GA for iManage (May) and Everlaw (hosted endpoint) reframes the fabric; partnership clocks (TR, Harvey, Copilot) remain fall 2026 / coming soon. LawToolBox M365 matter MCP is a shipping foil. ODP four-field HOLD. Patent MCP OSS (patent-client-agents, DianShi-RxnDB) continues.

Effect: rc.113 is tip for dist-tag rc. #7265 still the unpublished MCP adapter. Jazz alpha.54 cut. Evolu relay 4.0.0. drizzle #6162 and Instant sunset HOLDS. SchemaJIT #7908 still experimental OPEN (not separately claimed; covered under rc.113 SchemaBinary move).

Agents: Arcade documents OpenAI snapshot Skills-over-MCP vs unmerged SEP-2640. Scanning the Harness quantifies harness config defects. TrajMark + SEP-3004 are provenance/audit. Glyph is ontology×governance. #3306 HOLD.
