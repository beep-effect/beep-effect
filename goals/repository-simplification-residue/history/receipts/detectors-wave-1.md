# #1855 detector repairs wave 1: F-S31-EV010 record

Lane `residue-detectors`, branch `feat/residue-detectors-ev010` off `main`
`b7712d0aed`. Source evidence:
[goals/repository-simplification-confidence/history/receipts/stage-4-detectors.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-4-detectors.md),
`history/receipts/packet-opening-verification.md` (the three F-S31-EV010 findings)
and `history/receipts/vitest-canon-wave-1.md` (the EV010 coordination note with
#1875). The detector is the EV010 `platform-resource-provenance-review` class in
`packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts`.

## Fresh measurement at `b7712d0aed`

`bun run beep lint effect-vitest`: 2,005 files, 1,714 findings, `introduced=0
resolved=14`. The committed inventory holds 1,728 rows. The 14 resolved rows were
already fixed on main by other PRs: 2 EV010 `platform-filesystem-candidate`
exceptions (`@beep/test-utils` `FileSystemConformance.{bun,node}.test.ts`) and 12
EV004/EV014 rows in the `@beep/test-utils` MemoryFileSystem suites.

EV010 rows in the live scan at the base:

| Class | Open | Exception |
| --- | --- | --- |
| `platform-resource-provenance-review` | 117 | 92 |
| `platform-filesystem-candidate` | 44 | 53 |

**The three F-S31-EV010 findings are already gone.** The opening verification
reproduced them at packet opening. #1899 (`e11f0c4e5a`, 2026-10-17, "classify
proven native filesystem subjects in EV010") then repaired the detector with paired
fixtures: a services bundle counts as a proven native-filesystem integration when
every `it.layer` harness it reaches through `const` bindings and preserving Layer
combinators also reaches a `yield* FileSystem.FileSystem` binding, and either the
layer supplies a workspace subject or the callback calls a native-only operation
(`chmod`, `link`, `symlink`, ...). The packet never recorded that PR. A
per-file detector run at the base finds zero EV010 rows in `models-apply-command`,
`models-apply` and `models-catalog`. The later models suites (#1879/#1880/#1881:
`models-exchange-capability`, `models-exchange-recovery`,
`skills-publication-recovery`) have none either.

Two EV010 rows remained in the models tests, both open in the inventory:

- `models-check.test.ts:25` (`@effect/platform-node`)
- `models-locators.test.ts:16` (`@effect/platform-node`)

## Diagnosis

- **`models-check.test.ts`: detector false positive.** The file has three
  `layer(...)` harnesses. Each one provides `NodeServices.layer` to the workspace
  subject (`ModelsCatalogLive`, `ModelsCheckLive`, ... `.pipe(Layer.provide(platform))`),
  so the subject flag holds. The harness at line 102 yields `FileSystem.FileSystem`
  in its own callbacks and is proven. The harnesses at lines 495 and 506 reach the
  real filesystem only through same-file helpers: `runCheck` → `runCheckIn` →
  `stageWorkspace`, which yields `FileSystem.FileSystem` and calls
  `fs.makeTempDirectoryScoped`. The #1899 proof inspected only the callback's own
  descendants, so those two harnesses stayed unproven, and one unproven harness
  makes the whole import opaque. The resource is properly scoped
  (`makeTempDirectoryScoped` under the `it.layer` scope). The test is correct.
- **`models-locators.test.ts`: true opaque residue, not this wave.** The harness
  merges `NodeServices.layer` beside `ModelsLocatorReaderLive`, which reads in-memory
  `ModelsTargetFile` content and never receives the platform. The only filesystem
  use is the cross-module fixture reader `readFixtureText`
  (`./helpers/models-fixtures.ts`), which a syntax-only, per-file detector cannot
  follow. Platform use is real but not the subject, so the row is the ordinary
  "identify the actual services" review that #1875 wave 7 owns. It is left open.
  No exception was added and the test was not changed.

## Detector fix and paired fixtures

`harnessProvesNativeFileSystem` now collects FileSystem evidence from the harness
callback plus every same-file helper it reaches by name, each region visited once
(cycles terminate). A helper is followed only when all of these hold:

- the callee is a bare identifier that resolves lexically to a `function`
  declaration or a `const` binding;
- the binding's value is an arrow or function expression, or `Effect.fn(name)(body)`,
  `Effect.fn(body)` or `Effect.fnUntraced(body)` with no pipeline stages (a stage
  such as `Effect.provide(...)` could replace FileSystem);
- the helper body calls no `Effect.provide`, `provideContext`, `provideService` or
  `provideServiceEffect`.

The subject and native-operation requirements are unchanged. A helper's
`FileSystem` binding proves nothing without a subject unless a native-only
operation is called on that same binding.

Paired fixtures: the new case "follows same-file helpers that read FileSystem in
the harness context" in `packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts`.

- False-positive fixtures, which must now pass (no EV010 row): the models-check
  shape (subject layer, `stageWorkspace` helper); the three-level
  `runCheck` → `runCheckIn` → `stageWorkspace` chain; an `Effect.fn("name")` helper;
  a `function` declaration helper; a subject-less helper calling `fs.symlink`; and a
  self-recursive helper next to a proving one.
- True-positive fixtures, which must still flag
  `platform-resource-provenance-review`: an `Effect.fnUntraced` helper with an
  `Effect.provide(FakeFs.layer)` stage; a helper whose body pipes
  `Effect.provide(FakeFs.layer)`; a `let` helper; an imported helper; a helper
  reached as `helpers.stageWorkspace()`; a helper built by an unknown wrapper
  (`withFakeFileSystem(function* ...)`); a subject-less helper that only reads a
  file; and a proving helper that the callback never calls.

With the repair reverted (`HEAD` detector, new test kept), the case fails a
false-positive assertion. With the repair applied it passes, and all 341 tests in
the detector, contract and four models suites pass on Bun and Node.

## Rows resolved

After the repair: 1,698 findings, `introduced=0 resolved=30` against the committed
inventory, which is the 14 rows already resolved at the base plus 16 resolved by this
repair. All 16 are `platform-resource-provenance-review` rows. In each, a real
filesystem is reached through a same-file helper:

| Package | File | Status before |
| --- | --- | --- |
| `@beep/repo-cli` | `models-check.test.ts` | open |
| `@beep/repo-cli` | `cache-qualification.test.ts` | open |
| `@beep/repo-cli` | `create-package-lab.test.ts` | open |
| `@beep/repo-cli` | `frozen-grant-set.test.ts` | open |
| `@beep/repo-cli` | `graft-cache-sync.test.ts` | open |
| `@beep/repo-cli` | `image-command.test.ts` | open |
| `@beep/repo-cli` | `research-timers.test.ts` | open |
| `@beep/repo-cli` | `run-scope.test.ts` | open |
| `@beep/repo-cli` | `skills-review.test.ts` | open |
| `@beep/tesseract` | `Tesseract.test.ts` | open |
| `@beep/repo-cli` | `cache-dispatch.test.ts` | exception |
| `@beep/repo-cli` | `cache-workflow.test.ts` | exception |
| `@beep/repo-cli` | `labs-list.test.ts` | exception |
| `@beep/repo-cli` | `lint-tsconfig-overlay.test.ts` | exception |
| `@beep/libpff` | `Libpff.pffexport.test.ts` | exception |
| `@beep/tika` | `Tika.tikaapp.test.ts` | exception |

The six exception reasons already said the native filesystem was the intended
subject. The detector now proves what those reviews asserted, so the rows drop out
instead of staying as exceptions.

EV010 after the repair:

| Class | Open | Exception |
| --- | --- | --- |
| `platform-resource-provenance-review` | 107 | 86 |
| `platform-filesystem-candidate` | 44 | 53 |

The inventory was regenerated with its owner command,
`bun run beep lint effect-vitest --write`: 1,728 rows before, 1,698 after, no row
added (S31). The 30 resolved rows drop out. The regeneration also re-keys 66 rows
whose source lines other merged PRs shifted (for example
`PracticeKg.projections.test.ts`, `GraphOperations.test.ts`). Their ids change
with the line, but content, status and exception reasons do not.

## #1875 coordination

The 16 resolved rows come off the EV010 backlog that #1875 wave 7 planned to
migrate after this repair. That backlog is now 290 EV010 rows (151 open, 139
exceptions). `models-locators.test.ts:16` stays in it, along with the other opaque
platform rows whose filesystem use crosses a module boundary. This wave chased no
EV010 row beyond what the classification fix resolved on its own.

## Verification

Run in the lane worktree at base `b7712d0aed` with the change applied:

- Detector, contract and four models suites (`models-apply-command`, `models-apply`,
  `models-catalog`, `models-check`): 341/341 on Bun (`bunx --bun vitest run`) and
  on Node (`bunx vitest run`). After the final refactor, the detector and
  models-check suites pass 239/239 on both runtimes.
- `bun run beep lint effect-vitest`: `introduced=0`. Before regeneration it reported
  `resolved=30`, and against the regenerated inventory `resolved=0`, with 1,698
  findings.
- `lint:schema-first`: introduced=0 on every ratchet.
- `quality effect-diagnostics --filter @beep/repo-cli`: 0 in the changed files. The 4
  `preferEffectArray` errors are inherited from `test/laws-schema-tag-idioms.test.ts`,
  which is unchanged and identical on `origin/main`.
- oxlint and Biome: 0 on the changed files. `lint:retired-effect-paths`: findings=0.
- `quality package-verify @beep/repo-cli`: docgen ok. The audit failed exactly one
  test, `knowledge-doctor-evaluators` "reads the same packets ...". That test
  compares the `HEAD` tree with the live packet manifests, so it fails while this
  lane's `ops/manifest.json` edit is uncommitted. With the `HEAD` manifest
  restored it passes. The failure is environment-only and clears on commit.
  The other 7,118 tests pass.
- `quality fallow audit --check --base origin/main`: exit 0, after extracting
  `appendCalledHelpers` to clear one introduced cognitive-complexity finding.
- JSDoc ratchet (`jsdoc:inventory:check` then `jsdoc:ratchet:check`):
  `increased=0`.
- `lint schema-catalog`: current. `quality catalog-usage`: findings=0.
- `goals doctor`: blocking_new=0, blocking_inherited=0.

## Review round 1 (#1998)

Lane head `83ac6797ae` (main `b11ba93ad1` merged in). Two threads report false
negatives introduced by the helper-following, both in `EffectVitestDetectors.ts`.

- **PRRT_kwDOPbO_N86u91lu (beep-reviewer P2): self-providing helpers.**
  `providesContext` recognized only four effect/Effect provide combinators.
  A shared classifier, `isContextProvider`, now covers both cases.
  `isPublicLayerProvider` (`@beep/test-utils` `provideScopedLayer`) is one of its
  members, so the two cannot drift. The other members are every provide and update
  combinator declared in the installed `node_modules/effect/dist/Effect.d.ts`:
  `provide`, `provideContext`, `provideService`, `provideServiceEffect`,
  `updateContext`, `updateService` and `updateServiceScoped`. A helper that calls
  any of them is not followed.
- **PRRT_kwDOPbO_N86u9008 (CodeRabbit Major): providers at the call site.**
  `appendCalledHelpers` now checks each call site before following it
  (`wrappedByProvider`). It walks the call's ancestors up to the enclosing region
  (the test callback or the calling helper). The helper is not followed if the call
  sits in an argument of a provider, or in the input of a `.pipe(...)`/`pipe(...)`
  that has a provider stage, including the curried `provideService(key)(value)`
  stage. `updateServiceScoped` rewrites the rest of its scope, so a region
  containing one follows no helpers at all. Such call sites stay flagged for review.
- **Service-keyed exemption, to keep the stricter rule from re-opening true native
  rows.** On the first rescan the conservative rule re-opened four wave-1 rows:
  `create-package-lab`, `frozen-grant-set`, `labs-list` and `lint-tsconfig-overlay`.
  In each, the helper call is piped through
  `Effect.provideServiceEffect(Console.Console, TestConsole.make)`, which replaces
  only `Console`. Those would have been false positives again. A
  `provideService`/`provideServiceEffect`/`updateService`/`updateServiceScoped`
  call therefore counts as replacing FileSystem unless its key is an imported tag
  that provably names another service: not from `effect/FileSystem`, not imported as
  `FileSystem`, and not a `.FileSystem` member. Local aliases, unresolved keys and
  every whole-context provider still count as replacing it. With the exemption,
  no wave-1 row re-opens. The scan gives 1,698 findings, `introduced=0
  resolved=0`, and the inventory is unchanged.

Paired fixtures, added to "follows same-file helpers that read FileSystem in the
harness context":

- Still flagged, and each one returned `[]` (unflagged) against the round-0 detector
  at `HEAD`: a self-providing helper using `provideScopedLayer`; a self-providing
  helper using `updateService`; `Effect.provideService(helper(), FileSystem.FileSystem, fake)`;
  `helper().pipe(Effect.provide(FakeLayer))`;
  `pipe(helper(), Effect.updateContext(...))`; and `Effect.provide(Effect.map(helper(), f), FakeLayer)`.
- Still flagged by the key rule: curried `provideService(FileSystem.FileSystem)(fake)`,
  a local alias key `const Fs = FileSystem.FileSystem`, and a preceding
  `yield* Effect.updateServiceScoped(FileSystem.FileSystem, ...)`.
- Still passing: the six original shapes, including models-check, plus three
  Console-keyed providers (piped `provideServiceEffect`, data-first
  `provideService`, and a helper that provides Console itself).

Verification, each run alone through beep-heavy with `</dev/null`:

- Detector, contract and four models suites: 341/341 on Bun and on Node.
- `lint effect-vitest`: 1,698 findings, introduced=0, resolved=0.
- `lint:schema-first`: introduced=0.
- `quality effect-diagnostics --filter @beep/repo-cli`: 0 in the changed files, plus
  the same four inherited `preferEffectArray` errors in `test/laws-schema-tag-idioms.test.ts`.
- oxlint and Biome: 0 on the changed files.
- `quality fallow audit --check --base origin/main`: exit 0.
- `lint schema-catalog`: current. `quality catalog-usage`: findings=0.
- `lint:retired-effect-paths`: findings=0.
- `goals doctor`: 0 blocking.
- `quality package-verify @beep/repo-cli`: audit ok, docgen ok.
- JSDoc ratchet: one total increased, `unsafeExampleFindings` from 0 to 1. The cause is
  `decideLicense` in `src/commands/Ci/DependencyReview.ts`
  (`no-type-assertions-in-examples`). That file came from main in #1991 and is
  identical on `origin/main`, so the finding is inherited and not from this lane.
  This lane's changes add no JSDoc.

## Review round 2 (#1998)

Lane head `ce815f2419`. There are two beep-reviewer P2 threads, both in `EffectVitestDetectors.ts`.

- **PRRT_kwDOPbO_N86u_U2k: `setContext` was missing.** I re-read the installed
  `node_modules/effect/dist/Effect.d.ts`. Every exported combinator that provides,
  sets or replaces services or the context is now in the shared classifier.
  The whole-context ones are `provide`, `provideContext`, `setContext` and
  `updateContext`. The service-keyed ones are `provideService`,
  `provideServiceEffect`, `updateService` and `updateServiceScoped`. The
  `@beep/test-utils` `provideScopedLayer` is also included. The `with*` family
  (`withTracer`, `withLogger`, `withParentSpan`, `withSpan`, `withFiber` and the
  others) installs only tracing, logging or fiber references, never an arbitrary
  service, so it is not in the list. `context`, `contextWith`, `service` and
  `serviceOption` only read the context.
- **PRRT_kwDOPbO_N86u_U2a: providers applied through a local binding.**
  `boundValueSafe` follows the helper call's value. The value can pass through
  `yield*`, parentheses, array literals, effect/Effect namespace calls
  (`Effect.map(program, f)`) and `.pipe` calls without a provider stage. Then:
  - A `const` binding of the unrun effect is safe only if every reference resolves
    through the detector's lexical resolver (`bindingReferences`). No reference may
    sit under a provider (`wrappedByProvider`, curried forms included), and each
    must flow to a native run: `yield*`, a discarded statement, a return to the
    region itself or to a test registration callback, or another `const` checked
    the same way.
  - A `let` binding, a destructured binding, passing the effect to an unknown
    function, returning it from a nested function, or storing it in an object, a
    spread or an assignment keeps the helper unfollowed. Its call site then stays
    flagged.
  - A `yield*` result binding (`const workspace = yield* stageWorkspace()`) means
    the helper already ran in the caller's context. It is unsafe only when one of
    its references is placed under a provider. Destructured results stay safe.
    This keeps the models-check shape (`const { report } = yield* runCheckIn(...)`)
    proven.
  - The call-site checks now run only for calls that resolve to a followable
    helper. This keeps the full scan near its previous time: about 26 s, versus 136
    s when every call was checked.

Paired fixtures, added to "follows same-file helpers that read FileSystem in the
harness context". I wrote them first. Each still-flagged fixture below returned
unflagged against the round-1 detector at `ce815f2419`:

- Binding then piped provider: `const program = stageWorkspace(); yield* program.pipe(Fx.provide(FakeLayer))`.
- Binding passed to a provider: `yield* Fx.provide(program, FakeLayer)`.
- Binding through a curried provider: `program.pipe(Fx.provideService(FileSystem.FileSystem)(fakeFs))`.
- A self-providing helper that ends with `.pipe(Fx.setContext(fakeContext))`.
- A call site wrapped as `Fx.setContext(stageWorkspace(), fakeContext)`.
- Extra conservative shapes: a binding mapped and then provided; an escape to an
  unknown function; a `let` binding; a destructured array; an object property
  provided later; a `yield*` result passed to `Fx.provide`; and a binding returned
  through a nested `wrap` function that is then provided.

Still passing:

- the six original shapes, models-check included;
- the three Console-keyed shapes;
- a binding run with `yield* program` and with `yield* (program)`;
- a binding mapped and then run;
- a binding wrapped only by `provideServiceEffect(Console.Console, ...)`;
- a `yield*` result logged, and a destructured `yield*` result;
- a helper that binds the effect and returns it to its caller.

Verification, each run alone through beep-heavy with `</dev/null`:

- Detector, contract and four models suites: 341/341 on Bun and 341/341 on Node.
- `lint effect-vitest`: 1,698 findings, introduced=0, resolved=0. Rows are unchanged
  and no wave-1 row re-opened.
- `lint:schema-first`: introduced=0.
- `quality effect-diagnostics --filter @beep/repo-cli`: 0 in changed files. The same
  four errors as before remain in `test/laws-schema-tag-idioms.test.ts`, inherited.
- oxlint and Biome: 0 on changed files.
- `quality fallow audit --check --base origin/main`: exit 0. I split `carriedBy`
  (`pipeCarrier`, `effectCallCarries`) and `boundValueSafe` (`valueStep`) to clear
  two introduced complexity findings.
- `lint schema-catalog`: current. `quality catalog-usage`: findings=0.
  `lint:retired-effect-paths`: findings=0.
- JSDoc ratchet: still +1. It is the inherited `decideLicense` finding from #1991,
  which #2004 fixes on main.

## Review round 3 (#1998)

Lane head `6012829f38`.

- **PRRT_kwDOPbO_N86u_uvJ (P1, build break).** Round 2 passed `bindingReferences`
  results (`Identifier`) to `wrappedByProvider` and `pipesThroughProvider`, which
  took a `CallExpression`. Both only use `getAncestors()` and `containsNode`, so the
  node parameter is now `MorphNode`. The round-2 verification missed this because
  the Bun test run strips types and effect-diagnostics reports only Effect rules.
  - At `HEAD`, `tsc-rs -p tsconfig.check.json` fails with TS2740 at lines 1082 and 1093.
  - With the fix, `bun run check` (`tsc-rs` over `tsconfig.check.json` and
    `scripts/tsconfig.json`) exits 0 with 0 errors.
  - The test overlay (`tsc-rs -p test/tsconfig.json`) has one error, TS2345 at
    `test/ci-dependency-review.test.ts:157`. It is inherited from #1991:
    `src/commands/Ci/DependencyReview.ts` and that test are identical on
    `origin/main` `26bc04db92`, and this lane does not touch them.
  - The dependency dists were rebuilt first with
    `bunx turbo run build --filter=@beep/repo-cli^...` (49 tasks, all successful).
- **PRRT_kwDOPbO_N86u_uvR (P2): inline unknown wrappers.** When a helper call's
  value reaches neither `yield*` nor a binding, `boundValueSafe` now applies
  `flowsToNativeRun`, the same rule as the binding path. A helper call passed
  inline to an unknown function therefore stays unfollowed. The same applies to an
  object property, a spread or an assignment, which replaces the ad hoc
  `isEscapeSite` check. New still-flagged fixtures:
  - `yield* withFakeFs(stageWorkspace())`
  - `yield* runElsewhere(stageWorkspace())`
  - `yield* runElsewhere(Fx.map(stageWorkspace(), f))`

  All three were unflagged at `6012829f38` and flag now. All 16 passing and 32
  flagged shapes in the case hold, models-check included.

Verification, each run alone through beep-heavy with `</dev/null`:

- Typed `bun run check`: 0 errors.
- Detector, contract and four models suites: 341/341 on Bun and 341/341 on Node.
- `lint effect-vitest`: 1,698 findings, introduced=0, resolved=0, scan 26.1 s
  (detect 25.9 s). Rows are unchanged and none re-opened.
- `lint:schema-first`: introduced=0.
- effect-diagnostics: 0 in changed files, plus the four inherited errors in
  `test/laws-schema-tag-idioms.test.ts`.
- oxlint and Biome: 0 on changed files.
- `quality fallow audit --check --base origin/main`: exit 0.

Route: S39/S41 Claude chain, `claude-opus-5-5` Agent child (step 1), no fallback.

## Reversal

Revert the PR. That restores the callback-only proof, removes the fixture case, and
returns the inventory to its previous rows: the 16 rows come back with their original
status and exception reasons. No baseline, exception or schema change is involved.
