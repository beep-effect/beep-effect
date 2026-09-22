# Sources

Carried from the exploration ledger `explorations/effect-mcp-2026-07-28/research/SOURCES.md` (primary); this copy
reproduces the corpus for implementation.

## In-repo bricks

| Brick | Path | Disposition |
| --- | --- | --- |
| Sidecar transport, pin, Origin middleware, CORS | `apps/professional-desktop/server/OntologyMcpTransport.ts` | target surface |
| Per-launch bearer verification | `apps/professional-desktop/server/RpcSessionAuth.ts` | run-key source |
| Gate run keying | `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` (`runIdOf`) | re-key on launch |
| Ontology MCP config | `packages/ontology/config/src/McpConfig.ts` (`OntologyMcpServerConfig`) | allow-list home |
| Integration harness (SSE unwrap, #1173) | `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts` | move onto the kit client |
| Live proof client | `goals/ontology-agent-surface/ops/live-mcp-client.ts` | move onto the kit client |
| Decision 10 home | `goals/agent-execution-authority/SPEC.md` | wording update |
| Kit client and dual-read | `goals/mcp-stateless-kit-and-drivers` PR 1 | precondition |

## Upstream (installed and reference)

| Source | License | Disposition |
| --- | --- | --- |
| `effect@4.0.0-rc.117` (`node_modules/effect/dist/unstable/{ai,http}/**`) | MIT | installed truth |
| MCP specification 2026-07-28, security and transport sections | CC-BY-4.0 (docs) | Origin/OPTIONS rules |

## Exploration lanes to read

`explorations/effect-mcp-2026-07-28/research/22-r3-governance-identity.md` (options and risks, verified),
`24-r5-http-security-observability.md` (Origin, CORS, correlation), `11-u2-stateless-runtime.md`
(cancellation gap, `clientId` per-POST).
