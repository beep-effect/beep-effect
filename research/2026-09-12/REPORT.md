# REPORT — 2026-09-12

Window 2026-09-10 09:10 → 2026-09-12 08:14 America/Chicago (~47h). Status: **partial** (X search `client-not-enrolled` on every axis, x=0; no Sol/Luna; local `gh` CLI token invalid — GitHub MCP used). 26 claims. Novel-URL collision rate 0 against exclusion digest (intentional refute URL re-cites excluded from that gate). selfReject false. Refutation quota: 10 standing claims challenged (7 HOLD; 3 BROKEN — tip past rc.113 / #7265 merge / tip claim; 1 HOLD+MOVED SEP-2640). Saturday: no weekly consolidation, no tombstone reaper.

The 2026-09-10 packet (#1088) merged 2026-09-10 ~11:15 AM CT. No open research PR at preflight. Stamp was 2026-09-10T09:10-05:00 / lastSuccessfulPr=1088. 2026-09-11 nightly correctly skipped (stamp under 24h).

## Delta

### New

- **Effect MCP 2026-07-28 adapter landed on main; npm tip raced ahead of it.** `#7265` MERGED 2026-09-11T23:23:35Z (stateless `server/discover`, `McpRequestContext`, MRTR, `subscriptions/listen`, JSON `structuredContent`). Same day npm cut `effect@4.0.0-rc.114` then `rc.115` *before* the merge, so dist-tag `rc` is still `4.0.0-rc.115` without the adapter. Open Changesets `#8201` stages unpublished `effect@4.0.0-rc.116` that explicitly lists the `#7265` changeset — that is the publish vehicle. SchemaJIT/AOT `#7908` still draft with full benches.
- **Local-first follow-ons staged, not cut.** Jazz `#2748` stages `jazz-tools@2.0.0-alpha.55` (npm tip still alpha.54). Evolu `#708` stages `@evolu/common@8.11.0` / `@evolu/relay@4.0.1` (npm still 8.10.0 / 4.0.0).
- **Legal AI competitive fabric moves in-window.** Harvey ships Contract Review Agents early access (Sep 10). Edwin Coe rolls out Legora firm-wide across 14 practice groups (Sep 11). iManage documents Work MCP write-tool surface while next-gen platform GA remains October 2026. Legora–NetDocuments MCP deepen (governed DMS context). patentmax-patent-search appears as in-window global patent MCP/REST skill. Clarra ships a large litigation case-management MCP surface.
- **MCP registry reality check (arXiv 2609.10962, Sep 10):** unrepaired random draw of 400 npm/stdio servers → only 48.8% complete `initialize`; 37.5% never start. Tool-use benchmarks contain massive exact duplicates vs near-zero for real MCP.
- **COBRA-Skills (2609.11682) + No-Box MCP prompt-injection scan (2609.10854)** extend skills-evolution and MCP security edges.
- **Standing law HOLDs.** ODP four-field, TR partnership MCP coming-soon, Harvey-Everlaw fall 2026 all still hold on live Sep 12 checks.

### Moved

- **w-effect-rc113 / w-schema-binary / w-effect-mcp-adapter.** Tip is now rc.115; MCP adapter moves from "OPEN unpublished" to "MERGED on main, npm pending rc.116 via #8201".
- **w-jazz-wire-v1.** alpha.54 still tip; alpha.55 staged on `#2748`.
- **w-imanage-mcp-write.** Write-tool docs live; platform GA still October 2026.
- **w-skills-over-mcp / SEP-2640.** Still Accepted-not-Final / OPEN draft; body MOVES with Tier-1 SDK refs (updated Sep 11).
- **w-acle-effect-closure / SEP-3004.** Still OPEN; updated Sep 11.

### Contradicted (broken standing claims)

- **effect@4.0.0-rc.113 is tip — BROKEN.** npm/GitHub tip is `effect@4.0.0-rc.115`.
- **Effect #7265 MCP adapter still OPEN — BROKEN.** Merged 2026-09-11T23:23:35Z. Do **not** claim it is on npm until `#8201` / rc.116 publishes.

### Settled (refutation quota HOLDS)

- USPTO ODP four-field gate — HOLDS (live Sep 12).
- iManage/TR partnership MCP — HOLDS (coming soon; not GA).
- Harvey-Everlaw MCP — HOLDS (fall 2026 expected; not GA).
- drizzle #6162 TaggedErrorClass — HOLDS OPEN (no update since Aug 25).
- Instant Cloud sunset 2027-08-31 — HOLDS.
- Jazz alpha tip — HOLDS at `jazz-tools@2.0.0-alpha.54` (alpha.55 staged only).
- SEP-2640 — HOLDS Accepted-not-Final / still OPEN (MOVED body).
- MCP #3306 Enterprise IdP docs — HOLDS OPEN (no update since Sep 1).

## Intersections with today's repo-replay

No open research PR. Prior packet #1088 already on main. Effect tip + `#7265` merge sit on the same v4 migration / MCP toolkit edge as beep Effect pins. MCP registry 48.8% initialize rate sits next to TrustShift / harness scanners. Harvey Contract Review Agents + Legora firm-wide sit next to competitor positioning (Tom / Patlytics foil). SEP-2640 SDK refs + Skills-over-MCP fork remain the disk-vs-wire decision for agent skills packaging.

## Frictions

- Native X post/news search attempted; all returned client-not-enrolled (client_id 29986667). x=0.
- Local `gh` CLI token invalid (401). Remote reads via GitHub MCP. Publisher uses Cursor cloud agent GitHub connection.
- firecrawl CLI not on PATH; used WebSearch/WebFetch/arXiv API/npm instead.
- Sol/Luna blinded verify unavailable. Packet stays partial.
- Writer composed from structured sanitized records only.

## Appendix — topical notes

Law: Harvey Contract Review Agents + Legora firm-wide are in-window competitor moves. iManage write tools documented; Oct 2026 platform GA watch. Partnership MCP clocks (TR, Harvey-Everlaw) still HOLD. patentmax + Clarra extend IP/litigation MCP tooling.

Effect: Tip rc.115. `#7265` merged; watch `#8201` → rc.116. Jazz alpha.55 / Evolu 8.11.0 staged. SchemaJIT `#7908` draft. drizzle + Instant HOLDS.

Agents: SEP-2640 still not Final but SDK refs landed. Registry random-draw paper undercuts curated MCP quality narratives. COBRA-Skills / No-Box extend skills + MCP security. #3306 HOLD. SEP-3004 still OPEN.
