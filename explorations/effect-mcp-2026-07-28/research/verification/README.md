# Gate B — adversarial verification (2026-09-17)

Method: for every lane claim of kind `breaking`, `semantic`, `risk`, or `decision-challenge`, three
independent headless grok refuters (`grok-4.6`, effort high, structured JSON output) checked the
cited `file:line` in the Effect clone at `a7a71921de` or the repo, or the cited URL, and voted
`refuted` or not. A claim is **killed** when two of three votes refute it; `fact` and `gap` claims
were not voted (they are inventory, verified by citation at synthesis). Votes ran as batched
per-lane processes (three per lane, six concurrent), resumable per vote after the two host
reboots that killed the first per-claim workflow attempt (receipt in `../OPPORTUNITIES.md`).

Per-lane verdicts: `<lane>.verdicts.jsonl` (one row per claim with all three votes) and
`<lane>.verdicts.jsonl.summary.json`. The consolidated file is `../verification.jsonl` (184 rows,
including the four orchestrator spike claims from `25-r4-spike-census`).

## Tally

| Lane | Voted | Survive | Killed | Split 1–2 |
| --- | --- | --- | --- | --- |
| 10-u1-api-delta | 19 | 19 | 0 | 0 |
| 11-u2-stateless-runtime | 33 | 33 | 0 | 3 |
| 12-u3-effect-guidance | 10 | 9 | 1 | 0 |
| 13-s1-spec-delta | 34 | 33 | 1 | 1 |
| 14-s2-ecosystem | 26 | 22 | 4 | 3 |
| 20-r1-mcp-kit | 11 | 11 | 0 | 1 |
| 21-r2-hosts | 13 | 13 | 0 | 0 |
| 22-r3-governance-identity | 8 | 7 | 1 | 1 |
| 23-r4-snapshot-blast-radius | 15 | 14 | 1 | 2 |
| 24-r5-http-security-observability | 11 | 10 | 1 | 1 |
| 25-r4-spike-census (orchestrator spike) | 4 | 4 | 0 | 0 |
| **Total** | **184** | **175** | **9** | **12** |

"Split 1–2" claims survive but carry one refuting vote; synthesis cites them with the dissent.

## Killed claims

Each kill is struck in its lane report under a "Gate B verdicts" section. The refuters' corrections
are the load-bearing part; most kills trim an overstated clause while the core observation stands.

| Claim | Kind | What the refuters found |
| --- | --- | --- |
| `12-u3-effect-guidance-25` | decision-challenge | Copying `MCP.md` cannot produce a 2026-only server and `InputRequired` is the elicitation path, but the cited upstream tests do **not** substitute mixed lists: `v2026_07_28.test.ts` is 2026-only (initialize 404, stdio `server/discover`). |
| `13-s1-spec-delta-29` | semantic | Origin MUST-validate, 403 on invalid Origin, localhost SHOULD, and auth SHOULD all match the Streamable HTTP page; the closing sentence inventing an "Origin allowlist" and a bind-address requirement does not appear in the spec. |
| `14-s2-ecosystem-04` | semantic | The spec says a dual-era client MAY try a modern request first and SHOULD inspect a 400 body; the claim's MUST is invented. |
| `14-s2-ecosystem-14` | semantic | Python `negotiate_auto` raises on `-32022` only with a parseable modern-only list; without one it falls through to `initialize`, which can succeed. |
| `14-s2-ecosystem-26` | breaking | Laravel MCP 1.0 still accepts `initialize` (2025-11-25 / 2025-06-18); the "hard cut, -32601" reading was corrected in-thread by the maintainer. Not a hard-cut precedent. |
| `14-s2-ecosystem-36` | decision-challenge | Blog, TypeScript, and Python defaults are as stated; the Codex stdio `initialize` default is documented as opt-in, not as the late-response hazard the claim attributed to it (that reason belongs to grok/rmcp). |
| `22-r3-governance-identity-19` | decision-challenge | `McpServerClientMiddleware` is legacy-only, but the 2026-07-28 `ClientRequestRpcs` never install it, so a 2026-only `tools/call` does not `Effect.die`. Handlers run with `McpRequestContext` only; the kit's `serviceOption(McpServerClient)` is `None`, no `McpCallerIdentity` is built, and the tier gate refuses. The failure is a refusal, not a defect. |
| `23-r4-snapshot-blast-radius-25` | risk | POSIX process-group cleanup after a successful leader exit is new versus rc.115 and can affect the vault picker, but semantica's `Reasoning.test.ts` spawns live children through `BunServices`, so "tests mock the spawner" is false for that user. |
| `24-r5-http-security-observability-13` | decision-challenge | The kit only writes `sessionId` when `McpServerClient` is `Some`; under 2026-07-28 it is absent, so the identity path is skipped entirely rather than producing a `None` session id. Same correction as `22-r3-…-19`. |

Net for the align grill: the identity gap under G4 is confirmed by every refuter, but its shape is
"no caller identity is built, the gate refuses" rather than "the kit defects". The mixed-list
option remains upstream-supported (`mcpRuntime.ts:193-209`) and is not evidenced by the 2026-only
conformance suite.
