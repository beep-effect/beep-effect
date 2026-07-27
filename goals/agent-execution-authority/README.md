# Agent Execution Authority

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give the MCP agent surface a default-deny authority boundary and a hash-chained,
append-only record of every decision and outcome — so the repo can say what an
agent was permitted to do, and show what it did.

Graduated 2026-07-25 from
[`explorations/agent-execution-sandbox`](../../explorations/agent-execution-sandbox/README.md).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agent-execution-authority/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan, PRs 1-7.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger inherited
   from the exploration.
6. [`history/`](./history/) - evidence and closeouts.

## Current Phase

**P1 Implement.** PRs 1–4 have landed. Next concrete action: PR 5 —
`GovernedTierGateLive` in `epistemic/server` implementing `TierGateShape`
(evaluate against the session-frozen grant set with write-ahead ledger
decisions; `recordOutcome` persisting the bounded settlement), plus the run
store keyed by `clientId`, swapped in at
`apps/professional-desktop/server/OntologyMcpTransport.ts` in place of
`fromApprovedToolsPolicy`. Provide `PgliteDrizzleLive` and the epistemic config
into the MCP branch; write-ahead fail-closed lands here — no decision row, no
action. Map `TierGateSettlement` (mcp-kit) onto `ExecutionSettlement`
(epistemic/domain) in the evaluator; the literals are deliberately identical.

## Latest Evidence

- **PR 4** (2026-07-27) — the two foundation additions. `TierGateShape` gains
  `recordOutcome`; `dispatchWithTierGate` reports settlements via
  `Effect.onExit` as the bounded `TierGateSettlement` literal (v4 note: the
  interrupt-only check is `Cause.hasInterruptsOnly`, not `isInterruptedOnly`).
  The error channel stays exactly the wrapped effect's, proven by a test that
  flips a failed dispatch. Refused dispatches report no settlement, proven.
  `EgressDenied` lands in `@beep/api-transport` as a field-free
  `TaggedErrorClass` (the package gained its first `@beep/schema` dependency:
  package.json + tsconfig reference + regenerated docgen paths + fallow
  boundaries). Consumer records added to both READMEs.
- **PR 3** (#467, 2026-07-26) — the append-only ledger: raw-`pgTable` decision/outcome
  tables (fork resolved against `BaseEntity` — its mutability columns would be
  schema lies), the repo's first plpgsql triggers authored inside the splitter's
  boundary-keyword rule and proven through real `migrate()`, the
  `ExecutionLedger` port and Drizzle adapter with constraint-name error mapping,
  and the tamper proof: after `DROP TRIGGER` and a raw-SQL mutation of the
  mid-chain row, `verifyExecutionDecisionChain` reports `chain-broken` at index
  1 exactly. The derived unknown-outcome predicate is proven blind to ordinary
  denials.
- **PR 2** (#463, 2026-07-26) — `@beep/epistemic-config` owns the destination
  allowlist and pinned policy revision; audience is resolved from the
  destination rather than configured. `ONTOLOGY_MCP_MUTATIONS_ENABLED` moved to
  a new `OntologyMcpConfig` service and off the entrypoint's module-top-level
  `Effect.runSync`. The deterministic frozen grant-set fixture PR 7 depends on
  ships here with a digest-stability assertion. Proven non-vacuous: breaking
  the config key in `ontology-mcp-http.test.ts` fails two tests with
  `Tool 'ontology_propose_change_batch' not found`.
- **PR 1** (#458, 2026-07-26) — grant, verdict, grant-set, and record schemas in
  `epistemic/domain`, plus the `frozen-grant-set` law banning `FrozenGrantSet.make`
  outside its defining module.
- The spike that de-risked this packet was run and deleted on 2026-07-25; its
  findings are recorded in
  [`explorations/agent-execution-sandbox/README.md`](../../explorations/agent-execution-sandbox/README.md)
  under "Proven Mechanisms."

## Notes

High-signal constraints that do not belong in the normative spec:

- **This is not a sandbox.** It buys the policy plane and its records. Host
  isolation is a separate candidate packet, and a green suite here must never be
  described as "the sandbox exists."
- **Two spike findings are load-bearing and one is only half-proven.** The
  `Fetch` override was verified for a *directly-provided* effect, not through a
  server whose handler context is captured at layer build
  (`SanitizedSpan.ts:226`). PR 6 carries a blocking check for this.
- **PR 6 ships an exfiltration primitive to justify its own control.**
  `ontology_publish_provenance` is default-off and allowlist-gated, which is what
  makes it defensible — but re-read that scope deliberately rather than
  inheriting it.
- **The `audience` axis is half-degenerate in v1.** Only `external-network` is
  genuinely exercised; every governed MCP write is a local workspace file. Do not
  claim the axis is validated.
- **Known drift, recorded and not fixed here:**
  `apps/professional-desktop/src/chat/UsageRecordSink.ts` puts an epistemic
  product repository in app code, against `03-driver-boundaries.md:151-153`. The
  ledger must not copy it.
