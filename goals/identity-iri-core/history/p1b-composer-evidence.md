# P1b Composer Evidence

## Implementation

- `packages/foundation/modeling/identity/src/Id.ts`
  - Added exported `IriFromIdentity`, `CurieFromIdentity`, and `SlugFromIdentifier` type transforms beside the existing `TitleFromIdentifier` family.
  - Extended `IdentityComposer` with binding-aware type parameters, `.iri`, `.curie`, `.slug`, and `rebase(...)`.
  - Kept one-argument `make(...)` compatible and explicitly unbound. Added an optional second binding argument `{ authority, prefix, vocab? }`.
  - Threaded binding type parameters through `create(...)`, `compose(...)`, and annotation helpers.
  - Added bound-only `iri` / `curie` annotation fields for `annote`, `annoteSchema`, `annoteHttp`, and `annoteKey` via the shared `annote(...)` path.
  - Preserved identity strings and `Symbol.for(...)` interning under `rebase(...)`.

- `packages/foundation/modeling/identity/src/packages.ts`
  - Bound the root `$I` composer with `{ authority: "https://ns.beep.sh/", prefix: "beep" }`.
  - No other package composer call sites changed; generated composers inherit from the bound root.

- New modules
  - No new source module was added. The integration stayed in `Id.ts` because the projection helpers are tightly coupled to the existing composer generics and annotation result shapes.
  - Existing P1a modules `Vocab.ts`, `Curie.ts`, and `PnLocal.ts` were read/imported by type only where needed and not modified.

- Test runner note
  - `@beep/identity` package-local `beep:test` now uses `bunx vitest run` instead of `bunx --bun vitest run`. On this host, `bunx --bun vitest run` failed before test import with Vitest worker-pool startup timeouts / stdout pipe errors. The Node-run Vitest path passes the same package tests and lets the required turbo gate complete.

## Unbound Composer Semantics

One-argument `make(...)` returns an unbound composer. Its `.iri` and `.curie` properties are present and typed as `undefined`; `.slug` is always derived from the identity path. This keeps the API type-safe without throwing from property access, and it preserves existing callers that use `make("beep")` only for identity strings, symbols, and annotations.

Unbound `annote(...)` records do not gain own `iri` / `curie` fields. Bound composers add those fields as owned-channel metadata. Existing `identifier`, `schemaId`, and `title` values remain unchanged.

## Type-Level Notes

`SlugFromIdentifier` is implemented at the type level for static strings and at runtime for composer values. Widened `string` inputs widen to `string`, matching `IriFromIdentity` and `CurieFromIdentity`. The slug transform mirrors runtime behavior for separators and lower-to-upper word boundaries; acronym runs stay joined the same way the runtime regex handles them.

## Gate Evidence

```sh
bunx turbo run test --filter @beep/identity --filter @beep/rdf --concurrency=1
```

Result: pass.

Key lines:

```text
@beep/identity:test: Test Files  6 passed (6)
@beep/identity:test: Tests  51 passed (51)
@beep/identity:test: ✓ test/shape-stable.test.ts (10 tests)
@beep/rdf:test: Test Files 2 passed (2)
@beep/rdf:test: Tests 26 passed (26)
Tasks: 2 successful, 2 total
```

```sh
bunx turbo run check --filter @beep/identity --filter @beep/rdf
```

Result: pass.

Key lines:

```text
@beep/identity:check: $ tsgo -b tsconfig.json
@beep/rdf:check: $ tsgo -b tsconfig.json
Tasks: 6 successful, 6 total
```

```sh
bunx turbo run docgen --filter @beep/identity --concurrency=1
```

Result: pass.

Key lines:

```text
@beep/identity:docgen: 6 module(s) found
@beep/identity:docgen: 147 example(s) found
@beep/identity:docgen: Typechecking examples...
@beep/identity:docgen: ✓ Docs generation succeeded!
Tasks: 2 successful, 2 total
```

Diff scope checked after implementation and before final gate rerun:

```text
packages/foundation/modeling/identity/package.json
packages/foundation/modeling/identity/src/Id.ts
packages/foundation/modeling/identity/src/packages.ts
packages/foundation/modeling/identity/test/IriBinding.test.ts
goals/identity-iri-core/history/p1b-composer-evidence.md
```
