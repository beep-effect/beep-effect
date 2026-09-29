# SchemaUtils Census (2026-09-28, D7, D9, D10)

Lane B of the `effect-schema-parity` reopen. Read-only census of every
export of `packages/foundation/modeling/schema/src/SchemaUtils/` at checkout
`980b4cd44c` (branch `docs/effect-schema-parity-refresh`). Upstream symbols
are cited at `inventoryPin` `e5f7d12af9abef188f7dc39b0207af1801b03ffd`
(`effect@4.0.0-rc.118-1-ge5f7d12af9`), each line confirmed with
`git -C .repos/effect show <pin>:<path>`. `referenceHead` equalled the pin on
this date.

Re-run the counts:

```sh
python3 explorations/effect-schema-parity/research/tools/census-schemautils.py --scope all
python3 explorations/effect-schema-parity/research/tools/census-schemautils.py --scope prod --files withNoneDefault
```

## Scope and method

- **Prod** (the census scope, every row): `packages apps tools scripts`,
  files that mention `@beep/schema`, excluding `**/test/**`, `*.test.ts(x)`,
  `**/dtslint/**`, `__tests__`, `*.spec.*` and
  `packages/foundation/modeling/schema/**`. `tools/` and `scripts/`
  contribute zero.
- Counted forms: `SchemaUtils.<name>`, any alias of the namespace
  (`{ SchemaUtils as X }`, `import * as X from "@beep/schema/SchemaUtils[/…]"`),
  and bare uses of names imported from a `@beep/schema/SchemaUtils/*` subpath.
  Occurrences are textual, so JSDoc mentions count.
- **Test**: the same trees, test files only, outside the schema package.
- **Intra**: the schema package's own `src/` (defining file excluded). This
  column decides whether a "zero-consumer" DELETE is really free.
- **Pkg test**: `packages/foundation/modeling/schema/{test,dtslint}`.
- **Scratchpad**: the tracked `scratchpad/` tree (939 files), reported
  separately and never part of the verdict.

### Divergence from the 2026-09-28 seeds

The prod column reproduces every seed exactly (the grounding `census.py`,
re-rooted at this worktree, prints identical rows). Two refinements:

- Seeds lumped `CodecStatic*` as 3 files / 4 occurrences. Split by name:
  `CodecStaticKey` 1/2 (codegen-kit), `CodecStaticKeys` 2/2 (box and runpod
  generator scripts), `CodecStaticRegistry` 0, `CodecStaticSelectionError` 0.
- Seed scratchpad deltas came from `census.py scratchpad explorations goals`.
  This census scans `scratchpad/` only, so `withKeyDefaults` reads 64 files
  instead of 65. The extra file is
  `goals/repo-crispening-orchestration/ops/codemods/defaults-fallback.codemod.ts`.
- An early draft of the tool also scanned files that mention `SchemaUtils`
  without importing `@beep/schema`. That added a JSDoc-only hit in
  `packages/foundation/modeling/utils/src/Str.ts:22` to `toEquivalence`. The
  final tool keeps the seed's `@beep/schema` filter.
- Non-consumer text hits inside the prod count:
  `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstPolicy.ts:29,31`
  names `SchemaUtils.withKeyDefaults` and `SchemaUtils.toEquivalence` in
  remediation strings (the P4 rewrite of those strings is already planned).

## Census

Upstream cites are `packages/effect/src/<file>:<line>` at the pin. "Prod" is
files / occurrences. Verdicts are candidates for the Align checkpoint.

### Codec facades and statics

| Export (file) | Effect equivalent at pin | Prod | Test | Intra | Pkg test | Scratchpad | Verdict | Phase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `encodeEffect` (encoders.ts:59) | `Schema.encodeEffect` Schema.ts:1908 (over `SchemaParser.encodeEffect` SchemaParser.ts:650) | 0/0 | 0 | 0 | 1/4 | 0 | DELETE: same `SchemaError` channel upstream; the beep version only adds options-first currying and rebuilds the encoder inside every call | P3 F |
| `encodeUnknownEffect` (:116) | `Schema.encodeUnknownEffect` Schema.ts:1878 (SchemaParser.ts:616) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodeUnknownExit` (:175) | `Schema.encodeUnknownExit` Schema.ts:1944 (SchemaParser.ts:750) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodeExit` (:235) | `Schema.encodeExit` Schema.ts:1980 (SchemaParser.ts:783) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodeUnknownOption` (:292) | `Schema.encodeUnknownOption` Schema.ts:2010 (SchemaParser.ts:790) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodeOption` (:349) | `Schema.encodeOption` Schema.ts:2040 (SchemaParser.ts:798) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodeUnknownResult` (:406) | `Schema.encodeUnknownResult` Schema.ts:2072 (SchemaParser.ts:831) | 0/0 | 0 | 0 | 1/4 | 0 | DELETE: same | P3 F |
| `encodeResult` (:464) | `Schema.encodeResult` Schema.ts:2106 (SchemaParser.ts:864) | 0/0 | 0 | 0 | 1/6 | 0 | DELETE: same | P3 F |
| `encodeUnknownPromise` (:518) | `Schema.encodeUnknownPromise` Schema.ts:2137 (SchemaParser.ts:685) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `encodePromise` (:573) | `Schema.encodePromise` Schema.ts:2173 (SchemaParser.ts:719) | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: same | P3 F |
| `isCodecDataFirst` (isCodecDataFirst.ts:49) | none. `Function.dual` (Function.ts:102) accepts an `isDataFirst` predicate; this export is that predicate, specialised to `ParseOptions` | 42/123 | 0 | 4/4 | 0 | 0 | KEEP: nothing upstream to converge on; every use is `dual(SchemaUtils.isCodecDataFirst, <bound decoder>)`, the repo's dual-codec convention, which is not a parity question | none |
| `toEquivalence` (toEquivalence.ts:70) | `Schema.toEquivalence` Schema.ts:15229 (returns `Equivalence.Equivalence`, Equivalence.ts:60) | 10/21 | 1/1 | 4/5 | 1/8 | 1 | DELETE: the wrapper only adds `dual(2, …)`; the sampled call sites are two-argument data-first | P5 |
| `DualEquivalence` type (:35) | `Equivalence.Equivalence<A>` Equivalence.ts:60 | 1/1 | 0 | 1/1 | 0 | 0 | DELETE with `toEquivalence` (only `LegalActContent.model.ts:182`) | P5 |
| `withCodecStatics` (withCodecStatics.ts:420) | the free functions: `Schema.decode*`/`encode*` (e.g. `decodeUnknownSync` Schema.ts:1811, `decodeUnknownEffect` :1473), `Schema.is` :1401, `Schema.asserts` :1450, `Schema.toEquivalence` :15229 | 113/202 | 2/2 | 22/37 | 2/19 | 43/145 | DELETE: every static is a bound free function (D10); precondition met by #927 (`2731847346`, merged 2026-08-31) | P5 |
| `classStatics` (:484) | same free functions | 0/0 | 0 | 0 | 1/3 | 0 | DELETE: zero consumers (D7); same PR drops the allowlist entry `standards/effect-laws.allowlist.jsonc:45-52` (reason line :49) and its generated snapshot `packages/tooling/policy-pack/repo-configs/src/internal/eslint/generated/EffectLawsAllowlistSnapshot.ts` | P3 F |
| `CodecStaticRegistry` interface (:60) | none (type of the statics bag) | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers, but `withCodecStatics` signatures reference it, so it cannot leave before P5 | P5 |
| `CodecStaticKey` schema + type (:156, :169) | none (`Schema.Literals` Schema.ts:4852 over the helper names) | 1/2 | 0 | 0 | 1/1 | 0 | DELETE: only `codegen-kit` `GenerateConfig.schemaCodecStatics` uses it | P5 |
| `CodecStaticKeys` type (:177) | none | 2/2 | 0 | 0 | 0 | 0 | DELETE: `packages/drivers/box/scripts/generate.ts:16,254` and `packages/drivers/runpod/scripts/operations.renderer.ts:15,535` both hold an empty override map | P5 |
| `SelectedCodecStatics` type (:202) | none | 2/3 | 0 | 0 | 0 | 0 | DELETE: `packages/shared/domain/src/entity/EntityId.ts`, `PublicEntityId.ts` | P5 |
| `CodecStaticSelectionError` (:229) | none | 0/0 | 0 | 0 | 1/4 | 0 | DELETE: structural to `withCodecStatics` | P5 |
| `withStatics` (withStatics.ts:91) | none. Upstream schemas carry no static installer; `Struct.mapFields` (Schema.ts:3397) and `rebuild` rebuild the schema and drop foreign props | 94/148 | 0 | 34/40 | 3/4 | 24/48 | ADAPT: attached keys are mostly codec facades (see below); those go to free functions with F15, and the mechanism survives only for non-codec statics | P5 |
| `withLiteralKitStatics` (withLiteralKitStatics.ts:38) | none (copies LiteralKit facets) | 88/183 | 0 | 13/24 | 1/1 | 5/15 | ADAPT: its `Pick` names five facets that P2 deletes (`Options`, `HashSet`, `pickOptions`, `omitOptions`, `thunk`), so P2 must shrink it to `is`, `Enum`, `$match`, `toTaggedUnion` in the same PR; final fate rides with `withStatics` in P5 | P2 |
| `staticDescriptorInstaller` (internal/staticDescriptors.ts:113) | none | 0/0 | 0 | 2/3 | 1/6 | 0 | KEEP: internal engine of `withStatics` and `withCodecStatics`; it retires with its last user. Reachable only through the `./SchemaUtils/*` wildcard (`package.json:266`) | P5 (follows) |
| `collectAnnotationsAt` (collectAnnotationsAt.ts:145) | none. `SchemaAST.resolve` (SchemaAST.ts:5004) and `Schema.resolveAnnotations` (Schema.ts:15917) read one node; this walks children, checks, context and encoding links | 1/1 | 0 | 1/1 | 1/18 | 0 | KEEP: the surviving leaf of the 2026-09-14 ruling | none |

The attached-key tally for `withStatics` comes from the first three lines
after each prod call site. It is indicative, not exhaustive: `decodeOption` 48,
`fromUnknown` 46, `is` 12, `decodeEffect` 10, `equals` 6,
`decodeUnknownEffect` 5, `decodeUnknownEffectFromJsonString` 4. The only
non-codec keys in the sample are `Enum`, `Tabs`, `Sequential`, `Parallel`,
`text`, `description`, `toStr`, `toPointer`, `toCandidates` and
`rawMarkdown`. The P5 facet census should confirm this before the mechanism
is judged.

### Defaults and key combinators

| Export (file) | Effect equivalent at pin | Prod | Test | Intra | Pkg test | Scratchpad | Verdict | Phase |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| `withNoneDefault` (withConstructorDefaults.ts:49) | `Schema.withConstructorDefault(Effect.succeed(Option.none()))` Schema.ts:5703. One call; the upstream constraint rejects non-Option fields the same way | 281/1897 | 0 | 24/37 | 1/2 | 119/1114 | DELETE: an alias with a fixed argument. This is the largest rewrite in the train (more occurrences than Number's 361 consumers). It needs the P2 codemod engine and the >100-consumer facet census gate, which is trivially one facet | P3 C (own PR) |
| `withConstantDefault` (:86) | `Schema.withConstructorDefault(Effect.succeed(v))` Schema.ts:5703 | 26/85 | 0 | 0 | 1/3 | 1/1 | DELETE: same, same PR | P3 C (own PR) |
| `withKeyDefaults` (withKeyDefaults.ts:53) | `Schema.withConstructorDefault` Schema.ts:5703 then `Schema.withDecodingDefaultTypeKey` Schema.ts:5821, both `Effect.succeed(v)` | 110/427 | 1/1 | 6/18 | 2/2 | 64/352 | DELETE: covered by a two-call composition (the 2026-09-14 leaf ruling and F03 recipe). Codemod-class, facet census gate. See pushback below | P3 C (own PR) |
| `withEmptyArrayDefaults` (:120/143/166) | `Schema.withConstructorDefault` :5703 then `Schema.withDecodingDefaultType` Schema.ts:5929 (value-level missing-or-undefined, not `TypeKey`) | 20/38 | 0 | 3/6 | 1/2 | 32/131 | DELETE: same PR; keep the `Type` (not `TypeKey`) variant | P3 C (own PR) |
| `boolKeyWithDefault` (:197) | `Schema.Boolean.pipe(withConstructorDefault(…), withDecodingDefaultTypeKey(…))` | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers (D7). Only the two constants below call it; inline it into them | P3 C |
| `BoolKeyDefaultFalse` (:217, type :228) | the same composition over `Effect.succeed(false)` | 20/34 | 0 | 4/15 | 0 | 1/2 | ADAPT: a named schema building block, which AGENTS.md prefers. Keep the constant and rebuild it directly on the two upstream combinators | P3 C |
| `BoolKeyDefaultTrue` (:248, type :259) | same, `true` | 5/7 | 0 | 1/1 | 0 | 1/1 | ADAPT: same | P3 C |
| `withEncodeDefault` (withEncodeDefault.ts:47) | `Schema.withDecodingDefaultTypeKey(Effect.sync(thunk))` Schema.ts:5821. Equivalent: encoded `optionalKey(self)`, decode `withDefault`, encode passthrough (the `SchemaGetter.required()` it hand-writes, SchemaGetter.ts:605) | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers (D7). Despite the name it is a decoding default | P3 C |
| `boolWithDefault` (:91) | `Schema.Boolean.pipe(Schema.withDecodingDefaultTypeKey(Effect.succeed(b)))` | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers | P3 C |
| `BoolDefaultFalse` (:110, type :121) | same over `false` | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers | P3 C |
| `BoolDefaultTrue` (:140, type :151) | same over `true` | 0/0 | 0 | 0 | 0 | 0 | DELETE: zero consumers | P3 C |
| `optionalKeyWithDefault` (optionalKeyWithDefaults.ts:38) | `Schema.withDecodingDefaultTypeKey(Effect.succeed(v))` Schema.ts:5821; same wire shape as above | 0/0 | 0 | 0 | 1/2 | 0 | DELETE: zero consumers | P3 C |
| `optional` (optional.ts:47) | `Schema.optionalKey` Schema.ts:2317 when the Type side need not admit `undefined`; `Schema.optional` Schema.ts:2379 also admits `undefined` on the wire. No single symbol matches "optionalKey on the wire, `?: T \| undefined` in Type" | 0/0 | 0 | 1/2 | 1/8 | 0 | DELETE: zero outside consumers, but one in-package consumer (`packages/foundation/modeling/schema/src/FileDiff.schema.ts:17-18`, `SchemaUtils.optional(S.String)`) migrates in the same PR | P3 C |
| `pluck` (pluck.ts:61) | no single symbol: `struct.mapFields(Struct.pick([k]))` (Schema.ts:3397, Struct.ts:204) plus `Schema.decodeTo` Schema.ts:5439 with `SchemaGetter.transform` SchemaGetter.ts:702 | 0/0 | 0 | 0 | 1/3 | 0 | DELETE: zero consumers; a consumer-side composition, not a package helper | P3 C |
| `split` (split.ts:51) | `SchemaGetter.split({ separator })` SchemaGetter.ts:1420 inside `Schema.decodeTo(Schema.Array(Schema.String), …)`. Upstream maps `""` to `[]`; beep maps it to `[""]` | 0/0 | 0 | 0 | 1/4 | 0 | DELETE: zero consumers; record the empty-string difference in the PR | P3 F |

### Pushback on the defaults rows

- **`withKeyDefaults` is the closest call.** Upstream has no single
  combinator for "construction and missing-key decoding share one default".
  The DELETE verdict follows the doctrine (facet covered by composition, no
  alias) and the 2026-09-14 leaf table (`research/retirement-G-Z.md:186-195`).
  The cost is two calls plus two imports at 427 sites. If Align prefers the
  name, the honest record is an ADAPT row with a logged doctrine exception, not
  a silent KEEP.
- **`BoolKeyDefault*` are not wrappers.** They are named schema constants, so
  deleting them would paste `S.Boolean.pipe(…)` into 25 files. ADAPT keeps
  the name and drops the helper beneath it.
- **The F03 detector misses the largest default surface.** The idiom-census
  regex
  (`explorations/effect-schema-parity/research/idiom-census.mjs:18`) lists
  `withConstructorDefaults(`, which is a file name and not an export. It never
  matches `withNoneDefault` or `withConstantDefault`, 1,982 prod occurrences
  in total. The P4 `SFV4-*` rule for F03 must name the two exports.

## D10: the per-AST cache moots the hoisting rationale, and predates the compilers

**Claim tested.** Does `S.decodeUnknownSync(schema)` inside a function body
recompile on every call at the pin? It does not. It allocates a few closures,
and the interpreter walk over the AST happens once per AST per process.

**Call path at the pin (every line from `git show e5f7d12af9:<path>`).**

1. `Schema.decodeUnknownSync` (Schema.ts:1811-1816) calls
   `Schema.decodeUnknownEffect` (Schema.ts:1473-1481), which calls
   `SchemaParser.decodeUnknownEffect` (SchemaParser.ts:263-272).
2. That calls `run(schema.ast)` (SchemaParser.ts:955-957), which calls
   `runWithCompiler(normalCompiler, ast)` (SchemaParser.ts:975-993). This only
   returns a closure holding `let parser`. On the first invocation it runs
   `parser ??= compiler(ast)`.
3. `normalCompiler` is `(ast) => CompilerRegistry.resolve(ast).parser`
   (SchemaParser.ts:1152).
4. `resolve` (internal/schema/compilerRegistry.ts:180-188) reads the
   module-level `WeakMap<SchemaAST.AST, Entry>` (`cache`, :33). On a hit it
   returns the same `Entry`. On a miss it creates one `InterpretedEntry`, or a
   `CompilerEntry` when a compiler is installed, and stores it.
5. `InterpretedEntry.parser` → `decodeEffect` getter (:75-81) memoises
   `Interpreter.compile(ast, decodeChild)` in `cachedDecodeEffect`.
   `CompilerEntry` memoises through `save` and `Object.defineProperty`
   (:98-101, :120-132). Child ASTs resolve through the same registry, lazily
   when compiler adapters are active (`lazyParser` :166-177).
6. With adapters enabled (after any JIT or AOT install), the sync entry point
   instead takes `makeSync` (SchemaParser.ts:551-558 → :1047-1054). It is also
   lazy, via `run ??= makeSyncEntry(CompilerRegistry.resolve(ast), options)`.

**Encode and `is` hit the same cache.**

- `encodeUnknownEffect` builds `run(SchemaAST.flip(schema.ast))`
  (SchemaParser.ts:616-627).
- `flip` is `memoize(...)` (SchemaAST.ts:4667), which is a `WeakMap`
  (Function.ts:1339-1348). The flipped AST is therefore identity-stable and
  resolves to one registry entry.
- `is` goes through `_is` → `SchemaAST.toType`, which is `memoizeIdempotent`
  (SchemaAST.ts:4583, Function.ts:1375-1387). It then builds a lazy guard over
  `CompilerRegistry.resolve` (SchemaParser.ts:138-190).

**Class schemas are identity-stable too.** A class's static `ast` getter
(Schema.ts:14749-14751) reads `getClassSchema(this).ast`. The factory
memoises the built `decodeTo(declareConstructor…)` schema per class
(`let memo`, Schema.ts:14835-14841). The `Declaration` AST that the cache keys
on is built once (Schema.ts:14847).

**This is not new with #7908.** The per-AST memo predates the compilers:

| Effect commit | Date | Per-AST parser cache in `SchemaParser.ts` |
| --- | --- | --- |
| `7e1f455fab` (last main commit before 2026-06-21) | 2026-06-20 | `const recur = memoize(...)` :1007; `run` calls `recur(ast)` :915-916 |
| `17f0b91a24` (#7020) | 2026-08-05 | `normalCompiler = memoize((ast) => makeParser(...))` introduced |
| `51d4a2f08a` (old inventory pin, rc.115) | 2026-09-12 | `normalCompiler` / `constructorCompiler` `memoize` :1028-1029 |
| `c19c63fb71` (#7908) → `e5f7d12af9` (pin) | 2026-09-18 → 09-28 | `compilerRegistry.ts:33` `WeakMap` + `resolve` (above) |

The repo rule `beep/no-inline-schema-compile` landed on 2026-06-21 in
`e2bccf9d88` (#276). By then Effect v4 already cached parsers per AST. The
registry at the pin is the current form of that cache, and it adds one thing:
JIT or AOT entries live in it too.

**What hoisting still buys.** Indicative numbers from one `bun 1.4.2` run
(installed `effect@4.0.0-rc.118` from the pin's pkg.pr.new snapshot, 200k
iterations after 20k warm-up, 5-field `S.Class` row). The probe script lived
in the session scratchpad and is not committed.

```
hoisted decodeUnknownSync(Row)                        231 ns/op
inline  S.decodeUnknownSync(Row)(x)                   287 ns/op
hoisted encodeUnknownSync(Row)                        201 ns/op
inline  S.encodeUnknownSync(Row)(x)                   219 ns/op
hoisted plain S.Struct decode                         116 ns/op
inline  decodeUnknownSync(PlainStruct)(x)             140 ns/op
inline schema construction S.Struct({...}) + decode   935 ns/op
```

- **A hoisted schema passed inline costs tens of nanoseconds.** That is
  closure allocation, not compilation.
- **Inline schema construction costs about 8x.** Every call builds a new AST,
  misses the `WeakMap`, and pays a full `Interpreter.compile`. Under JIT it
  would also never be enabled, because `SchemaJITCompiler.enable(ast)` is per
  AST.

**Consequences for the three places that encode the old rationale.**

- **`goals/schema-utils-selective-codec-statics/SPEC.md:12-13`** says the API
  "compiles only the requested schema helpers at module initialization". At
  the pin, `withCodecStatics` compiles nothing at module initialization. Each
  static is a lazy closure, and every helper for one schema shares one
  registry entry. Selecting fewer helpers saves only closure allocations.
  (That packet stays untouched, per D7.)
- **`explorations/effect-schema-parity/MAP.md:111`** (the P5 F15 row) already
  states the right reason: statics are "bound decode/encode functions
  duplicating free functions". Retirement needs no performance argument.
- **`beep/no-inline-schema-compile` (`.oxlintrc.json:45`)** has two tiers in
  `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts`:
  - The **High** tier (messageHigh :75-76, chosen at :195-197) fires when the
    first argument is itself an inline schema construction. It is still
    correct: that case is the 8x row.
  - The **Medium** tier (messageMedium :78-79, :198) fires on a plain static
    schema reference. Its message, "the compiled function is rebuilt on every
    call", is false at the pin and was already false when the rule landed.
  - The header comment (:26-27) repeats the false premise.
  - **Recommendation for P4 or a follow-up:** narrow the rule to the High
    tier, reword it to "inline schema construction defeats the per-AST parser
    cache", and demote or drop the Medium tier.

**Correction for the already-amended PLAN P5 text.** `goals/effect-schema-parity/PLAN.md:163-171`
reads as though the registry newly removed the need. The precise statement:
per-AST caching dates from at least 2026-06-20. The registry keeps it and
extends it to compiled entries.

## Paste-ready cells

### PLAN.md P3 table (`goals/effect-schema-parity/PLAN.md:125`, `:128`)

Row 3 (C), group cell:

```
C unknown, opaque, record, json (Unknown 128, Opaque 103, Record, Json, Primitive, SafeObject, Options, Transformations; SchemaUtils zero-consumer DELETEs: optional (one in-package consumer, FileDiff.schema.ts), optionalKeyWithDefault, pluck, withEncodeDefault, boolWithDefault, BoolDefaultFalse, BoolDefaultTrue, boolKeyWithDefault; BoolKeyDefaultFalse/True rebuilt on upstream combinators) + PR 3b SchemaUtils defaults codemod (withNoneDefault 281 files / 1,897 occ., withKeyDefaults 110 / 427, withConstantDefault 26 / 85, withEmptyArrayDefaults 20 / 38)
```

Row 3 gate cell:

```
facet census for Unknown and Opaque; PR 3b: P2 codemod engine landed and a one-facet census for withNoneDefault and withKeyDefaults (>100 consumers)
```

Row 6 (F), group cell:

```
F text and misc (String, CommonTextSchemas, case brands, URL, BigDecimal, Logs, StatusCauseError, FileInfo, JSONSchema; SchemaUtils zero-consumer DELETEs: the ten encode* facades, split, classStatics with its effect-laws allowlist entry)
```

Row 6 gate cell stays `none`.

### PLAN.md P2 bullet addition

```
- `SchemaUtils.withLiteralKitStatics` (88 files / 183 occ.) copies five of the deleted facets (`Options`, `HashSet`, `pickOptions`, `omitOptions`, `thunk`); trim its `Pick` to `is`, `Enum`, `$match`, `toTaggedUnion` in the same PR.
```

### PLAN.md P5 bullet addition

```
- The F15 PR also deletes `classStatics`' siblings `CodecStaticRegistry`, `CodecStaticKey`, `CodecStaticKeys`, `SelectedCodecStatics`, `CodecStaticSelectionError`, `toEquivalence` + `DualEquivalence` (10 + 1 consumers → `S.toEquivalence`), codegen-kit's `GenerateConfig.schemaCodecStatics` (`packages/tooling/library/codegen-kit/src/CodegenKit.models.ts:369-371`, import :10, default :318), its emitter `renderCodecStatics` (`internal/postProcess.ts:418-426`, the emitted `SchemaUtils.withCodecStatics([...])` string at :423) and the usage probe at :589, and the empty override maps in `packages/drivers/box/scripts/generate.ts:254` and `packages/drivers/runpod/scripts/operations.renderer.ts:535` (0 `_generated/` files use the emitter today). `withStatics` (94 / 148) runs a facet census: codec-facade keys go to free functions; the mechanism and `internal/staticDescriptors.ts` retire with their last user.
```

### MAP.md §P3 rows (`explorations/effect-schema-parity/MAP.md:81`, `:84`)

Row C, append to the concepts cell:

```
; SchemaUtils: optional, optionalKeyWithDefault, pluck, withEncodeDefault, boolWithDefault, BoolDefault*, boolKeyWithDefault (all zero outside consumers), BoolKeyDefault* (ADAPT), and the defaults codemod withNoneDefault (281), withKeyDefaults (110), withConstantDefault (26), withEmptyArrayDefaults (20)
```

Row C, append to the upstream-target cell:

```
, `S.withConstructorDefault`, `S.withDecodingDefaultTypeKey` / `S.withDecodingDefaultType`, `S.optionalKey`, `Struct.pick` + `mapFields`
```

Row C, append to the notes cell:

```
The defaults codemod is its own PR (3b) and the largest rewrite in the train; withEmptyArrayDefaults maps to the `Type` variant, not `TypeKey`.
```

Row F, append to the concepts cell:

```
; SchemaUtils: encode* (10), split, classStatics (all zero consumers)
```

Row F, append to the upstream-target cell:

```
, `S.encode*`, `SchemaGetter.split` with `S.decodeTo`
```

Row F, append to the notes cell:

```
split: upstream decodes "" to [], beep to [""].
```

## Totals proposal

SchemaUtils is **one ADAPT concept** in the audit
(`research/retirement-G-Z.md:106`; the audit tally is `RESEARCH.md:102-106`).
It sits outside the `50 RETIRE / 6 Role B / 77 KEEP` counts in
`goals/effect-schema-parity/SPEC.md:234-236`. Those totals do not change.
Record the export-level census as a separate sub-count on the SchemaUtils
ADAPT row, for example as a new acceptance line after SPEC.md:236:

```
- [ ] SchemaUtils (ADAPT concept, 39 exports per research/2026-09-28-schemautils-census.md): 32 DELETE (20 zero-consumer in P3 C/F; 4 defaults via the PR 3b codemod; 8 with the P5 statics retirement), 4 ADAPT (BoolKeyDefaultFalse/True in P3 C, withLiteralKitStatics in P2, withStatics in P5), 3 KEEP (collectAnnotationsAt, isCodecDataFirst, internal staticDescriptorInstaller until its last user goes).
```

| Verdict | Count | Exports |
| --- | ---: | --- |
| DELETE | 32 | encode* ×10, optional, optionalKeyWithDefault, pluck, split, classStatics, withEncodeDefault, boolWithDefault, BoolDefaultFalse, BoolDefaultTrue, boolKeyWithDefault (20 zero-consumer, P3); withNoneDefault, withConstantDefault, withKeyDefaults, withEmptyArrayDefaults (P3 C codemod); withCodecStatics, CodecStaticRegistry, CodecStaticKey, CodecStaticKeys, SelectedCodecStatics, CodecStaticSelectionError, toEquivalence, DualEquivalence (P5) |
| ADAPT | 4 | BoolKeyDefaultFalse, BoolKeyDefaultTrue (P3 C), withLiteralKitStatics (P2), withStatics (P5) |
| KEEP | 3 | collectAnnotationsAt, isCodecDataFirst, staticDescriptorInstaller (internal) |

Two zero-consumer exports, `CodecStaticRegistry` and
`CodecStaticSelectionError`, are deliberate exceptions to D7's P3 routing.
`withCodecStatics`' own signatures need them until P5.

**Departure from the 2026-09-14 ruling.** That ruling said SchemaUtils keeps
only `collectAnnotationsAt`. This census also keeps `isCodecDataFirst`, which
has no upstream symbol to converge on. It adapts the two `BoolKeyDefault*`
constants rather than inlining them. Both need a DECISIONS entry at Align.

## Friction

- **The export list is the thing to hand over, not the file list.** The prompt
  and the grounding report had to correct three names: the singular
  `optionalKeyWithDefault`, the two exports of `withConstructorDefaults.ts`,
  and the absence of any `internal/` re-export. A generated export list
  (`graft skeleton` per file, or the tool's `EXPORTS` table) would have
  prevented it.
- **The F03 census regex matches a file name.** `withConstructorDefaults(` is
  not an export, so the 1,982 largest-surface occurrences were never in
  the idiom census. Prevent it by deriving detector regexes from the export
  list.
- **"Zero consumers" hid an in-package consumer.** Scope excludes the schema
  package, but `FileDiff.schema.ts` uses `SchemaUtils.optional`. The tool now
  reports an `intra` column. Every zero-consumer DELETE should read it before
  the PR opens.
- **Four packet artifacts restated the no-inline-compile premise without
  checking it.** SPEC, MAP, the lint rule and the amended PLAN P5 text all
  carry it. The premise has been false in v4 since at least 2026-06-20.
  Prevent it by putting the `git log -S` provenance check into any "upstream
  moots X" claim.
- **The installed tarball differs from the git bytes at the pin.** The
  benchmark had to run against `node_modules/effect` (pkg.pr.new build of the
  pin). That is fine for timing but not for line citations, which all come
  from `git show`.
- **Graft was not used.** Every question was an exact line lookup at a pinned
  sha, which `git show` answers directly. Tokens-saved tally: none.
