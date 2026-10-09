### fable-1-1
- file: scratchpad/effected/workspaces/LockfileReader.ts:88
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14 (deviation protocol); 2026-10-09 ruling 'one ledger plus README deviation entry per module per systemic class, listing sites and adjusted upstream tests'   evidence: Upstream `LockfileReaderShape.read/integrity/refresh` are `() => Effect` (oracle LockfileReader.ts:73,89,91); the lab makes them bare `Effect` values (LockfileReader.ts:88,104,106), likewise `WorkspaceDiscoveryShape.info/listPackages/refresh` (WorkspaceDiscovery.ts:210,212,263) and `WorkspaceCatalogsShape.refresh` (WorkspaceCatalogs.ts:572). The change landed in `c4f461a6cc` to clear tsgo `lazyEffect`, which `tsconfig.base.json:165` pins at `error`, so it is a diagnostic-forced deviation and allowed under section 14 cause 1. `rg -o '\.(info|listPackages|read|integrity|refresh)\(\)'` counts 87 upstream test call sites across 11 files rewritten to the property form (e.g. LockfileReader.test.ts:55 `reader.read()` -> `reader.read`). README.md:589 'Deviations: None' and the ledger row has `deviations: []`, so the public-shape change and its test adjustments are unrecorded; section 14 requires the ledger entry first and the README row citing the adjusted test.
- failure: A reviewer or the promotion grill cannot tell this public contract change from an accident; `makeTest({ read: () => ... })` consumers written against upstream silently stop type-checking with no port note explaining why; `ledger --verify` closes the row with the D9 record missing.
- fix: Add one ledger `deviations` entry `{ reason: "law:tsgo/lazyEffect", upstreamBehaviour: "zero-arg service members `() => Effect`", labBehaviour: "Effect values", test: <the 11 adjusted test files> }` listing the seven members, and the matching row under README.md `### Deviations`; no code change.

### fable-1-2
- file: scratchpad/effected/workspaces/README.md:589
- class: law   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 + section 14; 2026-10-09 ruling on recording law-forced changes per systemic class   evidence: Three further observable deviations in the focus files are unrecorded (README 'Deviations: None', ledger `deviations: []`): (a) `JSON.parse` replaced by `S.fromJsonString(S.Unknown)` at LayerPolicy.ts:146, LockfileReader.ts:257 and PackageManagerName.ts:309, so the `cause` on `LayerPolicyError{reason:"json"}` / `WorkspaceManifestError{kind:"decode"}` is a `SchemaError` instead of a `SyntaxError` (probe: `S.decodeUnknownResult(S.fromJsonString(S.Unknown))("{bad")` fails with `SchemaError`); (b) `new Error(...)` defects/causes replaced by private `S.TaggedError` classes at LockfileReader.ts:138, PackageManagerName.ts:27 and ConfigDependencyHooks.ts:55 (law 7); (c) identity keys change schema identifiers, which the adjusted upstream test LayerPolicy.test.ts:102 now reads as `definitions.@beep/scratchpad/effected/workspaces/LayerPolicy/LayerPolicyEncoded...` instead of `definitions.LayerPolicyEncoded...`.
- failure: Consumers branching on `cause instanceof SyntaxError` or on JSON-schema definition ids diverge from upstream with no port note; the D9 contract ('upstream tests and fixtures are the contract') is unverifiable for the module.
- fix: Add three ledger `deviations` entries (`law:effect-laws-v1#13` for fromJsonString causes, `law:effect-laws-v1#7` for tagged-error causes, `law:D5-identity` for identifiers, citing LayerPolicy.test.ts:102) and the matching README rows; no code change.

### fable-1-3
- file: scratchpad/effected/workspaces/PackageManagerName.ts:36
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named literal domains); EFFECTED_PORT_GOAL.md D5 ('LiteralKit for literal domains', applied at S4); AGENTS.md Code Laws ('named LiteralKit internal domains')   evidence: `PackageManagerName` (:36) and `PackageManagerEvidence` (:63) are exported, named literal domains built with `S.Literals([...]).pipe($I.annoteSchema(...))`. The module reads `PackageManagerEvidence.literals` at :209 and re-derives the union guard by hand at :475 (`name === "pnpm" || name === "npm" || name === "yarn" || name === "bun"`). The closed modules already use the kit (`scratchpad/effected/jsonl/JsonlError.ts:513`, `jsonc/Jsonc.ts:49`), and `LiteralKit` keeps `.literals`, `annotate` and the guard helpers (LiteralKit.schema.ts:355-359), so D2's export kind (`both`) is unchanged.
- failure: The literal domains carry no `.Enum`/`.is`/`$match` helpers, so call sites keep hand-rolled string comparisons that drift from the schema when a manager is added; the S4 D5 bar is not met.
- fix: `export const PackageManagerName = LiteralKit(["npm", "pnpm", "yarn", "bun"]).pipe($I.annoteSchema(...))` and the same for `PackageManagerEvidence`; replace :475 with `if (S.is(PackageManagerName)(name))`.

### fable-1-4
- file: scratchpad/effected/workspaces/PackageManagerName.ts:132
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (reused domain constraints are schemas first; derive guards with `S.is(...)`); law 13 (schema transformations over ad-hoc parsing)   evidence: `isPlainObject` is a hand-rolled predicate (`P.isObjectKeyword && !P.isFunction && !A.isArray`) used at :160, :163 and :311, and the same constraint is re-spelled inline at LayerPolicy.ts:23 (`withoutKeys`). Probe against installed effect 4.0.2: `S.decodeUnknownResult(S.Record(S.String, S.Unknown))` rejects `[1,2]`, `null` and `() => 1` and accepts `{a:1}`, i.e. identical semantics to the predicate, so `S.is(JsonObject)` is a drop-in guard (D9 preserved).
- failure: The manifest-object constraint lives in two hand-written predicates instead of one schema; `manifestOf` decodes JSON with `S.Unknown` and then re-checks the shape by hand, duplicating what the schema layer already expresses.
- fix: `const JsonObject = S.Record(S.String, S.Unknown); const isPlainObject = S.is(JsonObject);` (keep the `Record<string, unknown>` narrowing), and reuse the same guard in LayerPolicy.ts:23.

### fable-1-5
- file: scratchpad/effected/workspaces/DependencyGraph.ts:162
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; use `A.sort` with an explicit `Order`)   evidence: Ten native `.sort()` sites: :162, :218, :228, :253, :359, :366, :391, :411, :426, :430. The gate missed them: `NoNativeRuntime.ts:463` only reports `nativeSort` when `inHotspotScope`, and `NoNativeRuntimeHotspots.ts` lists `scratchpad/effect-ontology/` but not `scratchpad/effected/`. Sibling files in this module already comply (`VersioningStrategy.ts:148`, `internal/packedInstallPlan.ts:98` use `A.sort(..., Str.Order)`). Behaviour is unchanged: `Order.String` and the default comparator both order strings by UTF-16 code units.
- failure: Law 10 violation the hotspot-scoped gate cannot see; the module is inconsistent with itself on the ordering idiom.
- fix: Replace each `[...xs].sort()` with `A.sort(A.fromIterable(xs), Str.Order)` and `current.sort()` / `next.sort()` with `current = A.sort(current, Str.Order)` (import `* as Str from "effect/String"`).

### fable-1-6
- file: scratchpad/effected/workspaces/ChangeDetector.ts:184
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 10 (no native `Array.prototype.sort`; use `A.sort` with an explicit `Order`)   evidence: `[...committed].sort()` at :184 and `[...MutableHashSet.fromIterable([...committed, ...working])].sort()` at :187; same gate gap as fable-1-5 (hotspot-scoped `nativeSort` rule, `scratchpad/effected/` not a hotspot). String ordering is identical under `Str.Order`, so D9 holds.
- failure: Law 10 violation outside the gate's scope.
- fix: `A.sort(A.fromIterable(committed), Str.Order)` and `A.sort(A.fromIterable(MutableHashSet.fromIterable([...committed, ...working])), Str.Order)`.

### fable-1-7
- file: scratchpad/effected/workspaces/DependencyGraph.ts:44
- class: effect-idiom   severity: backlog
- standard: crispen rubric (section 12.1: helper walls); 2026-10-09 ruling 'adjacency -> HashMap of HashSet'; allowlist entry EFFECTED-WS-ADJACENCY   evidence: `DependencyNames` (:44-50) and `DependencyIndex` (:52-65) are hand-written adapters that implement `ReadonlySet`/`ReadonlyMap` over `MutableHashSet`/`MutableHashMap` solely so `sortSubset` (:317-326) can feed `kahn`/`cycleMembers` through the native-typed `Edges` interface, while `#index()` (:143-147) still builds native `Map`/`Set` under the allowlist entry the operator has ruled will be replaced.
- failure: Two throwaway collection adapters and a dual-typed `Edges`/`WorkspaceEdges` pair stay in the module after the planned adjacency replacement unless they are removed in the same change.
- fix: When the allowlisted `#index` sites move to `HashMap<string, HashSet<string>>`, retype `Edges` over the Effect maps, read with `HashMap.get`/`HashSet.size` in `kahn`, `materialize` and `cycleMembers`, and delete both adapter classes.

### fable-1-8
- file: scratchpad/effected/workspaces/DependencyGraph.ts:193
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3 (a branch unreachable by construction is a finding against the source; S3 coverage)   evidence: `if (frame === undefined) break;` (:193) and `if (next === undefined) continue;` (:201) were added for `noUncheckedIndexedAccess` and cannot execute: `frame` is read after `stack.length > 0` and `next` after `cursor < deps.length`. No test can cover them; S3's per-file 100 percent branch gate will fail here.
- failure: Dead branches that the S3 coverage gate cannot satisfy without an ignore comment, which section 16 forbids.
- fix: Use `A.last(stack)` / `A.get(frame.deps, frame.cursor)` with `O.match`, or pop the frame and re-push, so the index reads are total and the guards disappear.

### fable-1-9
- file: scratchpad/effected/workspaces/ChangeDetector.ts:197
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form); tsgo `lazyEffect` rationale   evidence: `rootOf` is still a zero-arg thunk (`const rootOf = (): Effect.Effect<...> => discovery.info.pipe(...)`) although `discovery.info` became a value in this port; it is called as `rootOf()` at :203 and :211.
- failure: Indirection the port removed from the service shapes survives in the one local helper that wraps them.
- fix: `const rootOf = Effect.map(discovery.info, (info) => info.root);` and `yield* rootOf` at the two call sites.

### fable-1-10
- file: scratchpad/effected/workspaces/ChangeDetector.ts:233
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (prefer the tersest equivalent Effect helper form)   evidence: `names.map((name) => O.getOrUndefined(MutableHashMap.get(byName, name))).filter((pkg): pkg is WorkspacePackage => pkg !== undefined)` round-trips an `Option` through `undefined` and a hand-written type guard.
- failure: Two passes and a manual refinement where one `filterMap` over the `Option` expresses the same lookup.
- fix: `const affected = A.filterMap(names, (name) => MutableHashMap.get(byName, name));`

### fable-1-11
- file: scratchpad/effected/workspaces/LockfileReader.ts:174
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (span naming); module convention `"LockfileReader.<member>"` at :267, :271, :277   evidence: `static readonly make = Effect.fn("make")(function* (...)` names the construction span `make`, while every other span in the file and in the sibling services is qualified (`"LockfileReader.read"`, `"ChangeDetector.changedFiles"`, `"PackageManagerDetector.detect"`). The upstream arrow was converted to `Effect.fn` for `effectFnOpportunity` (tsconfig.base.json:136).
- failure: A trace shows an anonymous `make` span with no service attribution.
- fix: `Effect.fn("LockfileReader.make")` or, since layer construction is not a traced operation, `Effect.fnUntraced`.

### fable-1-12
- file: scratchpad/effected/workspaces/LockfileReader.ts:267
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form)   evidence: `read: Effect.suspend(Effect.fn("LockfileReader.read")(function* () { return yield* memo; }))` (:267) and the same shape for `integrity` (:277) wrap an existing Effect value in a generator, an `Effect.fn` and a `suspend` only to attach a span.
- failure: Three layers of indirection where the value plus a span is the whole intent.
- fix: `read: Effect.withSpan(memo, "LockfileReader.read")` and `integrity: Effect.withSpan(Effect.gen(...), "LockfileReader.integrity")` (or keep the `Effect.fn` body and drop the outer `Effect.suspend`, which `Effect.fn` already defers).

### fable-1-13
- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:325
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (direct helper refs over trivial wrapper lambdas)   evidence: `value.every((entry: unknown): entry is string => P.isString(entry))` wraps `P.isString`, whose signature `(input: unknown) => input is string` already satisfies `Array.prototype.every`'s refinement overload; `isStringRecord` at :364 already passes `P.isString` directly.
- failure: A trivial wrapper lambda the terse law names, inconsistent with the sibling helper two lines down.
- fix: `A.isArray(value) && value.every(P.isString) ? value : fallback`.

### fable-1-14
- file: scratchpad/effected/workspaces/ConfigDependencySpec.ts:67
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 18 (named/reusable `S.makeFilter` carries identifier, title, description)   evidence: `specVersion` is a named module-level constraint (`SemVer` without build metadata) whose `S.makeFilter` carries no annotations; the message string doubles as its only description, so the generated JSON schema and error issues identify it only by position.
- failure: The constraint is anonymous in docgen, JSON-schema output and `SchemaIssue` rendering.
- fix: `S.makeFilter(..., { identifier: "ConfigDependencySpecVersion", title: "version without build metadata", description: "An exact SemVer version carrying no build identifiers" })`.

### fable-1-15
- file: scratchpad/effected/workspaces/DuplicateCheck.ts:281
- class: perf   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D11 (perf required only with a measurement or an algorithmic-class win)   evidence: The reachability walk pops with `queue.shift()` inside `while (queue.length > 0)`; `DependencyGraph.affectedBy` (:243-252) and `sortSubset` (:306-315) in the same module walk the same way with a cursor index. Upstream is identical, so there is no regression, and V8 left-trims `shift` on fast arrays, so no measurement was taken; recorded as backlog only.
- failure: Potentially quadratic queue handling on very large lockfiles under engines without the left-trim fast path.
- fix: `for (let head = 0; head < queue.length; head += 1) { const current = queue[head]; ... }` as `affectedBy` does.

### fable-1-16
- file: scratchpad/test/workspaces/ConfigDependencyHooksSubprocess.test.ts:1
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md D14 (`it.layer` for effectful layers; per-test `Effect.provide` only for pure `Layer.succeed` stubs); tsgo `strictEffectProvide` (tsconfig.base.json:217 at error)   evidence: The file opens with `// @effect-diagnostics strictEffectProvide:skip-file ...` and every test does `.pipe(Effect.provide(layer))` where `layer = ConfigDependencyHooks.layerSubprocess.pipe(Layer.provide(spawner.layer))` (:64), a `Layer.effect` layer; the suppression is what keeps the strict tsgo gate green. (`PackageManagerDetectorDouble.test.ts:1` carries the same directive but provides a pure `Layer.succeed` double, which the canon allows.)
- failure: A diagnostic the gate is configured to reject is silenced file-wide instead of being resolved by the canon's `it.layer` shape; S3 will have to revisit it.
- fix: At S3, wrap the suite in `it.layer(layer)("...", (it) => { ... })` and drop the `strictEffectProvide:skip-file` directive.

REQUIRED: 6
BACKLOG: 10
