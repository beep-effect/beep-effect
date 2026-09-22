# Lane 22-r3-governance-identity — Session-keyed governance under a stateless protocol

**Owns:** beep-effect invariants that assume an MCP session, and the option space for replacing
the session anchor. Effect's `McpRequestContext` population and `clientId` stability belong to
11-u2; cite them briefly, do not re-derive them.

**Question:** What in beep-effect assumes an MCP session exists (especially `GovernedTierGate`
grant freezing, write-ahead decisions, and hash chains), and what identity anchors could replace
`mcp-session-id`?

**Primary sources:** `repo:packages/epistemic/server/src/GovernedTierGate/**`,
`repo:packages/epistemic/server/test/GovernedTierGate.test.ts`,
`repo:packages/epistemic/server/test/integration/GovernedTierGate.pglite.test.ts`,
`repo:packages/foundation/capability/mcp-kit/src/{TierGate,McpCaller,SanitizedSpan}.ts`,
`repo:apps/professional-desktop/server/OntologyMcpTransport.ts` (bearer security middleware, grant
TTL), `repo:apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`, the
decision logs and specs in `repo:goals/ontology-agent-surface/` and any `agent-execution-authority`
packet under `repo:goals/` or `repo:explorations/`, `repo:standards/architecture/03-driver-boundaries.md`,
`09-errors-across-boundaries.md`, `12-observability.md`; Effect `McpRequestContext`, MRTR, and
stateless admission (`effect:packages/effect/src/unstable/ai/McpSchema.ts`,
`internal/mcpRuntime.ts`).

**Report sections:**
1. Session dependency inventory: every read of `sessionId`, `mcp-session-id`, or `clientId` and
   the invariant it protects (grant-set freeze on first dispatch, write-ahead ledger decision, hash
   chain continuity, TTL, audit attribution), with tests that pin each.
2. Existing decisions that assumed sessions (minimal quotes, cited).
3. What a 2026-07-28 request carries that could anchor identity (authenticated bearer principal,
   `clientInfo`, `requestMetadata`/`_meta`, `requestState`, MRTR `inputResponses`), separating
   client-controlled (forgeable) from server-minted or server-verified values.
4. Option table (no decision), each with how grants, hash chains, TTL, and audit would work;
   security properties; tests that change; doctrine touch points. Include, labeled as contradicting
   working assumption G4, "keep a stateful protocol on the ontology sidecar" and "mixed protocol
   list", so the operator can weigh them.
5. Grill questions only the operator can answer.
