# #1855 detector repairs wave 2: mechanical false-positive classes

Lane `residue-detectors`, branch `feat/residue-detectors-wave2`, fast-forwarded to
`main` `74d3625ad0` (which includes wave 1, #1998, and #2027). Class definitions come
from [goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-detector-false-positives.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/research/sweeps/2026-10-09/B-detector-false-positives.md)
section 2. FP-7 was closed as removed in `stage-4-detectors.md`. Detectors:
`packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts` and
`Lint/internal/SchemaFirstArbitraryCoverage.ts`.

## Fresh measurement at `74d3625ad0`

`bun run beep lint effect-vitest` scans 2,155 files and reports 1,694 findings,
`introduced=0 resolved=4`. The committed inventory holds 1,698 rows. The 4 rows were
already fixed on main by other PRs: 3 in
`packages/foundation/modeling/utils/test/Glob.test.ts` (EV003 exception, EV010 open,
EV010 exception) and the EV011 open row `test/corpus-command.test.ts:78`.
`lint:schema-first` reports 310 live entries, 0 stale and 0 missing.

Counts have moved since the 2026-10-09 sweep:

| Class | Sweep (exc / open) | At `74d3625ad0` (exc / open) |
| --- | --- | --- |
| FP-3 EV011 `vi`-only import | 16 / 4 | 1 / 0 (6 open rows import `describe`/`expect`/`it`) |
| FP-1 EV014 `it.layer((Node\|Bun)*.layer…)` | 125 / 10 | 97 / 12, plus platform layers reached through merges and `const` bindings |
| FP-4 EV006 canonical `assertTrue`/`assertFalse` | 4 | 4 / 11 (4 exc, 3 open compound; 8 open piped predicates) |
| FP-5 SFV4-arbitrary-tests | 32 | 36 exc (4 support modules, 5 `S.Unknown` plumbing) |

## FP-3 (EV011): already repaired; last exception retired at the source

#1928 (`426d494b34`, 2026-10-20) already made a `vi`-only `vitest` import silent when
the file uses it for `vi.mock`/`vi.hoisted`. That PR's paired fixtures deliberately keep
`import { vi } from "vitest"; vi.fn();` flagged, because `@effect/vitest` re-exports
`vi` (`export * from "vitest"`) and only the mock hoister needs the direct import. All
16 sweep exceptions were already gone. The detector is unchanged: widening it to every
`vi`-only import would quietly reverse #1928's ruling.

The one remaining exception, `packages/ontology/client/test/Session.atoms.test.ts:53`,
uses `vi.stubGlobal`/`vi.unstubAllGlobals` at runtime, with no hoisting. Under the
#1928 rule it is a true positive. The test now takes `vi` from `@effect/vitest`; that
suite passes 10/10 on Bun and Node. The row and its exception are gone.
`docs/runbooks/xstate-effect-statecharts.md` said such files "carry a reviewed row",
which has been stale since #1928; it now states the exemption.

Fixture added to "permits only the direct vi import required by Vitest mock hoisting":
the positive `import { describe, expect } from "vitest"` still flags. The existing
negatives (`vi.mock`, aliased `vi.hoisted`) and positives (`vi.fn`, `vi` beside `it`,
shadowed `vi`, namespace import) are unchanged.

## FP-1 (EV014): platform service layers

`detectLayerTimeout` now asks `isAcquisitionFreeLayer` instead of `isPureStubLayer`. Both
are built by one `layerComposedOf(leaf)` walker, which keeps the old merge/mergeAll and
`const` initializer recursion. The new leaf `isPlatformServiceLayer` accepts `.layer`
of `{Node,Bun}{Services,FileSystem,Path,Crypto,ChildProcessSpawner,Stdio,Terminal}`.
Provenance must resolve to `@effect/platform-node`/`@effect/platform-bun`: either the
root namespace (`Platform.NodeServices.layer`), a named root import, or the
`/<Module>` subpath. These layers build in-process services and acquire nothing
external. EV002 still uses `isPureStubLayer`, so its behavior does not change.

Paired fixtures ("permits platform service layers without a hook timeout and keeps
resource layers judged"). Written first, all failed against `74d3625ad0`:

- Silent: `it.layer(NodeServices.layer)`, the `{ excludeTestServices: true }` variant,
  bare `layer(NodeServices.layer)`, `BunFileSystem`, `BunServices`, `BunCrypto`,
  `L.mergeAll(NodeCrypto.layer, NodeFileSystem.layer, NodePath.layer)` from the root
  import, `Platform.NodeServices.layer`, `const platform = NodeServices.layer`, and
  `L.merge(BunPath.layer, L.succeed(A, {}))`.
- Still judged: `it.layer(L.scoped(Service, acquire))`, an unimported
  `NodeServices.layer` (the existing lookalike case is also kept), a `@beep/fake/NodeServices`
  import, `NodeHttpServer.layer`, a merge with `ImportedLive`,
  `L.provide(ImportedLive, NodeServices.layer)`, `NodeServices.other`, and a shadowed
  `NodeServices` parameter.

**Named-test-layer subclass, reported separately.** The repair resolves 6 of these
rows through deterministic same-file `const` bindings whose operands are all stub or
platform layers: `TestLayer` ×3, `platform` ×2, `PathSafetyTestLayer` and
`CommandTestLayer`. 142 named-test-layer rows remain (138 exceptions, 4 open):
`testLayer`, `TestLayer`, `makeTestLayer(...)`, `CliRecorderTest`,
`Layer.fresh(...TestLayer)` and the like. Their definitions are `Layer.effect`/`scoped`
bodies, factory functions or imports, which no same-file resolution proves free of
acquisition. They stay for individual review in wave 3.

## FP-4 (EV006): canonical Boolean assertions

`detectBooleanDataShape` now skips `isCanonicalBooleanForm` through a new
`isReviewableBooleanAssertion` predicate. The form is a provenance-checked
`utils.assertTrue`/`utils.assertFalse` (from `@effect/vitest/utils`) whose argument is one
of:

- a `&&`/`||` compound, optionally parenthesized. No single structural primitive
  states a conjunction, so the Boolean helper is already the recommended form.
- a piped `is*` predicate (`value.pipe(O.isSome)`, `pipe(value, R.isFailure)`) whose
  `predicateAssertionReplacement` is that same helper. These are the 8 open
  `drawings-review`, `FileSystem` and `goals-bootstrap-plan` rows. The detector already
  accepts the direct call form `assertTrue(O.isSome(value))`; only the pipe spelling
  was missed.

Paired fixtures ("accepts canonical Boolean assertions over compound and piped
predicates"). Written first, the case failed against `74d3625ad0`:

- Silent: `assertTrue(ready && O.isSome(value))`, the decoded-success conjunction, the
  dock-react `result.kind === "populated" && O.isNone(...)`, a parenthesized `||`,
  `assertFalse(O.isSome(value) && ready)`, `value.pipe(O.isSome)`,
  `decode(input).pipe(R.isFailure)`, `pipe(value, O.isSome)` and
  `assertFalse(value.pipe(O.isNone))`.
- Still flagged, each with its exact primitive:
  - `expect(O.isSome(value)).toBe(true)` → `utils.assertTrue`
  - `expect(ready && O.isSome(value)).toBe(true)` → `utils.deepStrictEqual`
  - `assertTrue(!O.isSome(value))` → `utils.deepStrictEqual`
  - `assertTrue(value.pipe(O.map(f)))` → `utils.deepStrictEqual`
- Also still flagged: `assertTrue(value.pipe(O.isNone))` and
  `assertFalse(value.pipe(O.isSome))` (absence asserts belong to `assertNone`), and
  vitest `assert.isTrue(ready && O.isSome(value))`.

## FP-5 (SFV4-arbitrary-tests)

- **(a) Only test entry files count.** `TEST_FILE_PATTERN` changed from
  `/test/|/tests/|.test.tsx?|.spec.tsx?` to `\.(?:test|spec)\.tsx?$`. Harnesses,
  fixtures and executable peers under `test/` assert nothing themselves. `.spec` files
  keep counting, since they are test entries too.
- **(b) `S.Unknown` plumbing does not count.** A codec call whose single argument is
  `S.Unknown`, `S.fromJsonString(S.Unknown)` (nesting allowed, namespace `S` or
  `Schema`) or a same-file `const` alias of one is left out of the threshold count.
  `let` aliases still count. The row stays anchored at the first codec call of any
  kind. The first rescan anchored at the first counted call instead, which re-keyed
  `AgentMessage.command.test.ts` from line 42 into a stale-plus-missing pair (an
  exception about to become an open row). Anchoring on any codec call keeps every
  existing key stable.

Paired fixtures in `test/lint-command.test.ts`, beside the existing arbitrary-tests
cases. Written first, the three negative/count cases failed against `74d3625ad0`:

- Silent: three support modules (`test/support/harness.ts`, `test/fixtures/process.ts`,
  `test/fixture.ts`) with three codec calls each; and a `.test.ts` with two concrete
  codecs plus four `S.Unknown` plumbing calls (inline, nested and `const` alias).
- Still reported: a `Harness.test.tsx` with three codecs, and a `.test.ts` whose
  `S.fromJsonString(Worker)`, `let`-alias and `encodeEffect(Worker)` calls give exactly
  "3 Schema codec assertions" beside one excluded plumbing call.

## Rows and exceptions retired

Each inventory was regenerated with its owner command. Rows are paired by
`(ruleId, file, symbol, occurrence)`, because effect-vitest ids embed line numbers that
other merged PRs shifted. Two `Floating.test.tsx` rows share one occurrence and are counted
separately.

`bun run beep lint effect-vitest --write`: 1,698 rows before, 1,552 after. 146 rows
were removed and **0 were added**. 0 rows changed status. Three rows show only
occurrence or evidence drift from main source edits. The rescan reports
`introduced=0 resolved=0`.

| Source | Exceptions retired | Open rows retired |
| --- | --- | --- |
| FP-1 EV014 platform layers (incl. 6 named same-file layers) | 103 | 23 |
| FP-4 EV006 compound / piped canonical assertions | 4 | 11 |
| FP-3 EV011 `Session.atoms.test.ts` source fix | 1 | 0 |
| Inherited, fixed on main before this lane (Glob, corpus-command) | 2 | 2 |
| **Total** | **110** | **36** |

Remaining after the wave: EV011 is 0 exc / 5 open. Every open row imports
registration or assertion APIs, which the rule correctly flags. EV014 is 240 exc / 12
open, EV006 73 / 76.

`bun run beep lint schema-first --write`: 310 entries before, 301 after. 9
`SFV4-arbitrary-tests` exceptions retired and **0 added**: 4 by (a), namely
`ontology-mcp-harness.ts`, `managed-claude-peer.ts`, `law-practice/server/test/fixture.ts`
and `fixtures/agent-message/process.ts`, and 5 by (b), namely `ci-lane`,
`corpus-preservation`, `coverage-turbo-inputs`, `effect-imports` and
`yeet-inbox-hook-adapter`. The rescan reports 301 live, 0 stale, 0 missing.

No exception, baseline or inventory row was added (S31). Exceptions that no longer
match a finding drop out with their rows, so none is left dead.

## FP-2 and FP-6: recommended rulings (not changed in this wave)

**FP-2, EV003 per-invocation temp-directory wrappers. Recommend: exempt fresh-root
wrappers, a true false positive.** At `74d3625ad0` the `withTemp*`/`inTemp*` symbols
hold 187 exceptions and 15 open rows (`withTempDirectory` 96, `inTempRepo` 57,
`withTempCwd` 22, `withTempFixture` 20, `inTempCheckout` 4, `withTempRepo` 3). All 202
are `mechanization: detector`, and they are 93% exceptioned. EV003's replacement,
sharing through `it.layer`, would put every case on one temp root. That breaks the
per-case isolation these tests exist to prove, and the exception reasons repeat that
point. Recommended repair: EV003 stays silent for an `acquireUseRelease`/`acquireRelease`
wrapper whose acquire creates a fresh temp root per call
(`makeTempDirectory*`/`mkdtemp`) and whose release removes it. A wrapper that
re-acquires a suite-shareable, read-only resource per test still flags. Paired
fixtures: a per-call temp dir is silent; a re-acquired shared read-only fixture flags.
Expected effect is about 200 rows, an upper bound to re-measure.

**FP-6, effect-laws `new-map-set` and `Weak*`. Recommend: split out a
`weak-collection` kind and do not drop `Weak*`.**
`MAP_SET_CTORS = ["Map", "Set", "WeakMap", "WeakSet"]` (`Laws/NoNativeRuntime.ts:69`)
holds 14 `new-map-set` allowlist entries, and 9 of them justify weak identity. Effect
has no weak collections, so `HashMap`/`MutableHashMap` cannot be the replacement and
the current message is wrong for those sites. Dropping `Weak*` silently would also lose
the review of identity-keyed caches, which can leak semantics: weak keys hide
lifetimes. A separate `weak-collection` kind with its own message ("document the
identity/GC reason") keeps that review and lets `new-map-set` mean what it says.
Paired fixtures: `new WeakMap()` reports `weak-collection`, `new Map()` reports
`new-map-set`. The same review applies to the 10 `object-method` entries
(`Object.freeze`/`Object.create(null)`). Before editing the allowlist, notify the
effected-port session.

## Dead-code deletion

Out of scope: the coordinator moved brief item 8 (the `PublicationLedger.ts` unused export
from #1984) to a separate follow-up PR. This lane does not touch `PublicationLedger.ts`
or the Skills publication files.

## Verification

At `74d3625ad0` with the change applied. Each run was alone through beep-heavy with
`</dev/null`, and the dependency dists were rebuilt first
(`bunx turbo run build --filter=@beep/repo-cli^...`, 50/50 tasks).

- Typed check in `packages/tooling/tool/cli`: `bun run check` (`tsc-rs` over
  `tsconfig.check.json` and `scripts/tsconfig.json`) exits 0. `bunx tsc-rs -p
  test/tsconfig.json --noEmit` exits 0 with 0 errors. The two `ci-lane-timings`
  errors the brief expected from #2008 are no longer present on this base.
- Suites: detector, contract, primitives, lint-command, schema-first,
  schema-first-arbitrary-coverage and the nine `models-*` suites (15 files) pass
  566/566 on Bun (`bunx --bun vitest run`) and 566/566 on Node (`bunx vitest run`),
  re-run after the final refactor. `Session.atoms.test.ts` passes 10/10 on both
  runtimes.
- `lint effect-vitest`: 1,552 findings, introduced=0, resolved=0.
  `lint:schema-first`: 301 live, 0 stale, 0 missing, every ratchet introduced=0.
- `quality effect-diagnostics --filter @beep/repo-cli`: 0 errors, 0 warnings in all three
  programs.
- oxlint and Biome: 0 on the changed files.
- `quality fallow audit --base origin/main --check`: exit 0. The first run found two
  introduced complexity findings (`detectBooleanDataShape`,
  `sourceUnknownSchemaAliases`). Extracting `isReviewableBooleanAssertion` and folding the
  alias walk into `A.reduce` cleared both.
- JSDoc: `jsdoc:inventory:check` ok; `jsdoc:ratchet:check` reports `increased=0`. It
  also suggests tightening 3 totals; those decreases come from main, since this lane
  adds no JSDoc.
- `lint schema-catalog`: current. `quality catalog-usage`: findings=0.
  `lint:retired-effect-paths`: findings=0. `goals doctor`: blocking_new=0,
  blocking_inherited=0.
- `quality package-verify @beep/repo-cli`: 7,401 of 7,402 tests pass. The one failure,
  `knowledge-doctor-evaluators` "reads the same packets ...", compares the `HEAD` tree
  with the live packet manifests. It fails only while this lane's `ops/manifest.json`
  edit is uncommitted, and passes 14/14 with the `HEAD` manifest. It is
  environment-only and clears on commit, as in wave 1.
  `beep docgen check --package @beep/repo-cli`: OK.
- The final effect-vitest rescan counted 2,159 files instead of 2,155 because the
  gitignored test-kit dists were rebuilt. Findings are unchanged.

Route: S39/S41 Claude chain, `claude-opus-5-5` Agent child (step 1), no fallback.

## Reversal

Revert the PR. That restores the old `isPureStubLayer` EV014 gate, the EV006 Boolean
path, the `/test/` arbitrary-tests scope and the full codec count. It also restores the
`vitest` `vi` import in `Session.atoms.test.ts` and the runbook line, and returns both
inventories to their previous rows with their original status and exception reasons. No
baseline or schema change is involved.
