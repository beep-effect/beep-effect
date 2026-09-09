# XState Effect experiment

This ports `packages/xstate-effect` from the local `effect-goodies/xstate`
experiment to this repository's Effect version and `xstate@6.0.0-alpha.52`.
The local `xstate-v6` checkout is the reference for the published alpha API.

Run these commands from the repository root:

```sh
bun run --cwd scratchpad check:xstate-effect
bun run --cwd scratchpad lint:xstate-effect
bun run --cwd scratchpad test:xstate-effect
```

The focused TypeScript project includes both the implementation and its tests
and inherits the scratchpad's strict compiler options and Effect diagnostic
settings. Biome uses an explicit configuration because the root configuration
excludes scratchpad; the lint script also runs the repository's Oxlint rules.
Tests use the scratchpad Vitest configuration and `@effect/vitest` scopes.

The original experiment also changes XState core. The persisted
[`xstate@6.0.0-alpha.52` patch](../../patches/xstate@6.0.0-alpha.52.patch)
supplies the declarations this port needs:

- `validator` accepts explicit `undefined` under `exactOptionalPropertyTypes`.
- Type-only machine metadata retains registered actions, actors, and state
  schemas so `RequirementsFrom` can collect their Effect services.
- `ErrorFrom` and invocation error-event inference preserve a child's typed
  errors in `onError` callbacks.

Bun applies the patch through the root `patchedDependencies` entry. It changes
only declarations; the installed XState JavaScript remains the published alpha.
The metadata fields are used only in conditional types and must not be read at
runtime. Reassess the patch when changing the pinned XState version.

The original core's passive observer option is absent from this alpha. The
adapter uses ordinary subscriptions, including error handlers for its internal
snapshot observers. Consumers can observe failures through the actor helpers
or the atom's `result`.

The lint rule and its two inputs in `../test/xstate-effect/lint-fixtures` are
copied from the original experiment. The tests execute the ESLint-compatible
rule directly with a TypeScript parser. The `.ts.txt` suffix keeps deliberately
invalid lint inputs out of TypeScript's program. The imported XState experiment
and those fixtures retain the accompanying [MIT license](./LICENSE).
