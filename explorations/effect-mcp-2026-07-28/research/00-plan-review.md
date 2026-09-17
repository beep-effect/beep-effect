# Gate A — Research Plan Review (2026-09-16)

Two headless grok reviewers (`grok-4.6`, xhigh, structured output) red-teamed the lane briefs in
`ops/prompts/` before fan-out: a completeness critic (12 turns) and a skeptic (8 turns). They
returned 28 findings: 5 blocker, 16 major, 7 minor. The orchestrator checked the load-bearing
source claims against the Effect clone before accepting them.

## Verdicts

- **Critic:** incomplete. No owner for stdio framing, stateless HTTP security, observability,
  beep-effect JSDoc/docgen, or in-repo MCP clients beyond the `nlp` `.mcp.json` entry.
- **Skeptic:** do not launch as written. The output contract contradicts itself for web lanes;
  the runtime brief presupposes dropped features that the adapter still implements; and the
  working assumptions G4 + G6 + G9 hide evidence that could change the plan.

## Verified premise

With a protocol list of only `McpProtocol.v2026_07_28`, an `initialize` request is rejected:
`selectStatefulProtocol` considers only stateful adapters
(`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:181-186`), and the runtime then
fails with "initialize is not supported by the configured MCP protocols"
(`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:319-326`). The stdio codec takes the
same path (`effect:packages/effect/src/unstable/ai/McpServer.ts:1484-1487`). Effect permits mixed
lists with at most one stateless adapter (`effect:packages/effect/src/unstable/ai/internal/mcpRuntime.ts:193-209`).
Whether in-repo launchers (agents started through `.mcp.json`, test harnesses) still work under G4
therefore depends on whether their clients speak 2026-07-28. That is now an explicit research
question, not an assumption.

## Dispositions

| # | Finding (condensed) | Disposition |
| --- | --- | --- |
| 1 | Contract: "create headings in 3 turns" then "skeleton = failed"; web lanes cannot meet turn rules; two writers of one file | **Fixed.** File created at first cited finding; per-section minimum is a cited claim or explicit NOT FOUND/UNVERIFIED; workflow waiting excluded from budget; web lanes have a single writer after the run. |
| 2 | G4/G6/G9 locked in the contract suppress evidence (stdio `initialize` rejection, session-keyed governance) | **Fixed.** Decisions are framed as working assumptions; new claim kind `decision-challenge`; summaries carry `decisionChallenges` and `grillQuestions`. The operator's decisions stand until the grill. |
| 3 | 11-u2 omits the TestUtils harnesses, `McpSchema.test.ts`, `McpProtocol.test.ts` | **Fixed.** Added as primary sources. |
| 4 | Nobody owns stdio framing (NDJSON, batch rejection, chunking) | **Fixed.** 11-u2 §3. |
| 5 | Stateless HTTP security unowned (routing headers vs CORS lists, 405s, default-deny Origin, duplicate Origin middleware) | **Fixed.** New lane `24-r5-http-security-observability`. |
| 6 | Observability unowned (span prefixes, sanitized spans, origin metric) | **Fixed.** Lane 24-r5 §4. |
| 7 | 11-u2 §9 presumed a "dropped" set (logging, completions, templates, cancellation) that the adapter still implements | **Fixed.** Replaced with an evidence-first coverage matrix. |
| 8 | 11-u2 asked about GET SSE; `layerHttp` answers GET with 405 and delivers notifications through `sendNotification` | **Fixed.** 11-u2 §4 and §7 name the actual channels. |
| 9 | 11-u2 too broad for the budget | **Partly accepted.** Sections tightened and the test map limited to §1–8; the lane keeps exclusive ownership of runtime facts so others stop duplicating them. |
| 10 | `McpRequestContext` census duplicated across 11-u2, 20-r1, 22-r3 | **Fixed.** 11-u2 owns field population and `clientId` stability; 20-r1 cites kit call sites; 22-r3 cites beep invariants. |
| 11 | No lane asks whether any `McpRequestContext` field is server-minted and stable | **Fixed.** 11-u2 §5 and 22-r3 §3. |
| 12 | 22-r3 cannot list "keep a stateful protocol on the sidecar" or "mixed list" | **Fixed.** Included as labeled G4-contradicting options. |
| 13 | JSDoc/doctest/docgen inventory missing for beep-effect | **Fixed.** 20-r1 §4 (kit) and 21-r2 §1 (hosts). |
| 14 | 21-r2 misses the integration tests that speak the wire, `@beep/ontology-config`, `live-mcp-client.ts` | **Fixed.** Named explicitly; in-repo clients declared in scope. |
| 15 | In-repo MCP client config wider than the `nlp` entry (`ai-sync`, `plugins/*/.mcp.json`, `.ai/mcp/mcp.json`) | **Fixed.** 21-r2 §2–3. |
| 16 | Host tests stub `McpServerClient` (nlp-mcp, m365-mcp `SanitizedSpan.test.ts`); GovernedTierGate tests unlisted | **Fixed.** 20-r1 and 22-r3 sources. |
| 17 | 14-s2 researched public client fallback that G6 declared out of scope | **Fixed.** Retargeted at the clients that launch in-repo servers and at conformance tooling. |
| 18 | 10-u1 inventory too wide (`LanguageModel.ts`, all of `RpcServer`); `Tool.Strict` dual use | **Fixed.** Narrowed; `Tool.Strict` provider vs MCP excess-property use split into its own section. |
| 19 | 12-u3's 25-line single-excerpt rule would create false gaps | **Fixed.** Multi-span citations allowed; missing demos are doc-gap notes, contradictions come first. |
| 20 | 13-s1 query embedded its expected answers and duplicated Effect coverage | **Fixed.** Query rewritten without presumed facts; Effect coverage moved to 11-u2. |
| 21 | New server options (`websiteUrl`, `icons`, `extensions`) unowned | **Fixed.** 10-u1 §3 and 11-u2 §2. |
| 22 | nlp-mcp's 17-tool `StreamingToolkit` not named | **Fixed.** 21-r2 hosts. |
| 23 | 23-r4 cannot size runtime risk without installs | **Fixed.** Type census supplied from the orchestrator spike; the lane now targets runtime-behavior changes and test coverage. A snapshot vs main MCP/sql-pg test run is in progress separately. |
| 24 | Sibling `@effect/*` packages must move in lockstep | **Fixed.** 23-r4 §3 (the spike already pinned all 16 catalog entries). |
| 25 | String-scan of client binaries is not a handshake proof; web research cannot upgrade it | **Accepted as a gap.** Logged for Stage 2: a live stdio handshake probe against a 2026-07-28-only server, run by the orchestrator, if research leaves it open. |
| 26 | G2 answer appeared truncated in the bundle | **No change.** Bundle extraction artifact (first line of the answer only); `DECISIONS.md` is complete. |
| 27 | Six grill decisions have no lane: host staging order, Origin middleware, reuse Effect TestUtils vs rewrite harnesses, in-repo `RpcClient` scope, what `server/discover` advertises, snapshot whole catalog vs `effect` only | **Accepted.** Added to the align agenda; lanes surface `grillQuestions`. The catalog question is answered by the spike (whole family pinned and green at type level). |
| 28 | G4 rationale treats mixed lists as a beep-effect invention; upstream supports them by design | **Accepted as evidence for the grill.** Recorded here; G4 remains the operator's decision until reopened. |
