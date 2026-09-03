# REPORT — 2026-08-31

Window 2026-08-30 08:14 → 2026-08-31 08:52 America/Chicago. Status: **partial** (X search still `client-not-enrolled`; no Sol/Luna). 21 claims. Collision rate 0.33 against prior digests (seven URL collisions: five standing-quota refute re-cites plus Jazz #2347 and MCP #3321 move re-cites of excluded URLs; novel-URL collision 0). selfReject false. Refutation quota: 5 standing claims challenged (all HOLD). Monday: no weekly consolidation, no tombstone reaper. Leave 2026-08-30 tombstones as-is.

The 2026-08-30 packet (#896) merged 2026-08-30T14:22Z. The 2026-08-27 packet (#862) remains closed-unmerged with claims at `research/ledger/excluded-packets/2026-08-27.jsonl`. arXiv Monday `/new` was already live (prelude was wrong about waiting for 20:00 ET).

## Delta

### New

- **Public-law MCP fabric got a Swedish twin, a directory, and a Korean rebrand.** AvoccadoTech/legal-mcp-sweden (created 2026-08-31) ships two read-only stdio servers with no account/API key: lifos watches Migrationsverket rättsliga ställningstaganden for superseded positions, rattspraxis FTS5-matches a firm watchlist against ~17k Domstolsverket decisions. Foil for `gov-legal-mcp` (sister of yesterday's Croatia MCP, different URL). awesome-legal-mcp-servers + legalaimcp.com/mcp (created in-window) catalogs 48 tools across seven practice categories, including Harvey, CoCounsel, and CourtListener Citations Checker. LimEulYoung/lawful-mcp rebranded from legal-search-mcp and filed Anthropic-connector SECURITY.md with OAuth web-connector path. NormasTCU (arXiv 2608.27746) and QUEST (2608.28555) add Brazilian and Danish legal-IR / LLM-as-judge evidence: rank-aware metrics often survive LLM judges; precision cutoffs and credibility labels do not.
- **Effect Schema/Net and Jazz wire moved; MCP adapter is the new Effect↔agents intersection.** #7532 (CIDR Schema codecs) merged 2026-08-31T11:56Z while #7524 Net codecs stay OPEN. #7265 MCP 2026-07-28 protocol adapter (OPEN, updated in-window) adds McpProtocol.v2026_07_28, McpSchema.InputRequired, and Schema-declared tool output including structuredContent. Jazz #2347 browser identity MERGED (00:37 CT Aug 31). #2435 opened same morning: reject unknown structured wire-error tags so TS/Rust share one enum. Cambria (arXiv 2608.27798) is on-axis algebraic-effects parametricity. Published latest remains effect@4.0.0-rc.112; #7446 still stages unpublished rc.113.
- **Agent Plugins got an empirical paper and a pre-install scanner; Enterprise IG nav closed.** arXiv 2608.28497 studies 1,926 Claude Code plugin marketplaces (8,351 plugins, 77,773 commits): 8.8× commit growth, 78% of skill Script–Markdown co-changes functionally coupled. skillscan (daffnjk/agent-skill-security-scanner, created Aug 31) is an offline fail-closed static scanner treating skills/MCP/IDE rules as untrusted data (TrustShift-adjacent). AGENT-O (2608.28345) defines a semantic Agent Card ontology; Logos (2608.28553) formalizes plugin assembly on a cross-process bus. MCP #3321 Enterprise IG nav MERGED; draft #3306 documents IdP ID-JAG support (Okta, Ping, Entra). SEP-2640 still OPEN on draft-track.

### Moved

- **w-jazz-wire-v1.** #2347 browser identity OPEN → MERGED. alpha.54 RC #2361 still OPEN. #2435 tagged-error close is the new live follow-through.
- **w-mcp-enterprise-ig.** #3321 nav wiring OPEN → MERGED. Rising edge continues on draft #3306 IdP/ID-JAG docs. SEP-2640 still open.
- **w-skills-over-mcp / w-trustshift.** SEP-2640 HOLD. Agent Plugins co-evolution paper (2608.28497) and Logos harness (2608.28553) raise the disk-vs-wire fork with empirical packaging evidence. skillscan is adjacent pre-install audit tooling for the TrustShift install-time gap.
- **Public-law MCP.** 08-30 Croatia store-nothing MCP → 08-31 Sweden Lifos/rättspraxis pair + awesome directory + Korean connector rebrand. Pattern: jurisdiction MCP that never holds the firm's lookup list, now with a catalog and connector-directory posture.
- **Effect pin.** Still no published rc.113. #7532 CIDR codecs landed on main; #7265 MCP adapter is unpublished pending that cut. Do not pin beep kits on #7446.

### Contradicted

None of the standing claims broke.

### Settled (refutation quota)

- **USPTO ODP four-field gate — HOLDS.** Live data.uspto.gov banner still mandates four profile fields as of 2026-08-18. Standing petition `includeDocuments=true` HTTP 500s are unverified this window (patent.dev still asserts them; unauth probe returned 401 and did not exercise the path; no authenticated probe; no in-window USPTO rollback note).
- **drizzle TaggedErrorClass — HOLDS.** #6162 still OPEN (`closed_at=null`, last update 2026-08-25).
- **Instant Cloud sunset 2027-08-31 — HOLDS.** Official essay unchanged (shutdown 2027-08-31; backups through 2028-08-31).
- **SEP-2640 — HOLDS (unsettled).** #2640 still OPEN (SEP draft label + extension; no in-window update since 2026-08-29T18:46Z).
- **effect@4.0.0-rc.112 / no rc.113 — HOLDS.** Published latest is still rc.112 (2026-08-25). #7446 OPEN, updated 2026-08-30T23:53Z, stages unpublished rc.113.

Cheap-check MOVES (not quota): Jazz #2347 MERGED 2026-08-31T05:37:27Z; MCP #3321 MERGED 2026-08-30T22:33:58Z. OED D2026-16: no in-window follow-on (notes only). LawNext empty Aug 30–31.

## Intersections with today's repo-replay

Merged since the 2026-08-30 packet cut: #896 (prior nightly); Semantica C0–C1 #913 #923 #932 #934 #935 (open #938 C2 / #939 C2 gitleaks, not research, do not babysit); beep-ci-ops S5–S7 #901 #905 #907 #919 #936; practice-office #904 #909 #915–#918 #928; schema codec statics #927; yeet/repo-cli #912 #921 #922 #925 #929 #931; document semantic conformance #926.

Sweden Lifos/rättspraxis + awesome-legal-mcp next to `gov-legal-mcp` / court-reporter vocabulary (public-court MCP that never holds the firm watchlist). NormasTCU / QUEST LLM-as-judge next to citation-verified-span-substrate and citation-extraction-engine: rank-aware metrics survive judges; P@k and credibility labels do not. Effect #7265 MCP adapter + #7532 CIDR codecs next to mcp-kit / schema codec work (#927) and effect-v4 kits; do not pin on unpublished #7446. Agent Plugins 2608.28497 + skillscan next to skill-contract-kernel / agent-execution-authority. Jazz #2347 merge + #2435 tagged errors next to local-first wire assumptions.

## Frictions

- X search is connected but API-forbidden (`client-not-enrolled`). Same resume cursor: enroll App in a Project at console.x.com.
- No Sol/Luna verify seat in this harness.
- GitHub MCP needsAuth; `gh` + cloud agent publishes this packet.
- LawNext empty Aug 30–31 (last post Aug 28 Peak Legal Tech).
- USPTO petition includeDocuments unauth 401 (500 untestable without API key).
- Prelude said Monday arXiv mailing had not happened; HTML `/new` was already populated. Used live lists.

## Appendix — topical notes

Law: the public-law MCP pattern (Croatia yesterday, Sweden today) is the foil for gov-legal-mcp, now with a first public catalog (awesome-legal-mcp / legalaimcp.com) and connector-directory posture (lawful-mcp). LLM-as-judge legal IR (NormasTCU, QUEST) warns that citation eval must prefer rank-aware metrics. OED Mitchell has no follow-on; ODP four-field HOLD unchanged (includeDocuments 500s unverified).

Effect: #7532 CIDR landed; #7265 MCP adapter is the Schema-as-tool-contract rising edge, still gated on unpublished rc.113. Jazz identity landed; tagged-error close (#2435) continues wire-v1 hygiene. Do not pin rc.113.

Agents: empirical Agent Plugins co-evolution + offline skillscan give packaging and supply-chain evidence while SEP-2640 stays draft. Enterprise IG nav is done; IdP docs are next. AGENT-O / Logos are ontology and harness formalizations adjacent to skill-contract-kernel.
