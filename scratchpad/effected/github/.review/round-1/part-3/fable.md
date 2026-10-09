### fable-1-1
- file: scratchpad/effected/github/internal/octokit.ts:152
- class: type-safety   severity: required
- standard: D15 (unsafe type assertion includes any `any`), D11 (unsafe type assertion is required); @octokit/types 18.0.0 RequestInterface   evidence: node_modules/@octokit/types/dist-types/RequestInterface.d.ts declares `<R extends Route>(route: EndpointKeys | R, options?) : R extends EndpointKeys ? Promise<Endpoints[R]["response"]> : Promise<OctokitResponse<any>>` with `Route = string`. `octokit.request<string>(route, withSignal(params, signal))` therefore has type `Promise<OctokitResponse<any>>`, and the annotation `Promise<OctokitResponse<A>>` holds only because `any` is assignable to `A`. The oracle (src/internal/octokit.ts:147) spelled the same narrowing as `as Promise<OctokitResponse<A>>`; the port removed the token, not the narrowing. D15's scan counts `as`/`!`/`<T>expr`/`any` tokens, so `parity` reports 0 while the program's types still carry `any` at this site (`rg -n 'request<string>' scratchpad/effected/github/internal/octokit.ts`). The sibling `pageSource` (line 165) is sound by contrast: plugin-paginate-rest's `<T, R extends Route>` overload infers `T = A` from the annotation and never produces `any`.
- failure: `transport.request<X>(op, route, params)` compiles for any `X` and `response.data` is whatever GitHub returned regardless of `X`; `GitHubClient.request` (`Rest.Data<R>`) and `requestDecoded` (`unknown`) lean on this as the package's one trust point, yet nothing records it (README Port notes: "Deviations: None") and the gate can no longer see it.
- fix: Take octokit's free-`T` options overload, which never yields `any`: split the route the way `@octokit/endpoint` `merge` does (`route.split(" ")`, `url ? { method, url } : { url: method }`), guard the verb with a `LiteralKit(["DELETE","GET","HEAD","PATCH","POST","PUT"]).is` so `method` types as `RequestMethod`, and call `octokit.request<A>({ ...routeOptions(route), ...withSignal(params, signal) })`. If the `<string>` boundary is to stay, record it in the ledger row and README Port notes as the module's one D15 trust site so the gate's blind spot is on record.

### fable-1-2
- file: scratchpad/effected/github/internal/octokit.ts:219
- class: type-safety   severity: required
- standard: D15/D11 (unverified narrowing); standards/effect-laws-v1.md law 17 (derive guards from schemas and built-ins, not ad-hoc predicate helpers); AGENTS.md Code Laws (prefer derived `S.is(...)` guards over ad-hoc predicate helpers)   evidence: `const isRecord = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value)`. `P.isObjectOrArray` is `typeof input === "object" && input !== null` (node_modules/effect/dist/Predicate.js:687) and narrows to `{ [x: PropertyKey]: unknown } | Array<unknown>` (Predicate.d.ts:1138); the hand-written predicate re-labels that as `Record<string, unknown>`, which `Array<unknown>` is not (no string index signature). It is the oracle's `as Record<string, unknown>` (src/internal/octokit.ts:210) rewritten as a user-defined type guard the D15 token scan cannot see. effect 4.0.2 exposes no `P.isRecord` (`rg isRecord node_modules/effect/dist/Predicate.d.ts` returns nothing).
- failure: An array-shaped `error.response.headers` passes the guard typed as a record and reaches `readRateLimitHeaders`; harmless today only because `headerNumber` reads keys an array never has, which is exactly the unverified narrowing D15 forbids.
- fix: Delete `isRecord` and narrow with built-ins at line 216: `return P.isObjectOrArray(headers) && !A.isArray(headers) ? headers : undefined;` (add `import * as A from "effect/Array"`). The surviving `{ [x: PropertyKey]: unknown }` branch is assignable to `Readonly<Record<string, unknown>>`. Not observable under D9: octokit's `RequestError.response.headers` is always an object, and an array could never carry the three `x-ratelimit-*` keys the reader requires.

### fable-1-3
- file: scratchpad/effected/github/internal/octokit.ts:65
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7 (extend `S.TaggedError` from `effect/Schema` for typed errors); .patterns/error-handling.md (S.TaggedError pattern); D5 (errors per error-handling.md); tsgo `preferSchemaTaggedError` is not enabled in tsconfig.base.json, so no gate covers it   evidence: `class TransportFailure extends Data.TaggedError("TransportFailure")<{ readonly error: unknown }> {}` is the only `Data.TaggedError` in the module (`rg -n 'Data\.TaggedError' scratchpad/effected/github` gives one hit); every other error (`GitHubError`, `GitHubGraphQLError`, `GitHubAppError`, every `UnstubbedError`) is `S.TaggedError<X>($I\`X\`)(...)`. The class exists only to satisfy `unknownInEffectCatch` for the two-argument `Effect.tryPromise` at line 127 and is unwrapped one combinator later.
- failure: A law-7 carrier that is neither schema-backed nor identity-annotated, and a second error idiom inside one module.
- fix: Drop the class and the `effect/Data` import; use the one-argument `Effect.tryPromise(call)`, which fails with `Cause.UnknownError` whose `cause` is the thrown value (node_modules/effect/dist/internal/effect.js:772; `UnknownError extends YieldableError extends Error`), and read it in the handler: `Effect.catch(Effect.fnUntraced(function* ({ cause }) { const now = yield* Clock.currentTimeMillis; yield* record(readThrownHeaders(cause)); return yield* Effect.fail(classify(cause, now)); }))`. Behaviour is identical (same thrown value, same `now`, same headers). If a named carrier is preferred, make it `S.TaggedError<TransportFailure>($I\`TransportFailure\`)("TransportFailure", { error: S.Defect() })` with a `$ScratchpadId.create("effected/github/internal/octokit")` composer as in GitHubError.ts:9.

### fable-1-4
- file: scratchpad/effected/github/internal/octokit.ts:171
- class: effect-idiom   severity: required
- standard: tsgo `preferSucceedSomeOrNone` (tsconfig.base.json:193 at `error`); standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: Lines 171 and 181 read `Effect.succeed(O.none<ReadonlyArray<A>>())`. The rule is at error and the gate is green at 3fa5876691, so the gate missed this shape; GitBranch.ts:252 (`Effect.succeed(O.none<string>())` under the plain `effect/Option` alias) also passes, which pins the miss to the explicit type-argument form rather than the `@beep/utils/Option` alias. `Effect.succeedNone: Effect<Option<never>>` (node_modules/effect/dist/Effect.d.ts:1473) is assignable to `Effect<Option<ReadonlyArray<A>>, GitHubError>` in both positions (the ternary at 169-187 and the `flatMap` return at 181).
- failure: The idiom the gate is configured to reject survives in two places.
- fix: Replace both occurrences with `Effect.succeedNone`.

### fable-1-5
- file: scratchpad/effected/github/internal/octokit.ts:206
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form); D9 (upstream's exact predicate)   evidence: `P.isObjectKeyword(params.request) && !P.isFunction(params.request)`: `isObjectKeyword` is `typeof x === "object" && x !== null || isFunction(x)` (node_modules/effect/dist/Predicate.js:782-784), so the conjunction reduces to `typeof x === "object" && x !== null`, which is `P.isObjectOrArray` (Predicate.js:687-689) and is the oracle's own test (src/internal/octokit.ts:200). Outside the shapes the `terse-effect` law checker names, hence backlog.
- failure: None at runtime; two guards spell one, and the narrowing is `object` rather than the spreadable record/array union.
- fix: `const existing = P.isObjectOrArray(params.request) ? params.request : {};`

### fable-1-6
- file: scratchpad/effected/github/internal/octokit.ts:91
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form)   evidence: Lines 91-94 spread four single-key `O.getSomesStruct({...})` calls; `getSomesStruct` (packages/foundation/modeling/utils/src/Option.ts:112) takes a whole struct and drops the `None` keys, so one call expresses all four with the same result.
- failure: None; four `R.getSomes` passes and four spreads where one suffices.
- fix: `...O.getSomesStruct({ auth: O.map(O.fromUndefinedOr(options.token), Redacted.value), baseUrl: O.fromUndefinedOr(options.baseUrl), userAgent: O.fromUndefinedOr(options.userAgent), request: O.map(O.fromUndefinedOr(options.fetch), (fetch) => ({ fetch })) }),`

### fable-1-7
- file: scratchpad/effected/github/internal/octokit.ts:67
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (shared thunk helpers over trivial lambdas)   evidence: `SILENT_LOG` is four `() => {}` lambdas; `constVoid: LazyArg<void>` (node_modules/effect/dist/Function.d.ts:496) is assignable to each of octokit's `log.*` members.
- failure: None.
- fix: `import { constVoid } from "effect/Function"` and `const SILENT_LOG = { debug: constVoid, info: constVoid, warn: constVoid, error: constVoid };`

### fable-1-8
- file: scratchpad/effected/github/internal/octokit.ts:119
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (accurate Details prose); backlog by brief because S2 has not run; D9 / section 14 (code change would be an unforced enhancement)   evidence: The `attempt` doc says the `AbortSignal` "is threaded into octokit's `request.signal`, so interrupting the fiber aborts the in-flight HTTP request". Only `request` (line 152) passes the signal through `withSignal`; `pageSource` (line 175, `() => iterator.next()`) and `graphql` (line 196) ignore the `signal` argument, so their in-flight requests outlive an interrupt. Identical upstream, so not a code deviation to make here.
- failure: A reader of `attempt` assumes pagination and GraphQL abort on interrupt; they do not.
- fix: Scope the sentence to `request` ("`request` threads the signal through `withSignal`; the paginating iterator and `graphql` do not accept one"). As a recorded enhancement, `graphql` could pass `{ ...variables, request: { signal } }` (`request` is a forwarded option key in @octokit/graphql `NON_VARIABLE_OPTIONS`).

REQUIRED: 4
BACKLOG: 4
