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

**P1 Implement.** PRs 1–5 have landed. Next concrete action: PR 6 — the policy
`Fetch` and `ontology_publish_provenance`. **Re-read the PR 6 scope in
`PLAN.md` and the SPEC stop conditions before starting**: it ships an
agent-controllable outbound POST of workspace content to justify its own
control, the tool registers only when the destination allowlist is non-empty,
and it carries a blocking check — a request issued from *inside a real tool
handler* must demonstrably reach the policy fetch (the spike only proved a
directly-provided effect). The handler must require `HttpClient.HttpClient`
and never self-provide it; the policy fetch writes its own typed refusal to
the ledger and rejects with `EgressDenied` (already landed in
`@beep/api-transport`); the ontology handler matches the cause and returns a
typed refusal through its existing `failureMode: "return"` envelope. Grants
for `network-egress` destinations come from `EpistemicConfig.destinationAllowlist`
— extend the `GovernedTierGateOptions` grant blueprint at the composition root
rather than teaching `epistemic/server` any ontology names.

**Head start on the blocking check, from working inside `SanitizedSpan.ts`
during PR 5.** `registerSanitizedToolkit` captures `const services = yield*
Effect.context<never>()` at **layer build**, and each dispatch runs
`Effect.provideContext(requestServices)` where `requestServices = Context.add(
services, CurrentMcpCaller, …)`. Because `provideContext` *replaces* the fiber
context rather than merging into it, this predicts a sharp rule PR 6 must
verify rather than assume: the policy `Fetch` reaches handlers **iff** it is
provided into the layer graph that builds the toolkit (e.g. another
`Layer.provide` on the transport layer in `main.ts`), and does **not** reach
them if it is provided only around the HTTP server or per-request, since that
context is discarded at dispatch. PR 5 proved the analogous read works — the
`mcp-session-id` header had to be read *before* `provideContext`, and the
session-chaining test passes because of it. Test the `Fetch` case explicitly;
a passing egress test with the reference in the wrong place would be proving
the default `globalThis.fetch`, not the policy one.

## Latest Evidence

- **PR 5** (2026-07-27) — enforcement begins. `GovernedTierGateLive` in
  `epistemic/server` implements `TierGateShape`: `evaluate` freezes a
  per-session grant set on the session's first dispatch, evaluates with the
  PR 1 evaluator, and appends the sealed decision row *before* returning — a
  failed append refuses with `ledger-unavailable` and the run state does not
  advance. Swapped in at `OntologyMcpTransport.ts` in place of
  `fromApprovedToolsPolicy`; `main.ts` provides `ExecutionLedgerDrizzle` +
  `EpistemicConfigLive` + the memoized `PgliteDrizzleLive` into the MCP branch.
  For `mcp-write` sinks the boundary classifies audience by construction — the
  URL-parsing resolver would misclassify the workspace destination.

  **Three defects an adversarial review caught before this landed, each now a
  test:**
  - *`clientId` is not a session.* The HTTP protocol mints it per request
    (`RpcServer` `clientId++` inside the per-request effect), so keying the run
    on it — as decision 10 and the first implementation both said — opened a
    new run per dispatch and reduced every chain to a lone genesis row.
    `McpCallerIdentity` gained `sessionId` (the `mcp-session-id` header, read
    in `sanitizedToolkit` before the context is replaced; `None` on stdio,
    where the connection is the session) and the run keys on that. The app test
    now runs two mutations on one MCP session and asserts one `runKey` with
    `seq [0, 1]` — which fails under `clientId` keying.
  - *Denial reasons reached the agent.* Per-reason guidance flowed from the
    audit record through `OntologyTierGateRefusal.guidance` into the tool
    result, so an agent could enumerate the grant set by probing and could tell
    a policy denial from a ledger outage — exactly what decision 13 forbids.
    Every refusal now carries one constant string; a test dispatches three
    refusals with three different bounded reasons and asserts they are
    byte-identical.
  - *Settlements could bind to the wrong decision.* The FIFO keyed by operation
    digest misattributed outcomes when two dispatches of one tool overlapped
    and finished out of order. Correlation is now the dispatch fiber — the
    same fiber runs `evaluate` and, via `Effect.onExit`, `recordOutcome` — and
    a test forces the reversed-completion interleaving.

  Also corrected: runs are never evicted. Sweeping an expired run let the next
  dispatch of that same session freeze fresh grants, so the TTL bounded
  nothing; retaining it is what makes `grant-expired` permanent. Growth is one
  small entry per session, and a session exists only after an `initialize` that
  cleared the origin allowlist and the bearer token.
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
