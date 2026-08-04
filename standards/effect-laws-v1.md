# Effect Laws v1

Compact, enforceable laws for this codebase. Keep agent-facing files terse; keep details here.

## Short Laws (authoritative)

1. Use `A/O/P/R/S` aliases only:
   - `import * as A from "effect/Array"`
   - `import * as O from "effect/Option"`
   - `import * as P from "effect/Predicate"`
   - `import * as R from "effect/Record"`
   - `import * as S from "effect/Schema"`
2. For other stable helper/data modules, prefer dedicated namespace imports (`effect/String` as `Str`, `effect/Equal` as `Eq`, `effect/Boolean` as `Bool`, etc.); reserve root `effect` imports for core combinators/types such as `Effect`, `Match`, `pipe`, and `flow`.
3. `effect/unstable/*` imports are allowed when needed.
4. No `any`, type assertions, `@ts-ignore`, or non-null assertions.
5. No runtime `typeof ... === ...`; use `effect/Predicate` guards.
6. No native `Object/Map/Set/Date` in domain logic.
7. No native `Error` in production source; use `TaggedErrorClass` from `@beep/schema` for typed errors, and record intentional low-level runtime exceptions in the allowlist.
8. No `node:path` in runtime source; use `Path.Path` service APIs.
9. No native `fetch` in runtime source; use `effect/unstable/http` and provide platform client layers.
10. No native `Array.prototype.sort`; use `A.sort` with explicit `Order`.
11. No native `switch` statements; use `Match`, `Match.tagsExhaustive` for `_tag` unions, and schema `.match` for tagged-union schemas.
12. Use `Bool.match` for boolean branching in domain/runtime orchestration code.
13. Prefer schema defaults and transformations (`S.withDecodingDefault*`, `S.decodeTo`, `SchemaTransformation`) over ad-hoc parsing/fallback logic.
14. HTTP boundaries must be expressed with Effect HTTP modules (`HttpClientRequest`, `HttpClientResponse`, `Headers`, `UrlParams`, `HttpMethod`, `HttpBody`).
15. JSDoc is required for exported APIs in `packages/*/src` and `packages/tooling/*/*/src`; examples must pass docgen.
16. Do not finish work with failing `check`, `lint`, `test`, or `docgen`.
17. Named or reused domain constraints are modeled as schemas first; prefer built-in schema constructors/checks before `S.makeFilter`, and derive guards with `S.is(...)`.
18. Reusable `S.makeFilter`, `S.makeFilterGroup`, and reusable built-in check blocks must include `identifier`, `title`, and `description`; `message` stays user-facing.
19. Use `LiteralKit` for internal literal domains when `.is`, `.thunk`, `$match`, or annotation-bearing schema values are part of the design.
20. Model finite variants, lifecycle states, status/result cases, and case-specific payloads as discriminated unions; keep optional/nullish bags at external boundaries only when compatibility requires them.
21. Prefer the tersest equivalent Effect helper form when behavior is unchanged: direct helper refs over trivial wrapper lambdas, `flow(...)` for passthrough `pipe(...)` callbacks, and shared thunk helpers when already in scope.
22. Reusable functions that directly return `Effect.gen(function*)` must use `Effect.fn` or `Effect.fnUntraced`; zero-arg one-off effect values may stay as `Effect.gen`.
23. Functions stay within the fallow complexity ceilings pinned in `.fallowrc.jsonc` `health` (the integers live in config, not prose). Every `fallow-ignore-*` suppression carries a `-- <reason>` (enforced by the `require-suppression-reason` rule); an honestly-complex function gets a `thresholdOverrides` entry with `reason` and a review date, never a bare suppression. Prefer real seams (match helpers, schema/data-table dispatch, named concept extraction) over threshold-appeasement fragmentation.

## Allowlist Contract

Boundary exceptions are allowed only through [effect-laws.allowlist.jsonc](./effect-laws.allowlist.jsonc).
It is the sole supported exception registry for Effect-law and runtime-boundary exceptions, and `bun run beep laws allowlist-check` is the required integrity check that `bun run lint` runs in normal quality flows.
Do not add entries for scanner misses or cleanup convenience. Harden the checker when a real boundary is being reported as a false positive, or remediate the module when the exception is ordinary application code.
The `native-runtime` law is a zero-baseline check: unsuppressed warnings and errors both fail `--check`. Browser availability guards such as `typeof window === "undefined"` are recognized by the checker and should not be allowlisted.

Required fields per entry:

- `rule`: checker rule id
- `file`: repo-relative path
- `kind`: violation kind discriminator
- `reason`: why this boundary exception is currently necessary
- `owner`: responsible team or package
- `issue`: tracking issue URL or id

Optional fields:

- `expiresOn`: `YYYY-MM-DD`

The allowlist checker verifies schema validity, duplicate keys, referenced file existence, exact live violation matches for `beep-laws/no-native-runtime`, and generated snapshot freshness. Stale entries should be removed in the same change that removes the native runtime usage.

## Dual-Arity Inventory Contract

Legitimate scanner exclusions belong in the checker, not in the inventory. Constructor factories documented as `@category constructors`, tagged-template identity helpers, React hooks, and React components are recognized by the scanner and should not create inventory churn.

Inventory entries should remain only for real public helper APIs that need remediation or an explicit package-owner exception. A callable shaped `(input, options?)` is excluded because its one-argument form is already complete. Prefer options objects for third parameters; optional object-shaped third parameters are valid when the first two parameters are required, but scalar third parameters are not.

## Scope

Wave 1 enforcement scope:

- `apps/**`
- `packages/**`
- `packages/tooling/**`
- `infra/**`

Excludes by default:

- tests, goals, Storybook snapshots, and fixtures
- generated artifacts

## Rollout

1. Warnings + reporting.
2. Codemod/autofix for mechanical import normalization.
3. Manual cleanup for remaining violations.
4. Promote selected warnings to errors once baseline is near zero.
5. Keep promoted policy lanes green through `bun run beep lint policy`, which runs the repo-wide policy checks without the aggregate Turbo lint lane for CI and Yeet verification.

## Deep References

- [JSDoc patterns](../.patterns/jsdoc-documentation.md)
- [Effect library development patterns](../.patterns/effect-library-development.md)
- [Effect-first development](./effect-first-development.md)
