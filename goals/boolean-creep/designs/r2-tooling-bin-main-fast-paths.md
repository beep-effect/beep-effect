# r2-tooling-bin-main-fast-paths

P2 at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Tier1 internal dispatch; independent P3 and implementation pending.

## Current shape

Live declarations at `packages/tooling/tool/cli/src/bin-main.ts:225` and `:246`:

```ts
let handledByQualityFastPath = false;
let handledByCiFastPath = false;
```

The corresponding live write/read statements are at lines 232, 248–249, and 272:

```ts
handledByQualityFastPath = true;
if (!handledByQualityFastPath && canUseCiFastPath(argv)) {
  handledByCiFastPath = true;
}

if (!handledByQualityFastPath && !handledByCiFastPath) {
```

The same dispatch domain is also projected one step upstream by
`canUseQualityTaskFastPath` at line 87 and `canUseCiFastPath` at line 90. Their
argv-head domains are disjoint, and the ordered reader at line 227/248 maps
them to the same `quality | ci | none` decision as the stored flags. The Round
19 residue hit for those predicates is therefore part of this opportunity,
not a second implementation record.

## Cardinality gap

Two booleans represent four combinations. Three are legal: `none`, `quality`, and `ci`. `quality && ci` is unreachable by explicit gated writer248, not merely absent
from fixtures. These are private consumed-route bits, not user-facing independent
preferences. Classification introduces tentative quality selection; parser None
returns to none before full-tree execution. It does not add a fourth final route.

## Target schema

Introduce the private payload-free domain with `LiteralKit`, classify argv once, and
keep one mutable dispatch value because top-level execution crosses
dynamic-import/`await` boundaries. Preserve the defensive fallthrough when the
quality parser unexpectedly returns `None`:

```ts
const { LiteralKit } = await import("@beep/schema/LiteralKit")

const FastPathDispatch = LiteralKit(["none", "quality", "ci"])
type FastPathDispatch = typeof FastPathDispatch.Type

const fastPathDispatchFromArgv = (argv: ReadonlyArray<string>): FastPathDispatch =>
  isQualityTaskName(argv[0]) &&
  !hasRootCliGlobalFlag(argv) &&
  !(argv[0] === "lint" && isLintPolicySubcommand(argv[1]))
    ? FastPathDispatch.Enum.quality
    : argv[0] === "ci" && !hasRootCliGlobalFlag(argv)
      ? FastPathDispatch.Enum.ci
      : FastPathDispatch.Enum.none

let fastPathDispatch = fastPathDispatchFromArgv(argv)

if (FastPathDispatch.is.quality(fastPathDispatch)) {
  const { parseQualityTaskInvocation, runQualityTask } = await import("./commands/Quality/Tasks.ts")
  const qualityTaskInvocation = parseQualityTaskInvocation(argv)

  if (O.isSome(qualityTaskInvocation)) {
    // ...run quality program...
  } else {
    fastPathDispatch = FastPathDispatch.Enum.none
  }
}

if (FastPathDispatch.is.ci(fastPathDispatch)) {
  // ...run CI program...
}

if (FastPathDispatch.is.none(fastPathDispatch)) {
  // ...run default command tree...
}
```

The sketch expresses dispatch, not a complete compiled implementation. Apply
repo-required schema annotations/helper preservation without introducing an eager
root schema/identity import before the no-op boundary. Use generated LiteralKit
helpers; no ad-hoc string union or Boolean reconstruction.

Load `LiteralKit` dynamically from the narrow
`@beep/schema/LiteralKit` subpath only after the protected
`fastLintFixNoop` exit boundary. The protected module-load set before that
boundary remains byte-for-byte unchanged. The startup-contract test must bind
the new post-boundary narrow load and reject a root `@beep/schema` load.

Keep `rawArgv` and every load through the `fastLintFixNoop` exit at lines
11-74 unchanged. Classify the sliced `argv` created at line 112, matching
the current predicates. If the quality predicate wins but
`parseQualityTaskInvocation` returns `None`, reset to `none` so the full command
tree still runs.

## Migration inventory

- `packages/tooling/tool/cli/src/bin-main.ts:225` — replace
  `handledByQualityFastPath` with mutable `fastPathDispatch` initialized from
  the one argv classifier.
- `packages/tooling/tool/cli/src/bin-main.ts:76-90` — dynamically load the narrow
  `LiteralKit` subpath after the protected no-op boundary, replace both
  `canUse*FastPath` boolean predicates with one `fastPathDispatchFromArgv`
  classifier, and preserve all current quality-task, lint-policy, CI, and
  root-global-flag precedence.
- `packages/foundation/modeling/schema/package.json:210` — the existing
  `@beep/schema/LiteralKit` export proves the narrow dynamic-import path. No
  package export edit is required.
- `packages/tooling/tool/cli/src/bin-main.ts:225-244` — replace
  `handledByQualityFastPath` with the classifier result, dispatch the quality
  case through the literal guard, and reset to `none` only if the existing
  parser returns `None` so the defensive full-tree fallback remains intact.
- `packages/tooling/tool/cli/src/bin-main.ts:246` — delete the second boolean declaration.
- `packages/tooling/tool/cli/src/bin-main.ts:248-249` — guard CI directly with
  the `ci` literal; preserve the `FsUtilsLive` CI layer at lines 250-260.
- `packages/tooling/tool/cli/src/bin-main.ts:272` — dispatch the full command tree only when the literal remains `none`.

Preserve runRepoCliMain176-214 and its current failure/teardown machinery:
render failure, restore terminal, defaultTeardown, drain process streams, fallback
write diagnostic, onExit and process.exit. Do not restore historical runner code
or alter non-awaited dispatch execution. A handled route remains handled even
when its program fails; failure is not permission to run the full command tree.
Thrown/rejected module imports and parser exceptions retain existing behavior;
only actual parser None resets the route.

Quality Tasks.ts3677-3701 preserves its complete invocation payload: task, parsed
args and lint-only fix. Existing bypass flags and lint-policy detection may return
None. Keep the original argv array (including arbitrary argument strings/order)
and runQualityTask inputs, BaseLayers scope and Console service. CI retains its
minimal Command root/version/description, CiLayers with FsUtilsLive and scoped
execution. Default272-293 retains parallel imports of repo-utils, unstable/cli,
Root and QualityScheduler; DerivedLayers includes FsUtilsLive, TSMorphServiceLive
and MemoryStatsLive, merged with BaseLayers. Do not hoist these heavy imports.

The exact whole-repo search found no other reads or writes of either stored
member or either canUse*FastPath predicate. The top-level module is executable,
not a reusable exported service; no barrel or serialized caller owns the state.
Do not import bin-main into unit tests merely to reach the classifier.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/bin-main.ts:87-90` — delete both sibling
  boolean route predicates and their repeated root-global-flag checks; one
  classifier returns the honest dispatch literal.
- `packages/tooling/tool/cli/src/bin-main.ts:248` — delete the boolean exclusion guard that manually prevents the quality/CI combined state.
- `packages/tooling/tool/cli/src/bin-main.ts:272` — delete the two-boolean default-dispatch conjunction; one derived literal guard replaces it.

## Encoded-side impact

none (internal). The dispatch is local process state and is never encoded.

Preserve accepted argv behavior for quality task heads, the lint-policy
exception, `ci`, root-global flags in any position, unknown/default commands,
and the defensive quality-parser `None` fallback. Root globals include exact names and name=value forms anywhere, as implemented
by isRootCliGlobalFlag82-83; preserve behavior even following an argument separator.
No argv trimming, consumption or normalization is introduced. Quality heads are
build/check/test/lint/audit/coverage, with lint policy second-token exception;
ci is disjoint. Empty/unknown heads reach the full tree. The separate rawArgv
lint --fix exact2-token shortcut and its git-failure/dirty-work fallback remain
unchanged. Only dispatch representation changes.

## Test impact

- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:210-215` — keep the protected pre-`fastLintFixNoop` module-load expectation byte-for-byte; `@beep/schema/LiteralKit` must not be added to this set.
- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:217` onward — add a separate post-boundary source-order assertion that binds `import():@beep/schema/LiteralKit` after `fastLintFixNoop` exits and before `FastPathDispatch` is constructed.
- Add a focused source assertion in the same test that `FastPathDispatch` has exactly `none | quality | ci`; there is no directly importable runtime unit for `bin-main.ts` because importing it executes the CLI.
- Exercise `quality`, `ci`, and full-tree/default routing plus the defensive
  quality-parser `None` fallback; assert the two former boolean route helpers
  are absent.

## Risk

This entrypoint is startup-sensitive. The target is exact: use the narrow
post-boundary dynamic import; do not relocate the kit or weaken the protected
allowlist. Land source and import-contract test together, exercise quality,
CI, and default routing, and record before/after cold-start time and peak RSS
for the no-op boundary and representative post-boundary invocations. This P2
runs no CLI process or timing benchmark. Implementation uses fixture/stubbed
entrypoint execution to cover parser None without launching real quality work
solely as a route test; retain all current tests. Run focused routing/startup
checks and `bun run beep quality package-verify @beep/repo-cli`, followed by
campaign/Yeet requirements. Coordinate shared entrypoint edits; no P3 credit.
