# Notes: phase 2 rework (re-admission, runs, approval, Reasoner contract, toolkit)

Thirteen workspace packages; `bun run check`, `bun run handlers:check` and `bun run test` pass from
the prototype root: 68 tests in 21 files (party/contract 2, runs/contract 2, party/model 23,
authority/model 11, runs/model 8, authority/host 7, party/host 15). Library: `@alchemy.run/domain`
2.0.0-beta.87, effect 4.1.4. Library references are to
`~/YeeBois/references/effect/alchemy/packages/domain/src/` at 2.0.0-beta.87.

## Decisions

### D4 as narrowed by D24 (authority between hops): built as decided, with one semantic choice

- Events carry `Provenance` (root, on whose behalf, grant ids with their delegation ids, causal
  chain) through `carry`, never grant terms. `party/host/test/ReviewerApi.test.ts` reads a view's
  `list` and `events` and asserts grant ids are present and `capability`, `operations` and
  `resource` are not.
- The kernel no longer exports a function that produces an `Invocation`: `relay` is gone, and
  `extend(provenance, hop)` only extends provenance. The `Invocation` schema itself is still public
  (D25).
- Party declares `Authority.external.ts` with `readmit`; its host adapts it to the authority
  contract's `AuthorityGateway`. Every Party policy and the executor saga re-admit before they send.
  The runs context does the same through its host's gateway.
- Re-admission (`authority/host/src/Boundary/Boundary.ts` `readmit`) re-checks the root (an agent
  root needs its accountable human live now), keeps only the grants the provenance names that are
  still in force (walking a delegation's ancestors), never adds one, and appends the hop. It
  refuses `unaccountable`, or `lapsed` when every named grant has lapsed. When only some lapse it
  returns the rest and `decide` refuses with `MissingGrant`. That is a choice, not a ruling.
- Refusals are recorded, never dropped: `MergeRefused` (re-admission refused, veto, missing grant)
  and `ReviewRefused` on the claim, `RunRejected` on the run. Stories cover a grant revoked between
  two hops, a lapsed re-admission, and a veto; an authority host test shows revocation drops a
  grant at the next re-admission.
- Rejections that revealed state before the grant check are fixed. Every Claim command checks the
  grant first; a claim nobody asserted answers `ClaimNotPending` because it has no org.
  `AssertClaim`, `RegisterParty` and `IssueGrant` check the grant on the command's own org before
  saying the record exists.

### D6 agent run: built as decided, in the runs context

`AgentRun` (`runs/model/src/Run/AgentRun.aggregate.ts`):
- **Lifecycle:** Requested, Running, AwaitingApproval, AwaitingChild, Completed, Rejected,
  Cancelled, Exhausted, Continued.
- **Record:** lineage, parent and previous run, purpose, prompt/model/tool versions, requester,
  accountable human, source grant, terms, delegation, the run's provenance, the budget ledger
  (allowance, reserved, spent, allocated, open reservations), steps and history bound.
- **Budget:** reservations never exceed what remains, and the aggregate's serial order means two
  parallel reservations cannot spend one allowance (story). Settle returns what a reservation did
  not use; release returns it all.
- **Children:** `DelegateRun` sets a share aside for a child and refuses a wider grant
  (`ChildGrantWidens`). The child's own budget is that share.
- **Executor:** Party's saga is keyed by the run. A second review of a claim is a second run
  (story). The saga reports through Party's `ReviewRuns` port.

Not built: a parent resuming when its child finishes. A refused child returns its share.

### D19 Reasoner evaluation contract: built as decided, with the harness still a later goal

`assess` takes run id, step, idempotency key, prompt version, maximum allowance and the claim, and
returns `{ assessment, usage, receipt }`. Party host has three adapters:
- a deterministic fixture;
- a recording adapter that writes each call to a `ReasonerTape` and answers a repeated key from
  the tape;
- a replay adapter that serves the tape and refuses an unrecorded call with the port's error.

`party/host/test/Reasoner.contract.test.ts` runs one suite against all three (usage within
allowance, receipt names key and prompt version, a retried key returns the first answer,
dispositions), with the replay tape passed through its JSON fixture form (`TapeJson`). The tape
lives in memory; nothing writes fixture files to disk, and model and tool versions are not part of
the call key.

### D21 agent surfaces: built minimally as decided

`DomainAi.toToolkit(AgentApi, { expose, headers })` (`Ai.ts:246`) runs under the review run's own
credential. `ProposeDisposition` on the run's claim succeeds. `ClaimReview.get`, which was not
delegated, and `ProposeDisposition` on another claim come back as typed `MissingGrant` tool
failures. The sandbox for coding agents is not built.

### D23 bounded runs: built as decided, without the session entity

At its history bound, `RecordStep` records `RunContinued`. The `ContinueAtBound` policy has the
authority context pass the run's delegation to the next run, then opens it with the remaining
budget and `previous` set. The `SessionRuns` view shows the chain (story). The `AgentSession`
cluster entity is not built: a session is a `SessionId` and a view. The Party executor does not
follow its run across a continuation (defect below).

### D26 run grants: built differently on one point

Requesting a run delegates narrowed terms of the requester's grant (named operations, a resource
scope, an expiry) and assigns a live accountability record, before the run starts. The run's
provenance names only that delegation; the end-to-end test asserts it. A child narrows again: the
authority context refuses a widening `DelegateFurther`, and the runs context refuses it earlier
with `ChildGrantWidens`.

The difference: D26 puts a budget on the delegation. Budget is in the runs ledger, not in the
authority context's grant terms, because the ledger has to settle usage and grant terms never
change on use. The owner should confirm.

### D28 AgentRun home: built as decided

A `runs` context (`runs/contract`, `runs/model`, `runs/host`) owns AgentRun, the budget ledger and
lineage. Party keeps its executor saga and reports through `ReviewRuns.external.ts`; its host
adapts that to the runs contract's `RunsGateway`. Approval stays in Party (`ApproveProposal`).
Authority keeps grants, delegation (now also `DelegateFurther`) and accountability; an agent-rooted
`AssignAccountability` names the same accountable human for a child or continuation.

### Approval (D4, brief item C): built as decided

`ApproveProposal` is one authenticated human command in Party:
- It requires a human root acting directly. An agent root, or a human root relayed by a process,
  gets `HumanApprovalRequired`; tested through the real Session with the run's own credential.
- It requires `party.review` on the claim.
- It must name the proposal's digest and the evidence revision it was made against, or it gets
  `ProposalMismatch`. New evidence clears the proposal, and a stale proposal is refused with
  `ProposalStale`.

Its one fact, `ProposalApproved`, decides the claim (accepted or retracted) and, through
`ResumeOnApproval`, wakes the run. The durable wait carries only `{ approval: ApprovalId }`, and the
`HumanDecision` signal that carried an invocation is gone. End to end: approval through the real
Session accepts the claim and the run completes with outcome `approved:<id>`.

## Library facts from this phase

- A policy reads several sources: `from: [Grant, Delegation]`.
- A policy wakes a saga with `saga.get(key).signal(deferred, value)` (`Saga.ts:113-131`).
- A story can name a command id: `when(ref, command, { commandId })` (`Story.ts:271-279`; the
  default is `story:<step>`, `Story.ts:1258`). Typed story partials are one level deep; nested
  expectations need the function form.
- A story asserts every port call, real or stubbed, so a policy or saga that re-admits adds a
  `call` and an answer per hop. The approval story is 29 steps.
- An operation with no `success` decodes to `Schema.Void` (`ExternalSystem.ts:405`).
- A command without middleware can be scheduled and sent with no request context. The library has
  no way to mark it internal, so any in-process code can send one.
- A toolkit's Layer must be built in a long-lived scope: its tools call the Api's in-process
  client, which `Effect.provide(layer)` would close.
- A view keyed by a value, not an aggregate, routes only on event fields; `keyOf` gets no source
  state for an aggregate (`View.ts` `Routing`). So every `AgentRun` event carries `session`.
- Activation is a policy reaction, so a caller cannot wait on it. The gateways poll
  (`grantRun` waits for the delegation to open, `request` for the run to start), bounded.
- `Model.Internals` is still one key. Three models share one `Domain.InMemory`; each Api and
  gateway gets its own model's Layer privately (`party/host/test/World.ts`).

## Where the fourth draft's sketches did not match

1. `AgentRun` sits in Party's model in the sketch, with the saga sending to it directly. D28 moved
   it to `runs`, so the saga reports through a port and a gateway.
2. The saga sketch provides `relay(invocation, hopOf(run))`. D24 removed `relay`; each step
   re-admits the run's provenance.
3. `ApproveProposal` takes `{ approval, digest }` and records `ProposalApproved` plus
   `ClaimAccepted`. Built: `{ digest, evidenceRevision }`, the approval id is the command id, and
   one fact decides the claim either way.
4. The deferred's success is a bare `ApprovalId`. Built as a struct `{ approval }`; the bare form
   was not tried.
5. `RunState` has `held`/`remaining` and no request state. Built: a record with a budget ledger,
   plus `Requested` and `Rejected`, because the grant is obtained after the request commits.
6. The sketch's `ContinueRun` command is built as `RecordStep` recording `RunContinued`, a policy,
   and an internal `OpenContinuation`.
7. The Reasoner returns a flat `{ disposition, rationale, usage, fixture }` and takes all three
   versions. Built: `{ assessment, usage, receipt }`, with the prompt version and a maximum
   allowance per call. Trust labels on signals are not built.
8. The saga is still called `ReviewAssist`, not `ReviewRun`.

## Upstream changes wanted (new this phase)

1. **Internal commands.** A command flag (`internal: true`) that `Domain.Api` refuses to list and
   that only the model's own policies and sagas may send. Today `RecordMergeRefused`,
   `RejectRun`, `OpenDelegation`, `ActivateRun` and the rest are unguarded in process.
2. **Waiting on a reaction.** A caller should be able to wait until a command's reactions settle,
   so gateways need not poll the aggregate after a policy-driven activation.
3. **`keyOf` with source state.** Let a value-keyed view's `keyOf` see the aggregate's state, so
   events need not repeat routing fields such as `session`.
4. **A cross-context call form.** A product port (an `ExternalSystem`) satisfied by another
   context's contract service is written by hand on both sides. A declared gateway contract with
   generated in-memory and RPC adapters would replace that.

Carried from phase 1 and still wanted: a model-free Api contract; `waitsFor` out of the query
declaration; request context on the envelope (it would remove `carry`); a verification hook on
request context (D25); `Model.Internals` per model; handled members on the Model type; a public
`ReadRpcs`.

## Open questions for the owner

- Budget on the delegation (D26 wording) or only in the runs ledger, as built.
- Re-admission when only some named grants have lapsed: pass the rest (as built) or refuse the hop.
- Whether a product context's synchronous port to another context should be an `ExternalSystem`
  over a provider gateway service (as built), and the gateway's remote form and caller authentication.
- Names:
  - `ReviewAssist` or `ReviewRun`;
  - the `.gateway.ts` suffix;
  - `Run/RunEvent.ts`;
  - a port named `Authority` in two models;
  - delegation ids `dlg:<run>`;
  - run ids `review:<claim>:<n>` and continuation ids `<lineage>~<generation>`.
- A child run's requester is recorded as its accountable human, since a run asked for it.
- The history bound's value (20 here) and the review allowance (100 units, 40 per call).
- Whether approval should also require the run to be waiting for approval.

## Known defects left for later phases

- **The executor does not follow a continuation:** it keeps reporting to the old run, and those
  reports are refused.
- **A parent never resumes** from `AwaitingChild` when its child finishes.
- **A claim decided directly** (`AcceptClaim` or `RetractClaim`) leaves its waiting run waiting:
  only an approval wakes it.
- **`CompleteRun` releases no open reservations.**
- **Re-admission trusts the provenance it is handed**, and the in-memory gateways authenticate no
  caller (D25); the source scan's gaps are unchanged.
- **Internal commands are unguarded** in process (upstream item 1).
- **The gateways poll**, with bounded waits (`grantRun` about 2 s, `request` about 3 s); a timeout
  shows up as a refusal.
- **`runs/host` has no tests of its own;** the Party host's end-to-end test exercises it.
  `RunsApi.CancelRun` and the `SessionRuns` read through the Api are covered only by parity.
- **The Reasoner tape lives in memory only**, and its key leaves out the model and tool versions.
- **The mailbox poller's assertions each start a review run**, which is refused and recorded
  unless the desk's human holds `party.propose`.
- **The app is type-checked only.**
