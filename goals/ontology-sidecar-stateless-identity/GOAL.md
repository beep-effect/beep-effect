# GOAL: run the ontology sidecar stateless, keyed on the launch bearer

Repo root: the current `beep-effect` checkout; all paths below are repo-relative.

Outcome: the desktop ontology MCP sidecar serves `[McpProtocol.v2026_07_28]`
only; `GovernedTierGate` keys grant freeze, hash chains and TTL on a
server-side digest of the verified per-launch bearer; the integration harness
and the live proof client drive it through `@beep/mcp-kit/client`; the Origin
allow-list lives on `OntologyMcpServerConfig` behind one Origin check.

The packet files are the contract:

- `goals/ontology-sidecar-stateless-identity/{README,SPEC,PLAN}.md`
- `goals/ontology-sidecar-stateless-identity/ops/manifest.json`

Read those first, then `AGENTS.md`,
`explorations/effect-mcp-2026-07-28/{BRIEF,MAP,DECISIONS}.md`, and
`goals/agent-execution-authority/SPEC.md`. Repo standards outrank packet
prose.

Precondition: `goals/mcp-stateless-kit-and-drivers` PR 1 is merged; stop and
report otherwise.

Scope:

- In: `apps/professional-desktop/server/{OntologyMcpTransport,RpcSessionAuth}.ts`,
  `apps/professional-desktop/test/integration/**`,
  `packages/epistemic/server/src/GovernedTierGate/**` (gate spans) and tests,
  `packages/ontology/server` (`OntologyChangeActor`),
  `packages/ontology/config/src/McpConfig.ts`,
  `packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts` (the
  `mcp-session-id` read only), the archived ontology-agent-surface live MCP client,
  `goals/agent-execution-authority/SPEC.md` (decision 10 wording), this packet.
- Out: bearer/launch vocabulary in kit schemas, stdio hosts, a client-echoed
  run token, `requestState` HMAC, MRTR approval, browser-origin clients,
  Origin-less POST allowance, HTTP cancellation workarounds.

Workflow:

1. Desktop provides the kit's dispatch anchor as `launch:<digest>` of the
   bearer `requireRpcSessionToken` verifies; `runIdOf` reads it; delete the
   kit's `mcp-session-id` read (no cross-slice import).
2. Tests: delete "keys the run on the session, not on the per-request client
   id"; add launch-key, grant-expired permanence, never-evict, stray-header.
3. `OntologyChangeActor` keyed to the anchor; gate spans renamed
   `epistemic.governed_tier_gate.evaluate` / `record_outcome` with `run_id`.
4. Sidecar pin to `v2026_07_28`; harness and live client on the kit client;
   conformance run.
5. D-origin: allow-list on `OntologyMcpServerConfig` (deny-all default, desktop
   provider); Origin middleware before CORS; attacker `OPTIONS` 403; Origin-less
   POST 403; `S.TaggedError`; CORS `allowedHeaders` gain `mcp-protocol-version`,
   `mcp-method`, `mcp-name` and drop `mcp-session-id`.
6. Decision 10: "a run is a sidecar launch"; record the HTTP cancellation gap;
   package-verify per package.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Verification commands pass, or unrelated failures are recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run beep quality package-verify @beep/epistemic-server
bun run beep quality package-verify @beep/ontology-config
bun run beep quality package-verify @beep/ontology-server
bun run beep quality package-verify @beep/mcp-kit
bun run beep ci lane test-integration --affected --base origin/main
test "$(wc -m < goals/ontology-sidecar-stateless-identity/GOAL.md)" -le 4000
jq . goals/ontology-sidecar-stateless-identity/ops/manifest.json
git diff --check -- goals/ontology-sidecar-stateless-identity
```

The raw bearer never enters a ledger, span, log, or assertion.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug ontology-sidecar-stateless-identity` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/ontology-sidecar-stateless-identity/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
