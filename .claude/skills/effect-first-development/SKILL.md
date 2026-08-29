---
name: effect-first-development
description: >
  Canonical Effect-first development guide for this repo. Trigger on: new features,
  refactors, bug fixes, API boundaries, typed errors, Option usage, schema decoding,
  service wiring, and test authoring.
version: 0.1.0
status: active
---

# Effect-First Development (Canonical)

Use this skill when implementing or reviewing production code in this repository.
If there is any conflict, repository laws win.

## Zero-Fail Memory Rule

Before writing code, walk the Non-Negotiable Laws below as a question checklist.
The fast triage questions:

1. Can it fail? Typed tagged error in `Effect`. Can it be missing? `Option`.
2. Is input external? Decode with `Schema` at the boundary; schema is the source of truth for data shapes.
3. Touching arrays/objects/strings/booleans or branching on shape? Effect modules (`A`/`R`/`Str`/`Bool`), `Predicate`, `Match`, `A.match` — never native helpers or `switch`. Prefer the flattest equivalent form first. Before I keep an `O.match(...)`, can `O.map`/`O.flatMap`/`O.liftPredicate`/`O.getOrElse` express it more flatly?
4. Defining services, schemas, unions, or Effect-returning functions? Identity composer + `Context.Service`/`Layer`, `S.Class`, `LiteralKit`/`S.toTaggedUnion`, named `Effect.fn`.
5. At a runtime boundary? `Effect.run*` only at entrypoints/tests, `runMain` owns process exit, `Effect.tryPromise` for promises, `Effect.scoped`/`acquireUseRelease` for resources.
6. Resilience/observability? `Effect.retry` + `Schedule`, `timeoutOption`/`timeoutOrElse`, explicit concurrency, spans + structured logs from the start, `Config`/`Redacted` for env + secrets.
7. Recovery? Precise `catchTag`/`catchFilter` in domain, `catchCause`/`matchCauseEffect` at boundaries, `Cause.pretty` for rendering, `fail` for expected vs `die` for invariants.

Two checks with no law counterpart below:

- Designing a service or test helper? Keep `FileSystem`, `Path`, and `SqlClient` inside the layer/service unless they are the explicit domain boundary.
- Testing platform/runtime semantics? Prefer `@effect/vitest` for supporting tests, but spawn the real runtime when the assertion is about platform lifecycle behavior.

## Non-Negotiable Laws

1. Canonical aliases are mandatory:
   - `effect/Array` as `A`
   - `effect/Option` as `O`
   - `effect/Predicate` as `P`
   - `effect/Record` as `R`
   - `effect/Schema` as `S`
2. For other stable helper/data modules, prefer dedicated namespace imports (`effect/String` as `Str`, `effect/Equal` as `Eq`, `effect/Boolean` as `Bool`, etc.); reserve root `effect` imports for core combinators/types such as `Effect`, `Match`, `pipe`, and `flow`.
3. No `any`, type assertions, `@ts-ignore`, or non-null assertions.
4. No plain `throw`, `new Error`, or untyped error channels in production logic.
5. No nullish leak in domain logic; convert nullish to `Option` at boundaries.
6. No direct `typeof` checks when `effect/Predicate` covers the case.
7. No native `Object/Map/Set/Date/String` helpers in domain logic.
8. For typed errors, extend `S.TaggedError` from `effect/Schema` directly. Use a package `$I` composer for a distinct namespaced identifier; otherwise omit the identifier, and never pass a bare identifier equal to the tag. Cause-carrying errors declare `cause: S.Defect({ includeStack: true })` explicitly.
9. Exported APIs need JSDoc and docgen-clean examples.
10. Do not finish with failing `check`, `lint`, `test`, or `docgen`.
11. Do not suffix schema constants with `Schema`; use the domain name.
12. For non-class schemas, export runtime type aliases with the same name: `export type X = typeof X.Type`.
13. Do not use native `switch`; use `Match`. For empty/non-empty array branching, prefer `A.match` over manual length checks.
14. All new schemas must be meaningfully annotated with `$I.annote("Name", { description })`.
15. Service identifiers must use package composer `.create(...)` and `$I\`MyService\``.
16. If a schema has properties that are a union of literal strings, it should be a tagged union composed via `LiteralKit`, `.mapMembers`, and `Tuple.evolve`, then finalized with `S.toTaggedUnion`. Use `S.TaggedUnion` only for canonical `_tag` object-union construction.
17. Reusable functions returning `Effect` should use named `Effect.fn("Namespace.name")` (or `Effect.fnUntraced` for hot/internal paths). Zero-arg effect values may stay `Effect.gen(...).pipe(Effect.withSpan("Name"))` when there is no exported/reused function to expose.
18. Effect workflows should be observable with spans and structured logs from the start; add metrics (`effect/Metric` + `Effect.track*`) where the path is important enough to measure.
19. Durations and time windows should use `effect/Duration`, not ad-hoc number literals.
20. For nullable/nullish/optional schema-to-`Option` conversions, use `S.OptionFromNullOr`, `S.OptionFromNullishOr`, `S.OptionFromOptionalKey`, or `S.OptionFromOptional`. For runtime `Option` object fields, prefer `O.getSomesStruct({...})` (`@beep/utils`) for heterogeneous struct spreads with known keys — it is runtime-identical to `R.getSomes` but preserves literal keys and per-key value types; reserve `R.getSomes({...})` for homogeneous dynamic-key dictionaries. Use `O.all({...})` when the whole object is all-or-nothing. (Amended 2026-07-05 — see `standards/architecture/DECISIONS.md`.)
21. Exported helper utilities should expose dual data-first/data-last forms via `dual` from `effect/Function`.
22. Never use `JSON.parse` / `JSON.stringify` in Effect-first code, tests, or fixtures; use `S.UnknownFromJsonString` / `S.fromJsonString` + `S.decodeUnknownEffect` / `S.encodeUnknownEffect` or explicit Result/Option codecs for non-throwing sync helpers.
23. Do not use `S.decodeSync`, `S.decodeUnknownSync`, `S.encodeSync`, or `S.encodeUnknownSync` by default. Prefer Effect codecs, and map schema errors with `Effect.mapError(...)` before returning them across module, service, CLI, HTTP, or test-helper boundaries. If a legacy sync API must remain throwing, use Result codecs plus `Result.getOrThrowWith(...)` to preserve an `Error` or typed boundary error.
24. Prefer `S.Class` over `S.Struct` for domain object schemas; use `S.Struct` only when a concrete boundary exception is required.
25. Only runtime boundaries (app entrypoints/tests) may call `Effect.runSync` / `Effect.runPromise` / `Effect.runFork`; libraries return `Effect`.
26. Process entrypoints must not recover the root cause merely to set `process.exitCode` and print `Cause.pretty(...)`. Pass the failing root effect directly to `BunRuntime.runMain` / `NodeRuntime.runMain`; use `runMain(..., { teardown })` plus `Runtime.defaultTeardown` for custom terminal rendering.
27. Promise-returning APIs must be lifted with `Effect.tryPromise` at boundaries.
28. Resource lifetimes must be explicit with `Effect.acquireUseRelease` or `Effect.scoped`.
29. Retries must be expressed via `Effect.retry` and `Schedule`, not manual retry loops.
30. Timeout behavior should be modeled with `Effect.timeoutOption` / `Effect.timeoutOrElse` instead of ad-hoc timers.
31. Forking defaults to `Effect.forkChild`; `Effect.forkDetach` requires explicit daemon intent.
32. Parallel fan-out should set explicit concurrency for `Effect.forEach` / `Effect.all` / `Effect.validate` when load is non-trivial.
33. Config should be modeled via `Config` and `ConfigProvider`, not direct `process.env` access in domain services.
34. Secrets must be represented as `Redacted` values (`Config.redacted` / `Redacted.make`) and never logged raw.
35. Error recovery should be precise (`catchTag` / `catchFilter`) instead of blanket recovery that hides unrelated failures; at outer HTTP/worker boundaries prefer `Effect.catchCause` / `Effect.matchCauseEffect`. At process entrypoints, prefer platform `runMain` teardown instead.
36. Use `Effect.fail` for expected business errors and reserve `Effect.die` / `Effect.orDie` for invariants and impossible states.
37. When layer memoization sharing is unsafe, force isolation with `Effect.provide(..., { local: true })` or `Layer.fresh`.
38. Schema-first development: if a data model can be represented as `Schema`, define the `Schema` first and derive runtime types from it; avoid plain `type` / `interface` for domain data shapes.
39. Service contracts may stay interfaces, but row shapes, wire payloads, and persisted models should not.
40. Prefer schema-level defaults (`S.withConstructorDefault`, `S.withDecodingDefault`, `S.withDecodingDefaultKey`) instead of ad-hoc runtime fallback object literals.
41. Guard predicates for domain strings/paths/tags should come from branded schemas via `S.is(...)`, not ad-hoc `regex.test(...)` helpers.
42. For schema-modeled domain comparisons, prefer `S.toEquivalence(schema)` over manual `===` / `!==` checks.
43. For deterministic format conversions, prefer schema transformations (`S.decodeTo` + `SchemaTransformation.transform`) over ad-hoc string conversion helpers.
44. Never use native `Array.prototype.sort`; use `A.sort(values, order)` with explicit `Order` instances.
45. Avoid ad-hoc `String(...)` coercion in domain logic; model unknown-to-string normalization with schema transformations and compare via schema equivalence.
46. When branching on boolean values, prefer the flattest equivalent form first; use `Bool.match` when both branches do real work or when it is materially clearer than direct boolean selection.
47. Before keeping `O.match(...)`, check whether `O.map(...)`, `O.flatMap(...)`, `O.liftPredicate(...)`, and `O.getOrElse(...)` express the same control flow more flatly. Avoid `onNone: () => ({})` object compaction; use `O.map(...)` plus `O.getOrElse(() => ({}))`, `O.getSomesStruct({...})` for heterogeneous struct spreads (`R.getSomes({...})` only for homogeneous dynamic-key dictionaries), or `S.OptionFrom*` according to boundary semantics. (Amended 2026-07-05 — see `standards/architecture/DECISIONS.md`.)
48. In callback-only contexts where `yield*` is unavailable (for example `SchemaTransformation.transform*`), consume services with `Context.Service.use(...)`.
49. Do not import `node:path` in production/tooling source. Use `Path.Path` service (`yield* Path.Path`) for `join`, `resolve`, `relative`, `basename`, etc.
50. Do not use native `fetch` in production/tooling source. Use `HttpClient` from `effect/unstable/http` and provide platform client layers (Bun: `BunHttpClient.layer`).
51. Named or reused domain constraints must be modeled as schemas first; prefer built-in schema constructors/checks before `S.makeFilter`, then derive guards with `S.is(...)`.
52. Reusable `S.makeFilter`, `S.makeFilterGroup`, and reusable built-in check blocks must include `identifier`, `title`, and `description`; `message` stays user-facing.
53. Use `LiteralKit` for internal literal domains when `.is`, `.thunk`, `$match`, or annotation-bearing schema values are part of the design.
54. Prefer `P.isTagged("Tag")` over manual `_tag` guard helpers built from `P.hasProperty`, `P.isObject`, or inline `_tag` string checks.
55. When a matcher is the function body or a reusable helper, prefer `Match.type<T>().pipe(...)` / `Match.tags(...)` over `Match.value(...)`.
56. At logging/recovery boundaries, render causes with `Cause.pretty(...)` or `Cause.prettyErrors(...)` instead of ad-hoc `String(error)` fallback chains.
57. Prefer the tersest equivalent helper form when behavior is unchanged: direct helper refs over trivial wrapper lambdas, `flow(...)` for passthrough `pipe(...)` callbacks, and shared thunk helpers when already in scope.

## Always / Never Examples (load on demand)

- [references/always-never-core.md](references/always-never-core.md) — core modeling:
  1 absence handling · 2 typed error boundary · 3 schema naming + annotation ·
  4 type checks · 4b schema-backed guards + internal modeling · 5 Match over switch ·
  6 tagged unions + exhaustive branching · 7 service identity via package composer ·
  8 discriminated union schemas · 9 Effect-returning functions
- [references/observability-runtime.md](references/observability-runtime.md) — observability + runtime boundaries:
  10 observability + metrics · 10b boundary logging with Cause · 10c process entrypoint teardown ·
  11 Duration values · 12 nullish schemas to Option · 13 dual helper APIs ·
  14 JSON via Schema codecs · 15 runtime boundary for running effects ·
  16 `Effect.tryPromise` boundaries · 17 scoped resource safety
- [references/resilience-recovery.md](references/resilience-recovery.md) — resilience + recovery:
  18 retry + timeout modeling · 19 structured concurrency + bounded parallelism ·
  20 config + secret redaction · 21 precise recovery by tag ·
  22 expected failures vs defects · 23 layer isolation

## Source of Truth References

- [Effect LLMS guide](../../../.repos/effect/LLMS.md)
- [Effect ai-docs index](../../../.repos/effect/ai-docs/src/index.md)
- [Effect migration notes](../../../.repos/effect/MIGRATION.md)
- [Effect Schema docs](../../../.repos/effect/packages/effect/SCHEMA.md)
- [Effect core API source](../../../.repos/effect/packages/effect/src/Effect.ts)
- [Effect Config source](../../../.repos/effect/packages/effect/src/Config.ts)
- [Effect Fiber source](../../../.repos/effect/packages/effect/src/Fiber.ts)

## Verify

1. `rg -n " as |@ts-ignore|!\\.|\\bany\\b" apps packages tooling`
2. `rg -n "new Error\\(|throw " apps packages tooling`
3. `rg -n "typeof " apps packages tooling`
4. `rg -n "\\bswitch\\s*\\(" apps packages tooling`
5. `rg -n "export const [A-Za-z0-9_]+Schema\\b" apps packages tooling`
6. `rg -n ":\\s*Effect\\.Effect<|=>\\s*Effect\\.Effect<|=>\\s*Effect\\.[A-Za-z]+" apps packages tooling`
7. `rg -n "Date\\.now\\(|Math\\.random\\(|setTimeout\\(|setInterval\\(" apps packages tooling`
8. `rg -n "\\.split\\(|\\.trim\\(|\\.toLowerCase\\(|\\.toUpperCase\\(|\\.replace\\(" apps packages tooling`
9. `rg -n "S\\.Struct\\(" apps packages tooling`
10. `rg -n "^export interface [A-Za-z0-9_]+" apps packages tooling`
11. `rg -n "^export type [A-Za-z0-9_]+\\s*=\\s*\\{" apps packages tooling`
12. `rg -n "JSON\\.parse\\(|JSON\\.stringify\\(" apps packages tooling`
13. `rg -n "Effect\\.run(Sync|Promise|Fork)\\(" apps packages tooling infra`
14. `rg -n "process\\.env" apps packages tooling infra`
15. `rg -n "forkDetach\\(" apps packages tooling`
16. `rg -n "catchAll\\(|Effect\\.catch\\(" apps packages tooling`
17. `rg -n "Redacted\\.value\\(" apps packages tooling`
18. `rg -n "Effect\\.die\\(|Effect\\.orDie\\(" apps packages tooling`
19. `rg -n "Effect\\.provide\\(.*local:\\s*true|Layer\\.fresh\\(" apps packages tooling`
20. `rg -n "const hasTag|P\\.hasProperty\\(.*_tag|P\\.isObject\\(.*_tag|Match\\.value\\(" apps packages tooling`
21. `rg -n "Effect\\.fn\\(function\\*|=\\s*Effect\\.gen\\(function\\*" apps packages tooling`
22. `rg -n "Cause\\.pretty\\(|Cause\\.prettyErrors\\(|Effect\\.catchCause\\(|Effect\\.matchCauseEffect\\(" apps packages tooling`
23. `bun run check`
24. `bun run lint`
25. `bun run test`
26. `bun run docgen`
