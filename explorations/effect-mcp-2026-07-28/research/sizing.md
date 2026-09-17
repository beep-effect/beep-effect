# Draft PR train (pre-align, superseded by `MAP.md`)

Sized after Gate C (`reviews/gate-c-sizing.md`). Stage ids `S0…S5` are deliberately not the goal
template's phase ids. Sizes are agent-days of implementation plus hosted proof. Dependencies name
the align decisions from `RESEARCH.md` §5, never numbered "grill items".

| Stage | Scope | Size (G4 kept) | Size (mixed list) | Depends on |
| --- | --- | --- | --- | --- |
| S0 snapshot pin | Pin the 16 catalog entries to the SHA named by D-pin-sha; the two proven type fixes; re-roll and re-key the platform-node-shared patch and assert `bun install` applied it (fail closed); a 2025-only SSE-stripping JSON-RPC decode shim for the sidecar harness and `live-mcp-client.ts` (keep `initialize`, no 2026 transport yet); native sql-pg timestamp/enum proof or a call-site census; docgen run (TS7056 precedent). Exit: hosted Heavy / Test Integration green, not tier 1 alone. | large 5–8 | large 5–8 | D-pin-sha |
| S1 kit rebase | Rebase `sanitizedToolkit` on snapshot `registerToolkit` (exclude `McpRequestContext`, `outputSchema`, strict decode, `omitRequestServices`, `Stream.runLast`); dual-read `McpServerClient` or `McpRequestContext` so 2026 dispatch is not `None` (transport facts only, no run-key semantics); D-projection as a named translator; protocol-list helper; README pin and stale comments; `SanitizedSpan` coverage ratchet in exit criteria. | large 5–7 | large 5–7 | S0, D-projection |
| S1b 2026 client kit | In-repo `ClientRpcs` with `server/discover`; HTTP header and `_meta` injector; stdio NDJSON helper that sends `discover`; reuse the S0 SSE decode. | large 4–6 | optional / deferred | S0, D-posture, D-client-home |
| S2 proving host nlp-mcp | Protocol pin per D-posture; stdio wire canary; `instructions`; `.mcp.json` entry shape; operator notes for vendor CLIs, or the live first-message capture as an entrance criterion, per D-cli-contract; conformance run or waiver per D-conformance. | medium 3–4 | small 1–2 | S1, S1b, D-posture, D-cli-contract, D-conformance |
| S3 remaining stdio hosts | m365 (the only real stdio JSON-RPC conversation test; the framing canary), uspto (array `structuredContent`), gov-legal, practice-kg (smoke and `.mcpb`); `instructions`; JSDoc. Runs parallel with S2 after S1 + S1b. | medium 3–4 | small 1–2 | S1, S1b |
| S4 sidecar identity + pin | Run key per D-run-key, owned in `epistemic/server` and app composition; sidecar protocol pin in the same PR; harness on the 2026 wire; grant-expired and never-evict tests; `OntologyChangeActor` keyed to the run id; gate span renamed and carrying the correlation attribute; Origin and CORS per D-origin (one-line allow-list edit unless browser clients are in scope). HTTP cancellation recorded as an accepted Effect gap. | extra-large 8–12 | large 6–10 | S1, S1b, D-run-key, D-origin |
| S5a docs closeout | mcp-kit README consumer table update (architecture 07), agent-execution-authority SPEC identity wording, optional fork `MCP.md` PR (G8). | small 1 | small 1 | S4 |
| S5b RC swap | A second snapshot campaign when a published RC carries the adapter: patch re-roll, lockstep re-pin, census re-run. Off the critical path. | medium 3–5 | medium 3–5 | S0–S4, published RC |

Totals: roughly 28–45 agent-days with G4 as written, 16–24 with a mixed list. Candidate goal
split (to be validated in `MAP.md`): Goal A = S0, S1, S1b, S2, S3; Goal B = S4; S5a/S5b each
attach to the goal they close. Goal A's kit work must not touch identity schema until D-run-key
is answered; Goal B cannot start before it.
