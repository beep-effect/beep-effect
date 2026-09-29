# Compiler evaluation: interpreter vs JIT vs AOT (2026-09-28)

Lane C of the 2026-09-28 reopen. It covers decisions D1, D6, D8 and D10. It
benchmarks the three experimental Effect Schema compilers shipped in PR #7908
against two repo-shaped workloads. It also answers the repo-fit questions and
drafts a verdict for the operator's grill.

**The verdict at the end is a DRAFT.** It is not a decision. Step 3 of the
reopen puts it to the operator before any DECISIONS entry is written.

| Pin | Value |
| --- | --- |
| `inventoryPin` | `e5f7d12af9abef188f7dc39b0207af1801b03ffd` (`effect@4.0.0-rc.118-1-ge5f7d12af9`) |
| Installed `effect` | `node_modules/effect/package.json` version `4.0.0-rc.118`; `bun.lock:3248` (the patched-dependency key) names the same pkg.pr.new snapshot sha |
| `referenceHead` (2026-09-28) | equal to the pin |

Upstream `file:line` cites were read with
`git -C .repos/effect show <inventoryPin>:<path>`. Repo cites were read in this
worktree.

## Spikes

The scripts live in `research/tools/`. Each prints a machine-state header at the
start and end, so the numbers can be re-taken on a quiet machine.

```sh
bun run explorations/effect-schema-parity/research/tools/spike-bulk.ts        # --rows=1000 --passes=7
bun run explorations/effect-schema-parity/research/tools/spike-recursive.ts   # --sections=40 --passes=5
```

| File | Role |
| --- | --- |
| `spike-harness.ts` | machine state, timing, `Function` instrumentation, AOT install, static census, child orchestration |
| `spike-bulk-schemas.ts` | bulk row schemas; a separate module so the AOT `Build` smoke can load its direct Schema exports |
| `spike-bulk.ts` | bulk spike (D6 bulk) |
| `spike-recursive.ts` | Pandoc spike (D6 recursive) |

Method:

- **One process per (case, mode, api).** The compiler registry is one
  process-global `WeakMap` (`internal/schema/compilerRegistry.ts:33`). The
  global `install` (`:211-214`) cannot be undone.
- **Interleaving.** Each pass runs every mode once, and the mode order rotates
  by one position per pass. The "per-pass ratio" column divides each run by the
  interpreter run of the same pass. This ratio is the load-robust number. Pooled
  ops/s are absolute and inflated by load.
- **Timing.** Each child does warm-up, then rounds with `Bun.gc(true)` between
  them, timing every call with `Bun.nanoseconds()`. The cold first call, which
  includes JIT code generation, is reported separately.
- **Correctness.** Every mode's decoded output is fingerprinted and compared to
  the interpreter's. Every row below matched.
- **JIT engagement.** `globalThis.Function` is wrapped to count code-generation
  calls. `jit-blocked` and `aot` make it throw an `EvalError`, which simulates a
  `script-src` without `'unsafe-eval'`.
- **AOT output.** `SchemaAOTCompiler.compile(targets)` output goes to the OS
  temp dir, is imported, then `install(asts)` runs. `research/tools/.tmp/` is
  not git-ignored, so nothing lands in the tree. Nothing writes into
  `.repos/effect`.

Modes:

| Mode | Setup |
| --- | --- |
| `interp` | no compiler |
| `jit-selective` | `SchemaJITCompiler.enable(ast)` before first use |
| `jit-global` | `import "effect/schema/SchemaJITCompiler/enable"` before first use |
| `jit-late` | decoder captured (not invoked) before the global enable; for Pandoc, the package is imported first |
| `jit-blocked` | global enable while `Function` throws (production CSP) |
| `aot` | compile, import, install, then `Function` throws |

### Machine state

**All absolute numbers were taken under heavy load from other sessions.** Only
the per-pass ratios should be read as findings.

| Run | Time (UTC) | loadavg (1m) at pass starts | Governor | Nightly units |
| --- | --- | --- | --- | --- |
| bulk, 7 passes | 2026-09-29 01:16–01:19 | 33.1, 35.6, 39.5, 40.4, 46.1, 44.4, 35.4 | performance | inactive, inactive |
| recursive, 5 passes | 2026-09-29 01:19–01:24 | 42.5, 65.7, 45.0, 31.9, 43.4 | performance | inactive, inactive |
| recursive, earlier 2-pass run | 2026-09-28 18:36–18:40 | 21.8 at start, 13.0 at end | performance | inactive, inactive |

Host: AMD Ryzen Threadripper 9970X, 64 threads. Bun 1.4.2. `effect`
4.0.0-rc.118 at the pin.

## Bulk spike: `S.Array` of 1,000 SqlModel rows

The row mirrors the effect-drizzle `User` fixture
(`packages/ecosystem/effect-drizzle/test/fixtures.ts:176-197`, audit columns
`:59-64`). That fixture is what `repository.ts:396-415` decodes, one row at a
time, through `SqlSchema.findOne({ Result: model })`. The fields are a branded
generated id, a branded org id, an email with a max-length check, a nullable
bio, an `OptionFromNullOr` nickname, a nested settings struct, a boolean, a
status literal union, a generated `searchName`, `createdAt`/`updatedAt` from
ISO strings, and a positive `rowVersion`.

| Case | Schema |
| --- | --- |
| `model-class` | `Model.Class` from `effect/schema/Model` (the SqlModel row class) |
| `schema-class` | `S.Class` over the select-variant fields |
| `struct` | `S.Struct` over the same select-variant fields |
| `struct-wire` | `S.Struct` of the encoded row shape: dates as strings, nickname `NullOr`, no transformations |

The table uses `Schema.decodeUnknownSync`. That is the API that `@beep/schema`
codec statics bind: `nativeCodecStatic` calls `Reflect.get(S, key)`
(`packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:250-263`).
Ratios compare against `interp` of the same case in the same pass, as median
with min to max.

| Case | interp arrays/s | jit-selective | jit-global | jit-late | jit-blocked | aot |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| model-class | 496 | 1.29x (0.67–2.00) | 1.32x (1.24–1.75) | 1.49x (0.82–2.17) | 1.04x (0.52–1.80) | 1.34x (1.04–1.59) |
| schema-class | 565 | 1.39x (0.62–4.29) | 1.23x (0.55–4.33) | 1.03x (0.50–4.30) | 0.59x (0.27–2.79) | 1.23x (0.51–3.84) |
| struct | 762 | 1.19x (0.81–2.89) | 1.43x (0.48–2.73) | 1.44x (0.55–2.69) | 1.08x (0.27–2.06) | 1.46x (0.25–2.91) |
| struct-wire | 2,265 | **3.72x (3.53–4.30)** | **3.67x (1.62–3.91)** | 3.66x (1.36–4.12) | 0.94x (0.25–1.01) | **3.69x (3.11–3.83)** |

`SchemaParser.decodeUnknownSync` (the `parser` api) gave the same picture.
model-class reached 1.52x (selective) and 1.61x (global). struct reached 1.39x
and 1.50x. struct-wire reached 3.72x and 3.83x. AOT with the parser api on
model-class came in at 1.03x. That run's spread (0.56–1.66) is load noise.

Readings:

- **Transformation-free wire structs gain about 3.7x.** The spread is tight
  even at load 33–46. The row `Objects` and the `Arrays` become generated
  validators, so the whole array is checked by one generated function.
- **Anything with a transformation or a class gains about 1.2–1.5x, and the
  ranges are wide.** `DateTimeUtcFromString` and `OptionFromNullOr` put
  `encoding` on child nodes. `addChild` then marks the parent unsupported
  (`internal/schema/codegen.ts:45-47`), so the row struct only gets a generated
  loop, not a validator.
- **JIT under a production CSP is the interpreter.** In `jit-blocked`, the
  support probe `checked("return true")` throws (`SchemaJITCompiler.ts:23-31`),
  `compiler` returns `undefined`, and no entry is compiled. The observed cost
  was about 1.0x or worse.
- **AOT matches the JIT and never touched `Function`.** It made zero calls to
  `Function` while `Function` threw. That confirms AOT's CSP claim.
- **Cold first call.** JIT adds about 1–3 ms of code generation for these
  graphs, with 13–14 generated functions per row graph. AOT compile took
  0.7–2.1 ms at build time, and import plus install took 2.7–4.9 ms at startup.

### Class vs struct, and the Declaration fallback

This is the number the frontier question asks for.

| | interp arrays/s | best JIT or AOT arrays/s | Class cost vs struct |
| --- | ---: | ---: | --- |
| model-class | 496 | 743 (jit-global) | 0.65x of struct under interp; 0.68x under JIT |
| schema-class | 565 | 754 (jit-selective) | 0.74x under interp; 0.69x under JIT |
| struct (same fields) | 762 | 1,100 (jit-global / aot) | baseline |
| struct-wire | 2,265 | 8,510 (jit-selective) | 3.0x struct under interp, 7.7x under JIT |

- **The class wrapper costs about 30–35% of throughput, and the compiler does
  not remove it.** The class root is a `SchemaAST.Declaration`: `makeClass`
  at `Schema.ts:14714` builds `new SchemaAST.Declaration(...)` at `:14847`.
- **The compilers never generate code for a Declaration.** The exclusions sit
  at `codegen.ts:34` (make-safe), `:45` (child) and `:135` (emission).
- **Only the Declaration's encoding link is compiled.** `shouldCompileParser`
  still returns true for a class, because the class has `encoding`
  (`codegen.ts:202`). Its `decodeEffect` is interpreted orchestration
  (`R.decode(...)` with no object or array loop). Its encoding link's `to`,
  the field struct, gets its own generated loop through the registry.
- **Class-based models gain the same small 1.2–1.5x as their fields allow,
  never the wire-struct 3.7x.** The class is not what blocks the big win; the
  field transformations block it first. Removing the class alone moves 496 to
  762 (interp) and 743 to 1,100 (JIT).

Static census of the `model-class` graph (20 nodes): 8 fast-validator, 2
generated-loop, 3 interpreted-orchestration (the three Declarations: `UserRow`
and two `DateTime.Utc` instanceOf declarations), and 7 interpreter nodes (plain
leaves). The `struct-wire` census (16 nodes) is 10 fast-validator and 6
interpreter leaves.

## Recursive spike: Pandoc strict decode

`decodePandocJsonStrict` lives at
`packages/foundation/modeling/pandoc-ast/src/Pandoc.codec.ts:1282`. It is
imported from `@beep/pandoc-ast` through the workspace symlink. No build step
was needed because Bun runs the TypeScript source.

The fixture is deterministic Markdown rendered by the local `pandoc` 3.11 to
JSON. It has 1,440 blocks and 20,800 inlines in 495,210 bytes. It covers
headers, three-level nested bullet and ordered lists, block quotes with lists,
code blocks, pipe tables, notes, links, emphasis, strong, inline code, math,
quotes, spans and fenced divs. Every mode decoded it identically.

| Case | What runs |
| --- | --- |
| `strict` | the real entry point: `PandocJsonWire`, then 27 module-private payload wire decoders captured at module load (`Pandoc.codec.ts:564-583`), then `PandocDocument.make` over the recursive model |
| `wire` | `S.decodeUnknownSync(PandocJsonWire)` only (`blocks` is `S.Array(S.Json)`) |
| `model` | `S.decodeUnknownSync(PandocDocument)` on the encoded model: the recursive class graph |

Per-pass ratios from the 5-pass run at load 32–66, with the earlier quieter
2-pass run (load 13–22) in brackets. That earlier run used pooled ratios and no
interleaving.

| Case | interp docs/s | jit-selective | jit-global | jit-late | jit-blocked | aot |
| --- | ---: | --- | --- | --- | --- | --- |
| strict | 9.4 [13.6] | 1.06x (0.63–1.20) [1.00x] | 0.72x (0.54–1.71) [0.98x] | 1.06x (0.72–1.86) [0.99x] | 1.10x (0.69–1.42) [1.05x] | 0.97x (0.74–1.31) [1.01x] |
| wire | 253 [562] | 1.10x (0.89–3.80) [0.98x] | 1.27x (0.70–4.28) [0.99x] | 1.06x (0.87–4.30) [0.99x] | 1.13x (0.44–2.35) [0.99x] | 1.98x (0.91–4.41) [0.99x] |
| model | 74 [83] | 0.80x (0.40–1.07) [1.01x] | 1.00x (0.60–1.11) [0.94x] | 0.83x (0.45–1.08) [1.06x] | 0.50x (0.45–1.16) [1.07x] | 0.69x (0.43–0.83) [0.78x] |

Readings:

- **There is no measurable gain on any Pandoc path.** Every range straddles
  1.0x, and the quieter run is flat at 0.94–1.07x. The AOT `model` result sits
  below 1.0x in both runs (0.78x and 0.69x), which suggests a real small
  regression from 270 installed entries. It is not proven under this load.
- **The `strict` path is dominated by non-schema work.** It spends about 75 ms
  per 0.5 MB document in hand-written `documentFromWire` mapping, `S.Json`
  validation and `PandocDocument.make`, not in structural decoding.
- **Static census of `PandocDocument` (395 nodes):**

  | Class | Nodes |
  | --- | ---: |
  | fast-validator | 36 |
  | generated-loop | 136 |
  | interpreted-orchestration | 129 |
  | interpreter | 94 |

  102 Declarations (every node class: `Plain`, `Para`, `Header`, `BulletList`,
  `Str`, `Emph`, `Link`, `Note`, and the rest) and 7 Suspends fall back.
  Arrays and Objects under them get loops. Unions get only 7 fast validators
  out of 22.
- **AOT stops at `Suspend`.** 386 of 395 nodes are reachable only through a
  Suspend. AOT's `visitDependencies` never evaluates a thunk
  (`SchemaAOTCompiler.ts:141-177`). The AOT module above therefore targeted all
  89 direct Schema exports of the package to reach them: 270 installed nodes, a
  92 KB module, 56 factories, and 12 fast decode paths.
- **Neither selective JIT nor AOT can reach private schemas.** The 27
  module-private `*Wire` schemas are not exported, and `Build.build` also only
  discovers direct exports (`SchemaAOTCompiler/Build.ts:235`). Only the global
  JIT reaches them: 290 generated functions in `strict`, against 70 for
  selective.

## Fallback nodes, by rule

| AST node | JIT | AOT | Source |
| --- | --- | --- | --- |
| `Declaration`, every `S.Class`, `instanceOf`, `S.declare` | never generated; children and encoding link resolved through the registry | same, plus explicit targets needed | `codegen.ts:34`, `:45`, `:135` |
| `Suspend` | never generated; the thunk is resolved lazily and the child compiled | the thunk is never evaluated, so the child stays interpreted unless targeted | `codegen.ts:45`, `:135`; `SchemaAOTCompiler.ts:98-99` JSDoc, `:141-177` |
| any node whose child carries `encoding` (transformations) | parent loses fast validation (loop only) | same | `codegen.ts:45-47` |
| `Union` | validators only when members qualify; never make-safe | same | `codegen.ts:34` |
| graphs over 2,048 nodes or 256 deep | stay interpreted | same | `codegen.ts:12`, `:14`, `:67`, `:91`; struct width cap `:711` |
| parse option `concurrency ≠ 1`, `errors: "all"`, `onExcessProperty` | generated Struct loop defers to the interpreter | same | `codegen.ts:829`; runtime `concurrency` check in `SchemaCompiler/runtime.ts` |

## Contract and ordering hazard

- **Public contract.** `CompiledDecoder` (`schema/SchemaCompiler.ts:178-191`)
  has a required `decodeEffect` and optional `is`, `decode`, `make` and
  `makeEffect`. `SchemaCompiler.set(ast, decoder)` (`:216-218`) replaces the
  whole entry. `Entry` (`internal/schema/compilerRegistry.ts:54-64`) is the
  internal registry record, not a public type.
- **JIT.** Code generation goes through `globalThis.Function` at
  `SchemaJITCompiler.ts:40`. `enable(ast)` is at `:91`. The side-effect module
  `SchemaJITCompiler/enable.ts:13` is just `install(compiler)`.
- **Startup ordering.** Per `SchemaCompiler.ts:193-214`, parsers that already
  resolved an entry keep it. What counts is when an entry is resolved, not when
  a decoder is captured:
  - Every `SchemaParser` adapter resolves lazily on first call
    (`SchemaParser.ts:975-993`, `:1047-1054`).
  - A decoder captured at module load and not yet invoked still picks up a
    later enable. `jit-late` matched `jit-global` in both spikes. Upstream's own
    `SchemaCompilerStartup.test.ts:6-18` asserts the same thing.
  - The real hazard is **any invocation before the enable**. That includes a
    decode or `make` during module initialization, such as a default computed
    at load or a constant built with `.make`. It freezes that AST's interpreted
    entry for good.
  - **Second-order trap.** `SchemaParser.decodeUnknownSync` picks its adapter
    at capture time from `compilerAdaptersEnabled` (`SchemaParser.ts:551-558`).
    A capture before activation keeps the slower Effect-wrapped adapter even
    after the enable. `Schema.decodeUnknownSync` is always the Effect-wrapped
    form (`Schema.ts:1811-1815`).
- **How this maps onto `@beep/schema`.**
  - `withCodecStatics` builds bound functions eagerly at class definition time:
    `codecStaticFactories[key](owned)` inside `installOnOwnedSchema`,
    `withCodecStatics.ts:328-334`.
  - Those factories call the `Schema.*` helpers, so they capture but do not
    invoke. They are safe under a later enable unless module-load code calls
    them.
  - They also always go through the Effect-wrapped adapter. The bulk numbers
    show `Schema.*` and `SchemaParser.*` within noise of each other under JIT,
    so the adapter tax is small next to the Declaration and transformation
    limits.

## Repo-fit answers

- **Where an opt-in would live.** It would go in `@beep/schema`, the canonical
  `foundation/modeling` home for "schema combinators, and schema-adjacent
  helpers" (`standards/architecture/07-non-slice-families.md:261-263`). A
  `foundation/capability` wrapper around `SchemaJITCompiler.enable` or
  `SchemaCompiler.set` fails the worked rejection example (`:66-89`) on
  criterion (c): "an ergonomic wrapper around an existing capability". It
  likely fails (a), consumers below 2, as well. The global opt-in is one
  binding-less import at an app entry point, which needs no package at all.
- **AOT as a `@beep/codegen-kit` `ExtraRenderer`: possible, but a shape
  stretch.**
  - The signature is `(config: GenerateConfig, refresh, fetch) =>
    Effect<string, …>` (`CodegenKit.service.ts:138-143`), and `GenerateConfig`
    requires a spec `source` and `dialect` (`CodegenKit.models.ts:349-350`).
    The kit is a pinned-spec to TypeScript pipeline. An AOT renderer instead
    imports live runtime schema modules and emits the output of
    `SchemaAOTCompiler.compile`.
  - What transfers is `CodegenKit.drift` (`:396-410`) with its `--check` and
    per-package `generate:check` CI lanes. Those are exactly what "regenerate
    when schemas or Effect change" needs.
  - The friction: the output is JavaScript that imports
    `effect/schema/SchemaCompiler/runtime` (`SchemaAOTCompiler.ts:237`). The
    repo convention is `_generated/*.gen.ts`, and there is no `.aot.js`
    precedent. The module must also sit where bare `effect/*` specifiers
    resolve. The spike had to rewrite the specifier to load it from the temp
    dir.
  - `Build.build` computes the module import relative to `outFile`
    (`Build.ts:96-134`). The smoke confirmed it works. A `.gen.ts` wrapper, or a
    dedicated `beep` generate step with its own drift check, fits better than
    an `ExtraRenderer`.
- **Imports: settled, no law change.** `Laws/EffectImports.ts` only reviews
  side-effect imports inside `planRootImport` (`:926-937`, calling `:905-925`),
  which handles root `effect` imports. A subpath import like
  `import "effect/schema/SchemaJITCompiler/enable"` is untouched. Biome
  `noUnusedImports`, oxlint, ESLint and knip do not flag binding-less imports.
  `effect`'s `sideEffects` list keeps the module under bundling.
- **CSP.**
  - oip-web production is `script-src 'self' 'nonce-…'`, with `'unsafe-eval'`
    only outside production (`apps/oip-web/src/proxy.ts:23-24`). JIT works in
    dev and silently falls back in prod.
  - The professional-desktop Tauri `csp` and `devCsp` have no `script-src`
    and no `'unsafe-eval'` (`apps/professional-desktop/src-tauri/tauri.conf.json:25-26`),
    so they fall back to `default-src 'self'`. The semantica lab Tauri config
    (`apps/labs/semantica/src-tauri/tauri.conf.json:21-22`) and the api-docs
    lab (`apps/labs/api-docs/src/Docs.routes.ts:26`, `script-src 'self'`)
    block eval too.
  - AOT output served as a same-origin static module satisfies `'self'` on all
    four. `jit-blocked` measured the production-CSP JIT at interpreter speed:
    it is dead code, not a failure.
- **D10 note.** The compilers do not attach statics to schema classes.
  - They only fill the per-AST registry that the ordinary
    `SchemaParser`/`Schema` free functions read. SchemaUtils rows are judged
    against Effect Schema's instance members and free functions, never against
    the compilers.
  - Separately, the per-AST registry moots the hoisting rationale for
    `withCodecStatics`. That rationale is "compiles only the requested schema
    helpers at module initialization"
    (`goals/schema-utils-selective-codec-statics/SPEC.md:12-13`;
    `explorations/effect-schema-parity/MAP.md:111`), and it is encoded by
    `beep/no-inline-schema-compile` (`.oxlintrc.json:45`).
  - Entries are cached per exact AST and resolved lazily. A free-function call
    at the use site reuses the same compiled entry that a hoisted static would
    hold, so hoisting no longer buys compilation reuse.

## DRAFT verdict for the operator's grill (not a decision)

**Recommended: DEFER.** The recommendation is not to adopt now and not to
reject. Keep the D8 re-entry gate open with sharper re-entry conditions.

Rationale:

1. **The win is real but narrow.** It is about 3.7x only for
   transformation-free struct and array graphs (`struct-wire`). The repo's
   actual models are classes with transformations: SqlModel rows, Lexical and
   Pandoc nodes. They gain 1.2–1.5x on flat rows and nothing measurable on the
   recursive Pandoc path. `Declaration` and `Suspend` exclusions put 102 of 395
   Pandoc nodes outside generation.
2. **Production browser and desktop surfaces cannot use JIT.** Every repo CSP
   blocks eval in production. The only CSP-safe route is AOT, which needs a
   build step with no repo precedent: a JavaScript artifact, bare `effect/*`
   specifiers, regeneration on every schema or Effect bump, and explicit
   targets past every `Suspend` and every private schema.
3. **The surface is `@stability unstable` and three weeks old.** It was first
   released in rc.116. The repo tracks main snapshots, so an AOT artifact would
   churn on every bump.
4. **D8 sequencing.** Runtime hot-path performance is second priority after the
   parity close (`MAP.md:19`, `:217-218`; `DECISIONS.md:100-110`). Nothing
   measured here is a hot path the repo has a complaint about today.

Re-entry conditions to record with the deferral:

- A measured server hot path that decodes transformation-free wire shapes in
  bulk: ingest, JSONL or row fan-out at 10k rows or more.
- Or upstream lifts the `Declaration` exclusion or adds `Suspend`-following AOT.
- Or the API leaves `unstable`.
- At re-entry, the cheapest experiment is the global side-effect import on one
  server entry point, behind a flag. That needs no package, no law change and
  no codegen. AOT stays a separate question for oip-web and Tauri.

Rejected options:

- **Adopt the global JIT now.** Rejected because of the dev and prod divergence
  under CSP, gains confined to shapes the repo rarely decodes, and the unstable
  API.
- **Adopt AOT through codegen-kit now.** Rejected because of the shape stretch,
  the `.js` artifact convention gap, per-bump regeneration churn, and the
  targets needed past `Suspend` and private schemas. No measured gain on the
  recursive model: 0.69–0.78x there.
- **A `foundation/capability` wrapper package.** Rejected by
  `07-non-slice-families.md:85-89`, criteria (a) and (c).
- **Reject outright.** Rejected because the 3.7x on wire structs is real and
  upstream is still moving. A dated deferral with measurable re-entry
  conditions costs nothing.

## Open questions for the Frontier

- Browser and desktop AOT: is a Build step worth it for oip-web and the Tauri
  shell, given that production CSP blocks JIT? The data here says not until a
  client hot path exists.
- `SchemaCompiler.set` with hand-written decoders for `@beep/schema` kits, such
  as a LiteralKit `is` fast path: still premature. No kit was measured.
- The AOT `model` regression (0.69–0.78x) needs a quiet-machine re-run before
  anyone cites it as a finding.

## Friction

- `research/tools/.tmp/` is not git-ignored. AOT output had to go to the OS
  temp dir.
- The generated AOT module's bare `effect/...` specifier does not resolve
  outside a package tree. The spike rewrites it to a file URL.
- A first `Build.build` smoke deadlocked. The entry module imported itself
  while its top-level await was pending. The schemas moved to
  `spike-bulk-schemas.ts`.
- Other sessions held load at 13–66 throughout. Absolute throughput here is
  load-inflated. Re-run both scripts on a quiet machine before quoting
  absolute numbers.
