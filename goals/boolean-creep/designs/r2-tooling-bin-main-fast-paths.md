## Instance

- id: `r2-tooling-bin-main-fast-paths`
- file:line: `packages/tooling/tool/cli/src/bin-main.ts:196`
- symbol: `handledByQualityFastPath`
- members: `handledByQualityFastPath`, `handledByCiFastPath`
- evidence classes:
  - E1 — `packages/tooling/tool/cli/src/bin-main.ts:219`: CI flag is only written true behind !handledByQualityFastPath; both-true is never assigned.
  - E2 — `packages/tooling/tool/cli/src/bin-main.ts:241`: Default CLI runs only when both flags are false; combined-true is not a handled dispatch.

## Current shape

Live declarations at `packages/tooling/tool/cli/src/bin-main.ts:196` and `:217`:

```ts
let handledByQualityFastPath = false;
let handledByCiFastPath = false;
```

The corresponding live write/read statements are at lines 203, 219–220, and 241:

```ts
handledByQualityFastPath = true;
if (!handledByQualityFastPath && canUseCiFastPath(argv)) {
  handledByCiFastPath = true;
}

if (!handledByQualityFastPath && !handledByCiFastPath) {
```

## Cardinality gap

Two booleans represent four combinations. Three are legal: `none`, `quality`, and `ci`. `quality && ci` is illegal because one argv dispatch can be consumed by at most one fast path.

## Target schema

Introduce the payload-free domain with `LiteralKit` and keep one mutable dispatch value because top-level execution crosses dynamic-import/`await` boundaries:

```ts
const { LiteralKit } = await import("@beep/schema")

const FastPathDispatch = LiteralKit(["none", "quality", "ci"])
type FastPathDispatch = typeof FastPathDispatch.Type

let fastPathDispatch: FastPathDispatch = FastPathDispatch.Enum.none

if (canUseQualityTaskFastPath(argv)) {
  const { parseQualityTaskInvocation, runQualityTask } = await import("./commands/Quality/Tasks.ts")
  const qualityTaskInvocation = parseQualityTaskInvocation(argv)

  if (O.isSome(qualityTaskInvocation)) {
    fastPathDispatch = FastPathDispatch.Enum.quality
    // ...run quality program...
  }
}

if (FastPathDispatch.is.none(fastPathDispatch) && canUseCiFastPath(argv)) {
  fastPathDispatch = FastPathDispatch.Enum.ci
  // ...run CI program...
}

if (FastPathDispatch.is.none(fastPathDispatch)) {
  // ...run default command tree...
}
```

Load `LiteralKit` via `await import("@beep/schema")` after the existing pre-fast-path boundary, not as a new static import before `fastLintFixNoop`; the startup-contract test must explicitly ratify the added module load.

## Migration inventory

- `packages/tooling/tool/cli/src/bin-main.ts:196` — replace `handledByQualityFastPath` with `fastPathDispatch` initialized to `none`.
- `packages/tooling/tool/cli/src/bin-main.ts:203` — write `quality` after `parseQualityTaskInvocation` succeeds.
- `packages/tooling/tool/cli/src/bin-main.ts:217` — delete the second boolean declaration.
- `packages/tooling/tool/cli/src/bin-main.ts:219` — guard CI with `FastPathDispatch.is.none(fastPathDispatch)`.
- `packages/tooling/tool/cli/src/bin-main.ts:220` — write `ci` before launching the CI program.
- `packages/tooling/tool/cli/src/bin-main.ts:241` — dispatch the full command tree only when the literal remains `none`.

The exact whole-repo search found no other reads or writes of either member.

## Guard-deletion accounting

- `packages/tooling/tool/cli/src/bin-main.ts:219` — delete the boolean exclusion guard that manually prevents the quality/CI combined state.
- `packages/tooling/tool/cli/src/bin-main.ts:241` — delete the two-boolean default-dispatch conjunction; one derived literal guard replaces it.

## Encoded-side impact

none (internal). The dispatch is local process state and is never encoded.

## Test impact

- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:208` — update the exact module-load expectation to include `import():@beep/schema` at its live source position.
- `packages/tooling/tool/cli/test/lint-subcommand-allowlist.test.ts:215` onward — preserve the assertion that the new import is after the protected pre-fast-path source boundary.
- Add a focused source assertion in the same test that `FastPathDispatch` has exactly `none | quality | ci`; there is no directly importable runtime unit for `bin-main.ts` because importing it executes the CLI.

## Risk & sequencing

This entrypoint is startup-sensitive. `@beep/schema` is a new runtime module load on every non-noop CLI invocation, so the apply agent must measure/attribute startup impact and may need to place the kit in an already-loaded lightweight schema module rather than weakening the allowlist. Land the source and the exact import-contract test together. No other design should edit `bin-main.ts`.
