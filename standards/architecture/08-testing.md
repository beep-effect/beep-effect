# 08 — Testing

A slice's tests must run with only that slice's Layers, plus shared test-kit and driver test Layers. Anything more couples slices and breaks the optionality the architecture exists to preserve.

The test runner is Vitest through the repo/package scripts: use `bun run test`
from a package/root script, or `bunx --bun vitest run ...` for a targeted local
lane. Never `bun test` — Bun's runner breaks `@effect/vitest`.

## Documentation runtime tests

`@effect/doctest` runs marked JSDoc TypeScript fences as isolated Vitest modules.
Use `ts import.meta.vitest name="<Example title>"` on a runnable fence and place
`// => expected` after an expression statement or one initialized `const`
identifier. The lane checks runtime behavior and Effect equality only. Docgen's
TypeScript example gate remains authoritative for imports and types, including
type-only examples.

Run all marked examples with `bun run doctest`. Run the hosted-lane shape with
`bun run beep ci lane doctest --mode affected --base origin/main --head HEAD` or
`--mode full`. The pull-request lane executes only changed source files which
contain `import.meta.vitest`; pushes execute the full marked corpus.

The executable proof target for the architecture is `packages/architecture-lab/*`
with `apps/architecture-lab-proof`. It carries focused runtime tests for
boundary subpaths, package shape, and strict port-to-action error translation
(the tstyche type-test surface was retired 2026-08-03 — see DECISIONS.md).

## Domain In Isolation

Domain functions are pure. Pure-Effect domain functions have no requirement
channel: their `R` resolves to `never`. They need no Layer to run.

Test pattern:

- Pure predicate or value function: import the function, call it directly with
  plain `it`/`expect`.
- Effect-returning domain function: use `it.effect` from `@effect/vitest` and
  yield the call. Use `Effect.exit` to inspect typed failures without throwing.
- Schema-modeled laws: derive data from the production schema with
  `S.toArbitrary(schema)` and FastCheck. Add `toArbitrary` annotations to the
  source schema when the domain needs realistic generated values.

`Membership.canRevoke` is a pure predicate. `Membership.revoke` is an
`Effect.fn` that returns `MembershipAlreadyRevoked` when the lifecycle rule
rejects the transition. Both can be tested without booting any Layer.

````ts
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as O from "effect/Option";
import {
  MembershipAlreadyRevoked,
  MembershipStatus,
} from "@beep/iam-domain/entities/Membership";
import { activeMembership, revokedMembership } from "@beep/iam-domain/test";

describe("Membership", () => {
  it("canRevoke returns true for an active membership", () => {
    expect(activeMembership.canRevoke()).toBe(true);
  });

  it("canRevoke returns false for a revoked membership", () => {
    expect(revokedMembership.canRevoke()).toBe(false);
  });

  it.effect(
    "revoke succeeds for an active membership",
    Effect.fnUntraced(function* () {
      const next = yield* activeMembership.revoke();
      expect(next.status).toBe(MembershipStatus.Enum.revoked);
    })
  );

  it.effect(
    "revoke fails with MembershipAlreadyRevoked when already revoked",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(revokedMembership.revoke());
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        expect(O.isSome(error)).toBe(true);
        if (O.isSome(error)) {
          expect(error.value).toBeInstanceOf(MembershipAlreadyRevoked);
        }
      }
    })
  );
});
````

The fixtures `activeMembership` and `revokedMembership` are owned by
`@beep/iam-domain/test` (see Fixture Ownership below). Domain tests never
depend on use-case ports, server adapters, drivers, or any application Layer.

Schema-derived property tests complement fixtures. Keep fixtures for exact
golden payloads, snapshots, migration cases, compatibility payloads, and
regression repros. When a property test finds invalid or surprising generated
data, sharpen the production schema or its source-schema arbitrary annotation
instead of defining a weaker test-only schema.

## Use-Case Testing With Port Stubs

Use-case services depend on ports declared in `*.ports.ts`. The use-case test
provides those ports through stub Layers. The use-case package's `/test`
subpath publishes a stub Layer per port that other tests in the same slice may
reuse.

Two stubbing styles are available:

- `Layer.succeed(Port, stubImpl)` — explicit, all methods provided. Use when
  the test exercises several methods or when the test asserts on call ordering.
- `Layer.mock(Port)({ partialImpl })` — partial, missing methods fail with
  `UnimplementedError` if called. Use when the test exercises one or two
  methods and you want defaults for the rest.

`Layer.mock` is the right tool for narrow port stubs. If the test needs to
control more than two methods, prefer `Layer.succeed` for clarity.

Use-case tests must cover the boundary translator as well as the happy path: a
stubbed port failure such as `MembershipRepositoryNotFound` should become the
public action error promised by the use-case contract, such as
`MembershipNotFound`. The `architecture-lab/WorkItem` use-case test is the
canonical compile-ready example.

`MembershipService.revoke` depends on `MembershipAccess` (authorization port)
and `MembershipRepository` (persistence port). The revoke test stubs both:

````ts
import { expect, layer } from "@effect/vitest";
import { Cause, Effect, Exit, Layer } from "effect";
import * as O from "effect/Option";
import {
  MembershipAccess,
  MembershipNotFound,
  MembershipRepository,
  MembershipService,
} from "@beep/iam-use-cases/server";
import { MembershipServerLayer } from "@beep/iam-server/layer";
import { activeMembership, revokeMembershipCommand } from "@beep/iam-use-cases/test";

const MembershipAccessAllow = Layer.mock(MembershipAccess)({
  assertCanRevoke: () => Effect.void,
});

const MembershipRepositoryStub = Layer.succeed(MembershipRepository, {
  findById: () => Effect.succeed(O.some(activeMembership)),
  save: () => Effect.void,
});

const TestLayer = MembershipServerLayer.pipe(
  Layer.provide(Layer.mergeAll(MembershipAccessAllow, MembershipRepositoryStub))
);

layer(TestLayer)("MembershipService.revoke", (it) => {
  it.effect(
    "revokes an active membership",
    Effect.fnUntraced(function* () {
      const service = yield* MembershipService;
      yield* service.revoke(revokeMembershipCommand);
    })
  );

  it.effect(
    "fails with MembershipNotFound when the repository returns none",
    Effect.fnUntraced(function* () {
      const service = yield* MembershipService;
      const exit = yield* Effect.exit(service.revoke(revokeMembershipCommand));
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        expect(O.isSome(error)).toBe(true);
        if (O.isSome(error)) {
          expect(error.value).toBeInstanceOf(MembershipNotFound);
        }
      }
    })
  );
});
````

The test composes only `MembershipServerLayer` (the slice's use-case
implementation) plus stubs for the two ports it needs. No driver Layer, no app
Layer, no other slice.

## Fixture Ownership

Each slice's `/test` subpath publishes shared fixtures: test data, common stubs,
test-only Layers. A slice's tests import its own `/test` through the package
alias, never through a relative path into another package's `src/`:

````ts
import { activeMembership } from "@beep/iam-domain/test";
import { revokeMembershipCommand } from "@beep/iam-use-cases/test";
````

Cross-slice tests never import another slice's `/test` directly. If a fixture
is genuinely cross-slice, promote it to the future `shared/use-cases/test`
surface. Promotion creates that package only when it includes a record per
`02-shared-kernel.md`.

Foundation `test-kit` packages (under `packages/tooling/test-kit/`) provide
infrastructure that any slice may import without promotion: deterministic clock
helpers, seeded random, in-memory drivers, and `ConfigProvider` test fixtures.
These are not product-coupled and need no promotion record.

## Contract Tests Between Use-Cases And Server Adapters

A port declares an interface; a server-side `*.repo.ts` implements it. The
contract test proves the implementation matches the port's expectations. Both
the live driver-backed implementation and the in-memory implementation must
satisfy the same suite. If they diverge, one of them has drifted from the
port.

Pattern: define a port contract suite as a function that takes a `Layer`
producing the port and runs the same cases against any implementation. The
slice provides:

- a test that runs the suite against the live implementation (with a real or
  test driver Layer)
- a test that runs the suite against the in-memory implementation

````ts
// packages/iam/use-cases/test/MembershipRepository.contract.ts
import { expect, layer } from "@effect/vitest";
import { Effect, type Layer } from "effect";
import * as O from "effect/Option";
import { MembershipRepository } from "@beep/iam-use-cases/server";
import { activeMembership } from "@beep/iam-use-cases/test";

/**
 * Contract suite shared between every `MembershipRepository` implementation.
 *
 * Pass any `Layer` producing the port to assert it satisfies the use-case
 * contract; both the live driver-backed adapter and the in-memory adapter
 * must pass identical cases.
 *
 * @category testing
 * @since 0.0.0
 *
 * @remarks
 * Drift between implementations indicates a port-or-adapter regression, not
 * a flaky test.
 */
export const MembershipRepositoryContract = (
  RepoLayer: Layer.Layer<MembershipRepository>,
  label: string
) =>
  layer(RepoLayer)(`MembershipRepository contract — ${label}`, (it) => {
    it.effect(
      "save then findById returns the saved membership",
      Effect.fnUntraced(function* () {
        const repo = yield* MembershipRepository;
        yield* repo.save(activeMembership);
        const found = yield* repo.findById(activeMembership.id);
        expect(O.isSome(found)).toBe(true);
      })
    );

    it.effect(
      "findById returns none for an unknown id",
      Effect.fnUntraced(function* () {
        const repo = yield* MembershipRepository;
        const found = yield* repo.findById(activeMembership.id);
        expect(O.isNone(found)).toBe(true);
      })
    );
  });
````

````ts
// packages/iam/server/test/MembershipRepositoryLive.contract.test.ts
import { MembershipRepositoryContract } from "@beep/iam-use-cases/test";
import { MembershipRepositoryLive } from "@beep/iam-server/test";

MembershipRepositoryContract(MembershipRepositoryLive, "live (drizzle test db)");
````

````ts
// packages/iam/use-cases/test/MembershipRepositoryInMemory.contract.test.ts
import { MembershipRepositoryContract } from "@beep/iam-use-cases/test";
import { MembershipRepositoryInMemory } from "@beep/iam-use-cases/test";

MembershipRepositoryContract(MembershipRepositoryInMemory, "in-memory");
````

Both files run the same suite. Any case that passes on one implementation and
fails on the other is a contract drift, not a flaky test.

## Slice-Isolation Guarantee

A slice's tests must run with only:

- that slice's Layers (`@beep/<slice>-domain/test`, `@beep/<slice>-use-cases/test`,
  `@beep/<slice>-server/test`, etc.)
- foundation `test-kit` Layers
- driver test Layers (e.g., a Drizzle test database, an in-memory event log)

A slice's tests must not need to boot another slice's `Layer.ts`, nor any
`apps/<app>/src/runtime/Layer.ts`. If a slice test currently requires another
slice, one of the following is true:

- the test belongs to the other slice and should move
- the dependency is on a promoted `shared/use-cases` contract that should be
  stubbed at the boundary

This isolation is what lets a slice be removed, rewritten, or forked without
breaking the rest of the repo. It is the test-time enforcement of the
optionality promise made by `01-hexagonal-vertical-slices.md` and
`05-layer-composition.md`.

## Opt-In Real-Postgres Race Lanes

PGlite proves behavior; it cannot prove concurrency. It is effectively
single-connection, so lock contention, `SELECT ... FOR UPDATE` loser paths, and
constraint-check ordering under real parallel transactions never occur there.
A repository whose contract includes concurrent-writer behavior (supersession,
head-close races, unique-head backstops) needs an **opt-in real-Postgres race
lane** alongside its PGlite suite:

- **Dedicated env var, not shared config.** The lane keys on its own
  `BEEP_<SLICE>_PG_URL` (e.g. `BEEP_EPISTEMIC_PG_URL`) and the whole suite
  no-ops with a logged skip when it is unset. CI runs it only where a real
  server is provisioned; local runs stay green without one.
- **Config boot snapshot.** Read the URL once through a `Config` snapshot at
  layer boot — never `process.env` inside test bodies (see Anti-Patterns).
- **Two repository instances.** Build two independent client/repository stacks
  over the same database so the race is between real connections, not two
  fibers sharing one pool slot.
- **`pg_sleep` choreography, not `Effect.sleep`.** Inside `layer()` testers the
  `TestClock` swallows `Effect.sleep`, so fiber interleaving never happens on
  wall time. Hold locks across a window with `SELECT pg_sleep(...)` inside the
  transaction you want to lose the race.
- **Expect mapped conflicts, not raw driver errors.** The race lane exists to
  prove constraint-to-typed-error mapping under contention — including
  constraints that only fire on real Postgres because its check ordering
  differs from PGlite (a btree unique can fire before a partial or exclusion
  index that PGlite reports first).

The reference implementation is
`packages/epistemic/server/test/integration/EdgeAuthority.pg.test.ts` (races
4/4 across repeated runs; found a real constraint-ordering gap PGlite could
not see).

## Anti-Patterns

| Smell                                                      | Diagnostic                                                                                                                |
|------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| Test imports `@beep/<other-slice>-server`                  | Cross-slice coupling. Refactor to stub the boundary; if the dependency is real, promote a contract to future `shared/use-cases`. |
| Test imports `apps/web/src/runtime/Layer.ts`               | The test is testing the app, not the slice. Move it under `apps/web`.                                                     |
| Test mocks `Effect` itself or `effect/Schema`              | Testing the framework, not your code. Remove.                                                                             |
| Test reads `process.env` directly                          | Test should provide a `ConfigProvider` test Layer from `tooling/test-kit/` or `@beep/<kernel>-config/test`.               |
| Test depends on wall-clock time without `TestClock`        | Flake. Use `TestClock` from `effect/testing`.                                                                             |
| Test uses `bun test`                                      | Breaks `@effect/vitest`. Use the repo/package `test` script or `bunx --bun vitest run ...`.                              |
| Test imports a relative path into another package's `src/` | Boundary violation. Use the `@beep/*` alias and the package's canonical `/test` subpath.                                  |
| Test composes >=2 slice `Layer.ts` values                  | Slice-isolation breach. Each slice test composes only its own slice.                                                      |

## See Also

- `01-hexagonal-vertical-slices.md` — slice topology and the boundaries tests must respect
- `04-rich-domain-model.md` — what makes domain code testable without Layers
- `05-layer-composition.md` — Layer composition rules that test wiring inherits
- `09-errors-across-boundaries.md` — how to test error translation at boundaries
