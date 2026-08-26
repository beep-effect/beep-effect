# P3 review fixes report

Date: 2026-08-25  
PR: #821 (`feat/identity-iri-fibered`)

## Files touched

- `packages/foundation/capability/semantic-web/src/identity/IdentityRdfBinding.ts`
- `packages/foundation/capability/semantic-web/test/IdentityRdfBinding.test.ts`
- `packages/foundation/modeling/identity/src/Fibered.ts`
- `packages/foundation/modeling/identity/test/Fibered.test.ts`
- `goals/identity-iri-fibered/history/p3-review-fixes-report.md`

## Fixes

### F1: RDF predicate collisions

`IdentityRdfBindingFields` is now an `S.Struct` with an object-wide
`S.makeFilter` attached through `S.check`. The filter walks `identifierPath`,
`curiePath`, and every `fiberPaths` entry, tracking each `NamedNode.value` in an
Effect `HashMap`. A duplicate returns a schema issue that names both colliding
fields and the RDF predicate. The checked struct is the fields argument to
`S.Class`, so `IdentityRdfBinding.make`, schema decoding, and schema-derived
arbitraries share the same invariant. `DefaultIdentityRdfBinding` remains valid.

The Effect 4.0.0-rc.112 API was validated against the local reference source:

- `.repos/effect/packages/effect/src/Schema.ts:14353-14356` declares the
  `S.Class` overload that accepts an `S.Struct`.
- `.repos/effect/packages/effect/src/Schema.ts:14358-14364` preserves a supplied
  struct and passes it to class construction.
- `.repos/effect/packages/effect/src/Schema.ts:14124-14131` runs `struct.make`
  from the class constructor, which enforces the check during `.make(...)`.
- `.repos/effect/packages/effect/src/Schema.ts:5133-5136` and `:6669-6673`
  define `S.check` and `S.makeFilter`.
- `.repos/effect/packages/effect/src/internal/arbitrary/schema.ts:1044-1058`
  applies custom schema filters to generated values and shrinks.

Tests cover constructor and decoder failures with the exact collision message.
A property test samples `S.toArbitrary(IdentityRdfBinding)` and verifies that
every generated predicate set is pairwise distinct. The existing RDF codec
round-trip property remains green.

### F2: Fiber member hook contract

`FiberedInput.member` now returns `FiberMember<Point, Fibers[Point]>` instead of
`S.Top`. The local `makeMember` helper carries the same return type, and the cast
after `.annotate(...)` was removed. Public `Fibered.make(...)` call syntax and
the returned `member`, `union`, and `fiberOf` APIs are unchanged.

Tests include a compile-time `@ts-expect-error` for a hook returning `S.String`
and a runtime case showing that a conforming hook's annotated schema is returned
by `member(point)` and validates the expected tagged value.

## Verification

| Working directory | Command | Exit | Result |
| --- | --- | ---: | --- |
| `packages/foundation/modeling/identity` | `bun run test` | 0 | 12 files, 106 tests passed |
| `packages/foundation/modeling/identity` | `bun run check` | 0 | `tsgo` passed |
| `packages/foundation/modeling/identity` | `bun run lint` | 0 | 25 files checked |
| `packages/foundation/capability/semantic-web` | `bun run test -- --pool=threads` | 0 | 3 files, 17 tests passed |
| `packages/foundation/capability/semantic-web` | `bun run check` | 0 | `tsgo` passed |
| `packages/foundation/capability/semantic-web` | `bun run lint` | 0 | 16 files checked |
| `packages/epistemic/server` | `bun run test -- --pool=threads` | 0 | 6 files, 32 tests passed |
| repository root | `bun run beep lint schema-first` | 0 | 89 live/tracked entries; no advisories |
| repository root | `bun run docgen:local` | 0 | 125 Turbo tasks passed |

## Environment notes

The default forks pool timed out while starting workers in this sandbox. The
`packages/epistemic/server` default run exited 1 with six worker-start timeouts;
the first semantic-web default run did not return a terminal result in its
capture window. Both packages passed with the permitted `--pool=threads`
fallback shown above. No `vitest.config.ts` file was edited.

Remote caching was unavailable during `docgen:local`, so Turbo recomputed the
expanded dependency graph. The command still exited 0. No install, service or
contract edit, Git index/ref mutation, or design-document change was performed.
