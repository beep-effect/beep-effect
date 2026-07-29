# Agent Execution Authority

## Status

Lifecycle: `completed-retained`

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

**Complete.** All seven PRs have landed and the packet is closed. The closeout
reflection is at
[`history/reflections/2026-07-28-claude.md`](./history/reflections/2026-07-28-claude.md).

What shipped: an MCP agent operates under a grant set frozen on its **first
governed dispatch** — not at session open, so read-only and idle time do not
consume the grant TTL; every governed dispatch is decided and durably recorded
before the effect runs; an outbound POST to a destination outside the allowlist
is refused reason-free; and reading the two ledger tables reconstructs what was
decided and in what order.

**Two limits on the audit guarantee, stated because they are easy to overclaim.**
The verifier proves the *internal consistency* of the decision chain it is
handed: a modified row is detected at its index, but a **resealed tail or a
deleted suffix still verifies intact**, because nothing anchors the chain tip.
That is the `agent-execution-record-anchoring` candidate, listed as a non-goal in
`SPEC.md`, not an oversight. And outcome rows are bound to their decisions
individually but are **not part of the decision chain**, so chain verification
says nothing about outcome completeness.

**Read this before touching the boundary.** The two enforcement points are
independent and answer different questions. The tier gate decides whether *this
session may invoke this operation*; the egress boundary decides whether *this
request may reach this destination*. A publish to a destination outside the
allowlist is therefore **allowed by the gate and denied by egress**, and it
writes rows into two different chains. `history/pr6-fetch-reach-spike.md`
records why they cannot be one chain: `Fetch` is a plain promise-returning
function with no fiber, so the egress boundary cannot see `CurrentMcpCaller`
and cannot know which session provoked a request. An auditor joins the two by
time. Closing that gap needs new `mcp-kit` surface; inventing a session from
ambient state would reintroduce exactly the cross-dispatch misattribution PR 5's
fiber correlation exists to prevent.

## Acceptance Criteria — where each one is proven

`SPEC.md` owns the criteria; this table says which test discharges each, so a
future reader does not have to trust that they were checked. Every row was
verified against the test body, not inferred from a filename.

| # | Criterion | Proven by |
| --- | --- | --- |
| 1 | Dispatch refused when the frozen grants do not authorize it; refusal is a typed value | `ontology-mcp-http.test.ts` — "fails mutation closed through TierGate when no tool approval resolves" |
| 2 | Outbound POST outside the grants refused, stub fetch at 0 | `GovernedEgress.test.ts` (`expectDenied` asserts the URL never reached the base fetch) + `ontology-mcp-http.test.ts` — "carries a publication from a real tool handler through the governed egress fetch" |
| 3 | An allowed dispatch produces exactly two ledger rows | `GovernedTierGate.pglite.test.ts` — "an allowed dispatch writes its decision ahead of the effect and exactly two rows in total" |
| 4 | A denied dispatch produces exactly one row | `GovernedTierGate.pglite.test.ts` — "a refused dispatch writes exactly one row and is not reported as outcome-unknown" |
| 5 | The derived unknown-outcome query is scoped to allowed decisions | same test as #4 — the two properties are asserted together, which is what keeps an ordinary denial from being reported as unknown |
| 6 | The chain verifier fails at the tampered index | `ExecutionLedger.pglite.test.ts` — "detects a tampered row at its index once the owner drops the trigger" (reports index 1 exactly). `EpistemicExecutionLedgerMigration.pglite.test.ts` does **not** discharge this row — it proves only that the append-only trigger rejects the mutation, never that the verifier localizes it |
| 7 | The publish-body canary is absent from the serialized rows, and the exact physical column set of both tables is pinned from `information_schema.columns` | `execution-authority.pglite.test.ts` (PR 7). **Narrowed twice:** the workspace and response-body canaries reach the boundary but are *not* claimed against the ledger, because production never carries them into the write path; and the column pin is an added-column drift tripwire, not proof the tables cannot hold payload — existing `TEXT` fields are unconstrained. See the narrowing note in `SPEC.md` |
| 8 | A descriptor walk rejects any payload-capable column | `ExecutionRecordTables.test.ts` — "exposes exactly the decision columns and no payload-capable column" (and the outcome sibling) |
| 9 | The `ungoverned-infrastructure` domain is exactly empty | `ExecutionAuthority.test.ts` — "keeps the ungoverned-infrastructure destination set empty" |
| 10 | A poisoned read followed by a publish to the injected destination is denied | `execution-authority.pglite.test.ts` (PR 7) |
| 11 | `ontology_publish_provenance` is unregistered when the allowlist is empty | `ontology-mcp-http.test.ts` — "leaves ontology_publish_provenance unregistered when no destination is allowlisted" |
| 12 | `bun run beep yeet verify` is green | PR 7 lane evidence |
| — | The ledger's critical-path cost is bounded **per path** — tier-only dispatch = 2 rows, allowed publish = 4 (governed egress writes *and settles* its own decision) — as before/after deltas around the dispatch, never absolute totals | `execution-authority.pglite.test.ts` (PR 7) |

Beyond the criteria, `ExecutionLedger.pglite.test.ts` also pins the database's
own refusals — free-text denial reasons, genesis rows claiming a predecessor,
allowed rows carrying a reason, unbounded settlement literals, direct
`UPDATE`/`DELETE`/`TRUNCATE` — each by the named constraint rather than by
message prose.

## Latest Evidence

- **PR 7** (2026-07-28) — the acceptance suite, and the packet's close.
  `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`
  drives a real MCP session over HTTP against the real `ExecutionLedgerDrizzle`
  over PGlite. The MCP bootstrap moved to
  `test/integration/support/ontology-mcp-harness.ts`; the extraction is a pure
  move, proven by the nine existing HTTP tests keeping a byte-identical test list
  and passing (−196/+11 in the original file).

  **The composed fixture is built so that ignoring tool 1's output is
  detectable.** The poisoned workspace carries **two** attacker destinations under
  different predicates, generated from a per-run nonce so neither exists as a
  literal in the test source. Each is read back through MCP and decoded; the test
  asserts the decoded values round-tripped, and then deliberately makes the
  generator variables **stale** by suffixing them. Both publishes therefore have
  to use the decoded values — substituting a generator constant now sends a
  different URL and fails on the digest. The denied rows must additionally carry
  `reason === "destination-not-granted"`, so a denial arising from some other
  state cannot be mistaken for a destination denial.

  That structure took two review rounds to reach. The first draft used a single
  fixed destination; the second used two fixed destinations, which only detected
  *swapping* them, not replacing each with its own constant. Neither established
  what the packet claimed.

  Two chains, because the denial is not where the packet's own plan said it was.
  The gate *allows* the publishes — the session may invoke the operation — and the
  egress boundary refuses the destinations. Session and egress chains are
  independently chain-verified and correlated by decision time.

  The egress chain's allowed row is asserted to digest the **full requested URL**,
  not the bare allowlist entry that covered it. That single assertion is the
  permanent guard on PR 6's exfiltration defect.

  **The no-payload evidence is a drift tripwire, not a proof of incapacity.**
  Three distinct canaries — workspace, publish body, response body — each carry a
  positive control proving that specific token reached the boundary. Only the
  publish body is claimed against the ledger, because production never carries the
  workspace contents or the response body into the write path; the other two are
  excluded in a comment rather than implied to be tested. On top of that, a
  literal `information_schema.columns` comparison pins the exact column name and
  type set of both physical tables — without it, a nullable `payload TEXT` column
  added to the migration would serialize as `payload: null` through `SELECT *` and
  pass unnoticed, since the descriptor test in `epistemic/tables` inspects only the
  Drizzle projection.

  What that does **not** establish: every digest, run-key, and revision field is
  unconstrained `TEXT` at the database boundary, so a raw writer or a converter
  regression could put payload into an existing column without changing
  `information_schema`. The typed writer prevents that today; the schema does not.
  Constraining those fields is recorded as a follow-up, not claimed here.

  **The cost bound covers both paths, and inspects the records rather than
  counting them.** Snapshots are taken immediately around each `tools/call`, not
  around the whole server lifecycle, so fixture setup and teardown cannot pad the
  window. A tier-only dispatch (export) must produce exactly one tier decision and
  its bound outcome. An allowed *publish* must produce exactly two decisions — the
  tier-gate record and the governed-egress record, each matched by operation and
  destination digest — and two outcomes, with both bindings verified. Deltas
  rather than absolute totals, so an in-process retry cannot make it lie. No
  wall-time assertion; the measured PGlite write-ahead was 1.873 ms and is
  recorded, not asserted.

  **Writing that assertion exposed a real defect in the PR 6 boundary, and it is
  fixed here.** `GovernedEgress` wrote its write-ahead decision and never settled
  it. Because `readUnsettledAllowed` derives "decided, outcome unknown" as *an
  allowed decision with no outcome*, every ordinary **successful** publish sat
  permanently in the state that is supposed to mean a crash or a failed outcome
  write — inverting the predicate for every egress run. The first draft of this
  suite asserted zero egress outcomes and so blessed the defect. Authorization now
  returns the allowed decision's identity and appends a sealed `completed` or
  `failed` outcome when the POST settles; denied decisions still receive none, and
  an outcome-write failure never converts a successful POST into a failed one —
  the effect has already run. The suite asserts the egress run has no unsettled
  allowed decision.

  **Non-vacuity was demonstrated by breaking things, not argued.** Each mutation
  reverted: allowlisting the injected destination (the attacker publish succeeded
  and `expect(deniedCall.isError).toBe(true)` fired); removing the production
  `Layer.fresh` to reproduce the memoization collision; recording the covering
  allowlist entry instead of the requested URL (digest mismatch); adding a
  `payload TEXT` column to the migration (the schema assertion failed naming
  `"column_name": "payload"`); and replacing a decoded destination with its own
  generator constant (digest mismatch).

  **Three adversarial review rounds rejected this suite; ten findings, all
  upheld.** Round one: the canary passed for the wrong reason and would have
  survived a smuggled payload column; the destination claim did not discriminate;
  the cost test measured the tier-only path; and the harness extraction had
  silently swapped `NodeHttpServer.layer(…, { host: "127.0.0.1", port: 0 })` for
  `layerTest`, which binds all interfaces — exposing a socket-mode MCP server
  guarded only by a source-visible fixed token, shipped under the words "pure
  move." Round two: the two-destination fixture still only detected swapping, the
  denial reason was never asserted, the publish delta window spanned the whole
  server lifecycle, and `SPEC.md` still ticked criteria the tests had narrowed.
  Round three found the egress settlement defect above — a fault in shipped
  product code, not in the test — plus two closeout claims that overstated the
  freeze point and the tamper guarantee.

  Every one of those passed a green local suite first. It is the single most
  reliable fact this packet produced: here, green means the tests ran, not that
  the boundary holds.
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
