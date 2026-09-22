# Map — Effect MCP 2026-07-28 Stateless Protocol Adoption

Decomposition of `BRIEF.md` into goal packets. Capability check: every component cites an existing
repo brick or is marked NET-NEW. Stage ids `S1…S5a` come from `research/sizing.md`; S0 and S5b were
retired on 2026-09-21 because rc.117 is already on `main` (#1173).

## Candidate goal packets

### Goal A — `mcp-stateless-kit-and-drivers` (promised now)

**Mission.** Rebase `@beep/mcp-kit` on the installed rc.117 adapter, give it a 2026 client and a
conformance port, and cut the five stdio hosts over to `[McpProtocol.v2026_07_28]` in a fixed
order, nlp-mcp last behind the live capture.

**Deliverables.**
1. S1 kit rebase. Bricks: `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`
   (`sanitizedToolkit` / `registerSanitizedToolkit`), `McpCaller.ts` (JSDoc rewritten to transport
   facts), `TierGate.ts`,
   `ApiKeyRequired.ts`, `ToolkitComposition.ts`, `FieldTier.ts`, `Version.ts`; upstream source
   `effect:packages/effect/src/unstable/ai/McpServer.ts` (`registerToolkit`) as installed in
   `node_modules/effect`. NET-NEW: the protocol-list helper, the named error translator
   (D-projection), the dual-read of `McpServerClient` / `McpRequestContext` (the 2025
   `mcp-session-id` read stays until Goal B deletes it), and the product-neutral dispatch anchor
   `Context.Reference` that Goal B's run key travels through (2026-07-25 inversion).
2. S1b client. NET-NEW `client.ts` barrel in `packages/foundation/capability/mcp-kit/src` with
   an explicit `./client` package export, a Node entry `client.node.ts` for the stdio helper, and
   the conformance runner on the kit's test surface (Gate D). The kit re-declares its own 2026
   RpcGroup (rc.117 has no public `server/discover` group). Bricks it ports: the SSE unwrap in
   `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts` (#1173), the
   JSON-RPC client construction in the same harness and in
   `goals/ontology-agent-surface/ops/live-mcp-client.ts`, the stdio conversation test in
   `packages/drivers/m365-mcp/test/Server.test.ts`, Effect's conformance harness
   (`effect:packages/effect/test/unstable/ai/McpServer/**`).
3. S2/S3 host cutover in order: `packages/drivers/m365-mcp`, `packages/drivers/uspto-mcp`,
   `packages/drivers/gov-legal-mcp`, `packages/law-practice/server` (+ `apps/practice-kg-mcp`),
   then `packages/drivers/nlp-mcp`. Each: protocol pin through the helper, `instructions`,
   prompt titles, JSDoc, a conformance run through the kit client. Bricks: each host's
   `Server.ts` / `Tools.ts`, existing driver tests.
4. D-cli-contract capture: first stdio message from Claude Code (and Codex if cheap) against a
   2026-only nlp-mcp build, recorded under the goal's `history/`. Brick: `.mcp.json` `nlp`
   entry; lane 14-s2 flag notes. Outcome decides whether nlp-mcp flips inside Goal A or is held.
5. sql-pg native `PgClient` call-site census (inherited from S0). Brick: lane 23-r4 findings.
6. mcp-kit README consumer table refresh (architecture 07) and stale pin comments.
7. G8 upstream lane (optional, non-blocking): stdio `-32022` `data.supported` shape and the
   `MCP.md` gaps, as a fork PR.

**Dependencies.** rc.117 on `main` (done). **Owner surfaces.** `packages/foundation/capability/
mcp-kit`, `packages/drivers/*-mcp`, `packages/law-practice/server`, `apps/practice-kg-mcp`,
`.mcp.json`.

### Goal B — `ontology-sidecar-stateless-identity` (promised now, starts after A's kit PR merges)

**Mission.** Move the desktop ontology sidecar to `[McpProtocol.v2026_07_28]` with the
`GovernedTierGate` run keyed on the verified per-launch bearer, the harness on the 2026 wire, and
the Origin policy owned by config.

**Deliverables.**
1. Run key (app-composed): digest of the bearer verified by
   `apps/professional-desktop/server/RpcSessionAuth.ts`, provided in
   `apps/professional-desktop/server/OntologyMcpTransport.ts` as the kit's dispatch anchor,
   read by `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` (`runIdOf`)
   and by `OntologyChangeActor`; the kit's `mcp-session-id` read is deleted here. Bricks:
   `requireRpcSessionToken`, `GovernedTierGateLive`, the Goal A anchor.
2. Tests: delete "keys the run on the session, not the per-request client id"; add "keys the run
   on the launch", grant-expired permanence, never-evict. Brick: existing gate tests in
   `packages/epistemic/server/test/**`.
3. `OntologyChangeActor` (`packages/ontology/server`) keyed to the run id; the gate's own spans
   in `GovernedTierGate.gate.ts` renamed `epistemic.governed_tier_gate.evaluate` /
   `record_outcome` carrying `epistemic.governed_tier_gate.run_id` (architecture 12).
4. Sidecar protocol pin + harness on the 2026 wire through `@beep/mcp-kit/client`; conformance
   run. Bricks: `OntologyMcpTransport.ts:180`, the #1173 harness.
5. D-origin: allow-list field on `OntologyMcpServerConfig`
   (`packages/ontology/config/src/McpConfig.ts`) with a deny-all default (the desktop
   ConfigProvider supplies its origins), single Origin middleware feeding Effect
   `allowedOrigins` and ordered before CORS so attacker `OPTIONS` is 403, Origin-less POST
   denied, `OntologyMcpOriginForbidden` as `S.TaggedError`, CORS `allowedHeaders` gains
   `mcp-protocol-version`/`mcp-method`/`mcp-name` and drops `mcp-session-id`.
6. Decision 10 wording in `goals/agent-execution-authority/SPEC.md` and the epistemic package
   docs: "a run is a sidecar launch". HTTP cancellation recorded as an accepted Effect gap.

**Dependencies.** Goal A PR 1 merged (kit dual-read, dispatch anchor, client, conformance port);
not the whole goal, so no packet-level `blockedBy` (Gate D).
**Owner surfaces.** `apps/professional-desktop/server`, `packages/epistemic/server`,
`packages/ontology/{server,config}`, `goals/agent-execution-authority/SPEC.md`.

## Sequencing

1. Goal A PR 1: S1 kit rebase + `@beep/mcp-kit/client` + conformance port, hosts untouched
   (still compiling on 2025). Rationale: the dual-read and the client are what every later PR
   proves with; hosts must keep working while the kit moves.
2. Goal A PR 2: m365 + uspto cutover (framing canary and array `structuredContent`), then PR 3:
   gov-legal + practice-kg. Two PRs so the first stdio red is attributable.
3. Goal A PR 4: the vendor capture and, if it passes, nlp-mcp; otherwise the capture record and
   the exception-ledger hold. Goal A closes either way.
4. Goal B PR 1 (after A PR 1 merges; can overlap A PR 2–4): run key + tests + actor + span +
   sidecar pin + Origin/CORS in one PR, because the identity change and the pin are only
   provable together.
5. Goal B PR 2: SPEC wording + epistemic docs + closeout reflection (may fold into PR 1).
6. Optional G8 fork PR at any time.

## First vertical slice

Goal A PR 1's proof: a 2026-only `McpServer.layerStdio` test host mounted through the rebased
`sanitizedToolkit`, driven by `@beep/mcp-kit/client` over stdio: `server/discover` answers with
the toolkit, one `method: tools/call` dispatch succeeds with `McpRequestContext` present and
`McpServerClient` absent, the sanitized span carries transport facts, and the conformance port
passes for 2026-07-28. Over HTTP the client sends `MCP-Protocol-Version`, `Mcp-Method`,
`Mcp-Name` and the `_meta` keys `io.modelcontextprotocol/protocolVersion` and
`io.modelcontextprotocol/clientCapabilities`; a POST missing either key is 400 (kit test). Same test against a 2025 host proves the dual-read did not regress.

## Re-entry gates

- nlp-mcp flip: opens when a daily CLI (Claude Code first) sends `server/discover` first on
  stdio, per the capture record in Goal A's `history/`. Until then nlp-mcp is the one host on
  2025, recorded in Goal A's exception ledger; a fired gate reopens this packet at `decompose`
  only if the flip needs more than the recorded PR 4.
- `requestState` as a finer run key: opens if a client the sidecar serves echoes it; revisit in
  Goal B's exception ledger, never in the kit.

## Inherited risks

- Kit rebase drift recurs at the next RC: the coverage ratchet and stale-comment sweep are the
  guard, not a second fork.
- `withTopLevelObjectInputSchema` may be dead after Effect#8326: decide from the installed source
  in S1, not from the frozen research.
- Vendor stdio clients may never speak 2026: Goal A closes with the hold recorded.
- Leftover `Mcp-Session-Id` reads: Goal A PR 1 keeps the 2025 read (dual-read); Goal B deletes it
  when the launch digest fills the dispatch anchor, so no header can key the gate afterwards.
- HTTP cancellation gap and the stdio `data.supported` gap are upstream, not in-repo.
