# Phase 7: the Effect build of the compiler, the owner's review, and the review saga fix

This phase made `bun run check` run the Effect build of the compiler over every project, with the
monorepo's own rule set, and clear every finding. It also applied the owner's three review points
and fixed the review saga defect that phase 6's case P5 found. No Docker, no `alchemy`: the
cluster cases were not rerun.

Before the work, the Effect build reported 981 findings. Now it reports none: `bun run check` exits
0 across all 17 projects. A first pass left 114. The second pass ("The last 114" below) cleared them
with the monorepo's own precedents: rejections declared as `S.TaggedError`, one entry-point
directive, and five typed library boundaries. `bun run test` passes 152 tests (136 before). The
outcome check reports 109 of 109 declared outcomes executed. `handlers:check` and
`generated:check` pass, and the frozen stored-format fixtures still decode, unchanged.

## Wiring, and why

- **Compiler.** The root `package.json` pins `@effect/tsgo` 0.68.1 and `tsrs` 0.24.0-ts7.1.0-beta,
  the monorepo catalog's versions, and drops `typescript`. Every segment of `check` is
  `effect-tsgo tsrs -p <project>`.
- **Why the proxy rather than patching.** The proxy runs the Effect build without rewriting the
  installed `tsrs`, so there is no postinstall step to forget after a reinstall. It also keeps the
  stock `node_modules/.bin/tsrs` untouched, which the canary needs as its baseline: the canary
  passes under stock `tsrs` and fails under the Effect build.
- **What `--version` reports.** `Version 7.1.0-beta+effect-tsgo.0.68.1 (tsrs 0.24.0-ts7.1.0-beta, ...)`.
- **Rules.** Every project extends the monorepo's `tsconfig.base.json` through its own extends
  chain. The plugin block is not copied, no rule is turned off and nothing overrides it. The one
  exception is `conformance/upstream/tsconfig.json`, the vendored project below. `tsrs` has no
  `--showConfig`, so the guard checks the chain itself:
  - each project's chain reaches the base;
  - only the vendored project defines `plugins`;
  - the canary reports no TS377134 (an unknown-rule warning).
- **Coverage.** `check` covers 17 projects: the 15 packages, the vendored project and `scripts/`.
  That takes in sources, tests, scripts, vitest configs, the web package's `.tsx`, the app,
  conformance and the generated files.
- **The two guards** (`shared/tooling/test/Compiler.guard.test.ts`, 4 tests). Both are in
  `PROOFS.md` as `compiler-effect-build` and `compiler-canary`.
  - *Version guard.* The installed versions equal the monorepo pins, and the proxy's `--version`
    names the Effect build at both pins. Every `check` segment is the Effect build, and every
    workspace with a tsconfig, plus `scripts`, is checked.
  - *Canary* (`shared/tooling/canary/`). One floating `Effect.log(...)` fails under the Effect
    build with exactly one `effect(floatingEffect)` error, while stock `tsrs` passes it.
- **Service keys.** Service keys come from `@beep/identity` composers. `shared/kernel/src/Identity.ts`
  roots `$PrototypeId` at `$ScratchpadId.create("model-first-slices")` and exports one composer per
  package. Every `Context.Service` key is `$I\`Name\``.
- **How `@beep/identity` and `@beep/schema` resolve.** They are root devDependencies with
  `link:../../packages/foundation/modeling/{identity,schema}`, which bun installs as symlinks.
  Their `exports` point at `src/*.ts`, so every consumer resolves source. A dependency of theirs,
  such as `effect`, resolves from the symlink's real path, which is the monorepo's `node_modules`.
  That needs the repo root's `bun install`, which is effect 4.1.4, the prototype's own version.

| Consumer | Resolves | Evidence |
| --- | --- | --- |
| Type check (`effect-tsgo tsrs`) | the linked `src/*.ts`; `effect` types from the monorepo copy | `check` passes these imports |
| vitest | the same files, through the real path: a second, identical effect 4.1.4 | every suite passes |
| Generators (`bun scripts/*.ts`) | the same | `handlers:check` and `generated:check` pass |
| Runner and front bundles | would bundle the monorepo's copy | not exercised (no Docker this phase) |

  Nothing in the monorepo changed, and nothing was vendored. The root `package.json`, `bun.lock`
  and `patches/` hash as they did before.

## Diagnostics before and after

The "before" column is the first run of the Effect build, before any fix. The first pass ended at 114
(newSchemaClass 108, TS377030 5, strictEffectProvide 1); the second pass cleared those.
`conformance` then still held the upstream files.

| Package | Before | After | Before, by rule | After, by rule |
| --- | --- | --- | --- | --- |
| `apps/practice` | 15 | 0 | yieldInCallArgument 5, strictEffectProvide 3, provideMergeAllToArray 2, preferEffectArray 2, preferEffectString 1, TS377030 1, newSchemaClass 1 | none |
| `authority/contract` | 2 | 0 | schemaClassMissingBrand 1, deterministicKeys 1 | none |
| `authority/host` | 49 | 0 | newSchemaClass 15, yieldInCallArgument 8, strictEffectProvide 7, preferEffectArray 6, effectFnOpportunity 5, preferSucceedSomeOrNone 3, deterministicKeys 1, missingPipeableSignature 1, returnEffectInGen 1, preferEffectString 1, TS377030 1 | none |
| `authority/model` | 100 | 0 | newSchemaClass 99, strictEffectProvide 1 | none |
| `conformance` | 155 | 0 | TS377030 39, yieldInCallArgument 27, newSchemaClass 17, processEnv 9, preferEffectString 8, strictEffectProvide 8, effectFnOpportunity 5, schemaNumber 5, missingPipeableSignature 4, unsafeEffectTypeAssertion 3, missedPipeableOpportunity 3, strictBooleanExpressions 3, returnEffectInGen 2, globalDateInEffect 2, preferEffectArray 2, cryptoRandomUUID 2, globalErrorInEffectFailure 2, globalJson 2, schemaSyncInEffect 2, schemaSync 2, preferEffectRecord 2, processEnvInEffect 1, catchAllToMapError 1, globalDate 1, globalJsonInEffect 1, preferTypedSchemaDecoder 1, onExitFailureToOnError 1 | none |
| `conformance/upstream` | (new) | 0 | none | none (TypeScript errors only) |
| `party/contract` | 9 | 0 | strictEffectProvide 3, effectFnOpportunity 2, unnecessaryTypeofType 1, deterministicKeys 1, missedPipeableOpportunity 1, yieldInCallArgument 1 | none |
| `party/host` | 58 | 0 | TS377030 22, strictEffectProvide 11, effectFnOpportunity 8, newSchemaClass 7, missedPipeableOpportunity 2, deterministicKeys 2, returnEffectInGen 1, missingPipeableSignature 1, preferTypedSchemaDecoder 1, unnecessaryEffectGen 1, globalJsonInEffect 1, preferEffectArray 1 | none |
| `party/model` | 227 | 0 | newSchemaClass 162, yieldInCallArgument 26, strictEffectProvide 12, missingPipeableSignature 8, schemaClassMissingBrand 6, effectFnOpportunity 5, preferSucceedSomeOrNone 3, deterministicKeys 1, missedPipeableOpportunity 1, schemaNumber 1, preferEffectArray 1, preferTypedSchemaDecoder 1 | none |
| `party/web` | 58 | 0 | strictBooleanExpressions 14, strictEffectProvide 8, TS377030 7, missingPipeableSignature 5, newSchemaClass 5, effectFnOpportunity 5, preferEffectArray 3, deterministicKeys 2, provideMergeAllToArray 2, asyncFunction 2, yieldInCallArgument 1, preferTypedSchemaDecoder 1, mapMapErrorToMapBoth 1, unnecessaryTypeofType 1, missedPipeableOpportunity 1 | none |
| `runs/contract` | 7 | 0 | schemaClassMissingBrand 3, strictEffectProvide 2, deterministicKeys 1, effectFnOpportunity 1 | none |
| `runs/host` | 75 | 0 | newSchemaClass 20, yieldInCallArgument 19, effectFnOpportunity 10, strictEffectProvide 7, TS377030 6, deterministicKeys 3, unsafeEffectTypeAssertion 3, missingPipeableSignature 2, schemaSync 2, missedPipeableOpportunity 1, returnEffectInGen 1, lazyEffect 1 | none |
| `runs/model` | 174 | 0 | newSchemaClass 156, strictEffectProvide 4, yieldInCallArgument 4, missingPipeableSignature 4, preferEffectArray 2, schemaClassMissingBrand 1, unnecessaryTypeofType 1, effectFnOpportunity 1, preferTypedSchemaDecoder 1 | none |
| `scripts` | 5 | 0 | globalErrorInEffectFailure 2, preferEffectArray 2, preferTypedSchemaDecoder 1 | none |
| `shared/contract-kit` | 1 | 0 | missingPipeableSignature 1 | none |
| `shared/kernel` | 13 | 0 | missingPipeableSignature 7, globalJson 2, schemaClassMissingBrand 2, missedPipeableOpportunity 1, newSchemaClass 1 | none |
| `shared/tooling` | 33 | 0 | schemaClassMissingBrand 6, newSchemaClass 6, missingPipeableSignature 5, preferEffectString 4, preferSucceedSomeOrNone 3, yieldInCallArgument 2, missedPipeableOpportunity 2, globalJson 2, preferEffectArray 1, strictEffectProvide 1, globalDateInEffect 1 | none |
| **Total** | **981** | **0** | | none |

The newSchemaClass findings were cleared in two passes. In the first, `S.Class`, `Domain.Event` and
`Domain.Command` classes became `X.make(...)` on the class. In the second, the rejections became
`S.TaggedError` classes ("The last 114").

## The owner's review

### Lifecycle states that are now tagged unions

- **`AgentRunState`** (`runs/model`). The record is split in two:
  - `RunRequest` is what a requested run records before its grant arrives.
  - `RunRecord` is the active record, with `accountable`, `delegation` and `provenance` now
    required.

  `Requested` and the new `Withdrawn` hold a `RunRequest`. `Withdrawn` is a request cancelled
  before its grant; it used to be a `Cancelled` with three nulls. The new `Refused` is an active
  run whose hop was refused mid-run. It keeps its record with nothing held open, where before the
  rejection discarded the whole ledger. Both new states read as `"cancelled"` and `"rejected"`, so
  `RunStatus` is unchanged.
  - Getters: `requestOf` (any state with a record) and `recordOf` (active states only).
  - The gateway's `provenance !== null` checks and `ConcludeRun`'s null branch are gone.
- **`ClaimReviewState`** (`party/contract`). `Unasserted { notes }`, plus `Pending`, `Accepted` and
  `Retracted`, each with `org`, `proposition`, sources, revision, reviews, `proposal: Option` and
  notes. This replaces the `status` literal and its three nulls. `proposalOf` reads the proposal
  in any state. The view's `version` is now 1, so it is computed again from history.
- **`EffectivePartyState`** (`party/contract`). `Unregistered | Registered { org, name, absorbed }`.
  Its view's `version` is now 1.
- **Web `Screen`** (`party/web`). `pending`, `notice` and `pending.receipt` only ever occur one at
  a time, so they became one `Approval` union: `Idle | Sending | Committed { receipt } | Noticed { notice }`.
  `view` and its `review` are `Option`s. `InFlight` is a schema union, and its guard is `S.is(InFlight)`.
- **Saga activity results** (`party/model`). `Reservation = Reserved { live } | OutOfBudget` and
  `ProposalSent = Made | Refused { refusal }`. Each decodes from the stored `LiveRun | null` and
  `string | null` and encodes back to them.
- **Gateway errors** (`runs/contract`). `RunReportRefused.remaining` was set only for a budget
  refusal. That refusal is now its own error, `RunBudgetExceeded { remaining }`.

### Fields that became `Option`

Each of these is an independent absence, decoded with `S.OptionFromNullOr`, so the stored or wire
JSON keeps `null`:

- `GrantTerms.operations` and `.expires`;
- `CapabilityGrant.delegation` and `GrantRef.delegation`;
- `RunRecord.parent` and `.previous`;
- the `parent` of `RunContinued`, `ContinuationOpened` and `OpenContinuation` (still with the
  phase 3 default);
- `SessionRun.previous` and `.parent`;
- `Delegation.Active.parentDelegation`, and the same field on `DelegationOpened` and `OpenDelegation`;
- `Claim Pending.proposal` and `ProposalApproved.corroboration`;
- the `AssertClaim` reply's `reviewRun`;
- `ClaimDecidedV2.approval`;
- the web's `lastRegistration` atom.

`ClaimDecided` is a published, frozen contract. Its JSON Schema snapshot test passes, so the
published schema is unchanged. Its `basis` and `approval` fields move together, which makes them a
missing union case. Fixing that needs a version 3 of the fact, so this phase left it alone.

Canonical defaults moved onto schemas:

- the import graph's manifest reads a missing `workspaces` or `exports` as empty
  (`withDecodingDefaultKey`);
- `Proof.live` is `false` unless set (a constructor default; the inventory is built with `Proof.make`).

### `LiteralKit`

The named literal domains now use `LiteralKit` from `@beep/schema/LiteralKit`. Their JSON Schema is
unchanged:

- `RunStatus`, `EndedStatus`, `Decision`, `Trust`, `Disposition`, `ProcessKind`, `AdmissionGate`,
  and `TermDimension`, which was already converted earlier in this phase.

Anonymous inline unions, such as a rejection's `status` field, stay `S.Literals`.

## Stored shapes that changed, and how old data still reads

| Stored shape | Change | How old data reads | Fixtures |
| --- | --- | --- | --- |
| `AgentRun` state, `Requested` | no longer writes `accountable`, `delegation` or `provenance` as `null` | the three keys are ignored on read (Schema's default `onExcessProperty: "ignore"`) | old `AgentRun.requested.state.json`, new `AgentRun.requested.phase7.state.json` |
| `AgentRun` state, request cancelled before its grant | `Cancelled` with nulls is now `Withdrawn` | declared conversion `CancelledBeforeGrant` in `StoredAgentRunState`: phase 6's form decodes to `Withdrawn`, and writes are today's form | old `AgentRun.cancelled-requested.state.json`, new `AgentRun.withdrawn.phase7.state.json` |
| `AgentRun` state, new `Refused` | new case | not applicable: earlier `Rejected` states decode unchanged | (written by the stories) |
| `RunRejected` event | adds `released` | `Since.phase7(S.Int, 0)`: earlier events read 0 | the existing histories |
| `ClaimReview` and `EffectiveParty` view state | union, with `_tag` replacing `status` | view `version` 1: computed again from history, so no stored view state is converted | none; the frozen `Claim` histories replay into the new state |
| Every `OptionFromNullOr` field above | none | identical JSON | `AgentRun.state.json`, the run and claim histories, `Claim.state.json`, `AssertClaim.receipt.json` |
| `ReviewAssist` activity results `reserve` and `propose` | none | unions decoded from the same JSON | `ReviewAssist.activities.json` decodes and re-encodes to the same values |

The old `Requested` and cancelled-before-grant fixtures were captured in this phase, before the
schema changed, by encoding through the phase 6 schema. That encoding was unchanged since HEAD:
the kernel's `NullOr` to `OptionFromNullOr` change keeps `null`. No existing fixture was regenerated.
`StoredFormat.test.ts` checks four things:

- both old forms decode;
- the new forms equal them;
- a write is the new form;
- no stored bytes change on read.

## The review saga fix (phase 6's P5)

`ReviewAssist.handler.ts` used to catch only `RunEnded`. A `RunRefused` from settle, step or
release therefore failed the whole workflow. Nothing was recorded on the claim, and the run stayed
`Running` with its reservation held.

Now any refused report hop is recorded the same way as a refused proposal:

- **Which hops.** All of them: reserve, settle, step, release, exhaust and the wait.
- **The claim.** `RecordReviewRefused` puts a note on the claim.
- **The run.** `runs.refuse` reports the refusal. That report needs no re-admission, so it lands
  even though the grant lapsed.
- **Then.** The executor stops cleanly: `recorded` fails with `RunEnded`, which the handler
  already catches.

On the runs side, rejecting an active run now gives back what it held:

- `RejectRun` computes `released` from the open reservations.
- `RunRejected` moves `Running`, `AwaitingApproval` or `AwaitingChild` to `Refused` with nothing
  held open.

Proof (`PROOFS.md`, `saga-refused-report-hop`):

- **`party/model` Review stories.** Six in-memory stories revoke before reserve, settle, step,
  release (after a Reasoner failure), exhaust (out of budget) and the wait. Each checks the claim's
  `ReviewRefused` note, the `refuse` call and a clean saga completion. In the wait case, the
  proposal still stands.
- **`runs/model` story.** A run refused mid-run with 40 units reserved: `RunRejected` gives back
  `released: 40`, and the run is `Refused` with reserved 0.
- **`runs/host` test.** Real authority and gateway: the owner revokes the grant before settle.
  Settle answers `RunReportRefused("readmission:lapsed")` while 40 units are still held. The
  `Refused` report then lands without re-admission, and the run ends `Refused` with reserved 0.

## Fixes that changed more than syntax

- **Lifetimes (strictEffectProvide).** Every Api or layer that serves past the effect that built
  it is now built into the caller's scope (`Layer.build` and `Effect.provideContext`), which is
  D39's rule:
  - the authority, Party and runs clusters' `apis`, and their cluster wiring;
  - the conformance cluster's `apis`;
  - the front's gateways, built once in the front's init and shared by the Party and runs Apis
    (generated by `scripts/entries.ts`);
  - test suites use `it.layer`, or `Layer.build` in the test's scope.
- **Routing.** The front's routes are typed `HttpEffect`, and the `as never` on its shape is gone.
  A path that no context serves, when there is no root app, now answers 404 instead of crashing on
  `undefined`.
- **Duals.** Subject-first exports got a real `dual`; signature changes ripple to callers:
  - `covers`, `widens`, `inForce`, `extend`, `byProcess`, `byAgent` and `sagaStep`;
  - `generatedFile`, `HandlerRegistry.main`, `entriesOf`, `violationsOf` and `scanText`;
  - `bootstrap`, `liveRun` and `hostParty` (now with a required directory store);
  - the Bindings `command`, `view`, `query` and `update`;
  - the conformance helpers `holdLock`, `issue`, `revoke` and `eventually`;
  - the model test fixtures.
- **`RequestKey`.** Canonical text now comes from the schema JSON encoder instead of
  `JSON.stringify`. Two golden ids pin the output, and old and new give the same ids.
- **`Catalog.make`** takes one options object. **`RpcParity`** compares JSON Schema documents
  rather than their text.
- **Conformance harness:**
  - environment through `Config`, with the values read when tests register taken once through
    `Config` as well;
  - `SecureRandom` for fresh keys and `Clock` for timings;
  - `NeverHeld` as a tagged error;
  - a typed case helper with no `as` casts;
  - the restore case's seeded `claimView` typed `NullOr(ClaimReviewState)` instead of `Unknown`
    and a cast.
- **`GeneratedDrift`** carries a message that names the file. Before, it printed an empty one.
- **`ResumeParent`** also listens to `RunRejected`. A child refused mid-run now resumes its parent
  with what it did not spend (a new runs story); a child refused at grant time never opened, so
  nothing changes for it.

## The vendored upstream files

They live in `conformance/upstream` (`@proto/conformance-upstream`). The project's tsconfig has an
explicit file list and `plugins: []`, with the reason beside it: they are upstream's code, checked
for TypeScript errors only. Each file is byte-identical to its phase 6 copy at HEAD in
`conformance/src/upstream/`. Each differs from upstream at 33c10dd only by a two-line provenance
header and its import paths (phase 5).

- `conformance/upstream/src/app.ts`
- `conformance/upstream/src/conformance.ts`
- `conformance/upstream/src/model.ts`

## The last 114: rejections, one directive, five typed boundaries

### Rejections are `S.TaggedError` classes (108 newSchemaClass)

`Domain.Rejection`'s `make` returns the library's `Instance` type, not the subclass, so `make` could
not replace `new`. The monorepo's own slice on this library (`packages/documents/domain`,
`SyncRuleViolation.rejection.ts`) declares its rejections as
`S.TaggedError<X, { readonly brand: unique symbol }>()("X", fields, $I.annote("X", {...}))` and lists
them in `rejects`. Every one of the prototype's 30 rejection classes now uses that form:

- **Annotations.** Each keeps its `httpApiStatus` and `description` inside `$I.annote`.
- **Identity.** `$I` comes from the package's identity composer (`$KernelId`, `$PartyContractId`,
  `$AuthorityContractId`, `$RunsContractId`), as the service keys do.
- **Construction.** Every rejection is built with `X.make(...)`; 112 sites changed, the JSDoc
  examples included.

Before converting the rest, `MissingGrant` alone was converted and checked on 2.0.0-beta.87 (the
monorepo slice is on beta.86).

**Where the library reads a rejection class.** It never reads the statics `kind`, `tag` or
`annotations` that `Domain.Rejection` adds:

- **The tag.** It reads it from the encoded schema (`rejectionTag` in `internal.ts`): `Kernel.ts`'s
  rejection codecs, and the undeclared-rejection check in `internal.ts`.
- **Saga errors and the Foldkit binding.** They use `Schema.Union(rejects)` and `Schema.is`.
- **The toolkit.** It builds its failure schemas from the RPC error schema (`Ai.ts` `failures`).
- **Story.** `Story.rejected` compares encoded JSON (`Story.ts` `encodeInstance`).
- **The statics.** `ReadRpcs.ts` reads `.tag` and `.annotations` only on commands and queries.

**What the checks showed:**

- **The rejects lists:** they type-check (`Rejection.Any` is any tagged error schema class).
- **`Domain.verify`:** the three verify tests pass.
- **The Api's RPC error schema, contract parity and the derived toolkit:** `ReviewerApi.test.ts`
  over the in-process wire, the parity tests, and `ReviewRun.test.ts`'s `encodedResult` of
  `MissingGrant` all pass.
- **`Story.rejected`:** every story passes.
- **The frozen snapshots:** the `ClaimDecided` JSON Schema snapshots pass. They hold no rejection.
- **Encoded shape: unchanged.** Encoding and decoding a `MissingGrant` gives the same JSON. Across
  all 28 rejection classes the commands declare, each class's JSON Schema equals that of a
  `Domain.Rejection` with the same tag and fields, once `$defs` names are normalized. The one
  difference is the `$defs` key: it is now the identity, for example
  `@beep/scratchpad/model-first-slices/kernel/MissingGrant.rejection/MissingGrantEncoded`, where it
  was `MissingGrantEncoded`.

**Three readers of the statics were the prototype's own.** Each now reads what the library
reads, and none needed the statics:

- **The primary-export checker** read `kind === "Rejection"`. A rejection is now a tagged error
  schema class (`isRejectionClass` in the new `shared/tooling/src/RejectionClass.ts`). The test
  gained controls: a real rejection class passes, and an object that only claims `kind: "Rejection"`
  fails.
- **Outcome coverage** (`scripts/outcomes.ts`) read `rejection.tag`. It now reads the encoded tag
  (`encodedTagOf`), and 109 of 109 outcomes still count.
- **`party/web`'s `Bindings.command`** read `.tag` through an `as unknown as` cast. Its first
  full-suite run classified `ProposalMismatch` as `Unknown`. It now matches a declared rejection by
  `S.is` over `rejects`, as the library's Foldkit binding does, and the casts are gone.

Behaviour is unchanged: the same tags, the same encoded JSON, the same HTTP statuses, and every
story and test passes.

### One directive (1 strictEffectProvide)

The front class's deploy-time props provide `Database` with `Effect.provide`. That is an Alchemy
class entry point, which provides a class's layers once per deploy on purpose (`Platform.ts`
`provideClassLayer`). `scripts/entries.ts` now emits the repo's directive form on that one line of
`apps/practice/generated/Practice.front.ts`:

```ts
// @effect-diagnostics-next-line strictEffectProvide:off -- the front class's deploy-time props are an Alchemy class entry point, and Alchemy provides a class's layers per deploy on purpose (alchemy Platform.ts provideClassLayer: a longer-lived build skips source registration on the next deploy). Owner: @proto/practice. Exit: when the stack provides Database through its providers instead, proved by a deploy.
```

The generator assembles the keyword (`@${"effect-diagnostics-next-line"}`), so its own source does
not read as a directive: the first attempt earned `TS377000: @effect-diagnostics directive has no
effect` on the template line.

This is the only directive in the prototype. `Compiler.guard.test.ts` scans every source file's
comment lines and fails unless the generated front holds exactly one, with an owner and an exit.
`PROOFS.md` lists it under `compiler-effect-build`.

### Five typed boundaries (5 TS377030)

- **`party/host/test/ReviewRun.test.ts` (3 sites).**
  - *Why the type is loose.* `DomainAi.toToolkit` builds each tool with JSON codecs and
    `failureMode: "return"` (`Ai.ts` `toolOf`), then erases the toolkit with
    `as unknown as Toolkit<Record<string, Tool.Any>>`. A call's requirements therefore read as `any`.
  - *The adapter.* `asDerived` restates the handlers once as `WithHandler<Record<string, DerivedTool>>`,
    the tool type the library built. A call then states no requirements and no tool error. It is a
    cast on the handler record (not on an Effect), right beside its one use, with the reason written
    above it.
- **`conformance/test/SimHost.ts` (2 sites).**
  - *Why the type is loose.* `ObjectImpl` returns `Record<string, unknown>` and `Stub` types a call as
    `Effect<unknown, unknown>`. Yet every instance method the library builds is wrapped in
    `reportDefects` (`DurableObjects.ts`), so it never fails.
  - *The adapter.* `isInstanceCall` narrows a method's result once to
    `Effect<unknown, never, RuntimeContext | Scope>`. The host's methods are a typed
    `Record<string, Method>`, and the stub looks a method up with `Record.get`.
  - *Behaviour.* A missing method, or one that returns no Effect, is now a named defect instead of a
    `TypeError`. Every other path behaves as before.

## Real defects the work caught

- **P5.** The review saga left the run holding its reservation, with nothing recorded, when a
  report hop was refused (fixed, above).
- **A rejected active run lost its ledger.** Rejection discarded the record, so a refusal mid-run
  gave nothing back explicitly (fixed: the `Refused` state and `released`).
- **A child refused mid-run left its parent `AwaitingChild` forever**, because `ResumeParent` did
  not listen to `RunRejected` (fixed).
- **Layers torn down too early.** The front's init and the conformance cluster's `apis` built
  layers with `Effect.provide`, whose scope closes when init returns while the routes keep using
  the services. Alchemy's own `Platform.ts` documents the same hazard (fixed).
- **The front crashed on an unrouted path** when no root app was present: a non-null assertion on
  `undefined` (fixed: 404).
- **The restore case round-tripped `claimView` as `Unknown` with a cast.** Once the view holds
  `Option`s, that would have written Option objects into the seed file (fixed: a typed schema).
- **`GeneratedDrift` printed an empty message** (fixed).
- **Stale doc example.** `ReadmissionRefused`'s JSDoc example no longer matched `GrantRef` once
  `delegation` became an `Option` (fixed).
