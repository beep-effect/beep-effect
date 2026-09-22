# Ontology Sidecar Stateless Identity Spec

## Objective

The desktop ontology MCP sidecar serves `[McpProtocol.v2026_07_28]` only, `GovernedTierGate` keys
its run on a server-side digest of the per-launch bearer the sidecar already verifies (carried
through the kit's product-neutral dispatch anchor), the integration harness and live proof client
drive it through `@beep/mcp-kit/client`, and the Origin policy is owned by
`OntologyMcpServerConfig` with one Origin check. Graduated from `explorations/effect-mcp-2026-07-28` (`BRIEF.md`;
rulings in `DECISIONS.md` cited as `(D-name)`; the Gate D amendments dated 2026-09-22 apply).

## Non-Goals

- Identity semantics (bearers, run keys, launch or sidecar vocabulary) inside `@beep/mcp-kit`; the
  kit's dispatch anchor is a branded string the desktop fills (D-run-key, Gate D amendment 1).
- A client-echoed run token, signed `requestState`, or MRTR per-call approval as the run key
  (D-run-key; `requestState` is a recorded re-entry gate in the exploration `MAP.md`).
- Conversation-granular runs: a run is a sidecar launch.
- Browser-origin `/mcp` clients; allowing Origin-less POST; an app-local allow-list literal or
  desktop host URLs as schema defaults (D-origin, Gate D amendment 5).
- Working around the HTTP cancellation gap on 2026 (accepted Effect gap).
- Changes to the stdio hosts (`goals/mcp-stateless-kit-and-drivers`).
- An architecture-wide `standards/architecture/DECISIONS.md` entry or numbered-doc edits: the
  identity wording lives in `goals/agent-execution-authority/SPEC.md` and the epistemic docs.

## Source Hierarchy

1. `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md` (architecture 06, 09, 12) and the
   2026-07-25 foundation-mediated inversion entry in `standards/architecture/DECISIONS.md`.
2. `explorations/effect-mcp-2026-07-28/DECISIONS.md` (D-run-key, D-origin, D-posture, D-conformance, Gate D amendments) and
   `BRIEF.md`.
3. `goals/agent-execution-authority/SPEC.md` (decision 10 and PR 5 findings);
   `explorations/effect-mcp-2026-07-28/RESEARCH.md` §3.3–3.4 with the lane reports `research/22-r3-governance-identity.md`
   and `24-r5-http-security-observability.md` for `file:line` evidence.
4. `goals/mcp-stateless-kit-and-drivers/SPEC.md` for the anchor, client and dual-read contract this goal consumes.
5. The installed Effect source (`node_modules/effect/dist/unstable/ai/**`, `unstable/http/**`).
6. This `SPEC.md`, then `PLAN.md`, then `GOAL.md`.

## Target Surfaces

- `apps/professional-desktop/server/OntologyMcpTransport.ts` — protocol pin; provides the kit's
  dispatch anchor as `launch:<digest>` from the verified bearer; Origin middleware as the single
  check, ordered before CORS, feeding Effect `allowedOrigins`; CORS `allowedHeaders`;
  `OntologyMcpOriginForbidden` as `S.TaggedError` (cleanup-on-touch, architecture 09).
- `apps/professional-desktop/server/RpcSessionAuth.ts` — exposes the verified-bearer digest
  without exposing the token.
- `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` — delete the 2025
  `mcp-session-id` read (`mcpSessionIdHeader`) in this goal's PR, so no header can key the gate.
- `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` — `runIdOf` reads the
  anchor; the gate's own spans become `epistemic.governed_tier_gate.evaluate` and
  `epistemic.governed_tier_gate.record_outcome` carrying `epistemic.governed_tier_gate.run_id`
  (the digest, never the bearer); tests in `packages/epistemic/server/test/GovernedTierGate.test.ts`.
- `packages/ontology/server` — `OntologyChangeActor` keyed to the anchor value.
- `packages/ontology/config/src/McpConfig.ts` — `OntologyMcpServerConfig` gains the Origin
  allow-list field (`ReadonlyArray` of origins, deny-all default); the desktop ConfigProvider
  supplies its host origins.
- `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts` and
  `support/ontology-mcp-harness.ts` — harness on the 2026 wire via `@beep/mcp-kit/client`; the
  cases named in the matrix.
- `goals/ontology-agent-surface/ops/live-mcp-client.ts` — on the kit client; no `initialize`.
- `goals/agent-execution-authority/SPEC.md` — decision 10 wording; `packages/epistemic/server`
  docs.

## Constraints

- Design order schema → service → implementation; `effect/HashMap` family; `Effect.fn`.
- The run key is `launch:<digest>` of the bearer verified by `requireRpcSessionToken`; the raw
  token appears only in the header helper, the digest function and the verifier, never in
  ledgers, spans, logs, or assertions (D-run-key).
- `epistemic/server` and `ontology/server` read the kit anchor and never import each other
  (2026-07-25 inversion); both READMEs record the coupling.
- Delete the test titled "keys the run on the session, not on the per-request client id" and add
  "keys the run on the launch", grant-expired permanence, and never-evict tests (lane 22-r3).
- Correlation attribute goes on the gate's architectural spans, never on the kit's technical
  `mcp.tool.call.*` spans (architecture 12).
- Origin: single check in the sidecar middleware (typed 403 + `ontology.mcp.origin` metric) placed
  before `HttpMiddleware.cors` so attacker `OPTIONS` is 403; Origin-less POST denied; allow-list
  from config with a deny-all default (architecture 06).
- Conformance for 2026-07-28 through the kit client passes on the sidecar (D-conformance).
- Precondition: `goals/mcp-stateless-kit-and-drivers` PR 1 merged.

## Acceptance Criteria

- [ ] With `[McpProtocol.v2026_07_28]` only, a harness `method: tools/call` on a governed mutation
      succeeds; two harness bearers yield two run ids and the same bearer yields the same id
      across requests; `initialize` with 2026 headers answers HTTP 404 / `-32601` and a bare
      legacy `initialize` answers HTTP 400 / `-32020`.
- [ ] `runIdOf` returns `launch:<digest>` for every HTTP dispatch; no `mcp-session-id` read
      remains in the kit; a 2026 dispatch carrying a stray `mcp-session-id` header still yields
      `sessionId: None`.
- [ ] Grant freeze, hash-chain continuity, grant-expired permanence and never-evict are each
      proven by a named test keyed on the launch.
- [ ] `OntologyChangeActor` attributes mutations by the anchor value, matching the ledger run.
- [ ] Attacker-Origin `OPTIONS` answers 403; allowed-Origin `OPTIONS` answers 204 with CORS
      headers; Origin-less POST answers 403; the allow-list is read from `OntologyMcpServerConfig`
      (deny-all default); CORS `allowedHeaders` list `mcp-protocol-version`, `mcp-method`,
      `mcp-name` and not `mcp-session-id`; `OntologyMcpOriginForbidden` extends `S.TaggedError`.
- [ ] The conformance runner passes against the sidecar; `live-mcp-client.ts` imports
      `@beep/mcp-kit/client` and no longer calls `initialize`.
- [ ] `goals/agent-execution-authority/SPEC.md` states "a run is a sidecar launch" with a back-link
      to `explorations/effect-mcp-2026-07-28/DECISIONS.md`.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Claim | Command or evidence | Required result |
| --- | --- | --- |
| Launch keying | `bunx vitest run packages/epistemic/server/test/GovernedTierGate.test.ts -t "keys the run on the launch"`; `-t "grant expiry is permanent"`; `-t "never evicts a frozen grant"` | Passes |
| Old test gone | `rg -n 'keys the run on the session, not on the per-request client id' packages/epistemic/server/test` | No matches |
| Bearer digest | `bunx vitest run apps/professional-desktop/test/integration/ontology-mcp-http.test.ts -t "two bearers open two runs"`; `-t "one bearer keeps one run across requests"` | Passes |
| Initialize rejected | `bunx vitest run apps/professional-desktop/test/integration/ontology-mcp-http.test.ts -t "rejects initialize with 2026 headers as 404 -32601"`; `-t "rejects bare initialize as 400 -32020"` | Passes |
| Stray header | `bunx vitest run packages/foundation/capability/mcp-kit/test -t "ignores mcp-session-id on a 2026 dispatch"`; `rg -n 'mcpSessionIdHeader' packages/foundation/capability/mcp-kit/src` | Passes; no matches |
| Origin + CORS | `bunx vitest run apps/professional-desktop/test/integration/ontology-mcp-http.test.ts -t "attacker OPTIONS is 403"`; `-t "allowed OPTIONS is 204"`; `-t "Origin-less POST is 403"`; `-t "CORS allow-headers name the 2026 headers"` | Passes |
| Config-owned list | `rg -n 'allowedOrigins' packages/ontology/config/src/McpConfig.ts`; `rg -n 'beep.localhost\|tauri://' packages/ontology/config/src` | Matches; no matches |
| Tagged error | `rg -n 'S.TaggedError' apps/professional-desktop/server/OntologyMcpTransport.ts`; `rg -n 'Data.TaggedError' apps/professional-desktop/server/OntologyMcpTransport.ts` | Matches; no matches |
| No raw bearer leak | `rg -n 'Redacted.value' apps/professional-desktop/server packages/epistemic/server/src` lists only `rpcSessionAuthorizationHeader`, the digest function and the verifier; `rg -n 'launch:' packages/epistemic/server apps/professional-desktop/server` shows digest interpolation only | As stated |
| Actor + spans | `bunx vitest run packages/ontology/server -t "attributes changes by the dispatch anchor"`; `rg -n 'epistemic.governed_tier_gate.run_id' packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` | Passes; matches |
| Live client | `rg -n '@beep/mcp-kit/client' goals/ontology-agent-surface/ops/live-mcp-client.ts`; `rg -n 'initialize' goals/ontology-agent-surface/ops/live-mcp-client.ts` | Matches; no matches |
| Decision 10 | `rg -n 'a run is a sidecar launch' goals/agent-execution-authority/SPEC.md` | Matches |
| Packages | `bun run beep quality package-verify @beep/epistemic-server`; `... @beep/ontology-config`; `... @beep/ontology-server`; `... @beep/mcp-kit` | Passes |
| Sidecar wire | `bun run beep ci lane test-integration --affected --base origin/main`; hosted Heavy / Test Integration on the PR | Green |
| Packet hygiene | `test "$(wc -m < goals/ontology-sidecar-stateless-identity/GOAL.md)" -le 4000`; `jq . goals/ontology-sidecar-stateless-identity/ops/manifest.json`; `git diff --check -- goals/ontology-sidecar-stateless-identity` | Passes |
| Closeout | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- `goals/mcp-stateless-kit-and-drivers` PR 1 is not merged.
- The desktop launcher cannot expose a verified-bearer digest without exposing the token.
- A 2026 conformance failure traces to Effect (file the G8 lane; hold).
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| HTTP cancellation not delivered on 2026 | sidecar | this goal | Effect adapter gap (lane 11-u2) | upstream delivers cancellation on the stateless HTTP path |
