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

**P1 Implement.** PRs 1–6 have landed. Next concrete action: PR 7 — the
composed fixture acceptance test. On one MCP session: tool 1 reads workspace
content carrying an injected instruction, tool 2 attempts an outbound POST to
the injected destination, and the authority frozen at session open denies it.
Plus the full acceptance suite from `SPEC.md`.

**What PR 7 inherits, and the one thing it must not assume.** The denial in
that scenario comes from the *egress* boundary, not the tier gate: the gate
grants `ontology_publish_provenance` as an operation, and the destination is
refused by `GovernedEgress` because it is not on the allowlist. So the fixture
must assert on **two** decision rows from **two** runs — the session's chain and
the egress boundary's own chain — not one. `history/pr6-fetch-reach-spike.md`
records why they cannot be one chain: `Fetch` is a plain promise-returning
function with no fiber, so the egress boundary cannot see `CurrentMcpCaller`
and cannot know which session provoked a request. Correlation is by time.
Closing that gap is a real follow-up, and inventing a session from ambient
state would reintroduce exactly the cross-dispatch misattribution PR 5's fiber
correlation exists to prevent.

## Latest Evidence

- **PR 6** (2026-07-27) — the egress boundary and the tool it exists to govern.
  `GovernedEgressLive` installs a `FetchHttpClient.Fetch` that resolves a
  requested URL to the allowlist entry covering it, writes a write-ahead
  decision row, and rejects a denied destination with the reason-free
  `EgressDenied`. `ontology_publish_provenance` registers only when the
  allowlist is non-empty, takes `HttpClient.HttpClient` as a layer requirement
  and never self-provides it, and translates a denial into the same refusal an
  operation denial produces.

  **The blocking check passed, and it falsified the prediction this packet
  carried.** Full evidence in
  [`history/pr6-fetch-reach-spike.md`](./history/pr6-fetch-reach-spike.md):
  - `Effect.provideContext` **merges**, it does not replace. The claim that it
    replaces was wrong, and the `SanitizedSpan.ts` comment asserting it is
    corrected in this PR. The PR 5 code it justified was already correct.
  - The override reaches handlers in *every* placement tested, including
    per-request. In the recommended placement the handler's own context does
    not contain `Fetch` at all — `HttpClient.layerMergedContext` merges the
    client layer's build context at execute time, so the override rides with
    the client rather than the handler.
  - The real hazard is the inverse: request-time context takes **precedence**,
    so a per-request `Fetch` silently displaces the composition-root one. That
    invariant is recorded on `GovernedEgress.layer.ts`.

  Two properties the tests pin. Registration is not authorization for this
  branch either — the publish gate draws its grant from the same approval list,
  so a test can register the tool and grant nothing. And a destination denial is
  byte-identical to an operation denial; the guidance string is restated in the
  ontology slice because slices cannot import each other, and the app test is
  what holds the two in sync.

  **Two majors an adversarial review caught before this landed, each now a
  test or a comment that explains itself:**
  - *The governed `Fetch` escaped its own branch.* `FetchHttpClient.layer` is a
    module-level object and layer builds are memoized by object identity across
    one graph, so the "governed" client was the same instance `AnthropicLive`
    and the OTLP exporter resolve. Whichever built first won for all of them —
    at this entrypoint the governed one, meaning every `api.anthropic.com`
    request would have been refused with `EgressDenied` and written a spurious
    denied row into this boundary's hash chain, with the allowlist non-empty
    being the only trigger. `Layer.fresh` is the fix; nothing type-checks it,
    because a `Reference` layer's output is `never`.
  - *Allowed rows named the allowlist entry, not the request.* Coverage
    deliberately ignores the query string, and the record reused the covering
    entry — so a publish to `.../publish?payload=<privileged text>` produced a
    row byte-identical to a benign one while the query went out over the wire
    intact. The record now digests the full requested form (query and fragment
    included); coverage still ignores it, so a query can neither buy nor lose
    authority.

  Also pinned: the chain stays dense under concurrent authorizations, which is
  not free — every `fetch` authorizes on its own detached fiber, so only the
  boundary's semaphore serializes the ledger append and the chain advance.

  **Known gap, recorded not hidden:** egress decision rows are not correlated to
  an MCP session, for the structural reason above. An auditor joins them to
  session rows by time.
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
- **Both spike findings are now proven through a running server.** The `Fetch`
  override was re-verified end-to-end in PR 6, and the mechanism turned out not
  to be the one predicted — see
  [`history/pr6-fetch-reach-spike.md`](./history/pr6-fetch-reach-spike.md).
- **The exfiltration primitive is live from PR 6 on.**
  `ontology_publish_provenance` is default-off (empty allowlist ⇒ unregistered)
  and its destination is allowlist-gated, which is what makes it defensible.
  Anyone widening `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` is authorizing an
  agent-chosen POST of workspace content to that origin and everything beneath
  it, in a product that holds privileged material. Treat allowlist edits as a
  security review, not configuration.
- **The `audience` axis is half-degenerate in v1.** Only `external-network` is
  genuinely exercised; every governed MCP write is a local workspace file. Do not
  claim the axis is validated.
- **Known drift, recorded and not fixed here:**
  `apps/professional-desktop/src/chat/UsageRecordSink.ts` puts an epistemic
  product repository in app code, against `03-driver-boundaries.md:151-153`. The
  ledger must not copy it.
