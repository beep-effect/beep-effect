# PROMPT — research/2026-10-08

## Kickoff A — MCP client/host trust audit (GHSA-6qxp + Harvey Tool Pinner + SEP-2127)
Audit beep's MCP clients and hosts (mcp-kit uspto and gov-legal, m365 outbox) for three things:
1. OAuth issuer binding per GHSA-6qxp-vccf-f47h: `expectedIssuer` on bundled providers and `issuer` on persisted credentials.
2. Whether tool definitions and descriptions are pinned and diffed between connections, as in Harvey's Tool Pinner.
3. What SEP-2127 Server Card metadata would expose.

Report findings only. Do not merge.

## Kickoff B — effect@4.0.2 upgrade impact
List every beep usage touched by Effect #8870 (AI tracing option/type removals), #8773/#8775 (McpServer.layerHttp session and protocol-version behavior) and #8842 (toolkit service requirements). Propose a bump PR plan; a human decides.

## Kickoff C — Type-checker lane comparison
Compare current `@effect/tsgo` (0.51.x) against tsc-rs 0.1.0 (Effect diagnostics ported from tsgo 0.46.1) on one beep package. Measure wall time and diagnostics parity. Proposal only; no dependency changes.
