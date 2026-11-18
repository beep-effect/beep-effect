# Schema-first audit of the prototype (2026-11-13)

Read-only audit of this workspace as it stood at 22:05Z on 2026-11-13 (phase 3 written, uncommitted),
through the lens of `schema-first-development`, `crispen` (ultra) and
`standards/schema-first-development-prompt.md`. Four questions: where a default belongs in the
schema, where absence should decode to `Option`, where a bag of fields hides a discriminated union,
and where an invariant lives in code that the schema could carry.

Nothing in the workspace was edited. Line numbers are this workspace's.

## Work order (operator, 2026-11-13)

Benjamin reviewed the prototype in WebStorm and asked for the following, routed to this lane's
owning session as its single writer. To be done before the next phase starts.

His words: "different states should be treated as a TaggedUnion … various state invariants could be
enforced more properly using this pattern"; nullable and optional fields should use "effect/Schema's
built in transformation schemas to take those values into effect/Option's so that nullability or
optionality is handled on schema decode"; "the lack of use of @beep/identity identity composers"
causes the `deterministicKeys` diagnostics; "Please also enforce all @effect/tsgo diagnostics on the
new module & resolve all issues."

1. **Enforce the diagnostics.** Switch `check` from `tsc` to the repository's
   `tsrs -p <package> --noEmit` for all thirteen packages and resolve all 602 errors (section G). Do
   not lower a severity or add an override.
2. **Use `@beep/identity` composers** for the ten `Context.Service` keys, in the repository's form
   `Context.Service<X, Shape>()($I`X`)`. Linking the package in or joining the root workspace is this
   lane's call; record it in the packet's decisions.
3. **Apply sections A to E.** Where a finding is judged wrong, say why under it instead of applying it.

Done means: `tsrs -p` exits 0 for all thirteen packages, `bun run test` and `bun run handlers:check`
pass, and the stored-format tests pass with the fixtures unchanged. Report the commands and results
to session `beep-effect-e9`, which re-runs them.

## What was proven, and how

A probe outside the workspace, typechecked and run against this workspace's own `effect` 4.1.4 and
`@alchemy.run/domain` 2.0.0-beta.87:

| Claim | Result |
| --- | --- |
| `Domain.View` accepts an `S.TaggedUnion` as `state`, with `initial: State.cases.X.make({})` | typechecks |
| `Domain.Filter<Union>` can filter on the discriminator (`{ _tag: "Pending" }`) | typechecks |
| `S.OptionFromNullOr(X)` inside a union case encodes `none` as `null` through `S.toCodecJson` | `{"_tag":"Pending",…,"proposal":null}` |
| A `Pending` row with `org: null` no longer decodes | rejected |
| `Since.phase3(S.OptionFromNullOr(RunId), null)` reads a missing key, `null` and a value | `none`, `none`, `some` |
| Constructor defaults apply through a plain nested object (`Record.make({ budget: { allowance: 100 } })`) | fills `spent`, `allocated`, `generation`, `reservations`, `parent` |
| `S.Int.check(S.isGreaterThanOrEqualTo(0))` rejects `-1` on decode | rejected |
| "none means unbounded" terms encode exactly as today | `{"operations":null,"expires":null}` |

Why the library allows all of it: a view or aggregate folds on the decoded side (`evolve`, `initial`,
`validate`, `reply` all see `Schema["Type"]`) and stores through `S.toCodecJson(state)`
(`Kernel.ts:104`, `:337`, `:937`). The encoded side is the stored format; the decoded side is free to
be as rich as the schema can express.

Three things the probe corrected:

- A default combinator hoisted into a shared const (`const noneByDefault =
  S.withConstructorDefault(Effect.succeedNone)`) loses its type parameter and turns the whole struct's
  services into `unknown`. Apply it inline, per field.
- `O.every` does not exist in 4.1.4. "None means unbounded" reads as
  `O.match(x, { onNone: constTrue, onSome: predicate })`.
- Struct decoding ignores excess keys, so `{ _tag: "Unasserted", proposal: {…} }` decodes to a bare
  `Unasserted`. The union cannot hold the illegal combination; it does not reject input that carries it.

## The pattern behind most findings

A group of nullable fields that are always null together, or null exactly when another field has one
value, is a sum type written as a product. `Option` is the right tool for one independent absence. It
is the wrong tool for correlated absence: three `Option`s that are all `none` or all `some` still admit
six states that cannot happen. The audit sorts every nullable field into one of the two.

## A. Missing cases (correlated nulls)

**A1. `ClaimReviewState` is a flat struct with a status literal** (`party/contract/src/Claim/ClaimReview.read.ts:64-95`).
`org` and `proposition` are null exactly when `status` is `"unasserted"`. The handlers pay for it:
`O.fromNullishOr(review?.org)` (`ClaimReview.handler.ts:22`), `input.state?.org ?? null` then
`if (org === null) continue` (`ClaimFacts.handler.ts:21-22`), and `input.state?.reviews ?? []` (`:35`).

```ts
const Asserted = {
  org: OrgId,
  proposition: Proposition,
  sources: Count,
  revision: Count,
  reviews: S.Array(RunId),
  notes: S.Array(ClaimNote),
};
export const ClaimReviewState = S.TaggedUnion({
  Unasserted: {},
  Pending: { ...Asserted, proposal: S.OptionFromNullOr(ProposalView).pipe(S.withConstructorDefault(Effect.succeedNone)) },
  Accepted: { ...Asserted },
  Retracted: { ...Asserted, reason: S.String },
});
```

The union also gives case payload a home. `ClaimRetracted.reason` is dropped by today's view because a
flat struct would need one more nullable field to hold it.

One fact to design around: readers never see `Unasserted`. The library creates a view row on the first
event (`Kernel.ts:1351`, `current ?? def.initial`) and `get` returns `none` before that, so `initial`
is only the seed of the fold. Today the read contract has two spellings of "nothing yet" (`null` and
`status: "unasserted"`); the seed case should be documented as never observable.

Stored effect: a view is derived, so this is a `version` bump and a rebuild, not a migration. It does
change the JSON of `ClaimReview.get` (`status: "pending"` becomes `_tag: "Pending"`), which
`Api.parity.test.ts` and the host tests assert on.

**A2. `EffectivePartyState`** (`party/contract/src/Party/EffectiveParty.read.ts:16-33`). Same shape:
`org` and `name` are null only in the seed, and `PartyRegistered` is always first. Target
`S.TaggedUnion({ Unregistered: {}, Active: { org, name, absorbed } })`. Deletes
`EffectivePartyInitial` and the `O.fromNullishOr(party?.org)` in `EffectiveParty.handler.ts:21`.

**A3. `RunRecord` carries three fields that are null exactly while the run is `Requested`**
(`runs/model/src/Run/AgentRun.aggregate.ts:61-79`): `accountable`, `delegation`, `provenance`.
`RunActivated` sets all three together (`:542`). The type cannot say that a `Running` run has them, so
the code checks for a case that cannot occur:

- `run.provenance === null ? [] : …` inside a `Running | AwaitingApproval | AwaitingChild` arm (`:484`)
- `state._tag === "Running" && state.run.provenance !== null` (`runs/host/src/RunsGateway.adapter.ts:129`)
- `O.flatMapNullishOr(recordOf(live.state), (record) => record.provenance)` (`:87`)
- `GrantRef.make({ grant: run.source.grant, delegation: run.delegation })` with a nullable delegation
  flowing into a ref where null means something else (`AgentRun.aggregate.ts:347`, `:415`)

Target: `Requested: { run: RunPlan }` and every later case `{ run: RunRecord }`, where
`RunRecord = RunPlan + { accountable: PrincipalId, delegation: DelegationId, provenance: Provenance }`.
Stored effect: a `Requested` snapshot written today has three extra null keys, which decode ignores.

**A4. `RunReportRefused { reason: S.String, remaining: S.NullOr(S.Int) }`** (`runs/contract/src/Runs.gateway.ts:87-90`).
`remaining` is non-null exactly when `reason === "budget"`; the consumer checks both
(`party/host/src/Review/ReviewRuns.adapter.ts:39`) and the producer builds it from an untyped bag with
`typeof cause.remaining === "number"` (`RunsGateway.adapter.ts:70-79`). Two errors, or one tagged
refusal: `Budget { remaining }`, `Readmission { reason }`, `Rejected { tag }`.

**A5. `ClaimDecidedV2 { basis, approval: S.NullOr(ApprovalId) }`** (`party/contract/src/Facts/ClaimDecided.fact.ts:46-54`).
`approval` is non-null exactly when `basis === "approval"`. This one is a published, snapshot-tested
contract, so the wire stays. `approval: S.OptionFromNullOr(ApprovalId)` is wire-identical; `basis`
then duplicates `O.isSome(approval)` and stays only because it is published.

**A6. `Invocation` and `Provenance`: root kind and grant kind are correlated** (`shared/kernel/src/Invocation.ts:102`, `:206`).
A human root carries direct grants (`delegation` null) and an agent root carries delegated ones;
`Boundary.confirm` enforces it by returning `none` for the other two combinations
(`authority/host/src/Boundary/Boundary.ts:126-140`). The rule can also sit on the schema as a struct
filter, so a provenance that violates it does not decode. The live re-check in `Boundary` stays: it is
the trust boundary.

## B. Independent absence: decode to `Option` (stored format unchanged)

Every field below keeps its encoded form (`X | null`), which DECISIONS line 76 fixes for grants. Only
the decoded side changes.

| Field | Where | Null means | Null handling it deletes |
| --- | --- | --- | --- |
| `GrantTerms.operations` | `shared/kernel/src/Capability.ts:65` | every operation | `:147`, `:169-170` (including `parent.operations ?? []`) |
| `GrantTerms.expires` | `:67` | never | `:149`, `:176`, `:209`; `ExpireAtDeadline.handler.ts:20` |
| `CapabilityGrant.delegation`, `GrantRef.delegation` | `Capability.ts:83`, `Invocation.ts:190` | held directly | `Boundary.ts:129`, `:135`; `AuthorityGateway.adapter.ts:49` |
| `DelegationOpened.parentDelegation`, `DelegationState.Active.parentDelegation` | `OpenDelegation.command.ts:30`, `:51`; `Delegation.aggregate.ts:38` | delegated from the grant itself | `Boundary.ts:118` |
| `RunRecord.parent`, `.previous` | `AgentRun.aggregate.ts:65-66` | top-level run; first generation | `ResumeParent.handler.ts:23` |
| `SessionRun.parent`, `.previous` | `runs/contract/src/Run/SessionRuns.read.ts:43-44` | same | the `previous: null, parent: null` spread in `SessionRuns.view.ts:16` |
| `ContinuationOpened.parent`, `RunContinued.parent`, `OpenContinuation.parent` | `OpenContinuation.command.ts:27`, `:58`; `RecordStep.command.ts:36` | same | none; composes with `Since.phase3` |
| `ClaimState.Pending.proposal` | `party/model/src/Claim/Claim.aggregate.ts:56` | not proposed yet | `:187` |
| `AssertClaim.reply.reviewRun` | `party/contract/src/Claim/AssertClaim.command.ts:51` | no review requested | `O.getOrNull(…)` at `Claim.aggregate.ts:300` |
| `ProposalApproved.corroboration` | `ApproveProposal.command.ts:55` | the D22 widening exhibit; nothing writes null today | none |
| Activity results `S.NullOr(LiveRun)`, `S.NullOr(S.String)` | `party/model/src/Review/ReviewAssist.handler.ts:61`, `:94` | budget refused; no refusal | `:67`, `:106` |

`operations` and `expires` are a "none is the top of the lattice" case, not a "nothing here" case. A
named union (`Every | Only { operations }`) would say so in the type; `Option` keeps the decided wire
shape. `Option` is the smaller change; the union is the clearer model.

The `St | null` a view validator receives and the `O.Option<St>` a host `get` returns are the
library's own boundary. One `O.fromNullOr` there is correct and stays.

## C. Defaults that belong in the schema

| Site | What is repeated | Schema default |
| --- | --- | --- |
| `RunRecord.make` ×3 (`AgentRun.aggregate.ts:516`, `:611`, `:658`) | `generation: 0`, `parent: null`, `previous: null`, `reservations: []`, `steps: 0`, `budget: { allowance, reserved: 0, spent: 0, allocated: 0 }` | constructor defaults on `generation`, `steps`, `reservations`, `parent`, `previous`, and on `Budget.spent`, `.allocated` |
| `ClaimState.cases.Pending.make` (`Claim.aggregate.ts:220`) | `reviews: 0`, `proposal: null` | constructor defaults (`revision: 1` is a fact of the event, not a default) |
| `ClaimReviewInitial`, `EffectivePartyInitial` (`ClaimReview.read.ts:86`, `EffectiveParty.read.ts:33`) | a hand-written all-defaults object exported beside its schema | gone with A1 and A2; otherwise `State.make({})` |
| `upsert(…, from: Partial<SessionRun> = {})` (`SessionRuns.view.ts:13-16`) | `{ run, previous: null, parent: null, status, ...from }` | defaults on `previous`, `parent`; `SessionRun.make({ run, status, ...from })` |
| `bootstrap` (`Boundary.ts:253-260`) and `terms` (`ReviewOnRequest.handler.ts:65-70`) | `delegation: null`, `operations: null`, `expires: null` | defaults of `none` on the three |

Constructor defaults leave the wire alone. `S.withDecodingDefaultKey` and
`S.withDecodingDefaultTypeKey` make the stored key optional, which is right for a field added after
events were stored (`Since.phase3`, `EvidenceSignal.trust`) and wrong for a field that has always been
written. A view state field has no stored history that outlives a rebuild, so it needs the constructor
default only.

## D. Text that is a union

- **Refusal reasons are assembled with template strings and never read back as data**:
  `` `readmission:${refused.reason}` `` (`ReviewAssist.handler.ts:103`, `ReviewOnRequest.handler.ts:87`,
  `RunsGateway.adapter.ts:76`), `` `run:${refused.reason}` `` (`ReviewOnRequest.handler.ts:83`),
  `"no-propose-grant"` (`:52`), `` `grant:${denied.reason}` `` (`GrantOnRequest.handler.ts:48`,
  `ContinueAtBound.handler.ts:65`, `OpenChildOnRequest.handler.ts:58`), `` `continuation:${tag}` ``.
  `MergeRefusal` already shows the right form, a tagged union with a declared read-time transform from
  the stored text (`RecordMergeRefused.command.ts:18-69`). `ReviewRefused.reason`, `RunRejected.reason`
  and `ChildRunRefused.reason` want the same treatment.
- **The view flattens the one union that exists.** `ClaimNote.MergeRefused: { reason: S.String }` is
  filled with `renderMergeRefusal(event.reason)` (`ClaimReview.view.ts:60`). The note can carry
  `MergeRefusal` itself.
- **`outcome: S.String` holds three domains**: free text from `CompleteRun`, a `Decision` literal from
  `ConcludeRun` (`ClaimDecided.inbox.ts:85`), and an event tag from `ResumeParent`
  (`trigger.event._tag === "RunCompleted" ? trigger.event.outcome : trigger.event._tag`,
  `ResumeParent.handler.ts:29`).
- **One decision, four spellings**: `Disposition` (`accept`, `reject`), `ProposalApproved.outcome`
  (`ApproveProposal.command.ts:52`) which repeats `Decision` (`ClaimDecided.fact.ts:13`), the view's
  status literals, and the aggregate's tags. The conversions are by ternary
  (`Claim.aggregate.ts:200`, `:288`), and one is the identity
  (`event.outcome === "accepted" ? "accepted" : "retracted"`, `ClaimReview.view.ts:56`).
- **`RunStatus` restates `AgentRunState`'s tags in kebab case**, joined by a ten-arm `statusOf`
  (`RunStatus.ts:9-20`, `AgentRun.aggregate.ts:123-135`). Party and authority use the tags directly
  (`ClaimNotPending.status`, `GrantNotActive.status`, `DelegationNotActive.status`). Using the tags in
  runs too deletes `statusOf`.

## E. Invariants the schema could hold

- **Counts are `S.Int`.** `allowance`, `spent`, `allocated`, `units`, `remaining`, `steps`, `generation`,
  `historyBound`, `revision`, `reviews`, `sources`, `have`, `need`, `seq`, `evidenceRevision` are all
  non-negative, and `historyBound` and `need` are positive. One kernel
  `Count = S.Int.check(S.isGreaterThanOrEqualTo(0))` covers them.
- **`Budget.reserved` is stored twice.** It always equals the sum of `reservations[].units`, and five
  places keep the two in step (`AgentRun.aggregate.ts:169`, `:554`, `:559`, `:564`, `:674`). Dropping
  the field and deriving it removes the invariant instead of guarding it; a stored `reserved` key is
  then ignored on decode, as D22's "removed field" row allows.
- **Sets kept as arrays.** `absorbed` (guarded by `A.contains` at `Party.aggregate.ts:72`),
  `requesters`, `delegations`, `grants` (kept unique with `A.union`) and `reviews`. `S.UniqueArray`
  exists in 4.1.4 (`Schema.ts:4851`) and states it; not probed.
- **Ids accept the empty string.** All ten are `S.String.pipe(S.brand(…))`
  (`shared/kernel/src/Ids.ts`, `*.id.ts`); `S.NonEmptyString` is the floor.
- **Finite domains typed as `S.String`**: `Proposition.HasIdentifier.scheme`
  (`party/contract/src/Proposition.ts:25`), `Cause.Session.scheme` (`Invocation.ts:62`).
- **`Need` is an exported pure-data interface** (`Capability.ts:127-132`); the law asks for a schema.

## F. Left as it is, on purpose

- Every aggregate state is already an `S.TaggedUnion` with `.cases`, `.guards`, `.match`. That is the
  model the views should follow.
- `StoredMergeRefusal`, `Since.phase3`, `S.encodeKeys({ quote: "excerpt" })` and the `EvidenceSignal.trust`
  default pair are the right use of decode-time transforms: the stored bytes stay, the model moves.
- `requirePending`, `requireActive`, `requireRunning` match on `_tag` with `Match` because the schema
  value lives in the file that imports them. The comment says so; it is a cycle, not an oversight.
- `FixtureCredential.parse` is a trust boundary and stays explicit.
- `FactEnvelope.payload: S.Unknown` is decoded by version at the consumer, which is the design.

## G. `@effect/tsgo` diagnostics

`tsconfig.base.json` extends the repository's, so it inherits the `@effect/language-service` plugin
with every rule at `error`. The workspace's own `check` script runs plain `tsc`, which does not load
the plugin, so the editor shows the diagnostics and the check does not fail on them. Running the
repository's `tsrs -p <package> --noEmit` over the thirteen packages reports 602:

| Rule | Count | Rule | Count |
| --- | --- | --- | --- |
| `newSchemaClass` | 358 (131 in `src`) | `preferSucceedSomeOrNone` | 9 |
| `yieldInCallArgument` | 55 | `preferEffectArray` | 9 |
| `strictEffectProvide` | 45 | `missedPipeableOpportunity` | 7 |
| `anyUnknownInErrorContext` | 28 | `preferEffectString` | 4 |
| `effectFnOpportunity` | 25 | `preferTypedSchemaDecoder`, `globalJson` | 3 each |
| `missingPipeableSignature` | 22 | `unnecessaryTypeofType`, `schemaSync` | 2 each |
| `schemaClassMissingBrand` | 15 | six more rules | 1 each |
| `deterministicKeys` | 10 | | |

The ten `deterministicKeys` are the ten `Context.Service` classes with hand-written keys
(`"Party/PartyDirectoryStore"` where `@proto/party-model/Directory/PartyDirectory.store/PartyDirectoryStore`
is expected, and so on): `PartyFactsFeed`, `PartyDirectoryStore`, `ReasonerTape`, `AuthorityGateway`,
`Boundary`, `RunsGateway`, `ClaimDecidedInbox`, `InboxStore`, and the two test harnesses. The
repository's form is an identity composer, `Context.Service<X, Shape>()($I`X`)`. This workspace is a
standalone bun workspace with no `@beep/*` dependency, so adopting `$I` means linking `@beep/identity`
in or joining the root workspace.

To enforce: point `check` at `tsrs` instead of `tsc`. Several rules overlap with this audit
(`preferSucceedSomeOrNone`, `schemaClassMissingBrand`), so the diagnostic sweep and sections A to E
touch the same lines and are cheaper done together.
