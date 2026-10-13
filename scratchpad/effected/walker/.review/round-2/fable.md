### fable-2-1
- file: scratchpad/effected/walker/Expand.ts:52
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19 and law 17; standards/effect-first-development.md EF-35 (LiteralKit for named internal literal domains; S.Literals only for anonymous unions never referenced by name); EFFECTED_PORT_GOAL.md D5; INVENTORY.md req-6 precedent   evidence: Descend.ts:29-34 names the domain (`OnUnreadable = LiteralKit(["fail", "skip", "record"])`, `OnUnreadableArray = OnUnreadable.pick(["fail", "skip"])`) and DescendOptions.onUnreadable (Descend.ts:83) is typed from it; Expand.ts:52 respells the same two members as `S.optionalKey(S.Literals(["fail", "skip"]))`. `rg -n 'Literals\(' scratchpad/effected/walker` finds only this site. No gate compares the two spellings: tsgo only checks assignability into descend at Expand.ts:222, which still holds when Expand's union is narrower than the kit.
- failure: Two sources of truth for one reused mode domain. A member added to OnUnreadableArray leaves compileAndExpand's accepted/decoded options silently narrower than descend's, and the Expand schema carries no identity/description link to the kit. This is the class the round-1 inventory promoted to required as req-6.
- fix: Export the kit from Descend.ts (`export const OnUnreadableArray = ...` with a lead sentence, a titled `**Example**`, `@category schemas`, `@since 0.0.0`; it stays off index.ts so parity and exportsAdded are untouched), import it in Expand.ts next to DescendError/descend, and write `onUnreadable: S.optionalKey(OnUnreadableArray).annotateKey({...})`. Types and the CompileAndExpandOptions property test are unchanged.

### fable-2-2
- file: scratchpad/effected/walker/Walker.ts:101
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17 (named/reused domain constraints are schemas first; guards via S.is); standards/effect-first-development.md EF-35 ("named, reused ... model it as a schema first rather than ad-hoc predicate helpers"; broad numeric primitives are prompts to encode integer/range checks) and EF-6; EFFECTED_PORT_GOAL.md 12.1 crispen axis   evidence: The constraint "positive integer depth cap" is spelled as the ad-hoc guard `!Number.isInteger(maxDepth) || maxDepth < 1` at Walker.ts:101 and Descend.ts:334, while the schemas that model the same options omit it: AscendOptions.maxDepth = S.optionalKey(S.Finite) (Walker.ts:86), CompileAndExpandOptions.maxDepth = S.optionalKey(S.Finite) (Expand.ts:50). Read-only bun probe from the repo root: `S.decodeUnknownSync(AscendOptions)({ maxDepth: 0 })` -> `{"maxDepth":0}`; `Walker.ascend("/a/b", decoded)` -> `Failure dies=true`; `S.decodeUnknownResult(CompileAndExpandOptions)({ cwd: "/", maxDepth: -2.5, glob: {} })` -> success; `S.is(S.Finite)(-2.5)` -> true. Walker.property.test.ts:12 round-trips Arbitrary.schema(AscendOptions) values the operations reject as defects. No gate checks domain tightness.
- failure: The option schemas are not the source of truth for their own documented domain ("must be a positive integer", Walker.ts:85, README.md:10): a decoded or generated AscendOptions/CompileAndExpandOptions value dies in ascend/descend, and the invariant lives in two hand-written predicates that can drift independently.
- fix: Model the constraint once (e.g. `export const DepthCap` in Walker.ts with JSDoc, imported by Descend.ts, or a shared internal file): `S.Finite.check(S.isGreaterThanOrEqualTo(1), S.makeFilter((n) => Number.isInteger(n), { identifier: "DepthCap", title: "Depth cap", description: "A positive integer directory depth." }))` keeps upstream's exact predicate; use it for both maxDepth schema fields and replace both guards with `if (!S.is(DepthCap)(maxDepth))`, keeping the die messages. `S.Int.check(S.isGreaterThanOrEqualTo(1))` is terser but `S.Int` is `Number.isSafeInteger` (probe: `S.is(S.Int)(2 ** 53) === false` while `Number.isInteger(2 ** 53) === true`), so that spelling needs a line in the existing numeric-domains deviation. DescendError.limit stays S.Finite (Descend.test.ts:44 constructs limit 0).

### fable-2-3
- file: scratchpad/effected/walker/Walker.ts:124
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-2 ("Inside domain code, avoid | undefined; convert at boundaries via O.fromNullishOr; consume via O.map/O.exists") and EF-5 (A.last over index access); INVENTORY.md req-5 precedent (same class, promoted to required)   evidence: Walker.ts:124 `const ceiling = options?.stopAt === undefined ? undefined : path.resolve(options.stopAt)` is consumed at :129 as `ceiling !== undefined && (...)`; Walker.ts:178-179 `const last = dirs.at(-1); if (last !== undefined && ...)`. Both sentinels drive the traversal after the boundary (the optional stopAt field) was crossed. The round-1 fix converted Descend's typeOf/realPathOf for the same reason (req-5) but Walker.ts was outside that finding's sites. No gate detects undefined-as-absence.
- failure: Upward traversal still branches on undefined unions inside domain code, inconsistent with Descend.ts (O.exists/O.isNone) and with EF-2, in the module presented as the beep-native reference.
- fix: `const ceiling = O.map(O.fromNullishOr(options?.stopAt), (stopAt) => path.resolve(stopAt));` and `if (O.exists(ceiling, (c) => current === c || path.resolve(current) === c)) break;`; at :178-179 `if (O.exists(A.last(dirs), (last) => path.resolve(last) === path.resolve(ceiling))) return dirs;` (import `A` from effect/Array). Behaviour and the Walker.test.ts chain assertions are unchanged.

### fable-2-4
- file: scratchpad/effected/walker/Expand.ts:218
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-22b ("Result boundaries must be lifted with Effect.fromResult"); standards/effect-laws-v1.md law 21 / EF-5 (tersest equivalent helper form)   evidence: Expand.ts:218-224 unwraps the Result by hand inside an Effect.fn generator: `Result.isFailure(compiled)` then `compiled.failure` / `compiled.success`, with GlobExpansionError.make repeated per stage. The glob module's own `compile` lifts the identical Result with `Effect.fromResult(GlobPattern.compileResult(source, options))` (scratchpad/effected/glob/GlobPattern.ts:486). `Effect.fromResult` exists in the installed effect 4.0.2 (Effect.d.ts:2427). The comment at :216-217 argues against GlobPattern.compile (an Effect round-trip), not against fromResult.
- failure: The compile stage's Result is consumed outside the Effect error channel, so the two failure stages are folded twice by hand instead of once through mapError, and the module diverges from the sibling glob module's own idiom for the same value.
- fix: `return yield* Effect.fromResult(GlobPattern.compileResult(pattern, options.glob)).pipe(Effect.flatMap((compiled) => descend(compiled, options)), Effect.mapError((cause) => GlobExpansionError.make({ pattern, cause })));` — cause is `GlobPatternError | DescendError`, matching the schema union; span name, stage values and every Expand.test.ts assertion are unchanged.

### fable-2-5
- file: scratchpad/effected/walker/Descend.ts:60
- class: docs   severity: backlog
- standard: .patterns/jsdoc-documentation.md (repo JSDoc form; every documented file under packages/** uses ` * ` continuation lines); EFFECTED_PORT_GOAL.md 10.2 (mechanical carrier conversion); upstream oracle formatting   evidence: `rg -c '^\*' scratchpad/effected/walker/{Descend,Expand,Walker}.ts` -> 228 / 110 / 84 lines: every top-level JSDoc continuation line, and the S.Struct field blocks (e.g. Descend.ts:153-162), starts at column 0 with a bare `*`, while nested class-member blocks (Descend.ts:239-257, Walker.ts:242-279) and the oracle (` * `) are indented. tsdoc and docgen tolerate it, so the gate is green.
- failure: The carried doc blocks are visibly malformed relative to upstream and to every other documented file in the repo, and a diff against upstream touches every doc line, hiding the real prose edits.
- fix: Re-indent the top-level and field JSDoc blocks to ` * ` continuation lines (mechanical, comment lines only), with no prose change.

### fable-2-6
- file: scratchpad/effected/walker/Walker.ts:337
- class: jsdoc   severity: backlog
- standard: EFFECTED_PORT_GOAL.md 10.1 ("if it is wrong after a law-driven change, rewrite it"); INVENTORY.md backlog-1 (assigned to S2)   evidence: Walker.ts:337 "`Effect.catch` catches failures, not defects ... Do not change this to `Effect.catchCause`" documents firstMatch, whose body (Walker.ts:194) is `Effect.orElseSucceed(predicate(candidate), () => false)`; README.md:10 says "Absorption uses `Effect.catch`". The ledger note "S2 green: carriers converted" (2026-10-09T16:19Z) closed S2 with backlog-1 still listed in PORT_LEDGER.json.
- failure: The Gotchas section names a combinator the code does not call; a reader checking the warning against the body finds no `Effect.catch` and may conclude the failures-not-defects boundary was dropped.
- fix: Replace the two mentions with `Effect.orElseSucceed` (which, like `Effect.catch`, recovers failures only) and keep the catchCause warning: one sentence each at Walker.ts:337 and README.md:10.

### fable-2-7
- file: scratchpad/test/walker/Walker.test.ts:100
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md EV006 (canonical Exit assertions); .patterns/testing-patterns.md; EFFECTED_PORT_GOAL.md section 16 (never weaken a test)   evidence: Ten sites (`rg -n 'assertExitFailure\(exit, Exit.isFailure'` -> Walker.test.ts:100,110,179,186,193,282,503; Descend.test.ts:152,161,170) pass the actual exit's own cause as the expected cause: `assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty)`. The expected argument is derived from the value under test, so the helper only proves "not a Success". Upstream's `assert.strictEqual(exit._tag, "Failure", \`expected ${JSON.stringify(stopAt)} to be refused\`)` (oracle Walker.test.ts:102) also lost its per-shape failure message at Walker.test.ts:110. The EV006 detector accepts `@effect/vitest/utils` `assertTrue(X.isFailure(value))` (packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:639-642), so the tautology was not forced by the detector.
- failure: The assertions read as cause equality but assert nothing about the cause; a reader cannot tell what the expected failure was, and the relative-ceiling loop no longer names which shape failed.
- fix: `const exit = yield* Effect.exit(...); assertTrue(Exit.isFailure(exit), \`expected ${stopAt} to be refused\`); assertTrue(Cause.hasDies(exit.cause));` with `assertTrue` from `@effect/vitest/utils` (its `asserts self` narrows exit), at all ten sites.

### fable-2-8
- file: scratchpad/test/walker/Walker.property.test.ts:21
- class: law   severity: backlog
- standard: standards/effect-laws-v1.md law 6 / standards/effect-first-development.md EF-5 (Effect modules over native helpers); INVENTORY.md backlog-7 (assigned to S3)   evidence: S3 (7aae242a6e) added `Array.from({ length: depth }, () => "child").join("/")` at Walker.property.test.ts:21 while backlog-7's `Object.fromEntries(present.map(...))` at Walker.test.ts:293 and :300 remained. The ledger S3 note reads "canon detectors clean" and the native-runtime law excludes tests, so neither gate sees these sites.
- failure: The S3 lane grew the native-helper surface the open backlog item was meant to retire; the module's own tests still teach `Object.fromEntries` and `Array.from`.
- fix: `A.join(A.makeBy(depth, () => "child"), "/")` at Walker.property.test.ts:21; `R.fromEntries(A.map(present, (path) => [path, ""] as const))` in FsWith/FsDenying; keep seeds and injected faults identical.

### fable-2-9
- file: scratchpad/effected/walker/Descend.ts:585
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md 11.3 (S3 coverage) and D10; PORT_LEDGER.json tsgo-diagnostics deviation ("No dedicated curried-call test is present")   evidence: `rg -n 'descend\(\{' scratchpad/test/walker` -> no call of the data-last overloads (Descend.ts:585-590); Expand.property.test.ts:47 exercises compileAndExpand's curried form but nothing exercises `descend(options)(pattern)`. The 100 percent gate cannot see this: the arity branch lives in effect's `dual` (Function.js), so Descend.ts line/branch coverage is identical with or without the call. Read-only probe: `descend({ cwd: "/x" })` is a function and `descend({ cwd: "/x" })(pattern)` is an Effect, so the form works today.
- failure: The lab-added record/array curried overloads (a recorded tsgo-forced addition) have no executable contract; a change to overload order or dual arity would pass every gate.
- fix: One `it.effect` in Descend.test.ts asserting `yield* descend({ cwd: "/proj", onUnreadable: "record" })(pattern)` deep-equals the data-first result, and likewise for the array form, mirroring Expand.property.test.ts:47.

### fable-2-10
- file: scratchpad/effected/walker/Expand.ts:48
- class: type-safety   severity: backlog
- standard: standards/effect-first-development.md EF-33 (derive, do not duplicate parallel models); EFFECTED_PORT_GOAL.md D15 (`satisfies` permitted)   evidence: Upstream `CompileAndExpandOptions extends DescendOptions` (oracle Expand.ts:304); the lab S.Struct re-lists cwd/maxDepth/prune/onUnreadable/followSymlinks by hand (Expand.ts:49-53) while the JSDoc still promises "every DescendOptions field" (:31). The only compile-time link is assignability into descend at :222, which does not fail when DescendOptions gains an optional field Expand omits. `rg -n DescendOptions scratchpad/effected/walker/Expand.ts` -> the type import at :22 is referenced only by the `{@link}` at :31.
- failure: A new optional DescendOptions field is silently unreachable through compileAndExpand while the doc claims parity; the type import survives only because TypeScript counts `{@link}` as a use.
- fix: Build the fields object with `satisfies Record<keyof DescendOptions | "glob", unknown>` before passing it to `S.Struct` (a missing key becomes a type error and the import becomes live), or add an equivalent type-level parity assertion next to the schema.

### fable-2-11
- file: scratchpad/effected/walker/Descend.ts:263
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-19 ("Use Result/Option codecs only for intentional non-throwing synchronous helpers"); standards/effect-laws-v1.md law 21   evidence: Descend.ts:263-264 and Expand.ts:162 use `Result.getOrThrowWith(encodeJsonString(x), identity)` inside `message` getters, turning the Result codec back into a throwing path; the codec cannot fail for a string (probe: `JSON.stringify("\uD800")` -> `"\ud800"`), so the throw branch is dead. The `JsonString` codec is declared three times (Descend.ts:49, Expand.ts:27, Walker.ts:17) and consumed two different ways (encodeEffect + orDie in Walker.ts, Result + throw in the getters).
- failure: The getters are nominally throwing helpers for an impossible failure, and three identical codec declarations can drift independently.
- fix: `Result.getOrElse(encodeJsonString(x), constant(x))` with `constant` from effect/Function (no new function literal, so function coverage is unaffected); optionally hoist a single `quoteJson` helper into a shared internal file.

### fable-2-12
- file: scratchpad/effected/walker/Descend.ts:346
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 / standards/effect-first-development.md EF-5 (tersest equivalent Effect helper form; A over native array helpers)   evidence: Descend.ts:346-350 `fs.stat(absolute).pipe(Effect.map((info) => O.some(info.type)), Effect.orElseSucceed(O.none))` equals `Effect.option(Effect.map(fs.stat(absolute), (info) => info.type))`, the combinator Walker.ts:182 already uses; Walker.ts:210-211 `for (const dir of dirs) candidates.push(...candidatesFor(dir))` equals `A.flatMap(dirs, candidatesFor)`; Descend.ts:489-490 `frame.ancestors.includes(real.value)` / `[...frame.ancestors, real.value]` are `A.contains` / `A.append`; Walker.ts:185 `dirs.slice(0, dirs.indexOf(hit.value) + 1)` is `A.take` over `A.findFirstIndex`. All behaviour-neutral; upstream used the native forms.
- failure: Mixed native and Effect helper forms within one module; no defect.
- fix: Apply the listed one-line replacements; the sibling-link, cycle and sorted-output tests remain the oracle.

### fable-2-13
- file: scratchpad/effected/walker/Descend.ts:339
- class: effect-idiom   severity: backlog
- standard: EFFECTED_PORT_GOAL.md D5 (effect/HashSet or MutableHashSet); standards/effect-first-development.md EF-5   evidence: `const prune = MutableHashSet.fromIterable(options.prune ?? DEFAULT_PRUNE)` is read via `MutableHashSet.has` at Descend.ts:466 and never mutated after construction.
- failure: A mutable collection signals mutation that never occurs; a reader must scan the whole walk body to confirm the lookup is constant.
- fix: `HashSet.fromIterable` / `HashSet.has` (import effect/HashSet, drop the MutableHashSet import).

### fable-2-14
- file: scratchpad/effected/walker/Expand.ts:135
- class: schema   severity: backlog
- standard: standards/effect-laws-v1.md law 19 / standards/effect-first-development.md EF-35 (LiteralKit for named literal domains); EF-7 and EF-13 (schema-derived match over `_tag` conditionals)   evidence: `get stage(): "compile" | "descend"` is an anonymous TS union referenced by name (`stage`) in tests (Expand.test.ts:89,104) and docs, computed by `this.cause._tag === "GlobPatternError" ? "compile" : "descend"` over the `S.Union([GlobPatternError, DescendError])` cause.
- failure: The phase domain has no schema, guard or match helper; a third cause member would fall into "descend" silently with no type error.
- fix: `const ExpansionStage = LiteralKit(["compile", "descend"])` with `$I.annote`, return `typeof ExpansionStage.Type`, and derive it with `Match.tagsExhaustive` (or `S.toTaggedUnion("_tag")` on the cause union and its `.match`) so a new cause member is a compile error.

### fable-2-15
- file: scratchpad/effected/walker/Descend.ts:485
- class: type-safety   severity: backlog
- standard: standards/effect-first-development.md EF-31 (defects only for invariant violations, made explicit); EFFECTED_PORT_GOAL.md D9   evidence: S3 (7aae242a6e) replaced upstream's unreachable fallback `frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute` with the equally unreachable `O.getOrThrow(A.last(frame.ancestors))` to remove an uncoverable branch; under followSymlinks every frame's chain is non-empty by construction (base seeded at :419, every push appends at :490), so neither form ever executes its absent case.
- failure: The invariant "a followSymlinks frame has a non-empty ancestor chain" is enforced by a throwing accessor whose failure would surface as an anonymous native-Error defect, rather than by the frame's shape.
- fix: Make it structural: carry the chain as `S.NonEmptyArray(S.String)` on a followSymlinks frame variant (or a separate NonEmptyReadonlyArray frame type) and read it with `A.lastNonEmpty`; otherwise keep the accessor and state the invariant in the adjacent comment.

### fable-2-16
- file: scratchpad/effected/walker/Descend.ts:546
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md 10.1 (prose must stay true after a change)   evidence: S3 replaced the head-index loop with `for (const frame of frames)` (Descend.ts:429-430; diff in 7aae242a6e) and dropped the "A head index, never Array.shift()" comment, but the descend Details paragraph (Descend.ts:546-547) still says "dequeued by head index, never `Array.shift()`"; the new inline comment says only that iteration "visits appended frames".
- failure: The public doc describes a mechanism the code no longer spells, and the live-iterator-over-a-growing-array idiom (well-defined: the Array iterator re-reads length each step) is undocumented where a reader would look for it.
- fix: Reword to "a worklist consumed by array iteration, which visits frames appended during the walk; never `Array.shift()`", or restore the head-index loop with its original comment.

REQUIRED: 4
BACKLOG: 12
