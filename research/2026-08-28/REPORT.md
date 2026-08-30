# REPORT — 2026-08-28

Window 2026-08-26 22:22 → 2026-08-28 08:27 America/Chicago. Status: **partial** (X search still `client-not-enrolled`). 15 claims. Collision rate 0 against the 2026-08-26 digest plus the closed unmerged 2026-08-27 packet (#862). Refutation quota: 5 standing claims challenged (4 held, 1 held-and-moved). Not Sunday; no weekly consolidation.

The 2026-08-27 packet (#862) was closed unmerged. Its 12 claims are committed at `research/ledger/excluded-packets/2026-08-27.jsonl` so a later exclusion digest can rebuild without the closed PR. They are not re-emitted.

## Delta

### New

- **DMS and research vendors now ship MCP write-back, not just chat.** iManage next-gen GA is October 2026; MCP already does create-workspace/folder, file, move, link, and lands AI work product in the governed record (LawNext 2026-08-27). Clarra shipped a 120-tool / 250-endpoint litigation MCP into Claude Cowork (and Cursor). Bloomberg Law put dockets and cited research into Claude over MCP. Google's Gemini Enterprise for Legal is the connector graph (13+ permission-bound MCP connectors: iManage, NetDocuments, RelativityOne, HighQ, Harvey, CourtListener). RelativityOne-over-Gemini was yesterday's claim; today's claim is the wider fabric plus write actions.
- **Patent white space got a quantitative method.** BLANC (2608.26685, 2026-08-27) flags combinations whose NPMI drops under a keyword filter (ΔNPMI). Three semantic views required; one-view collapse recovers nothing. 34.1% / 27.3% recovery on depleted USPTO G06N / C03C; 0/191 decoys.
- **Hosted skills can be stolen from ordinary task results.** Daydreaming (2608.26733) reconstructs a multi-file skill at Output-level (final answer only), 86.8% capability, median 32 calls, ~4× SigLeak, with disclosure defenses on. Names Harvey as Skill-as-a-Service. Hiding `SKILL.md` is not a confidentiality story.
- **Skills and ontologies keep moving off weights.** WikiSkill (2608.27454) persists experience in a wiki that later skill updates build on; smaller models with evolved skills beat larger models without them. SymbolLKG (2608.26836) treats rules as topological nodes and routes to a symbolic solver — same constraints-before-LLM family as Bosch CGM.
- **Effect SchemaBinary is being hardened in-tree, and Effect's MCP server no longer emits illegal structuredContent.** Overnight #7506/#7507/#7508 fix dictionary/number arrays, decoder limits, and strict extra-field collisions. #7495 stops null/arrays going into MCP `structuredContent`. Socket is now pull-based with Node TLS constructors (#7487/#7511/#7512). Still no rc.113.

### Moved

- **w-schema-binary.** Cluster-wire decision from 2026-08-26 still holds (MessagePack stays gone). Three overnight bugfixes mean the codec is not yet "done"; do not pin a beep cluster transport until the next RC absorbs them.
- **Legal MCP market.** 2026-08-26 was "own the model + own the MCP + verify citations." 2026-08-28 adds "own the DMS write path." iManage/Clarra/Bloomberg/Gemini connectors are the same race from the system-of-record side.

### Contradicted

None of the standing 2026-08-26 claims broke.

### Settled (refutation quota)

- **USPTO ODP four-field gate — HOLDS.** patent.dev August 2026 live check: Job Title / Organization Name / Organization Type / Intended Use still mandatory or keys revoke; cannot be set via API. Petition `includeDocuments=true` still 500s for every record 2004–2026.
- **drizzle TaggedErrorClass — HOLDS.** #6162 still OPEN (updated 2026-08-25). beep #852 merged and does not close it.
- **Instant Cloud sunset 2027-08-31 — HOLDS.** Official essay unchanged; self-host docs still the path.
- **SEP-2640 — HOLDS (unsettled).** #2640 still OPEN (last update 2026-08-25). Disk plugins vs wire skills remains a fork.
- **SchemaBinary as default cluster wire — HOLDS, moved** (see above). Not reverted.

## Intersections with today's repo-replay

Merged since the 2026-08-26 packet: #866 closes semantic-foundation (read next to SymbolLKG / WikiSkill). #863 adds Impeccable + Phoenix MCPs (read next to Effect #7495 structuredContent and Daydreaming). #852 effect-drizzle kits merged — does **not** retire w-drizzle-taggederror. #858/#870 yeet watch-on-event + scheduler tests. #864 openai-driver quality. #855 packet convention migration. #853 still parks extraction after the C0 breaker — Daydreaming + TrustShift are the two reasons not to un-park a long-lived MCP provider on hope.

Open and relevant: #867 patent-document-schema and #865 court-reporter-vocabulary (BLANC + iManage write-back). #872 LeJeune ontology / #873 corpus salvage. #869 Oppold T7. #874 ship-velocity. #871 langextract metadata.

Closed #862 (2026-08-27 nightly) is the exclusion source for Lexis Protégé, ILTACON Day 3, Clio judiciary, USPTO RPI NPR, Tenet LAB/harness, claude-patent-creator, Evolu 8.7.0, and Effect #7489/#7486/#7477/#7492. Those 12 records live in `research/ledger/excluded-packets/2026-08-27.jsonl`. Do not re-claim those.

## Frictions

- X search is connected but API-forbidden (`client-not-enrolled`). Same resume cursor as 2026-08-26/27.
- No Sol/Luna verify seat in this harness.
- GitHub MCP DCR is broken; `gh` + cloud agent publishes this packet.
- 2026-08-27 packet was closed unmerged after commitlint (`research:` is not in type-enum). This publisher uses `docs(research):` on the commit.

## Appendix — topical notes

Law: the ILTACON leftover is MCP-as-the-system-of-record. Specialist models (Thomson 1.0 / Tenet / planned Lexis) were last week's story; this window is DMS and research vendors exposing writeable, permission-bound MCP. USPTO access is still keyed and profile-gated; petition documents still 500.

Effect: SchemaBinary is the v4 wire and is still taking overnight correctness patches. Effect's own MCP server just learned that `typeof null === "object"`. Local-first vendor shock (Instant) is unchanged.

Agents: two new threat papers (Daydreaming on skills, TrustShift still standing on MCP) plus two constructive papers (WikiSkill wiki, SymbolLKG solver routing). The skill contract is still forked (SEP-2640 open).
