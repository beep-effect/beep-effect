# MCP Stateless Kit and Drivers Spec

## Objective

`@beep/mcp-kit` runs on the MCP `2026-07-28` adapter installed by `effect@4.0.0-rc.117`, exports
an in-repo 2026 client and a conformance port, and the five stdio hosts serve
`[McpProtocol.v2026_07_28]` only, each proven by conformance through that client. Graduated
from `explorations/effect-mcp-2026-07-28` (`BRIEF.md`; rulings in `DECISIONS.md` are cited as
`(D-name)`, not copied; the Gate D amendments dated 2026-09-22 apply).

## Non-Goals

- Mixed protocol lists on any host, even as a stepping stone (D-posture).
- A new package for the client (D-client-home).
- Identity semantics (bearers, run keys, session-as-run wording) in kit schemas; the kit carries
  transport facts plus one product-neutral dispatch anchor (D-run-key, Gate D amendment 1).
- Deleting the 2025 `mcp-session-id` read: that happens in `goals/ontology-sidecar-stateless-identity` together with the
  launch-keyed run key (Gate D amendment 2).
- The ontology sidecar, `GovernedTierGate`, `OntologyChangeActor`, `OntologyMcpServerConfig`,
  Origin/CORS: `goals/ontology-sidecar-stateless-identity`.
- A canned invalid-arguments result once strict tools land (D-projection).
- Gating any flip on external agent clients other than the nlp-mcp capture (G6, D-cli-contract).
- In-repo waivers of the stdio `-32022` `data.supported` shape; that is the optional G8 upstream
  lane (D-conformance).
- Adopting `subscriptions/listen` or multi-round-trip tool results in a host (G5: record, do not
  wire).

## Source Hierarchy

1. `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md` (architecture 07, 09, 12) and the
   2026-07-25 foundation-mediated inversion entry in `standards/architecture/DECISIONS.md`.
2. `explorations/effect-mcp-2026-07-28/DECISIONS.md` (G1–G9, the 2026-09-21 and 2026-09-22 entries including the Gate D
   amendments) and `BRIEF.md`.
3. `explorations/effect-mcp-2026-07-28/RESEARCH.md` §2 (adapter semantics) and §3.1–3.2 (kit, hosts); the lane reports
   `research/10-u1-api-delta.md`, `11-u2-stateless-runtime.md`, `12-u3-effect-guidance.md`,
   `14-s2-ecosystem.md`, `20-r1-mcp-kit.md`, `21-r2-hosts.md` for `file:line` evidence.
4. The installed Effect source (`node_modules/effect/dist/unstable/ai/**`) for every API claim;
   the Effect reference clone (`.repos/effect`, provisioned by `scripts/setup-effect-ref.sh`) for
   the conformance test sources, which the npm package does not ship.
5. This `SPEC.md`, then `PLAN.md`, then `GOAL.md`.

## Target Surfaces

- `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` — `sanitizedToolkit` rebased on
  rc.117 `registerToolkit`; dual-read of `McpServerClient` / `McpRequestContext`; the 2025
  `mcp-session-id` read kept (deleted in Goal B).
- `packages/foundation/capability/mcp-kit/src/McpCaller.ts` — JSDoc and `sessionId` annotation
  rewritten to transport facts only (an optional protocol header, never "the grant-run key"); a
  branded dispatch-anchor `Context.Reference` (product-neutral name, absent by default) that app
  composition may provide and that `epistemic/server` and `ontology/server` read.
- `packages/foundation/capability/mcp-kit/src/{ApiKeyRequired,TierGate,ToolkitComposition,Version}.ts`
  — the named error translator (`api_key_required` envelope kept; invalid arguments surface as
  upstream `InvalidParams`), the protocol-list helper, pin constants.
- `packages/foundation/capability/mcp-kit/src/client{.ts,.node.ts}` (NET-NEW) with explicit
  `./client` and `./client.node` entries in the package `exports`: a kit-owned 2026 RpcGroup
  (`server/discover`, `tools/list`, `tools/call`, `prompts/get`, `resources/read`, re-declared,
  not imported from the internal module); the HTTP injector for `MCP-Protocol-Version`,
  `Mcp-Method`, `Mcp-Name` (`params.name` for `method: tools/call` and `method: prompts/get`,
  `params.uri` for `method: resources/read`) and the `_meta` keys
  `io.modelcontextprotocol/protocolVersion` (equal to the header) and
  `io.modelcontextprotocol/clientCapabilities`; the SSE unwrap ported from
  `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts`; the stdio NDJSON
  helper (Node entry) sending `discover` first.
- `packages/foundation/capability/mcp-kit/test/**` — conformance runner (test-only surface)
  ported from the reference clone's `effect:packages/effect/test/unstable/ai/McpServer/**`
  (inventory: lane 11-u2 §10); coverage ratchet for `SanitizedSpan`; the tests named in the
  verification matrix.
- `packages/foundation/capability/mcp-kit/README.md` — consumer table naming every importer
  (today: the four `*-mcp` drivers, `law-practice-server`, `law-practice-use-cases`,
  `ontology-server`, `ontology-use-cases`, `epistemic-server`, `professional-desktop`) with what
  each uses and its protocol state (architecture 07).
- `packages/drivers/m365-mcp`, `packages/drivers/uspto-mcp`, `packages/drivers/gov-legal-mcp`,
  `packages/law-practice/server` + `apps/practice-kg-mcp`, then `packages/drivers/nlp-mcp`:
  protocol pin via the helper, `instructions`, prompt titles, JSDoc, conformance test.
- `.mcp.json` `nlp` entry (only if the capture changes the launch shape).
- `goals/mcp-stateless-kit-and-drivers/history/nlp-mcp-capture.md` — the capture record (stable name).

## Constraints

- Design order schema → service → implementation; Effect v4 idioms; `effect/HashMap` family; no
  `node:http`; `Effect.fn`/`Effect.fnUntraced` for generator functions.
- On a 2026 dispatch the kit identity is `clientId` plus `sessionId: None`; the dispatch anchor is
  the only cross-package carrier and the kit never derives, names, or documents what fills it.
- `withTopLevelObjectInputSchema`: decide keep/delete from the installed rc.117 (Effect#8326), not
  the frozen research.
- Host order is fixed: m365, uspto, gov-legal, practice-kg, nlp-mcp (D-posture).
- nlp-mcp flips only after `history/nlp-mcp-capture.md` shows a CLI the operator runs daily
  sending `server/discover` first on stdio against a 2026-only build; otherwise the hold is an
  exception-ledger row and a `MAP.md` re-entry gate (D-cli-contract).
- Every flipped host passes the conformance port for 2026-07-28 (D-conformance).
- PR 1 precondition: `bash scripts/setup-effect-ref.sh` so `.repos/effect` is linked.
- Per-package handoff: `bun run beep quality package-verify <package>` for every touched package.
- Sibling goal `goals/ontology-sidecar-stateless-identity` consumes PR 1's anchor, dual-read and client; keep their signatures
  stable after PR 1 merges.

## Acceptance Criteria

- [ ] `sanitizedToolkit` matches rc.117 `registerToolkit` semantics with the kit's exclusions in
      one comment block; the tests named in the matrix pass on a 2026-only host and on a 2025 host.
- [ ] `McpCaller.ts` carries no session-as-run wording; the dispatch anchor exists and is absent
      unless provided.
- [ ] `@beep/mcp-kit/client` resolves through an explicit `./client` export; its tests drive
      `server/discover` and a tool call over stdio and over HTTP (SSE unwrap), reject a POST missing
      either `_meta` key with 400, and the conformance runner passes against the test host.
- [ ] `api_key_required` remains a non-error `CallToolResult`; invalid arguments surface as
      `InvalidParams`.
- [ ] m365, uspto, gov-legal and practice-kg pin `[McpProtocol.v2026_07_28]` through the helper,
      carry `instructions` and prompt titles, pass conformance, and answer `initialize` with `-32022`.
- [ ] `history/nlp-mcp-capture.md` exists with the first stdio frame verbatim; nlp-mcp either flips
      with the same proof or the hold is an exception-ledger row.
- [ ] The mcp-kit README consumer table names every importer.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Claim | Command or evidence | Required result |
| --- | --- | --- |
| 2026 dispatch | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "dispatches tools/call on a 2026-only host with McpRequestContext and no McpServerClient"` | Passes |
| 2025 dual-read | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "dispatches tools/call on a 2025 host through McpServerClient"` | Passes |
| Anchor default | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "dispatch anchor is absent unless provided"` | Passes |
| Client stdio | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "sends server/discover then tools/call over stdio"` | Passes |
| Client HTTP + SSE | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "unwraps a text/event-stream tools/call response"` | Passes |
| HTTP `_meta` guard | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "rejects a POST missing request metadata with 400"` | Passes |
| Projection | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "api_key_required stays a non-error result"` and `-t "invalid arguments surface as InvalidParams"` | Passes |
| Conformance | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "conformance 2026-07-28"` | Passes |
| Export map | `rg -n '"./client"' packages/foundation/capability/mcp-kit/package.json`; `rg -n '@beep/mcp-kit/client' apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts goals/ontology-agent-surface/ops/live-mcp-client.ts packages/drivers/m365-mcp/test/Server.test.ts` | Matches |
| Kit + hosts | `bun run beep quality package-verify @beep/mcp-kit`; `... @beep/m365-mcp`; `... @beep/uspto-mcp`; `... @beep/gov-legal-mcp`; `... @beep/law-practice-server`; `... @beep/practice-kg-mcp`; `... @beep/nlp-mcp` (last one only if flipped) | Passes |
| Hosts pinned | `rg -n 'v2025_06_18' packages/drivers/m365-mcp packages/drivers/uspto-mcp packages/drivers/gov-legal-mcp packages/law-practice/server apps/practice-kg-mcp` | No matches |
| Caller wording | `rg -n 'grant-run key\|per-session key' packages/foundation/capability/mcp-kit/src/McpCaller.ts` | No matches |
| Vendor capture | `test -f goals/mcp-stateless-kit-and-drivers/history/nlp-mcp-capture.md && rg -n 'initialize\|server/discover' goals/mcp-stateless-kit-and-drivers/history/nlp-mcp-capture.md` | Matches |
| nlp-mcp outcome | `rg -n 'v2026_07_28' packages/drivers/nlp-mcp/src/Server.ts` or an exception-ledger row citing D-cli-contract | One of the two |
| README consumers | `rg -n 'law-practice-use-cases\|ontology-use-cases\|ontology-server\|epistemic-server\|professional-desktop' packages/foundation/capability/mcp-kit/README.md` | Matches |
| Packet hygiene | `test "$(wc -m < goals/mcp-stateless-kit-and-drivers/GOAL.md)" -le 4000`; `jq . goals/mcp-stateless-kit-and-drivers/ops/manifest.json`; `git diff --check -- goals/mcp-stateless-kit-and-drivers` | Passes |
| Closeout | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- The installed adapter's `registerToolkit` no longer exposes the seam the kit wraps (report the
  rc and the diff; do not fork deeper).
- A host cannot pass conformance without a change to upstream Effect (file the G8 lane; hold the
  host).
- Verification needs credentials the hosts do not already model through `SourceAuth`.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| nlp-mcp stays on `v2025_06_18` | `packages/drivers/nlp-mcp` (the `.mcp.json` `nlp` server) | Goal A steward | D-cli-contract: the 2026-09-22 capture (`history/nlp-mcp-capture.md`) shows Claude Code 2.1.275 sends a legacy `initialize` (2025-11-25) by default and `server/discover` only under `MCP_PROTOCOL_NEGOTIATION=auto`; a 2026-only build fails every default launch. Codex not captured (pool exhausted, run aborted before spawning stdio servers). | Either Claude Code defaults stdio negotiation to `auto` (or the operator pins `MCP_PROTOCOL_NEGOTIATION=auto` in the environment every daily launch uses), or a re-run of the capture shows a daily CLI opening with `server/discover` by default; then apply the two-line flip plus `instructions` and `conformance2026` recorded in the capture. |
