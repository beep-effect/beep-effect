### fable-1-1
- file: scratchpad/effected/package-json/EntryPoint.ts:186
- class: bug   severity: required
- standard: D11 (bug in added public surface); standards/effect-laws-v1.md 'Dual-Arity Inventory Contract' (a callable shaped `(input, options?)` is excluded from dual form because its one-argument form is already complete); D9   evidence: Upstream `resolveEntryPoint(manifest, options?)` is a plain function. The port wraps it in `dual((args) => args.length >= 2 || (args[0] !== undefined && (P.hasProperty(args[0], "exports") || P.hasProperty(args[0], "main") || !P.hasProperty(args[0], "conditions"))), ...)` (lines 186-191). `ResolveEntryPointOptions` has only an optional `conditions`, so `{}` is a complete options bag yet the predicate routes it as a manifest. Read-only probe (bun, repo root): `resolveEntryPoint({})` -> Result.Success("index.js"); `pipe({ exports: "./a.js" }, resolveEntryPoint({}))` -> `TypeError: args[0] is not a function`; `resolveEntryPoint(undefined)` -> returns a function (upstream threw at `manifest.exports`). The added test (scratchpad/test/package-json/EntryPoint.test.ts:23-29) never exercises `resolveEntryPoint({})`.
- failure: The documented data-last overload `(options?) => (manifest) => Result` is unusable with an empty or defaulted options object: `pipe(manifest, resolveEntryPoint({}))` throws a TypeError at runtime, and a caller forwarding `options ?? {}` silently gets a Result instead of a function. A manifest-typed value that happens to carry a `conditions` key but no `exports`/`main` is also misrouted to the data-last branch. The ambiguity is structural (both parameters are optional object bags), so no predicate can make this dual total.
- fix: Restore the upstream non-dual signature: `export const resolveEntryPoint = (manifest: EntryPointManifest, options?: ResolveEntryPointOptions): Result.Result<string, UnresolvedEntryPointError> => { ... }` (delete the overload block, the `dual(...)` call and the predicate, drop the now-unused `dual`/`P.hasProperty` imports) and delete the added `supports one-argument manifests and pipeable options` test. If a pipeable form is wanted, add a separately named curried helper and list it under README Port notes -> Added exports.

### fable-1-2
- file: scratchpad/effected/package-json/internal/format.ts:171
- class: law   severity: required
- standard: standards/effect-laws-v1.md Short Law 10: 'No native `Array.prototype.sort`; use `A.sort` with explicit `Order`'; AGENTS.md Code Laws 'Prefer effect helper modules over native helpers'   evidence: `rg -n '\.sort\(' scratchpad/effected/package-json/internal/format.ts` -> 171 `for (const key of R.keys(value).sort(byCodePoint))`, 197 `known.sort((a, b) => a[2] - b[2])`, 198 `restPublic.sort((a, b) => byCodePoint(a[0], b[0]))`, 199 `restPrivate.sort((a, b) => byCodePoint(a[0], b[0]))`. The gate missed it: `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:463` only reports `native-sort` when `inHotspotScope && propertyName === "sort" && objectName !== "A"`, and `internal/format.ts` is not a hotspot path, so `native-runtime --check` is green while four native sorts remain.
- failure: Four in-place native sorts in the canonical key-ordering path (`sortMapEntries`, `sortKeys`) violate Law 10; `known.sort`/`restPublic.sort`/`restPrivate.sort` also mutate the arrays they receive, which the law's `A.sort` (returns a new array) is meant to rule out. Output bytes are unaffected today, so this is a pure law finding, not a D9 deviation.
- fix: Import `* as Order from "effect/Order"` and replace each site with a non-mutating sort over an explicit Order that keeps the code-unit comparison (D9: same bytes): `const byKey = Order.make(byCodePoint)`; line 171 `A.sort(R.keys(value), byKey)`; line 197 `const sortedKnown = A.sort(known, Order.mapInput(Order.number, (e: readonly [string, unknown, number]) => e[2]))`; lines 198-199 `A.sort(restPublic, Order.mapInput(byKey, (e) => e[0]))` / same for `restPrivate`, then build `result` from the sorted copies.

### fable-1-3
- file: scratchpad/effected/package-json/PackageJsonFormat.ts:105
- class: law   severity: required
- standard: D9 / section 14 deviation protocol (ledger entry first, then README Port notes -> Deviations); operator ruling 2026-10-09 'one ledger plus README deviation entry per module per systemic class (identity keys, S.Finite, tagged errors, ...)'; tsgo rule effecttsgo/schema-number (law:effecttsgo/schema-number)   evidence: Upstream `PackageJsonModifyError.path: Schema.Array(Schema.Union([Schema.String, Schema.Number]))`; port line 105 `S.Array(S.Union([S.String, S.Finite]))`. Read-only probe: `PackageJsonModifyError.make({ path: ["a", NaN], cause })` and `["a", Infinity]` both throw `Error: Schema validation failed` in the lab, while upstream's `Schema.Number` accepts them. README Port notes -> Deviations reads `None`; PORT_LEDGER row `w3-package-json` has `deviations: []`.
- failure: An observable accepted-input change (section 14: 'a different accepted input') forced by the tsgo `schema-number` rule is carried with no `law:` record. The ledger and README both assert zero deviations, so a reviewer or promoter cannot distinguish this from an accidental drift, and the module cannot honestly reach `done` with Port notes 'complete' (section 6).
- fix: Add one systemic-class entry to the `w3-package-json` ledger row `deviations` and to README Port notes -> Deviations: `law:effecttsgo/schema-number` — `PackageJsonModifyError.path` numbers are `S.Finite`; non-finite path segments (`NaN`, `±Infinity`) are rejected at construction (upstream `Schema.Number` accepted them); sites: PackageJsonFormat.ts:105; adjusted upstream tests: none (no upstream test covers a non-finite path).

### fable-1-4
- file: scratchpad/effected/package-json/PackageJsonFile.ts:187
- class: law   severity: required
- standard: D9 / section 14 (a deviation is any observable difference, including a different error tag or set); D2 superset export rule + README 'Added exports'; scratchpad/effected/jsonc/README.md deviation 8 (`law:7`)   evidence: Upstream `PackageJsonFileShape.modify` error union is `PackageJsonReadError | PackageJsonNotFoundError | PackageJsonParseError | PackageJsonModifyError | PackageJsonWriteError`; the port adds `| JsoncStringifyError` (line 187, imported at line 8 from `../jsonc/index.ts`). Cause: lab `jsonc/JsoncModifier.ts:130` types `modify` as failing with `JsoncStringifyError | JsoncModificationError` (jsonc README deviation 8, `law:7`), whereas the upstream oracle's `JsoncModifier.modify` serializes with a bare `JSON.stringify` (upstream JsoncModifier.ts:154,168) and never mentions `JsoncStringifyError`. `PackageJsonFormat.modify` / `modifyToString` therefore also infer the wider union. `rg JsoncStringifyError scratchpad/effected/package-json/index.ts` -> not re-exported. README Deviations: `None`; ledger `deviations: []`, `exportsAdded: []`.
- failure: A public error-channel widening (a third failure tag a `catchTag`-exhaustive consumer must now handle) is undocumented at the package-json boundary, and the new member of that public union cannot be imported from this module's index, so a consumer cannot name or narrow it without reaching into `../jsonc`. The jsonc record does not cover the downstream contract.
- fix: (1) Record the inherited deviation in the ledger row and README Port notes -> Deviations: `law:7` (via jsonc deviation 8) — `PackageJsonFile.modify`, `PackageJsonFormat.modify` and `modifyToString` additionally fail with `JsoncStringifyError` when an edit value cannot be serialized; adjusted upstream tests: none. (2) In index.ts change the jsonc re-export to `export { JsoncEdit, type JsoncPath, JsoncStringifyError } from "../jsonc/index.ts";` and list `JsoncStringifyError` under Added exports / ledger `exportsAdded`.

### fable-1-5
- file: scratchpad/effected/package-json/LenientManifest.ts:69
- class: law   severity: required
- standard: standards/effect-laws-v1.md Short Law 21 and AGENTS.md Code Laws: 'Prefer the tersest equivalent helper form when behavior is unchanged: direct helper refs over trivial wrapper lambdas'   evidence: Lines 69-70: `const isString = (value: unknown): value is string => P.isString(value);` and `const isBoolean = (value: unknown): value is boolean => P.isBoolean(value);`. `P.isString`/`P.isBoolean` already have the exact signature `(input: unknown) => input is string|boolean` (node_modules/effect/dist/Predicate.d.ts). The `terse-effect --check` gate is green on this commit, so it does not detect wrapper lambdas around Predicate guards.
- failure: Two trivial wrapper lambdas re-declare guards that exist verbatim in `effect/Predicate`, violating Law 21 while adding nothing (same type predicate, same runtime).
- fix: Replace lines 69-70 with `const isString = P.isString;` and `const isBoolean = P.isBoolean;` (or use `P.isString` / `P.isBoolean` directly in `stringGuard`, `booleanGuard`, `isStringRecord`, `isStringArray`, `isStringOrRecord`).

### fable-1-6
- file: scratchpad/effected/package-json/PackageJsonFormat.ts:265
- class: effect-idiom   severity: backlog
- standard: .patterns/error-handling.md 'Effect.try Pattern' and 'NEVER: try-catch in Effect.gen'; D11 perf rule (no measurement, so backlog)   evidence: `modify` (PackageJsonFormat.ts:265-271) and `readJson` (PackageJsonFile.ts:238-249) now decode through `S.fromJsonString(S.Unknown)` and, on failure, call `PackageJsonFormat.formatToString(source)` a second time purely to recover the native `SyntaxError` as `cause` (the schema codec discards it: node_modules/effect/dist/SchemaGetter.js:936-943 `catch: () => new SchemaIssue.InvalidValue(...)`). Probe confirms the final `cause` is the `SyntaxError` (behaviour preserved), at the cost of parsing invalid text twice and coupling the parse path to the formatter. The sync entry points (`formatToString`, `LenientManifest.parseResult`) still use a plain `JSON.parse` try/catch, so the module already has a one-parse, law-compliant way to produce `PackageJsonSyntaxError`.
- failure: Invalid JSON is parsed twice on every failing `modify`/`modifyToString`/`PackageJsonFile.read|modify` call, and the `cause` fidelity depends on `formatToString` failing for the same reason (an unreachable `Result.isFailure(...) ? ... : cause` branch documents the coupling). No observable divergence today.
- fix: Extract the existing sync try/catch into one internal `parseJsonObject(source): Result.Result<Record<string, unknown>, PackageJsonSyntaxError>` (used by `formatToString` and `LenientManifest.parseResult` too) and in the Effect paths use `yield* Effect.fromResult(parseJsonObject(source))`; `readJson` then maps `PackageJsonSyntaxError` to `PackageJsonParseError` with `cause: error.cause ?? error`. One parse, same `cause`, no schema round-trip, and the `prefer-schema-over-json` diagnostic stays out of generator bodies.

### fable-1-7
- file: scratchpad/effected/package-json/PackageValidator.ts:189
- class: effect-idiom   severity: backlog
- standard: AGENTS.md 'Functions returning effect generators should always use Effect.fn/fnUntraced' (does not apply to a non-generator lambda); standards/effect-first-development.md tracing guidance   evidence: `runRules` (line 148) is already `Effect.fn("PackageValidator.validate")`; lines 189 and 199 wrap the layer's `validate` in a second `Effect.fn("PackageValidator.validate")((pkg) => runRules(pkg, rules))`. Upstream had `validate: (pkg) => runRules(pkg, defaultRules)` with a single span. The lambda returns an Effect value, not a generator, so no law forced the outer wrapper.
- failure: Every `PackageValidator.validate` call now opens two nested spans with the identical name `PackageValidator.validate`, doubling trace volume and making span trees misleading; no functional change.
- fix: Drop the outer wrappers: `validate: (pkg) => runRules(pkg, defaultRules)` and `{ validate: (pkg) => runRules(pkg, config.rules) }` (or keep the outer `Effect.fn` and make `runRules` `Effect.fnUntraced`).

### fable-1-8
- file: scratchpad/effected/package-json/PackageManager.ts:127
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (span naming: qualified, stable names); D9 (upstream transform had no span)   evidence: `decode: Effect.fn("decode")((input: string): Effect.Effect<PackageManager, SchemaIssue.Issue> => { ... })` inside `SchemaTransformation.transformEffect`; upstream used a plain arrow. The body is not a generator, so the effect-fn law did not require the wrapper; the chosen span name `decode` carries no module/codec qualifier.
- failure: Every `PackageManager.FromString` decode (including each `Package.decode` of a manifest with `packageManager`) emits an unqualified span named `decode`, indistinguishable from any other `decode` span in a trace; upstream emitted none.
- fix: Use a plain arrow (as upstream) or, if a span is wanted, `Effect.fn("PackageManager.FromString.decode")`; `Effect.fnUntraced` is the zero-cost alternative that still satisfies the effect-fn law.

### fable-1-9
- file: scratchpad/effected/package-json/PackageJsonFile.ts:238
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md (span naming); consistency with the sibling spans in the same `make` block   evidence: Lines 238, 254, 264 create spans `readJson`, `withPreservedSource`, `writeText` while the public operations in the same block use the qualified form `PackageJsonFile.read` / `.write` / `.readManifest` / `.writeManifest` / `.modify` (lines 270-296). Upstream expressed these three helpers as untraced `Effect.gen` thunks.
- failure: Three unqualified internal span names leak into traces next to qualified public ones; a trace consumer cannot attribute `readJson` to this service.
- fix: Rename to `PackageJsonFile.readJson`, `PackageJsonFile.withPreservedSource`, `PackageJsonFile.writeText`, or switch the three internals to `Effect.fnUntraced` so only the public operations produce spans (matches upstream's trace surface).

### fable-1-10
- file: scratchpad/effected/package-json/EntryPoint.ts:61
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md Law 11 (`Match` over `switch`, exhaustive matching for literal unions); ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md (literal unions are closed)   evidence: `message` uses `Match.value(this.reason).pipe(Match.when("noRootExport", ...), Match.when("noConditionMatched", ...), Match.orElse(() => ...))` for the three-member literal `reason`. `Match.orElse` absorbs the third literal and any future one, so adding a fourth `reason` to the schema never fails to compile here (upstream's `default:` had the same gap, but the port already moved to `Match`).
- failure: The message for `unsupportedExportsForm` is not named in the match; a future reason literal silently inherits the wrong message instead of a compile error.
- fix: Replace `Match.orElse(() => ...)` with `Match.when("unsupportedExportsForm", () => ...)` followed by `Match.exhaustive`.

### fable-1-11
- file: scratchpad/effected/package-json/internal/format.ts:258
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md 'Dual-Arity Inventory Contract' (a callable shaped `(input, options?)` is excluded; prefer options objects); D9 (upstream shape)   evidence: `resolveIndent` (lines 255-266) and `renderJson` (lines 298-324) are non-exported helpers turned into `dual(2, ...)`; every caller is two-argument data-first (`format.ts:287`, `PackageManifest.ts:121`, `PackageJsonFormat.ts:223`, `Package.ts:542`). `resolveIndent`'s second parameter is `string | undefined`, so a one-argument call such as `resolveIndent(indent)` type-checks against the data-last overload and returns a function instead of a string.
- failure: Arity-sniffing on internal helpers with an optional-shaped trailing parameter adds a per-call `arguments.length` branch and a foot-gun (one-arg call returns a function) for zero consumers; the grilling ruled that lab changes no law forced should restore the upstream shape.
- fix: Restore the plain two-parameter functions from upstream (`export const resolveIndent = (indent, sourceText): string | number => ...`, `export const renderJson = (raw, options): string => ...`) and drop the `dual` import.

### fable-1-12
- file: scratchpad/effected/package-json/Repository.ts:265
- class: effect-idiom   severity: backlog
- standard: AGENTS.md Code Laws 'Prefer effect helper modules (`String`, `Equal`, ...) over native helpers'; tsgo rule effecttsgo/prefer-effect-array (default off, so not gate-enforced)   evidence: Native array iteration helpers remain where `effect/Array` equivalents exist: Repository.ts:265-276 (`.map`, `.filter`, `.some`, `.join` on `segments`), LenientManifest.ts:74-79 (`R.values(value).every(isString)`, `value.every(...)`), EntryPoint.ts:101 (`keys.some(...)`), PackageValidator.ts:63 (`this.failures.map`), PackageValidator.ts:105 (`[...].some(...)`), Funding.ts:226 (`entries.map(encodeEntry)`). `A` is already imported in most of these files.
- failure: Mixed native/effect iteration style in domain code; the `prefer-effect-array` rule is off in the gate so nothing enforces the law here. No behavioural impact.
- fix: Swap for `A.map`, `A.filter`, `A.some`, `A.every`, `A.join` (`effect/Array`) at the listed sites, keeping callbacks `(value, index)`-shaped; land it with the S4 crispen pass rather than as a standalone change.

### fable-1-13
- file: scratchpad/effected/package-json/README.md:286
- class: docs   severity: backlog
- standard: D4 carried documentation surfaces; section 10.3 README adaptation; section 6 'README Port notes complete' before `done`   evidence: README Port notes -> Attribution lines 286-304 are a pasted ripgrep listing (`- scratchpad/effected/package-json/License.ts:1 // SPDX license validation: the \`SpdxLicense\` branded schema ...`, `- scratchpad/effected/package-json/internal/format.ts:31 "license",`, 19 lines in all) that followed a `rg -n -i license` sweep for the License line and was committed into the bullet list.
- failure: The Attribution section is unreadable and misstates the port notes (source-line dumps presented as attribution bullets); the ledger `done` gate requires complete Port notes.
- fix: Delete README.md lines 286-304, leaving the three real Attribution bullets (upstream package, upstream commit, LICENSE).

### fable-1-14
- file: scratchpad/test/package-json/PackageJsonFormat.test.ts:147
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md 'Never use Effect.runSync in tests'; goals/effect-vitest-canon/SPEC.md D5 (Option/Result/Exit asserted with `@effect/vitest/utils` helpers); operator order: S3 not yet run, backlog only   evidence: `Effect.runSync(Effect.map(Package.decode(JSON.parse(source)), ...))` at PackageJsonFormat.test.ts:147-150 and `.pipe(Effect.fromResult, Effect.runSync)` at :237 inside plain `it`; `assert.isTrue(O.isNone(...))` / `assert.isTrue(O.isSome(...))` / `assert.deepStrictEqual(x, O.some(...))` remain across License.test.ts, Repository.test.ts:97-98, Person.test.ts:116, PackageManagerRange.test.ts:226-234, Dependency.test.ts:12,35 instead of `assertNone` / `assertSome`. Both are upstream-verbatim (D6/11.1), so they belong to the S3 canon migration.
- failure: Two tests run effects with `Effect.runSync` under a non-effect `it`, and Option assertions use boolean guards that hide the actual value on failure; neither is a correctness defect today.
- fix: At S3: convert the two `runSync` tests to `it.effect` with `yield*`, and replace the Option boolean assertions with `assertNone` / `assertSome` from `@effect/vitest/utils` (keep `assert.deepStrictEqual` where the test deliberately compares whole Option values).

REQUIRED: 5
BACKLOG: 9
