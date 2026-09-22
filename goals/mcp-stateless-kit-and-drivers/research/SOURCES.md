# Sources

Carried from the exploration ledger `explorations/effect-mcp-2026-07-28/research/SOURCES.md` (primary); this copy
reproduces the corpus for implementation. Lane reports and Gate B verdicts live in the exploration.

## In-repo bricks

| Brick | Path | Disposition |
| --- | --- | --- |
| Kit fork of `registerToolkit` | `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` | rebase on rc.117 |
| Caller identity (transport facts) | `packages/foundation/capability/mcp-kit/src/McpCaller.ts` | keep; dual-read source |
| Kit envelopes and gates | `packages/foundation/capability/mcp-kit/src/{ApiKeyRequired,TierGate,SourceAuth,FieldTier}.ts` | D-projection translator home |
| Sidecar harness SSE unwrap (#1173) | `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts` | port into `@beep/mcp-kit/client` |
| Live proof client | `goals/ontology-agent-surface/ops/live-mcp-client.ts` | consumer of the kit client |
| m365 stdio conversation test | `packages/drivers/m365-mcp/test/Server.test.ts` | framing canary; moves to the kit client |
| Host servers | `packages/drivers/{nlp,m365,uspto,gov-legal}-mcp/src/Server.ts`, `packages/law-practice/server/src/Tools.ts` | protocol pin via helper |
| Vendor launch entry | `.mcp.json` (`nlp`) | capture surface |

## Upstream (installed and reference)

| Source | License | Disposition |
| --- | --- | --- |
| `effect@4.0.0-rc.117` (`node_modules/effect/dist/unstable/ai/**`) | MIT | installed truth for every API claim |
| Effect clone `effect:packages/effect/src/unstable/ai/**`, `effect:packages/effect/test/unstable/ai/McpServer/**` | MIT | reference; conformance harness port |
| Effect-TS/effect#7265, #8228, #8242, #8326 | MIT | changelog evidence |
| MCP specification 2026-07-28 (modelcontextprotocol.io) | CC-BY-4.0 (docs) | protocol reference |

## Exploration lanes to read

`explorations/effect-mcp-2026-07-28/research/`: `10-u1-api-delta.md`, `11-u2-stateless-runtime.md`, `12-u3-effect-guidance.md`,
`14-s2-ecosystem.md` (vendor CLI stdio defaults), `20-r1-mcp-kit.md`, `21-r2-hosts.md`; verdicts in
`research/verification/`.
