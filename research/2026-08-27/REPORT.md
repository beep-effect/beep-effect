# REPORT — 2026-08-27

Window 2026-08-26 22:22 → 2026-08-27 08:21 America/Chicago. Status: **partial** (X search still `client-not-enrolled`). 12 claims. Collision rate 0 against the 2026-08-26 digest (34 standing). Refutation quota: 3 attempted, 2 held, 1 inconclusive.

Human admitted the 2026-08-26 packet as #854 (merged 00:50 CDT). Overnight repo-replay: #852 effect-drizzle kits, #853 park extraction after C0, #851 desktop chat, #856 evidence-quote relation, #857 session-b rulings. Open: #858 yeet-until-event, #855 packet-convention-migration. No blocking `research/*` PR at start of run.

## Delta

### New

- **Lexis joined the "own the model + own the harness + verify citations" stack.** Lexis+ with Protégé's Legal Intelligence Engine (2026-08-24, still the ILTACON talking point on 2026-08-26) dynamically selects models, agents, skills, and sources from a described task — not predefined workflows. Several hundred skills, including Claude Legal skills. Shepard's is the citation harness. A proprietary Lexis model is planned later in 2026. Yesterday's packet had TR Thomson 1.0 + Harvey Tenet + Relativity/Gemini MCP and missed Lexis.
- **ILTACON Day 3 made the product question "who owns the single agentic interface."** Litera Lito (relaunch), Lexis Protégé, DISCO Advanced Research (shown at booth 216), Reveal's agentic suite, Epiq Automate. Foundation-model chatbots (Claude / Gemini / Perplexity) are named as the elephants because they already sit in lawyers' daily chat.
- **Clio is walking into the judiciary.** Pablo Arredondo (Casetext cofounder, later TR VP of CoCounsel) starts 2026-08-31 as SVP Judiciary to build a dedicated court/judge product line. First move of this scale. Backdrop: vLex + Clio Docket.
- **USPTO identity pressure continues.** July 2026 NPR to require RPI disclosure on third-party ex parte reexams drew 26 split comments (IPWatchdog 2026-08-25). Missed yesterday. Orthogonal to the ODP four-field gate (f-law-05 standing).
- **Evolu dropped msgpackr the night Effect dropped MessagePack.** `@evolu/common@8.7.0` (2026-08-27 04:57Z) ships `encodeJsonValue` / `decodeJsonValue`, 76% smaller than msgpackr 2.0.5, three round-trip fixes. Same "schema-narrow codec, not generic msgpack" decision as Effect SchemaBinary (#7461).
- **Effect overnight: cluster interrupts, eager streaming tools, cross-runtime WebSocket, AI-guide `fnUntraced`.** #7489 bounds teardown interrupt classification. #7486 runs `streamText` tool handlers only after the stream has moved past the call. #7477 unties `Socket.fromWebSocket` from DOM. #7491/#7492 continue yesterday's jsdocs-skill compression.
- **Claude-Patent-Creator is a live MCP+skills USPTO drafting stack** (pushed 2026-08-24): MPEP/USC/CFR RAG, BigQuery 76M+ patents, 35 USC 112 checks, 6-phase autonomous subagent. Markdown+SVG out; DOCX/PDF is a manual post-step. Foil for `patent-drafting-episode-ledger`.

### Moved

- **Harvey Tenet now has numbers and a harness asterisk.** Fireworks 2026-08-26: 19.7% vs 10.8% LAB all-pass; 11.3% vs 9.3% LAB Contracts; 74.0% vs 58.8% Mercor APEX Corporate Law; 55.5% vs 49.3% Crosby Redline; $5.92 vs $5.62 per LAB task. Harvey's own preview: the LAB run used bash + filesystem mount, **not** Mercor's MCP/ReAct Archipelago harness. Do not treat Tenet LAB as MCP-harness gold for `effect-native-legal-eval`. Yesterday's f-law-04 stays true; this is the measured follow-through.

### Contradicted

None. Three standing claims were challenged:

- `f-effect-05` drizzle `Schema.TaggedErrorClass` — **held**. #6162 still open; `lotap` pointed at `v1.0.0-rc.4/drizzle-orm/src/effect-core/errors.ts` (2026-08-25). Beep #852 merged and simplified kits; that does not close the upstream break.
- `f-agents-03` SEP-2640 — **held**. PR still open; last update 2026-08-25T22:57Z.
- `f-law-05` USPTO ODP four-field gate — **inconclusive**. The live ODP HTML is a JS app and did not contain the 2026-08-18 notice text. Do not treat silence as a lift.

### Settled

- Repo, not research: #853 (park extraction after C0 breaker) merged 00:50 CDT. Yesterday's "read TrustShift before un-parking" still applies if/when it is un-parked; the park itself is admitted.

## Intersections with today's repo-replay

#852 (effect-drizzle kits) landed while drizzle-orm#6162 is still open — the kit simplify does not retire `w-drizzle-taggederror`. #853 park + #856 evidence-quote sit next to TrustShiftProbe (standing) and to Tenet's harness-dependent eval: semantica should not treat a bash-fs score as an MCP-provider score. Effect #7486 (eager streaming tools + incomplete-finish gate) rhymes with yeet cheap-gates and open #858 (exit yeet watch on events). Evolu 8.7.0 + SchemaBinary is the same schema-as-wire story as HttpApi catalog. Claude-Patent-Creator + Dis2Pat (standing) are usable gold for `patent-drafting-episode-ledger`. Lexis/Clio/Litera "one interface" is the competitor frame for `gov-legal-mcp` / `uspto-mcp` / `skill-contract-kernel`.

## Frictions

- X search is connected but API-forbidden (`client-not-enrolled`, client_id 29986667). Same resume cursor as 2026-08-26. Silence is not absence of X traffic.
- No Sol/Luna verify seat in this harness.
- GitHub MCP DCR still unused; `gh` + cloud agent publish.
- USPTO ODP notice is JS-rendered; live HTML scrape cannot confirm or lift f-law-05.

## Appendix — topical notes

Law: the competitor stack is now three specialist-model houses (TR Thomson 1.0, Harvey Tenet, Lexis planned) plus a judiciary entrant (Clio) and a "who owns the chat" fight at ILTACON. Eval numbers arrived with a harness caveat — gold for `effect-native-legal-eval` must record the harness, not just the model.

Effect: SchemaBinary is no longer a one-repo story. Evolu independently replaced msgpackr with a JsonValue-only codec overnight. Cluster interrupt accounting and streaming tool safety are the post-rc.112 hardening.

Agents: SEP-2640 still not voted. Hosts keep shipping disk plugins and in-repo skills (Effect #7491/#7492, Claude-Patent-Creator) while the wire spec waits. Tenet vs Mercor is a concrete instance of "same model, different harness, different claim."
