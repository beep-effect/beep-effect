# PROMPT — research/2026-10-09

## Kickoff A — Hallucination gate and checker pin

Read the 2026-10-09 packet claims f-law-01, f-law-02, f-law-07, and f-law-08. Report, for beep's citation and verifier path:

1. Where a task can pass while a material hallucination is present.
2. Whether the checker model is pinned and disclosed.
3. What a public claim-level set (PARCEL-style Supported / Refuted / Not Found) would sit next to any private gate.
4. Where a citation is named and the verdict does not depend on it.

Report findings only. Do not merge. Do not change prompts or models.

## Kickoff B — effect main since 4.0.2

List beep call sites touched by the unreleased Effect main train in this packet:

1. `effect/net` DNS and TLSA (#8880, #8953).
2. HTTP MCP subscription disable and list-change notifications (#8924, #8925), on top of `McpServer.layerHttp` session termination.
3. Spans that start from the active OpenTelemetry parent (#8929) and RPC response-encoding failures on the server span (#8958).
4. JSON Schema safe-integer bounds (#8956), for Schema-derived tool inputs.
5. Cluster shutdown and shard-handoff (#8941 and the same-window series).

Propose a bump plan. A human decides. Do not bump dependencies in this pass.

## Kickoff C — Skill admission and fail-closed hooks

Audit beep skill install and hook runners against:

1. Claude Code 2.1.295 `onFailure: "block"` (a hook that cannot start blocks the action).
2. PyCache Trap (scanners read source; the loader runs a swapped bytecode cache).
3. One Skill Too Many (a co-installed skill drops a constraint while the task still passes).
4. Skill Constellations (copies with no registry version).

Report findings only. Do not merge. Do not change hook config.
