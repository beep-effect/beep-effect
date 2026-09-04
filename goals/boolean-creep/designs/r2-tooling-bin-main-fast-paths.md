## Instance

- id: `r2-tooling-bin-main-fast-paths`
- file:line: `packages/tooling/tool/cli/src/bin-main.ts:197`
- symbol: `handledByQualityFastPath`
- members: `handledByQualityFastPath`, `handledByCiFastPath`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/bin-main.ts:220`: CI flag is only written true behind !handledByQualityFastPath; both-true is never assigned.
  - E2 — `packages/tooling/tool/cli/src/bin-main.ts:244`: Default CLI runs only when both flags are false; combined-true is not a handled dispatch.

## Current shape

Live declarations at `packages/tooling/tool/cli/src/bin-main.ts:197` and `:218`:

```ts
let handledByQualityFastPath = false;
let handledByCiFastPath = false;
```

The corresponding live write/read statements are at lines 204, 220–221, and 244:

```ts
handledByQualityFastPath = true;
if (!handledByQualityFastPath && canUseCiFastPath(argv)) {
  handledByCiFastPath = true;
}

if (!handledByQualityFastPath && !handledByCiFastPath) {
```

The same dispatch domain is also projected one step upstream by
`canUseQualityTaskFastPath` at line 87 and `canUseCiFastPath` at line 90. Their
argv-head domains are disjoint, and the ordered reader at line 199/220 maps
them to the same `quality | ci | none` decision as the stored flags. The Round
19 residue hit for those predicates is therefore part of this opportunity,
not a second implementation record.

## Cardinality gap

Two booleans represent four combinations. Three are legal: `none`, `quality`, and `ci`. `quality && ci` is illegal because one argv dispatch can be consumed by at most one fast path.

## Target schema

Introduce the payload-free domain with `LiteralKit`, classify argv once, and
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

Load `LiteralKit` dynamically from the narrow
`@beep/schema/LiteralKit` subpath only after the protected
`fastLintFixNoop` exit boundary. The protected module-load set before that
boundary remains byte-for-byte unchanged. The startup-contract test must bind
the new post-boundary narrow load and reject a root `@beep/schema` load.

## Migration inventory

- `packages/tooling/tool/cli/src/bin-main.ts:197` — replace
  `handledByQualityFastPath` with mutable `fastPathDispatch` initialized from
  the one argv classifier.
- `packages/tooling/tool/cli/src/bin-main.ts:76-90` — dynamically load the narrow
  `LiteralKit` subpath after the protected no-op boundary, replace both
  `canUse*FastPath` boolean predicates with one `fastPathDispatchFromArgv`
  classifier, and preserve all current quality-task, lint-policy, CI, and
  root-global-flag precedence.
- `packages/tooling/tool/cli/src/bin-main.ts:197-216` — replace
  `handledByQualityFastPath` with the classifier result, dispatch the quality
  case through the literal guard, and reset to `none` only if the existing
  parser returns `None` so the defensive full-tree fallback remains intact.
- `packages/tooling/tool/cli/src/bin-main.ts:218` — delete the second boolean declaration.
- `packages/tooling/tool/cli/src/bin-main.ts:220-221` — guard CI directly with
  the `ci` literal; preserve the `FsUtilsLive` CI layer at lines 222-232.
- `packages/tooling/tool/cli/src/bin-main.ts:244` — dispatch the full command tree only when the literal remains `none`.

The exact whole-repo search found no other reads or writes of either stored
member or either `canUse*FastPath` predicate.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/bin-main.ts:87-90` — delete both sibling
  boolean route predicates and their repeated root-global-flag checks; one
  classifier returns the honest dispatch literal.
- `packages/tooling/tool/cli/src/bin-main.ts:220` — delete the boolean exclusion guard that manually prevents the quality/CI combined state.
- `packages/tooling/tool/cli/src/bin-main.ts:244` — delete the two-boolean default-dispatch conjunction; one derived literal guard replaces it.

## Encoded-side impact

none (internal). The dispatch is local process state and is never encoded.

## Test impact

- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:208-213` — keep the protected pre-`fastLintFixNoop` module-load expectation byte-for-byte; `@beep/schema/LiteralKit` must not be added to this set.
- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:215` onward — add a separate post-boundary source-order assertion that binds `import():@beep/schema/LiteralKit` after `fastLintFixNoop` exits and before `FastPathDispatch` is constructed.
- Add a focused source assertion in the same test that `FastPathDispatch` has exactly `none | quality | ci`; there is no directly importable runtime unit for `bin-main.ts` because importing it executes the CLI.
- Exercise `quality`, `ci`, and full-tree/default routing plus the defensive
  quality-parser `None` fallback; assert the two former boolean route helpers
  are absent.

## Risk & sequencing

This entrypoint is startup-sensitive. The target is exact: use the narrow
post-boundary dynamic import; do not relocate the kit or weaken the protected
allowlist. Land source and import-contract test together, exercise quality,
CI, and default routing, and record before/after cold-start time and peak RSS
for the no-op boundary and representative post-boundary invocations. No other
design should edit `bin-main.ts`.
