# Effect v4 Schema compilers (SchemaCompiler / SchemaJITCompiler / SchemaAOTCompiler) and build-pipeline fit

Version context (verified 2026-10-09): installed `effect` in beep-effect2 is `4.0.2`
(`node_modules/effect/package.json`); the reference
checkout `~/YeeBois/references/effect/effect` is at commit `66257d29224e`
(2026-10-09) and its `packages/effect/package.json` is also `4.0.2`. The exported signatures of
`SchemaAOTCompiler/Build` are identical between installed `.d.ts` and reference `.ts` (diff showed
only `declare`/semicolon formatting). No API difference between installed and reference was found.

## KQ1 — Installed API: what the three modules are and what they export

### Takeaway
`SchemaCompiler` is a tiny registry contract (one `WeakMap<AST, Entry>` keyed by AST identity) that
the ordinary `SchemaParser`/`Schema` functions consult transparently; `SchemaJITCompiler` fills it at
runtime via `new Function`; `SchemaAOTCompiler.compile` emits a JS ES module string with an
`install(asts)` export that fills the same registry without dynamic code, and
`SchemaAOTCompiler/Build.build` is the build-script wrapper that loads schema modules, discovers
exported schemas and writes a self-installing module. There is no `Hooks`, `Cache` or `Tracer` export;
the public surface is small and every symbol is `@stability unstable`, `@since 4.0.0`.

### Cited Findings
- `effect/schema/SchemaCompiler` exports: `invalid: symbol`, `missing: symbol`, interfaces `Is`,
  `Decode`, `Make`, `DecodeEffect`, `MakeEffect`, `CompiledDecoder`, and
  `set: (ast: SchemaAST.AST, decoder: CompiledDecoder) => void`. Module JSDoc: "Provides the shared
  registry used by Schema decoder implementations... allowing runtime and ahead-of-time compilers to
  use the same cache without introducing a compiled Schema type or a second parser API." —
  `SchemaCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaCompiler.d.ts`, installed package)
- `CompiledDecoder` shape (verbatim): `readonly is?: Is; readonly decode?: Decode; readonly make?: Make;
  readonly decodeEffect: DecodeEffect; readonly makeEffect?: MakeEffect`. Only `decodeEffect` is
  required; `decode`/`is`/`make` are "optional optimizations, not requirements for an AST to be
  usable. The interpreter supplies only `decodeEffect` in this same format." —
  `SchemaCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaCompiler.d.ts`, installed package)
- Fast-path semantics: "Decoding tries `decode` when present, returning its output on success or
  calling `decodeEffect` after `invalid`... Type guards prefer `is`... Each operation is resolved lazily
  on first use, so unused fast paths need not be compiled." —
  `SchemaCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaCompiler.d.ts`, installed package)
- `effect/schema/SchemaJITCompiler` exports one function: `export declare function enable(ast:
  SchemaAST.AST): void;` ("Enables lazy JIT compilation for an AST and its parsing dependencies...
  Compilation failures, including environments that block `new Function`, retain interpreted parsing").
  `effect/schema/SchemaJITCompiler/enable` is a side-effect-only module (`export {}` in the d.ts) whose
  source is just `install(compiler)`. —
  `SchemaJITCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaJITCompiler.d.ts`, installed package);
  `enable.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaJITCompiler/enable.ts`)
- JIT mechanics (source): `compiler` probes `globalThis.Function("return true")` once per Function
  identity; per operation it calls `generate(ast, key)` from `internal/schema/codegen.ts` and runs
  `globalThis.Function("ast","R","resolve", source)(ast, runtime, resolve)`; on throw, decode-side
  codegen is marked `decodeFailed` and falls back to `runtime.decode(ast, resolve)` /
  `runtime.make(ast, resolve)` (the interpreter). —
  `SchemaJITCompiler.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaJITCompiler.ts`)
- `effect/schema/SchemaAOTCompiler` exports `type Operation = "decode" | "is" | "make"`, `interface
  Target { readonly ast: SchemaAST.AST; readonly operations: ReadonlyArray<Operation> }`, and
  `export declare const compile: (targets: ReadonlyArray<Target>) => string;` — "Generates a JavaScript
  ES module exporting `install(asts): void` for an ordered array of compilation targets." —
  `SchemaAOTCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler.d.ts`, installed package)
- `effect/schema/SchemaAOTCompiler/Build` exports `type Operation = "decode" | "encode" | "is" |
  "make"`, `interface ModuleLoader { (): PromiseLike<unknown> }`, `interface BuildOptions { modules:
  Readonly<Record<string, ModuleLoader>>; baseUrl: string | URL; outFile: string; operations?:
  ReadonlyArray<Operation> }`, `interface BuildResult { outFile; modules: number; schemas: number }`,
  `class BuildError` (`kind: "Generate" | "InvalidModule" | "LoadModule" | "ResolveModule"`), and
  `export declare const build: (options: BuildOptions) => Effect.Effect<BuildResult, BuildError |
  PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>;`. "A lazy record returned by
  `import.meta.glob` can be passed as `modules` directly." —
  `Build.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler/Build.d.ts`, installed package)
- `effect/schema/SchemaCompiler/runtime` exports a `runtime` object (d.ts shows `export {}` because it
  is marked internal-ish; source exports `runtime`) with helpers the generated code destructures
  (`invalid`, `getCheckIssues`, `matchesTemplateLiteral`, `getCandidateIndex`, `getIndexSignatureKeys`,
  `defaultParseOptions`, `hasExcessProperties`, `decode`, `make`, `setCompiler`, `sameExit`, `args`,
  `missing`, ...). "This module contains no source generator or dynamic function construction.
  Generated modules must use the same Effect version as their generator." —
  `runtime.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaCompiler/runtime.ts`)
- All three subpaths resolve through the package `exports` wildcard `./*`; `effect/schema` is also a
  named export. The package `sideEffects` list is exactly
  `["./src/schema/SchemaJITCompiler/enable.ts", "./dist/schema/SchemaJITCompiler/enable.js"]`, so
  bundlers keep the enable import and may tree-shake everything else. —
  `package.json` (`node_modules/effect/package.json`, installed package)
- Installed dist sizes (unminified bytes): `SchemaCompiler.js` 1,968; `SchemaCompiler/runtime.js`
  7,799; `SchemaJITCompiler.js` 2,598; `SchemaJITCompiler/enable.js` 528; `SchemaAOTCompiler.js`
  8,439; `SchemaAOTCompiler/Build.js` 7,047; `internal/schema/codegen.js` 37,553;
  `internal/schema/compilerRegistry.js` 4,570; `internal/schema/interpreter.js` 8,117. —
  `wc -c` on `node_modules/effect/dist/...` (this session)
- Tests in the reference repo: `SchemaAOTCompiler.test.ts`, `SchemaAOTCompilerBuild.test.ts`,
  `SchemaCompilerApi/Array/Construction/Concurrency/Regression/Startup.test.ts`,
  `SchemaJITCompiler/Fallback/ExcessProperties/CheckedSources.test.ts`, plus typetests
  `SchemaAOTCompiler.tst.ts`, `SchemaAOTCompilerBuild.tst.ts`, `SchemaCompiler.tst.ts`. —
  `find packages/effect/test -iname '*compiler*'` in the reference checkout

### Inferences
- The design deliberately avoids a "compiled schema" type: callers keep calling
  `Schema.decodeUnknownSync(S)` etc.; the compiler only changes what the registry hands back for that
  AST identity. That is why adoption is a one-line import, and also why ordering (install before first
  use) matters.
- `codegen.js` (37.5 KB raw) is the generator; the AOT path keeps it out of the app bundle because the
  generated module imports only `SchemaCompiler/runtime`.

### Gaps
- No `Hooks`, `Cache`, or `Tracer` exports exist in these modules in 4.0.2; the question's premise does
  not match the shipped API. The only extension point is `SchemaCompiler.set(ast, decoder)` for
  hand-written decoders.

## KQ2 — What the AOT compiler emits, and whether generation needs the live AST

### Takeaway
`compile` emits a single ES module: a header comment, `import { runtime } from
"effect/schema/SchemaCompiler/runtime"`, one deduplicated `function dN(ast,resolve,operation){...}`
factory per distinct generated source, and `export function install(asts){ const a0=asts[0]; const
a1=a0.propertySignatures[0].type; ...; runtime.setCompiler(a0,d0); ... }`. Generation walks the live
`SchemaAST` object graph, so the build step must execute the schema modules (TypeScript or JS) to
obtain ASTs; nothing about the schema is serialized — functions, symbols, defaults and Class source
schemas are read back from the ASTs passed to `install` at runtime.

### Cited Findings
- Emitted module skeleton (verbatim from source): header `// Generated by SchemaAOTCompiler. Regenerate
  after schema or Effect changes.`, then `import { runtime } from "effect/schema/SchemaCompiler/runtime";`,
  factories, `/** @param {ReadonlyArray<import("effect/SchemaAST").AST>} asts */`, `export function
  install(asts){`, bindings, `runtime.setCompiler(aN,dM);` installations, `}`. Factories are deduped by
  source text (`factoryNames` map) and bindings reference child ASTs by path (`a0.propertySignatures[1].type`,
  `a5.encoding[0].to`, `a8.typeParameters[0]`). —
  `SchemaAOTCompiler.ts L218-246` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaAOTCompiler.ts`)
- Probe run this session against installed 4.0.2 (Struct with checked string / Array / NumberFromString,
  plus `S.Class` and `S.Literals`): 4 targets produced a 13,268-byte, 61-line module with 8 factories
  and 14 AST bindings. The Struct's `decodeEffect` factory is a generated per-property loop that inlines
  the `NumberFromString` transform (`const t0=ast.propertySignatures[3].type.encoding[0].transformation.decode.transform`)
  and defers to `fallback(i,o)` when `o.errors==="all"||o.onExcessProperty!==void 0||(o.concurrency!==void 0&&o.concurrency!==1)`.
  The `S.Class` root (a `Declaration`) got only `decodeEffect: R.decode(ast,resolve,undefined,false,undefined,undefined)`
  and `makeEffect: R.make(...)` — interpreted orchestration — while its field struct got a real
  `make` fast path and the `Literals` union got `is`/`decode` fast paths backed by a `new Set([...])`
  constant. — scratchpad `aot-probe/generated.mjs` (this session)
- "Generation does not install decoders or execute checks and transformations... Transformations and
  middleware are not replayed... Functions and symbols are read from those ASTs, not serialized.
  Suspend thunks are not evaluated during generation; their contents and other unsupported nodes use
  the interpreter." —
  `SchemaAOTCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler.d.ts`, installed package)
- "Installation trusts that the runtime array has the same length and target order, and its ASTs have
  the same definitions and sharing as at build time." Type-side (`SchemaAST.toType`) and flipped
  (`SchemaAST.flip`) ASTs are separate registry keys and must be targeted separately for `make`/`is`
  and encoding. —
  `SchemaAOTCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler.d.ts`, installed package)
- `Build.build` output adds, above the `compile` output, `import * as m0 from "<relative path to
  schema module>";` per module with Schema exports (aliases `m0`,`m1`... sorted by specifier), an
  optional `import * as A from "effect/SchemaAST";` only when flip/toType is needed, and a trailing
  `install([m0["User"].ast, A.flip(m0["Port"].ast), A.toType(m0["Port"].ast), ...]);` so importing the
  file installs as a side effect. Exports are discovered with `Schema.isSchema(namespace[name])`;
  only direct exports are compiled. —
  `Build.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaAOTCompiler/Build.ts`);
  `SchemaAOTCompilerBuild.test.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/test/schema/SchemaAOTCompilerBuild.test.ts`)
- Build output is deterministic (test asserts byte-identical output on a second run) and is written
  via `FileSystem.makeDirectory` + `writeFileString`; the import path is computed relative to
  `outFile` and errors (`ResolveModule`) if the schema module cannot be imported relatively. —
  `Build.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaAOTCompiler/Build.ts`)
- Generated code is JavaScript only; there is no `.d.ts` emission and the module's only typed surface is
  the JSDoc `@param` on `install`. — `SchemaAOTCompiler.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaAOTCompiler.ts`)
- The Effect repo's own usage pattern: the benchmark fixtures spawn a child process that runs
  `writeFileSync(process.argv[2], compile(targets))`, then the parent `import()`s the file and calls
  `generated.install(roots)`. —
  `compiler-rebuild/fixtures/aot.ts and generate.mts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/runtimeperf/suites/compiler-rebuild/fixtures/aot.ts`)

### Inferences
- Yes, AOT requires executing the schema-defining code at build time (a Bun/Node script or a Vite
  plugin hook that imports the modules). It is a "snapshot of parser code for this AST shape", not a
  static analysis of TypeScript source.
- The generated module is not independently tree-shakeable in the useful sense: it is one side-effect
  module (`install(...)` at top level in the Build variant) importing every targeted schema module, so
  it pulls those modules into the bundle and must be listed as side-effectful. It only saves the
  generator, not the schema objects or `SchemaCompiler/runtime` + interpreter.
- Because installs are keyed by AST identity, the AOT module must import the *same* module instances
  the app uses (duplicate copies of a schema package in a bundle graph would silently miss).

### Gaps
- No upstream guidance on source maps, minification or `.d.ts` for generated modules; none observed.

## KQ3 — Intended workflow, authorship, stated goals

### Takeaway
Authored by Giulio Canti (@gcanti) in PR #7908, merged 2026-09-18 (first in `effect@4.0.0-rc.116`, moved
from `effect/unstable/schema/*` to `effect/schema/*` in PR #8354 on 2026-09-22). The stated workflow is:
JIT via a side-effect import at app startup; AOT via a build script calling `Build.build` (or
`compile`) and importing the generated file at startup. Goals stated by the PR: faster decoding
through the existing APIs, one shared registry, graceful fallback, and a CSP/no-eval path (AOT); bundle
size was measured as a cost, not a goal.

### Cited Findings
- Commit `c19c63fb71` "Optimize Effect Schema and add experimental JIT and AOT compilers (#7908)",
  author Giulio Canti, Fri Sep 18 2026; it added `codegen.ts` (922 lines), `compilerRegistry.ts`,
  `interpreter.ts`, the three compilers, `SchemaCompiler/runtime.ts`, `SchemaAOTCompiler/Build.ts`, a 211-line
  SCHEMA.md section and the `runtimeperf` `compiler-rebuild` and `moltar` suites. — `git show
  c19c63fb71 --stat` in the reference checkout; [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- PR #7908 summary (verbatim): "Adds experimental JIT and AOT compilers behind the existing
  `SchemaParser` APIs. Keeps interpreted, JIT, AOT, and manually installed decoders in one registry
  keyed by AST identity. JIT compilation is lazy and falls back to the interpreter when dynamic code
  generation is unavailable or compilation fails. AOT uses the same code generator and emits only the
  requested operations and their dependencies." Constraints: "Install JIT or AOT before the first
  parser execution that should use it. Regenerate AOT output after changing schemas or the Effect
  version. AOT generation loads the selected application modules at build time. Unsupported compiler
  paths use the interpreter." — [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- PR #7908 usage example for AOT uses Vite's glob: `SchemaAOTCompilerBuild.build({ modules:
  import.meta.glob("./schemas/*.ts"), baseUrl: import.meta.url, outFile: "./generated/schema-aot.js" })`
  — "Import the generated module at application startup. Decode roots are included by default. Encode,
  guard, and construction roots are opt-in." — [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- SCHEMA.md "Experimental schema compilers": `import "effect/schema/SchemaJITCompiler/enable"` at
  startup; "Importing `SchemaJITCompiler` or the `schema` barrel alone does not enable compilation";
  "Generated modules do not import the generator and work where `new Function` is forbidden"; "Run the
  returned Effect with the platform's `FileSystem` and `Path` services, and ensure the bundler retains
  the generated side-effect import." —
  `SCHEMA.md L68-130` (local checkout `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md`)
- SCHEMA.md closing caveat: "AOT removes dynamic source generation, not all parser initialization or
  the need for runtime schema objects." — `SCHEMA.md` (local checkout `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md`)
- Changeset for #7908 (patch) lists the companion breaking changes that made codegen feasible:
  `SchemaGetter.Getter` became a tagged union (sync/optional/effectful) with standalone `map`/`compose`/
  `run` "so bundlers remove composition code when an application does not use it";
  `Transformation#compose` → `composeTransformation`; `constructorDefault` now stores the Effect directly.
  — `git show c19c63fb71:.changeset/add-schema-compilers.md`;
  `CHANGELOG.md` (local checkout `~/YeeBois/references/effect/effect/packages/effect/CHANGELOG.md`)
- The 4.0 stable release note (PR #8633, @IMax153) lists "Optional JIT and AOT schema compilers are
  available as experimental modules." — `CHANGELOG.md L335` (local checkout `~/YeeBois/references/effect/effect/packages/effect/CHANGELOG.md`)
- Follow-up commits touching the compilers: #8406 Tim (stability annotations), #8354 Tim (move from
  `unstable/`), #8423 fml09 (onExcessProperty non-enumerable fix), #8430 and #8451 Florien Lazaro
  (stop re-proving emittability / re-analysing sub-schemas), #8555 Florien Lazaro (union candidate
  parsers resolved once), #8597 Riccardo Romoli / @Ceereals (inline checked sources of JIT
  transformations; fixes issue #8595), #8810 Sebastian Lorenz 2026-10-06 (fix suspended compiled Struct
  parser output reuse). — `git log --follow` on the compiler files in the reference checkout;
  [Issue #8595](https://github.com/Effect-TS/effect/issues/8595); [PR #8597](https://github.com/Effect-TS/effect/pull/8597)
- Related perf PR #8384 by front-depiction (Sept 22-23, closed and split into six PRs): union
  decoding 1.57–7.41× faster, cold compile 3.14–16.2× faster; "Applies to both interpreter and JIT
  compiler paths". — [PR #8384](https://github.com/Effect-TS/effect/pull/8384)
- Current public docs: the SCHEMA.md in the repo is the only documentation found; the effect.website
  v4 docs search returned nothing specific to the compilers. — WebSearch this session

### Inferences
- The compilers are a Canti design that landed late in the rc cycle (three weeks before 4.0 stable) and
  are still being patched weekly (latest fix 2026-10-06), consistent with the `unstable` stamp.

### Gaps
- No blog post, Effect Days talk, Discord summary or X post explaining the design was found via web
  search (results were dominated by unrelated "@jit/compiler" packages). The PR body is the primary
  narrative source.

## KQ4 — Performance evidence (interpreted vs JIT vs AOT) and bundle size

### Takeaway
Upstream's paired benchmarks show JIT and AOT are within noise of each other and 20–60× faster than the
interpreter on validation-only shapes (e.g. "Moltar parseSafe, valid" 325.8 ns → 5.42 ns), roughly 13×
on `Struct with 32 transformations`, and 2.5–6× on construction. Bundle cost measured by upstream:
+6.77 KB min+gz for JIT, +2.12 KB for AOT, versus a 17.88 KB no-compiler baseline. The repo's own
2026-09-28 spike on realistic `@beep` shapes found a narrower picture: ~3.7× on transformation-free
wire structs, 1.2–1.5× on class/transformation-heavy rows, and no measurable gain on the recursive
Pandoc graph.

### Cited Findings
- PR #7908 "Compiled" table (median ns/op, Node 24.12.0, V8 13.6, Apple M3; Valibot 1.5.0, Zod 4.6.2):
  Moltar parseSafe valid — JIT 5.42 ns, AOT 5.47 ns, Zod compile 5.26 ns (interpreter 325.8 ns);
  Array of 32 Structs — 128.0 / 126.1 / 130.6 ns (interp 3.17 µs); Record of 32 Structs — 594.1 /
  594.6 ns / 1.52 µs (interp 3.87 µs); Discriminated Union 8 members — 15.7 / 15.8 / 30.2 ns (interp
  97.5 ns); Struct with 32 transformations — 140.7 / 140.4 / 207.0 ns (interp 1.53 µs branch);
  Construct 32 defaulted fields — 362.8 / 357.0 / 482.1 ns (interp 865.3 ns branch). —
  [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- PR #7908 "Interpreted" table shows the same PR also sped the interpreter: Struct with 32
  transformations 1.88 → 1.53 µs; Construct 32 defaulted fields 2.22 µs → 865.3 ns. —
  [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- PR #7908 retained-heap per schema: Struct — JIT 5.32 KiB, AOT 6.90 KiB, Zod compile 9.37 KiB;
  Discriminated Union — 27.90 / 33.79 / 47.97 KiB; 32 transformations — 32.17 / 32.19 / 101.37 KiB.
  Preparation CPU (adapter creation + first call; AOT includes importing/installing the generated
  module): Struct — JIT 31.4 µs, AOT 37.1 µs, Zod 58.3 µs; 32 transformations — 354.5 / 294.3 /
  367.4 µs. — [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- PR #7908 bundle size (minified + gzip): "Main, no compiler 17.55 KB; Branch, no compiler 17.88 KB
  (+0.33); Branch with JIT 24.65 KB (+6.77); Branch with AOT 20.00 KB (+2.12)". —
  [PR #7908](https://github.com/Effect-TS/effect/pull/7908)
- Upstream's `compiler-rebuild` suite "measures 25 public SchemaParser operations with the interpreter,
  selective JIT and generated AOT modules" against `z.compile(schema, { strict: true })`, Valibot and
  jitless Zod; "AOT fixtures generate their version-specific module in a separate process before loading
  it"; "AOT source generation is reported separately because it runs at build time." Run with
  `pnpm runtimeperf-compare compiler-rebuild --base schema-compiler` / `pnpm runtimeperf compiler-rebuild`.
  — `compiler-rebuild/README.md` (local checkout `~/YeeBois/references/effect/effect/packages/effect/runtimeperf/suites/compiler-rebuild/README.md`)
- beep-effect2 spike (2026-09-28, Bun 1.4.2, effect 4.0.0-rc.118, Threadripper 9970X under load
  13–66; only per-pass ratios are considered findings): bulk `S.Array` of 1,000 rows,
  `Schema.decodeUnknownSync`: `struct-wire` (no transformations) jit-selective 3.72×, jit-global 3.67×,
  aot 3.69×; `struct` with transformations 1.19× / 1.43× / 1.46×; `schema-class` 1.39× / 1.23× / 1.23×;
  `model-class` (SqlModel) 1.29× / 1.32× / 1.34×; `jit-blocked` (Function throws, production CSP)
  ~1.0× or worse. — [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Same spike, recursive Pandoc decode (395-node class graph, 102 Declarations, 7 Suspends): every mode
  straddled 1.0×; AOT on the `model` path 0.69–0.78× (possible small regression from 270 installed
  entries, "not proven under this load"); the AOT module targeting all 89 direct exports was 92 KB with
  56 factories. Cold costs: JIT 1–3 ms codegen per row graph; AOT compile 0.7–2.1 ms at build, import +
  install 2.7–4.9 ms at startup. — [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Same spike: "The class wrapper costs about 30–35% of throughput, and the compiler does not remove
  it" (model-class 496 → struct 762 arrays/s interp; 743 → 1,100 under JIT). —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)

### Inferences
- The upstream headline numbers are for shapes the compiler fully specializes (plain primitives,
  Structs, Arrays, Unions). For `@beep/schema`-style graphs the relevant number is the repo's 1.2–1.5×,
  not the 60×.
- Bundle size is a cost of both compilers, not a saving; neither drops the interpreter (the detailed
  `decodeEffect` path, diagnostics and transformations still run through it).

### Gaps
- No independent third-party benchmarks found. The beep spike's absolute numbers were taken under
  heavy machine load and its authors asked for a quiet re-run before citing them.

## KQ5 — Build integration: existing plugins/CLIs, third-party and in-repo usage

### Takeaway
There is no official Vite/rolldown/tsdown/Bun plugin or CLI; the only shipped build integration is the
`Build.build` Effect (designed to accept `import.meta.glob`). The Effect repo uses the compilers only in
its `runtimeperf` benchmark suites, not for its own packages. No usage exists in Spencer Beggs's
effected/okfit/pluginfinity/tsdoctor/vitest-agent checkouts. The one external adopter found is
nikhilsnayak/effective-rsc (JIT enable in every graph, 2026-09-19). beep-effect2 has no runtime usage,
only the exploration packet that recorded a DEFER verdict.

### Cited Findings
- `rg "AOTCompiler|SchemaCompiler|JITCompiler"` over `~/YeeBois/references/effect/{effected,okfit,pluginfinity,tsdoctor,vitest-agent}`
  returned zero matches. — ripgrep this session
- Within the Effect repo, non-test usages are only
  `packages/effect/runtimeperf/suites/{compiler-rebuild,moltar}/fixtures/{jit,aot}.ts` and
  `schema-excess-properties` / `schema-checked-sources` fixtures. No `packages/*` library imports
  `SchemaJITCompiler/enable`. — ripgrep over `packages` in the reference checkout
- opencode's plugin module loader test lists `effect/schema/SchemaJITCompiler` and
  `effect/schema/SchemaJITCompiler/enable` among host-discoverable modules (loader code
  `require("effect/schema/SchemaJITCompiler/enable")`) — a module-resolution test, not adoption. —
  `module.test.ts L354-366` (local checkout `~/YeeBois/references/effect/opencode/packages/core/test/plugin/module.test.ts`)
- nikhilsnayak/effective-rsc PR #53 "feat: enable Effect Schema JIT compilation in every graph",
  merged 2026-09-19, touched `src/build/rsc-entry.ts`, `src/cli.ts`, `src/client/entry.ts`,
  `src/server/start.ts`, `docs/DECISIONS.md`, `docs/architecture/build.md`; Vercel previews passed. The
  fetched page did not expose the diff, benchmark numbers or bundle notes. —
  [effective-rsc PR #53](https://github.com/nikhilsnayak/effective-rsc/pull/53)
- beep-effect2 references are documentation only: `explorations/effect-schema-parity/{MAP,README,DECISIONS}.md`,
  `research/2026-09-05/*`, `research/2026-09-22/claims.jsonl`, `research/ledger/WATCHLIST.md`
  (`w-schema-jit` RETIRED 2026-09-30 "ships in effect@4.0.0-rc.118") and the compiler evaluation; the
  verdict PR was beep-effect/beep-effect #1329. No `packages/**` source imports the compilers. —
  ripgrep this session; [WATCHLIST.md](../../../../research/ledger/WATCHLIST.md);
  [beep-effect PR #1329](https://github.com/beep-effect/beep-effect/pull/1329)
- beep-effect2 DECISIONS 2026-09-28 reopened the parity packet on the compilers with constraints D1–D10;
  D6 fixed the two spikes, D8 keeps "runtime hot-path perf is LATER", D10 records that "the compilers
  do not attach statics to schema classes". —
  [DECISIONS.md L527-590](../../../../explorations/effect-schema-parity/DECISIONS.md)
- The evaluation's DRAFT verdict: "DEFER"; re-entry conditions: a measured bulk server hot path
  decoding transformation-free wire shapes (≥10k rows), upstream lifting the Declaration exclusion or
  following Suspend in AOT, or the API leaving `unstable`; "the cheapest experiment is the global
  side-effect import on one server entry point, behind a flag." —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Repo CSP facts from the evaluation: oip-web production `script-src 'self' 'nonce-…'` with
  `'unsafe-eval'` only outside production (`apps/oip-web/src/proxy.ts:23-24`); the Tauri shells and
  api-docs lab also block eval — "JIT works in dev and silently falls back in prod"; "AOT output served
  as a same-origin static module satisfies `'self'`". —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)

### Inferences
- The absence of any bundler plugin after three weeks, plus `unstable` status, means a beep adoption
  would be writing the first integration, not reusing one.

### Gaps
- Could not read the effective-rsc diff to see how the enable import was placed per entry (page
  fetch returned only metadata). GitHub issue/PR search via `gh search` returned nothing (likely
  search-index lag), so the issue census relies on `git log` and web results.

## KQ6 — Unsupported schema features, fallback behaviour, and meaning for `@beep/schema`

### Takeaway
Code generation covers encoding-free graphs of primitives, `Objects` (Structs/Records), `Arrays`
(tuples/arrays), `Union` and `TemplateLiteral`, plus generated Struct/homogeneous-Array loops and one
synchronous leaf-to-leaf transformation. `Declaration` (every `S.Class`, `instanceOf`, `declare`),
`Suspend`, any child carrying `encoding`, middleware, effectful transformations, `oneOf` inside template
literals, graphs over 2,048 nodes / 256 deep, and parse options `errors:"all"`, `onExcessProperty`,
`concurrency≠1` all fall back to the interpreter — silently, per node, through the same registry. Brands
are type-only in 4.0 and do not affect compilation; `LiteralKit`-style literal unions compile to a `Set`
lookup; `S.Class` roots never get generated code though their field struct does.

### Cited Findings
- Eligibility (`shouldCompileParser`): returns true when the AST has `encoding`, a constructor
  descriptor, `checks`/encoding checks, or is `TemplateLiteral | Arrays | Objects | Union`; plain
  leaves return false (they stay interpreted; a leaf parser is cheap). —
  `codegen.ts L222-234` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- Fast-validator exclusions (`addChild`): `if (child.encoding !== undefined || child._tag ===
  "Declaration" || child._tag === "Suspend") { facts.supported = false }` — any such child makes the
  parent's `is`/`decode` fast path unsupported. `getEmission` returns `"unsupported"` for a root with
  `encoding` (unless local), `Declaration`, or `Suspend`. —
  `codegen.ts L50-56, L154-161` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- `make` fast path only for `Arrays` with exactly one rest element and no fixed elements, or `Objects`
  with ≥1 property and no index signatures, and only when make-safe: no `Union`, `Declaration`,
  `Suspend`, index signatures, `encoding`, or `constructorDefault` anywhere in the subtree. —
  `codegen.ts L40-44, L166-169` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- Limits: `maxGeneratedDepth = 256`, `maxGeneratedNodes = 2048`; exceeding either yields `undefined`
  facts (interpreter). `TemplateLiteral` containing a `oneOf` union part is unsupported. —
  `codegen.ts L12-14, L114-119` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- Checks are supported in generated validators by calling back into runtime: emitted code does
  `const vN=<output>; if(K(C[i],vN,0,o))return <invalid>` where `K = runtime.getCheckIssues` and `C[i]`
  is the AST constant — so refinements with custom predicates compile, but the predicate function itself
  runs as ordinary JS from the live AST. —
  `codegen.ts L284-300` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- Transformations: "A single synchronous transformation between supported leaf types can use generated
  orchestration. Other detailed traversals, transformations, and middleware use the interpreter with
  registry-resolved children. Transformations and middleware are not replayed." —
  `SchemaAOTCompiler.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler.d.ts`, installed package)
- Generated Struct loop bails to the interpreter at runtime when `o.errors==="all" ||
  o.onExcessProperty!==void 0 || (o.concurrency!==void 0 && o.concurrency!==1)`. — generated module probe
  this session; `codegen.ts ~L829` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/internal/schema/codegen.ts`)
- Suspend: "Suspend is resolved lazily by JIT. AOT does not evaluate Suspend thunks at build time, so
  dynamically reached schemas fall back to the interpreter unless installed separately. Declaration
  callbacks remain runtime code; their type parameters can be compiled." —
  `SCHEMA.md "What is specialized"` (local checkout `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md`)
- Contract requirements on user code: "Checks and property getters in replayable validation must be
  deterministic and free of side effects. Proxy inputs and modifications to built-in object behavior
  are not supported by the optimization contract." —
  `SCHEMA.md` (local checkout `~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md`)
- Brands: PR #8628 (@gcanti) "Make `Schema.brand` type-only: brand identifiers are no longer stored in
  AST annotations"; `fromBrand` checks remain and compile like any check. —
  `CHANGELOG.md L297` (local checkout `~/YeeBois/references/effect/effect/packages/effect/CHANGELOG.md`)
- Correctness contract: compiled output "must reproduce the interpreter reachable via `ast.getParser`
  exactly; any divergence is a bug, not an optimization"; the checked-sources suite differential-tests
  interpreter vs compiler over an input × option matrix. —
  `graft/schema-compiler-layer-jit-aot-codegen-registry.md` (local checkout `~/YeeBois/references/effect/effect/graft/schema-compiler-layer-jit-aot-codegen-registry.md`)
- beep evaluation static census: `model-class` graph (20 nodes) — 8 fast-validator, 2 generated-loop,
  3 interpreted-orchestration (the class and two `DateTime.Utc` declarations), 7 interpreter leaves;
  Pandoc (395 nodes) — 36 fast-validator, 136 generated-loop, 129 interpreted-orchestration, 94
  interpreter. "The compilers never generate code for a Declaration... Only the Declaration's encoding
  link is compiled." —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Ordering hazard relevant to `@beep/schema`: `withCodecStatics` builds bound `Schema.*` functions at
  class-definition time; "They capture but do not invoke. They are safe under a later enable unless
  module-load code calls them"; any decode/`make` during module initialization "freezes that AST's
  interpreted entry for good". Also `SchemaParser.decodeUnknownSync` picks its adapter at capture time
  from `compilerAdaptersEnabled`. —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- D10: "the per-AST registry moots the hoisting rationale for `withCodecStatics`... A free-function call
  at the use site reuses the same compiled entry that a hoisted static would hold." —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)

### Inferences
- For `@beep/schema`: `LiteralKit` unions (literal `Union`) are ideal fast-path material (Set lookup);
  `S.Class`-heavy domain models get only field-struct loops; transformation-rich columns
  (`DateTimeUtcFromString`, `OptionFromNullOr`) demote their parent to loop-only. Expected gain is the
  1.2–1.5× band unless wire structs are decoded separately from class construction.
- Fallback is per-node and silent, so "unsupported" never breaks a build; the risk is only wasted
  generated bytes and the startup install cost.

### Gaps
- No upstream list of exactly which `Declaration`s (Option, Map, Set, DateTime...) might gain
  specialized codegen later; the evaluation's re-entry condition "upstream lifts the Declaration
  exclusion" has no tracking issue found.

## KQ7 — How an AOT build pipeline for a monorepo of schema packages would look

### Takeaway
The only supported shape today is: a build-time script (Bun/Node) that imports the built or
source schema modules, calls `Build.build` (or `compile` for exact targets including `toType`/`flip`
roots and anything behind `Suspend`), writes one `*.js` module per app (or per package) that imports the
schema modules and installs on import, and an app entry that imports it before any decode. The output
is plain JS importing bare `effect/schema/SchemaCompiler/runtime`, must be regenerated on every schema
or Effect change, must be kept side-effectful by the bundler, and carries no `.d.ts`.

### Cited Findings
- Build contract: "Module keys are import specifiers relative to `baseUrl`. Their loaders run
  sequentially during the build... The generated module imports those exports and installs their
  decoders in the shared Schema parser registry as a module side effect... Build configurations that
  mark modules as side-effect free must retain the generated import." —
  `Build.d.ts` (`node_modules/effect/dist/schema/SchemaAOTCompiler/Build.d.ts`, installed package)
- `Build.build` requires `FileSystem.FileSystem | Path.Path` — i.e. run it under `@effect/platform-bun`
  or `-node` layers (the upstream test used `FileSystem.layerNoop` with node fs plus `Path.layer`). —
  `SchemaAOTCompilerBuild.test.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/test/schema/SchemaAOTCompilerBuild.test.ts`)
- Only direct `Schema.isSchema` exports are discovered; nested dependencies are discovered by the AOT
  compiler, but module-private schemas and anything only reachable through `Suspend` are not, so
  "Neither selective JIT nor AOT can reach private schemas... Only the global JIT reaches them." —
  `Build.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/src/schema/SchemaAOTCompiler/Build.ts`);
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Emitted module import specifier is the bare `effect/schema/SchemaCompiler/runtime`, which "does not
  resolve outside a package tree. The spike rewrites it to a file URL"; a first `Build.build` smoke
  "deadlocked. The entry module imported itself while its top-level await was pending" — schema
  modules must be separate from the build entry. —
  [compiler-evaluation.md Friction](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Repo-fit analysis: an AOT step as a `@beep/codegen-kit` `ExtraRenderer` is "possible, but a shape
  stretch" (kit is spec→TS; AOT is live-modules→JS); what transfers is `CodegenKit.drift` with
  `--check` lanes; "A `.gen.ts` wrapper, or a dedicated `beep` generate step with its own drift check,
  fits better." The repo convention is `_generated/*.gen.ts` with no `.aot.js` precedent. —
  [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Upstream's own pattern for benchmarks: generate in a separate child process
  (`execFileSync(process.execPath, [generate.mts, file])`) then `import()` + `install(roots)` in the
  parent, so generator code never loads in the measured process. —
  `compiler-rebuild/fixtures/aot.ts` (local checkout `~/YeeBois/references/effect/effect/packages/effect/runtimeperf/suites/compiler-rebuild/fixtures/aot.ts`)
- Startup cost measured by the repo: AOT import + install 2.7–4.9 ms for a 14-function row graph; a
  Pandoc-wide module was 92 KB / 56 factories / 270 installed nodes with a 0.69–0.78× result on the
  recursive path. — [compiler-evaluation.md](../../../../explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md)
- Bundle delta upstream: AOT +2.12 KB min+gz over no-compiler for the runtime helpers (excluding the
  generated module itself), JIT +6.77 KB. — [PR #7908](https://github.com/Effect-TS/effect/pull/7908)

### Inferences
- Per-package `*.compiled.js` next to each schema module is not what the API models: installs are keyed
  by AST identity and `Build` emits one module importing N schema modules, so the natural unit is one
  generated module per *application entry* (server, oip-web, Tauri), generated from that app's built
  dependency graph — not per library package. Shipping a generated module inside `@beep/schema`'s dist
  would also pin it to one exact Effect version and risk double-install mismatches if an app bundles
  a second copy.
- A Bun build script (`bun run scripts/aot.ts`) that imports `@beep/*` schema barrels through
  workspace symlinks, runs `Build.build` with `BunFileSystem`/`BunPath` layers, writes
  `apps/<app>/src/_generated/schema-aot.js`, plus a `--check` drift lane comparing output bytes, is the
  minimal integration; a Vite plugin would only wrap the same steps around `import.meta.glob`.
- Tree-shaking: the generated module cannot be shaken (top-level `install(...)` side effect) and pulls
  every targeted schema module into the entry chunk; declaration typing is absent, so a sibling
  `schema-aot.d.ts` (`export function install(asts: ReadonlyArray<AST>): void`) must be hand-written if
  the `compile` (non-Build) form is used from TypeScript.
- Given the repo's DEFER verdict and the measured 1.2–1.5× on real models, the bundler decision should
  not hinge on AOT support; any bundler that honours `sideEffects` and can run a pre-build script
  suffices. The one bundler-relevant requirement is that the enable/AOT import executes before any
  module-initialization decode, which argues for placing it first in the entry file rather than relying
  on plugin ordering.

### Gaps
- No upstream or community example of a Vite/rolldown/tsdown/Bun plugin, watch-mode regeneration, or
  per-package publishing of AOT output was found; the design above is inferred from the API and the
  repo's spike, not from a shipped integration.
- Whether Effect plans a first-party CLI or bundler plugin is unknown; no issue or discussion was found.
