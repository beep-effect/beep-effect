### fable-1-1
- file: scratchpad/effected/glob/internal/limits.ts:64
- class: law   severity: required
- standard: D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol: ledger `deviations` entry first, README Port notes -> Deviations row, cite the adjusted upstream test)   evidence: Upstream `assertCap` throws a native `TypeError` (oracle src/internal/limits.ts:47) and `assertValidPattern` throws `TypeError("invalid pattern")`; the port throws `InvalidCap.make` (limits.ts:64) and `InvalidPattern.make` (assertValidPattern.ts:21), and swaps `new Error(...)` invariant throws for `ASTError` (ast.ts:267,286,304,315,799), `MinimatchError` (minimatch.ts:908) and `BraceExpressionError` (braceExpressions.ts:64). Four upstream tests were adjusted to the new classes: scratchpad/test/glob/braceExpansion.test.ts:229-231 (upstream __test__/braceExpansion.test.ts:229-231 assert `TypeError`), hostility.test.ts:128-132 (upstream :127-131), engine.test.ts:105,140-141 (upstream :105,140-141). The cause exists (law 7 / native-runtime law lists `TypeError` and `Error` at packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:79,84), so the deviation is allowed, but README.md Port notes -> Deviations reads `None` and the `w1-glob` ledger row has `deviations: []`.
- failure: The parity record is false: the ledger and README claim zero observable deviations while the defect class for invalid caps and non-string patterns changed and four upstream test files were edited; a later session or `ledger --verify` reviewer cannot see which upstream tests no longer mean what upstream wrote.
- fix: Add one `deviations` entry to the `w1-glob` ledger row ({test: "scratchpad/test/glob/braceExpansion.test.ts:229, hostility.test.ts:128, engine.test.ts:105,140 (adjust upstream __test__/braceExpansion.test.ts:229-231, hostility.test.ts:127-131, engine.test.ts:105,140-141)", upstreamBehaviour: "invalid caps and non-string patterns die as native TypeError; AST/engine invariants as native Error", labBehaviour: "InvalidCap / InvalidPattern / ASTError / MinimatchError / BraceExpressionError S.TaggedError defects", reason: "law:7 (no native Error in production source) + native-runtime law"}) and mirror the same row under README.md `### Deviations`.

### fable-1-2
- file: scratchpad/test/glob/GlobPattern.test.ts:213
- class: test   severity: required
- standard: EFFECTED_PORT_GOAL.md section 11.1 / section 16 (never weaken a test) + operator ruling 2026-10-09 (deliberate wrong-input casts go through one `deliberatelyInvalid<T>` helper per module at scratchpad/test/<m>/deliberatelyInvalid.ts; D15's scan admits exactly that cast)   evidence: Upstream __test__/GlobPattern.test.ts:210 and :214 assert `GlobPatternOptions.make({ dot: undefined as unknown as boolean })` and `GlobPatternOptions.make({ platform: "vms" as unknown as "posix" })` throw. The port rewrote both to `Result.getOrThrow(S.decodeUnknownResult(GlobPatternOptions)({...}))` (lines 213, 217): a different entry point. `Class.make` validates through `SchemaParser.make(getClassSchema(this))` (node_modules/effect/dist/Schema.js:9170, bypassable with `MakeOptions.disableChecks`), while `decodeUnknownResult` runs the decoding path. The class annotation at GlobPattern.ts:120 (and JSDoc at :50) promises invalid options "throw at `make`". `ls scratchpad/test/*/deliberatelyInvalid.ts` shows the sanctioned helper in 11 sibling modules; glob has none.
- failure: The `make`-rejects-explicit-undefined and `make`-rejects-unknown-platform contracts are no longer exercised; a change that makes `GlobPatternOptions.make` skip checks keeps both tests green while the documented contract breaks.
- fix: Add scratchpad/test/glob/deliberatelyInvalid.ts (the toml shape: `export const deliberatelyInvalid = <T>(value: unknown): T => value as T;` with its JSDoc) and restore the upstream subjects: `GlobPatternOptions.make({ dot: deliberatelyInvalid<boolean>(undefined) })` and `GlobPatternOptions.make({ platform: deliberatelyInvalid<"posix">("vms") })`.

### fable-1-3
- file: scratchpad/test/glob/compliance.test.ts:17
- class: test   severity: required
- standard: D3 / D10 (oracle suites retained with their devDeps) + section 4 (copy the exact specifier from upstream packages/<m>/package.json); upstream packages/glob/package.json:39 pins `"minimatch": "10.2.6"`   evidence: `node -e 'require.resolve("minimatch/package.json", {paths:["scratchpad/test/glob"]})'` resolves to /home/elpresidank/YeeBois/projects/beep-effect/node_modules/minimatch/package.json version 10.2.5. scratchpad/package.json:98 declares `"minimatch": "10.2.6"` and bun.lock:3474 records that declaration under `@beep/scratchpad`, but the only resolved package entry is `minimatch@10.2.5` (bun.lock:7756) and no scratchpad/node_modules exists. The ledger row `newDeps` claims spec 10.2.6.
- failure: The oracle and differential property suites (`oracle(...)`, `OracleMinimatch`, `oracle.escape`) run against minimatch 10.2.5, not the 10.2.6 upstream pinned its suite to; the declared lab is not what the gate proved, and a frozen-lockfile install cannot reproduce the declared devDep.
- fix: Run `beep-heavy bun install` from the repo root so bun.lock resolves `minimatch@10.2.6` for the scratchpad workspace (nested under scratchpad/node_modules), re-run `audit:effected -- test glob`; if bun refuses the nested exact pin, move the root pin to 10.2.6 instead and note it in the ledger row.

### fable-1-4
- file: scratchpad/effected/glob/internal/limits.ts:32
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains); AGENTS.md Code Laws (named LiteralKit internal domains, S.Literals only for anonymous inline unions never referenced by name); D5 (kits land in S4)   evidence: `export type GuardReason = "PatternTooLong" | "ExpansionBudgetExceeded" | "NestingDepthExceeded"` is a hand-rolled union whose own comment (limits.ts:31) says it "mirrors GlobPatternError's reason union"; GlobPattern.ts:35 restates the same three literals inline as `S.Literals([...])` for `GlobPatternError.reason`. Two sources of truth for one named domain.
- failure: Adding or renaming a guard reason on one side compiles and silently diverges from the other (the error schema would reject a reason the engine emits); the domain has a name but no schema, so no `.is`/`.Enum`/annotations exist for it.
- fix: In limits.ts: `export const GuardReason = LiteralKit(["PatternTooLong", "ExpansionBudgetExceeded", "NestingDepthExceeded"]); export type GuardReason = typeof GuardReason.Type;` and in GlobPattern.ts: `reason: GuardReason.annotateKey({ description: ... })` (decode/encode of the literals is unchanged, so D9 holds).

### fable-1-5
- file: scratchpad/effected/glob/internal/types.ts:13
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains); AGENTS.md Code Laws; D5   evidence: `export type Platform = "posix" | "aix" | ... | "netbsd"` (13 literals) is a named domain used by `EngineOptions.platform` (types.ts:72) and `Minimatch.platform` (minimatch.ts:168); GlobPattern.ts:96-110 restates all 13 literals inline as `S.Literals([...])` for `GlobPatternOptions.platform`.
- failure: The schema and the engine type can drift (a platform added to one list but not the other type-checks); the named domain has no schema value, no `.is`, no annotations.
- fix: In types.ts: `export const Platform = LiteralKit(["posix", "aix", "android", "darwin", "freebsd", "haiku", "linux", "openbsd", "sunos", "win32", "cygwin", "netbsd"]); export type Platform = typeof Platform.Type;` and in GlobPattern.ts: `platform: S.optionalKey(Platform).annotateKey({ description: ... })`.

### fable-1-6
- file: scratchpad/effected/glob/internal/ast.ts:82
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 (LiteralKit especially when `.is` is part of the design) + law 17 (derive guards with `S.is(...)` instead of ad-hoc predicate helpers)   evidence: `export type ExtglobType = "!" | "?" | "+" | "*" | "@"` (ast.ts:82), a parallel `const types = HashSet.fromIterable<string>(["!", "?", "+", "*", "@"])` (ast.ts:83) and a hand-rolled guard `isExtglobType = (c) => c !== null && HashSet.has(types, c)` (ast.ts:84) spell the same named literal domain three times; the guard is used at ast.ts:85,416,467,528,561.
- failure: The type and the runtime set are maintained separately (a literal added to the type but not the HashSet makes `isExtglobType` reject a valid extglob type at runtime while still type-checking); the domain has no schema-derived guard.
- fix: `const ExtglobType = LiteralKit(["!", "?", "+", "*", "@"]); export type ExtglobType = typeof ExtglobType.Type; const isExtglobType = (c: string | null): c is ExtglobType => ExtglobType.is(c);` and delete the `types` HashSet (membership semantics are identical, so D9 holds).

### fable-1-7
- file: scratchpad/effected/glob/internal/balancedMatch.ts:49
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md Dual-Arity Inventory Contract (a callable shaped `(input, options?)` is excluded because its one-argument form is already complete) + law 21 (tersest equivalent form); .patterns/module-organization.md DUAL FUNCTION PATTERN (data-first takes self first, data-last pipes self)   evidence: Eight upstream plain arrows were wrapped in `dual`: escape.ts:26, unescape.ts:31, braceExpansion.ts:126, minimatch.ts:133 are `(input, options?)` shapes wrapped with a runtime predicate `(args) => args.length >= 2 || P.isString(args[0])`; balancedMatch.ts:49,70 (`dual(3, (a, b, str))`), braceExpressions.ts:61 (`dual(2, (glob, position))`) and limits.ts:62 (`dual(2, (name, value))`) put the data (`str`, `glob`, `value`) LAST, so the generated data-last overloads pipe the delimiter or the cap name (`balanced(b, str)(a)`, `assertCap(value)(name)`), the inverse of the Effect dual convention. Every call site in the module is full-arity (`rg "balanced\(|range\(|parseClass\(|assertCap\(" scratchpad/effected/glob`), so no behaviour changes.
- failure: No observable failure today; the `(input, options?)` wrappers add a per-call `P.isString` branch and advertise a data-last overload the inventory contract says is unnecessary, and the inverted `dual(N)` overloads expose a misleading pipeable signature (`pipe("{", balanced("}", str))`).
- fix: Drop the eight `dual` wrappers and restore the upstream arrow signatures (`export const balanced = (a, b, str) => ...`, `export const assertCap = (name, value) => ...`, etc.); if a pipeable form is wanted later, build it data-first with the subject (`str`, `value`) in position one.

### fable-1-8
- file: scratchpad/effected/glob/internal/limits.ts:40
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 7 (extend `S.TaggedError` from effect/Schema directly for typed errors); .patterns/error-handling.md S.TaggedError pattern   evidence: `GuardExceeded extends Data.TaggedError("GuardExceeded")<{...}>` with a positional `constructor(reason, limit, actual)` that builds `message` itself and then sets `this.name = "Error"` (limits.ts:45-49), overriding the `Base.prototype.name = tag` that `Data.TaggedError` installs (node_modules/effect/dist/internal/core.js:433). The sibling errors in the same module (`InvalidCap`, `GlobPatternError`) use `S.TaggedError`. tsgo `extends-native-error` and the native-runtime law are satisfied, and the positional constructor keeps the ~8 `new GuardExceeded(reason, limit, actual)` throw sites (braceExpansion.ts, ast.ts, assertValidPattern.ts) verbatim, which is why this is backlog rather than required.
- failure: Stack headers, `Cause.pretty` and `String(e)` report `Error: PatternTooLong ...` instead of `GuardExceeded: ...`, hiding the class during debugging; the module mixes two error-definition idioms for the same kind of signal.
- fix: `export class GuardExceeded extends S.TaggedError<GuardExceeded>($I`GuardExceeded`)("GuardExceeded", { reason: GuardReason, limit: S.Finite, actual: S.Finite }, $I.annote(...)) { override get message() { return `${this.reason}: limit ${this.limit}, actual ${this.actual}`; } }`, rewrite the throw sites to `new GuardExceeded({ reason, limit, actual })`, and delete the `name` override.

### fable-1-9
- file: scratchpad/effected/glob/internal/limits.ts:12
- class: schema   severity: backlog
- standard: D5 (`$ScratchpadId` identity annotations on every exported schema, service and error) + operator step 4 (annotations on fields and schemas); .patterns/error-handling.md (`$I.annote(...)` third argument on every S.TaggedError); crispen (literal-family collapse)   evidence: Five internal programmer-error classes are shape-identical `{ message: S.String }` with a `$I` identifier but no `$I.annote` description and no field annotation: `InvalidCap` (limits.ts:12), `InvalidPattern` (assertValidPattern.ts:18), `ASTError` (ast.ts:42), `MinimatchError` (minimatch.ts:50), `BraceExpressionError` (braceExpressions.ts:16). `GlobPatternError` and `GlobPatternOptions` in the same module carry the full `$I.annote` form.
- failure: Docgen/identity audits see five errors without description or title annotations; the five classes are a duplicated literal family (one `boundary` discriminator would carry the same information).
- fix: Add `$I.annote("<Name>", { description: "..." })` as the third argument and `.annotateKey({ description })` on `message` for each class; optionally collapse the five into one `GlobInternalError` with `boundary: LiteralKit(["cap", "pattern", "ast", "engine", "braceExpression"])` when the S4 kit pass runs.

### fable-1-10
- file: scratchpad/effected/glob/GlobPattern.ts:37
- class: schema   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 14 (a different accepted input is a deviation and must be recorded); forced by `@effect/tsgo` schema-number (TS377098, effect-tsgo/docs/rules/schema-number.md), so the cause is `law:`   evidence: Upstream `GlobPatternError.limit/actual` are `Schema.Number`; the port uses `S.Finite` (GlobPattern.ts:37,39). `S.decodeUnknown(GlobPatternError)({ ..., limit: Infinity })` was accepted upstream and is rejected here; the engine never emits a non-finite value, so only direct decode of untrusted input observes it. Not in README Deviations or the ledger.
- failure: An unrecorded accepted-input narrowing on a public error schema; harmless for every engine-produced value, visible to anyone decoding a serialized `GlobPatternError`.
- fix: Fold it into the fable-1-1 ledger/README deviation entry (`reason: law:tsgo/schema-number`), no code change.

### fable-1-11
- file: scratchpad/effected/glob/internal/ast.ts:538
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 11.3 (a branch unreachable by construction is a finding against the source; S3 per-file 100% branch floor); .patterns/error-handling.md (invariant violations fail loudly)   evidence: To drop the upstream casts the port added guards that cannot fire: ast.ts:538,552,588 `if (!(gc instanceof AST) || !isExtglobAST(gc)) return;` inside `#adoptWithSpace`/`#adopt`/`#usurp`, which are only reached after `#canAdopt`/`#canAdoptWithSpace`/`#canUsurp` already proved `gc` is an AST with non-null type, and the `return` is silent where every other invariant in the file throws `ASTError`; minimatch.ts:548 (`partsMatch`), :760 (`before === undefined`), :796 and :851 (`file[i]`/`pattern[pi]` inside `i < length` loops) return `false` on index reads that are in bounds by the loop condition.
- failure: S3 cannot reach 100% branch coverage without covering branches that no input reaches; the ast.ts arms would silently produce a wrong flatten instead of a defect if the invariant ever broke.
- fix: In ast.ts throw `ASTError.make({ message: "extglob child without an extglob grandchild" })` (consistent with ast.ts:267,286) or narrow `gc` through the `#canAdopt`/`#canUsurp` type predicates so the arm does not exist; in minimatch.ts iterate with index-free forms (`A.zip`, `for (const [i, f] of file.entries())`, `A.get`) so no `undefined` arm remains.

### fable-1-12
- file: scratchpad/effected/glob/internal/braceExpansion.ts:34
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.1 (prose that is wrong after a law-driven change is rewritten and cited in Port notes)   evidence: braceExpansion.ts:34 (`programmer error and dies as a TypeError defect`) and the `expand` JSDoc at braceExpansion.ts:121 (`an invalid max dies as a TypeError defect`) still describe the upstream class, while `assertCap` now throws `InvalidCap` (limits.ts:64); the port already updated the matching sentences in assertValidPattern.ts:4-7, ast.ts:23 and minimatch.ts:16.
- failure: The module's own comments contradict its behaviour and the braceExpansion.test.ts:229-231 assertions.
- fix: Replace `TypeError` with `InvalidCap` at both sites (KNOWLEDGE.md:68 stays verbatim per section 10.4).

### fable-1-13
- file: scratchpad/effected/glob/README.md:1
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.3 (Attribution lists every vendored-engine notice: package, version, licence pointer)   evidence: The Port notes -> Attribution list is a raw grep dump: six of its bullets are MIT licence-body fragments (`balancedMatch.ts:7,11,17` and `braceExpansion.ts:7,11,17`: "use, copy, modify, merge...", "The above copyright notice...", "AUTHORS OR COPYRIGHT HOLDERS BE LIABLE...") rather than notices, and the seven minimatch files repeat the same three-line notice.
- failure: The attribution section is hard to read and misstates licence fragments as notices; it does not name the three vendored engines once each.
- fix: Replace the dump with three rows: minimatch@10.2.5 (BlueOak-1.0.0; assertValidPattern, ast, braceExpressions, escape, minimatch, types, unescape), balanced-match@4.0.4 (MIT; balancedMatch.ts header), brace-expansion@5.0.7 (MIT; braceExpansion.ts header).

### fable-1-14
- file: scratchpad/effected/glob/internal/minimatch.ts:724
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent form when behaviour is unchanged)   evidence: `let sawSome = (fileTailMatch !== 0 && !Number.isNaN(fileTailMatch));` (minimatch.ts:724), the same expression inline at minimatch.ts:764, and `if (consumed !== 0 && !Number.isNaN(consumed))` (ast.ts:846) re-spell `!!n` for values that are integer counters by construction (`fileTailMatch = tail.length`, `consumed` is a difference of two positions), so the `isNaN` arm is dead and will also block S3 branch coverage.
- failure: No behaviour change; dead sub-branches and a less readable predicate.
- fix: `fileTailMatch !== 0` and `consumed !== 0` (hoist the minimatch.ts expression into one `const sawTail` used at :724 and :764).

### fable-1-15
- file: scratchpad/effected/glob/GlobPattern.ts:92
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 20 (model finite variants as literal/discriminated unions) + law 17 (built-in constructors before `S.makeFilter`/checks); crispen literal-family rule   evidence: `optimizationLevel: S.optionalKey(S.Finite.check(S.isInt(), S.isBetween({ minimum: 0, maximum: 2 })))` models the three-value domain `0 | 1 | 2` as a checked number; the module's own compliance arbitrary already models it as `S.Literals([0, 1, 2])` (compliance.test.ts). Decode/encode results are identical for every input (0, 1, 2 accepted; everything else rejected), so D9 holds.
- failure: The Type side is `number` instead of `0 | 1 | 2`, so a caller can pass `3` at compile time and only learn at `make`; no observable runtime difference.
- fix: `optimizationLevel: S.optionalKey(S.Literals([0, 1, 2])).annotateKey({ description: ... })` (types.ts:70 `EngineOptions.optimizationLevel?: number` stays, the literal type is assignable to it).

REQUIRED: 6
BACKLOG: 9
