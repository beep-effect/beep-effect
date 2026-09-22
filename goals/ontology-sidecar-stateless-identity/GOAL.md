# GOAL: run the ontology sidecar stateless, keyed on the launch bearer

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the desktop ontology MCP sidecar serves `[McpProtocol.v2026_07_28]`
only; `GovernedTierGate` keys grant freeze, hash chains and TTL on a
server-side digest of the verified per-launch bearer; the integration harness
and the live proof client drive it through `@beep/mcp-kit/client`; the Origin
allow-list lives on `OntologyMcpServerConfig` behind one Origin check.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ontology-sidecar-stateless-identity/README.md`
- `goals/ontology-sidecar-stateless-identity/SPEC.md`
- `goals/ontology-sidecar-stateless-identity/PLAN.md`
- `goals/ontology-sidecar-stateless-identity/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`,
`explorations/effect-mcp-2026-07-28/{BRIEF,MAP,DECISIONS}.md`, and
`goals/agent-execution-authority/SPEC.md` (decision 10). Repo standards outrank
packet prose.

Precondition: `goals/mcp-stateless-kit-and-drivers` PR 1 is merged; stop and
report otherwise.

Scope:

- In: `apps/professional-desktop/server/{OntologyMcpTransport,RpcSessionAuth}.ts`,
  `apps/professional-desktop/test/integration/**`,
  `packages/epistemic/server/src/GovernedTierGate/**` and its tests,
  `packages/ontology/server` (`OntologyChangeActor`, gate span),
  `packages/ontology/config/src/McpConfig.ts`,
  `goals/ontology-agent-surface/ops/live-mcp-client.ts`,
  `goals/agent-execution-authority/SPEC.md` (decision 10 wording), this packet.
- Out: identity semantics in `@beep/mcp-kit`, stdio hosts, a client-echoed
  run token, `requestState` HMAC, MRTR approval, browser-origin clients,
  Origin-less POST allowance, HTTP cancellation workarounds.

Workflow:

1. Desktop provides the kit's dispatch anchor as `launch:<digest>` of the
   bearer `requireRpcSessionToken` verifies; `runIdOf` reads it; delete the
   kit's `mcp-session-id` read (2026-07-25 inversion: no cross-slice import).
2. Tests: delete "keys the run on the session, not on the per-request client
   id"; add launch-key, grant-expired permanence, never-evict, stray-header.
3. `OntologyChangeActor` keyed to the anchor; gate spans renamed
   `epistemic.governed_tier_gate.evaluate` / `record_outcome` with `run_id`.
4. Sidecar pin to `v2026_07_28`; harness and live client on the kit client;
   conformance run.
5. D-origin: allow-list on `OntologyMcpServerConfig` (deny-all default, desktop
   provider); Origin middleware before CORS; attacker `OPTIONS` 403; Origin-less
   POST 403; `S.TaggedError`; CORS headers gain `mcp-method`/`mcp-name`.
6. Decision 10 wording: "a run is a sidecar launch"; record HTTP cancellation
   as an accepted gap. `bun run beep quality package-verify` per package; at
   P4 Close, `/reflect` and `bun run beep lint reflection-artifacts`.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/epistemic-server
bun run beep quality package-verify @beep/ontology-config
bun run beep ci lane test-integration --affected --base origin/main
test "$(wc -m < goals/ontology-sidecar-stateless-identity/GOAL.md)" -le 4000
jq . goals/ontology-sidecar-stateless-identity/ops/manifest.json
git diff --check -- goals/ontology-sidecar-stateless-identity
```

Stop and report before changing public API beyond the named surfaces,
dependencies, lockfiles, or generated files unless `SPEC.md` requires it. The
raw bearer never enters a ledger, span, log, or assertion.

Done only when acceptance passes and verification is complete, or a blocker
is reported with file/command evidence.
