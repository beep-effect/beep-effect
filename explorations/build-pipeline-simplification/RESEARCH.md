# Build Pipeline Simplification: Research

<!-- Stage 1. Cited external landscape + in-repo capability inventory. Dated
sections. Provenance ledger: research/SOURCES.md. -->

Every external claim below cites the deep-research note section that carries
it. Those notes hold the primary URLs; [`research/SOURCES.md`](./research/SOURCES.md)
lists them. The synthesis is [`REPORT.md`][report]. Claims the notes mark as
inference keep an "(inference)" tag here.

## 2026-10-09: External landscape

### Bun 1.4.2 bundler: capabilities and gaps

| Area | Finding | Cite |
| --- | --- | --- |
| Declarations | No `.d.ts` in any mode, no `--dts`, no isolatedDeclarations emit. Docs say "use `tsc`". Issue #5141 open since 2023 (109 upvotes). | [bun Q1][bun-q1] |
| Type check | `bun check` / `Bun.build({ check: true })` merged 2026-10-06, after 1.4.2 shipped 2026-09-05. On 1.4.2 a type error still "builds". | [bun Q2][bun-q2] |
| Library surface | Externals, `--splitting`, esm/cjs/iife, minify, sourcemaps, `define`, PURE emission, `--bytecode`, `--compile`. | [bun Q3][bun-q3] |
| Missing options | No `outExtension`, `alias`, `mainFields`, `legalComments`, downlevel `target`, `inject`, `pure`. | [bun Q3][bun-q3] |
| Per-module output | No preserveModules. `--no-bundle` leaves extensionless relative specifiers, so Node cannot load it. | [bun Q3][bun-q3] |
| Plugins | `onStart/onResolve/onLoad/onBeforeParse/onEnd` only. No render-chunk or emit-file hook, so no plugin-emitted dts. | [bun Q4][bun-q4] |
| Speed | Rolldown's benchmark (2026-10-07): Bun 955 ms, rolldown 1,822 ms, esbuild 2,108 ms on 19k modules. Output differs, so not like-for-like. | [bun Q5][bun-q5] |
| Known bugs | No `exports` map, no `.d.ts.map`. 240 open bundler issues. #18008 (`sideEffects: false` barrel re-export drop) confirmed on 1.4.3-canary. | [bun Q6][bun-q6] |
| Adoption | tsdown ~53,632 package.json references vs bunup ~677. No Effect-ecosystem library publishes through `bun build` alone. | [bun Q7][bun-q7] |
| Runtime | `--bytecode` startup: vendor ~2x, one independent 1.38x (52.7 to 38.3 ms). Bun-only, version-locked, CLI lane only. | [bun Q8][bun-q8] |
| Silent flags | Unknown CLI flags and `Bun.build` keys are accepted silently. Every claim needs output inspection, not exit 0. | [bun Q9][bun-q9] |

### tsdown, rolldown, Rslib, esbuild, TypeScript 7

| Tool | Version / date | Declarations | Status note | Cite |
| --- | --- | --- | --- | --- |
| tsdown | 0.23.0, 2026-09-03 | `rolldown-plugin-dts`: oxc (needs isolatedDeclarations), tsgo (TS 7, "experimental"), else tsc | Pre-1.0; 0.23 was a breaking reorg. tsup now points to it. `unbundle`, `exports` + `devExports`, publint/attw, `-W` workspace mode. | [rust KQ1][rust-kq1], [REPORT tsdown][report-tsdown] |
| rolldown | 1.0.0 on 2026-05-07; 1.2.13 on 2026-10-07 | Only via rolldown-plugin-dts | `output.preserveModules` stable. Vite 8 (2026-03-12) made it the single default bundler. | [rust KQ2][rust-kq2] |
| Rslib | 1.0.0, 2026-09-03 | tsc API, tsgo auto, SWC isolated | Bundleless mode with path/extension redirects. Vendor 2.4x/4.2x dts speedups. No named adopters found. | [rust KQ3][rust-kq3] |
| esbuild | 0.28.2, 2026-08-08 | None | Three 2026 releases. Vite 8 replaced it with Oxc. Fit: JS-only transform, e.g. the effect-drizzle probe. | [rust KQ4][rust-kq4] |
| TypeScript 7 | 7.0, 2026-07-08 | Native (`tsc`, `--build`, incremental) | Go compiler, 7.7x to 11.9x faster. Programmatic API deferred to 7.1. No tree-shaking or PURE insertion. | [rust KQ5][rust-kq5] |

- Independent benchmarks are scarce. The one user number is 7.0 s to 3.6 s (tsup+tsc to tsdown, 26 packages, 2025). No dated head-to-head exists. [rust KQ7][rust-kq7]
- Turbo caching is tool-agnostic when the script runs per package with `dist/**` outputs. tsdown has the shortest per-package config. [rust KQ8][rust-kq8]
- A tsdown build still runs a TypeScript program for declarations. Without repo-wide isolatedDeclarations there is no wall-clock win (inference). [REPORT tsdown][report-tsdown]

### Effect-team build practice and the dual-instance hazard

- Effect v4 is ESM-only: `tsc -b` per module, then `babel dist --plugins annotate-pure-calls`. It ships `src`, `.js.map` and `.d.ts.map`. [bundle Q1][bundle-q1], [spencer KQ6][spencer-kq6]
- v4 tightened `sideEffects` from `[]` to a two-file allowlist naming `SchemaJITCompiler/enable`. The team never bundles its own packages. [bundle Q1][bundle-q1], [REPORT Spencer][report-spencer]
- Two `effect` copies in one process is tracked in issues #1479, #1561 and #3308. The team called bundling effect into libraries a bad idea. [bundle Q2][bundle-q2]
- The team tolerates duplicates via `globalValue`, string-keyed Tags and `Symbol.for` TypeIds. tsgo's `duplicatePackage` diagnostic exists because duplicates break `Context` lookups. [bundle Q2][bundle-q2]
- Per-module output tree-shakes more reliably than one file per entry. Removal correctness rests on `sideEffects` and `@__PURE__`. [bundle Q3][bundle-q3]
- Module-graph size drives Node CLI startup. No Effect-specific or Bun-specific numbers exist. Hot paths are unaffected by layout. [bundle Q5][bundle-q5]
- Rolled-up `.d.ts` loses `declarationMap`, which breaks go-to-source for Effect stack traces and definitions. [bundle Q6][bundle-q6]
- Turborepo names three strategies: Just-in-Time, Compiled ("majority ... should use tsc"), Publishable. Next 16 Turbopack auto-transpiles workspace packages. [bundle Q7][bundle-q7]
- No Effect-ecosystem exemplar inlines `effect`. [bundle Q8][bundle-q8]

### Pure-annotation handling

- Rolldown/Oxc, esbuild, Rspack and Bun all respect `@__PURE__` on input. Oxc and rolldown also respect `@__NO_SIDE_EFFECTS__`. [bundle Q4][bundle-q4], [rust KQ6][rust-kq6]
- None infers purity for `dual(...)`, `Schema.Struct(...)` or `Context.Tag(...)`. Oxc docs say it "does not inject" them. [bundle Q4][bundle-q4]
- Insertion tools: `babel-plugin-annotate-pure-calls` (Effect still runs it) and `rollup-plugin-pure`. Rolldown heuristic DCE (#10068) is an open discussion. [rust KQ6][rust-kq6], [REPORT tsdown][report-tsdown]
- Swapping emitters does not remove the Babel pass. Only ruling that unpublished packages need no annotations does (inference). [REPORT tsdown][report-tsdown]

### Spencer Beggs's `@savvy-web/bundler`

- Note conflict: one note names `@savvy-web/bun-builder` (Bun bundler). The installed-source audit of `@savvy-web/bundler` 2.4.24 shows tsdown. Installed source is authoritative. [bundle Q8][bundle-q8], [REPORT Spencer][report-spencer]
- Engine: tsdown ^0.23.0, rolldown ^1.2.12, `@savvy-web/tsdown-plugins` 2.8.22, API Extractor 7.59.1. Bun is not in his library build. [spencer KQ1][spencer-kq1]
- Passes per target group: JS pass (`unbundle: true`, `dts: false`); bundled `.d.ts` per entry (`generator: "tsc"`); prod-only per-module dts plus API Extractor meta pass. [spencer KQ1][spencer-kq1], [spencer KQ3][spencer-kq3]
- Prod strips `.d.ts.map` and ships no source maps. Minify is off by default. Every run writes `dist/<target>/issues.json`. [spencer KQ1][spencer-kq1]
- Manifest projection: source manifests are `private: true` with `exports` to `src`. A transform flips `private`, strips dev fields and derives `{ types, import, default }` from export keys. [spencer KQ2][spencer-kq2]
- Peers: `effect` is always a peer via an `effect:peers` catalog (`^4.0.0`). Dev uses the `effect` catalog (`^4.0.2`). Everything declared is auto-externalised. [spencer KQ4][spencer-kq4]
- Why bundle: publishing mechanics across six repos, type-surface hygiene, agent-readable diagnostics. Not size: zero `@__PURE__` markers in his dev JS. This "why" is reconstructed (inference). [spencer KQ5][spencer-kq5], [REPORT Spencer][report-spencer]
- Costs on record: three TS program loads per prod build, `stableTypeOrdering` for `Layer` unions, `_base` forgotten-export suppressions, a duplicated private-member bug. [REPORT Spencer][report-spencer]
- Borrow: manifest projection from a private source, two-catalog peer discipline, auto-externals, `issues.json`, artifact assertions over exit codes. [REPORT Spencer][report-spencer]
- Leave: rolled-up `.d.ts`, API Extractor, stripped maps and source, `tsc` over `tsgo`. [REPORT Spencer][report-spencer]

### Effect SchemaCompiler, AOT and JIT

| Fact | Value | Cite |
| --- | --- | --- |
| Shape | `SchemaCompiler` is one `WeakMap<AST, Entry>` registry that `SchemaParser` consults. JIT fills it via `new Function`. | [schema KQ1][schema-kq1] |
| AOT output | One ES module: imports `effect/schema/SchemaCompiler/runtime`, deduplicated factories, `install(asts)`. `Build.build` writes a self-installing module. | [schema KQ1][schema-kq1], [schema KQ2][schema-kq2] |
| Generation input | Walks the live `SchemaAST` graph, so the build must execute schema modules. Nothing is serialized. | [schema KQ2][schema-kq2] |
| Provenance | PR #7908 by gcanti, merged 2026-09-18. Moved to `effect/schema/*` in PR #8354 on 2026-09-22. All symbols `@stability unstable`. | [schema KQ3][schema-kq3] |
| Stated goals | Faster decode via existing APIs, one registry, graceful fallback, CSP-safe AOT. Bundle size was measured as a cost. | [schema KQ3][schema-kq3] |
| Upstream perf | JIT and AOT within noise; 20x to 60x over interpreter on validation-only shapes (325.8 ns to 5.42 ns). | [schema KQ4][schema-kq4] |
| Bundle cost | +6.77 KB min+gz JIT, +2.12 KB AOT, over a 17.88 KB no-compiler baseline. | [schema KQ4][schema-kq4] |
| Repo spike (2026-09-28) | ~3.7x on transformation-free wire structs; 1.2x to 1.5x on class/transformation rows; no gain on recursive Pandoc. | [schema KQ4][schema-kq4] |
| Fallback | `Declaration` (every `S.Class`), `Suspend`, any child with `encoding`, effectful transforms, >2,048 nodes fall back silently per node. | [schema KQ6][schema-kq6] |
| Integrations | No Vite, rolldown, tsdown or Bun plugin. Effect uses it only in `runtimeperf`. One external adopter (effective-rsc, JIT). | [schema KQ5][schema-kq5] |
| Pipeline shape | Build script imports schema modules, writes one module per app, entry imports it first. Plain JS, no `.d.ts`, regenerate on any change. | [schema KQ7][schema-kq7] |
| Placement | One generated module per application entry, not per library; a library-shipped module pins an exact Effect version (inference). | [REPORT SchemaCompiler][report-schema] |
| Bundler fit | Needs only `sideEffects` honouring and a pre-build script. Every candidate, `tsc` included, satisfies both (inference). | [REPORT SchemaCompiler][report-schema] |

## 2026-10-09: In-repo capability inventory

Paths verified with `ls`/`rg` against `main` @ e62411d63f on 2026-10-09.
Census figures come from [pipeline Q1][pipe-q1] to [pipeline Q8][pipe-q8].

| Brick | Package / owner | Path (verified) | Today | Build-kit relation |
| --- | --- | --- | --- | --- |
| Package-scripts policy | `@beep/repo-cli` | `packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts` (360 lines) | Owns every generated scripts block; `beep lint package-scripts --write`. | Extend: emit one `beep:build` call. |
| `beep:build` defaults | `@beep/repo-cli` | `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts:1169,1199,1225,1297` | `tsc -p tsconfig.json && bun run babel` for library, tool, ecosystem, infra kinds. | Replace the value. |
| Task binding | `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:276` | `build` task maps to script `beep:build`. | Reuse. |
| Babel script template | `@beep/repo-cli` | `CreatePackage/CreatePackage.command.ts:1950`, `Architecture/OperationPlanPackageJson.ts:109` (under `.../cli/src/commands/`) | Scaffolds `babel dist --plugins annotate-pure-calls ...`. | Extend: conditional on publishability. |
| Emit settings | repo root | `tsconfig.base.json:5-25` | `outDir` dist, tsbuildinfo under `node_modules/.tmp`, `composite`, `incremental`, `declaration`, `declarationMap`, `sourceMap`. No `isolatedDeclarations`. | Reuse. |
| effect-tsgo swap | repo root / runbook | `docs/runbooks/typescript-toolchain.md:15`; shim `tools/tsgo-shim/tsgo.js` | `prepare` patches `tsc` to `7.0.2+effect-tsgo.0.47.2`; ~130 Effect diagnostics ride on emit. | Reuse: the private-tier emitter. |
| Turbo build graph | repo root | `turbo.json:279` (`build` task) | `dependsOn: ["^build"]`; tsgo shim is a global input; outputs `dist/**` + tsbuildinfo. | Reuse; add build-kit as an input. |
| Docgen example compile | `@beep/docgen` | `packages/tooling/tool/docgen/src/Core.ts:606-607` | `tsc --noEmit` against built declarations. | Reuse (a dist consumer). |
| Bundle probe | `@beep/effect-drizzle` | `packages/ecosystem/effect-drizzle/test/bundle-build.ts:1-10`; floor `test/bundle-size.ts:6` | esbuild probe; comment blames Bun.build 1.3.14; `minimumBundleRawBytes = 4096`. | Reuse as the publishable-tier oracle pattern. |
| `bun build --compile` sidecar | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp/src/package.ts:313-325` | Compiled binary, DuckDB externals copied beside it. | Reuse: CLI/release lane. |
| Desktop sidecar | `@beep/professional-desktop` | `apps/professional-desktop/scripts/build-sidecar.ts:46` | `bun build --compile server/main.ts`. | Reuse: release lane. |
| Ecosystem-package standard | standards | `standards/architecture/14-ecosystem-packages.md:108,143` | `sideEffects: false` + pure annotations + CI bundle probe. | Reuse: defines the publishable tier. |
| SchemaCompiler ruling | effect-schema-parity packet | `explorations/effect-schema-parity/DECISIONS.md:611` | 2026-09-28 DEFER with three re-entry triggers. | Constraint, not a brick. |
| Compiler spike | effect-schema-parity packet | `explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md` | Source of the 3.7x / 1.2x to 1.5x numbers. | Evidence. |
| Changesets | repo root | `.changeset/config.json:10` | `"access": "restricted"`; nothing published. | Context for tiering. |
| Shared build-kit | (proposed) | `packages/tooling/library/build-kit`: **NOT FOUND** | Does not exist. | NET-NEW. |

Census facts (from [pipeline Q1][pipe-q1], [pipeline Q2][pipe-q2], [pipeline Q3][pipe-q3]):

- 123 manifests run `tsc -p tsconfig.json && bun run babel`; 13 bare `tsc -p`; 5 `tsgo -p tsconfig.check.json`; 4 `vite build`.
- 136/161 manifests point `exports["."]` at `./src/index.ts`; `publishConfig.exports` rewrites to `./dist/*.js`.
- `@beep/schema` declares `"sideEffects": []`; `@beep/effect-drizzle` declares `false` (verified in their manifests).
- Next and Vitest (797 generated aliases) read `src`; six `bin` fields point at `src/bin.ts`.
- No `tsdown`, `rolldown`, `tsup`, `rslib`, `rollup` or `esbuild` config files exist. [pipeline Q4][pipe-q4]
- Known timings: warm `bun run build` 131/131 in 24 s; cold `--filter=@beep/repo-cli...` 33 tasks in 6.7 s. [pipeline Q5][pipe-q5]

## 2026-10-09: Experiments (measured, this machine)

Both ran on `main` @ e62411d63f with the tree clean before and after. Notes:
[`bun-treeshake-probe-1.4.2.md`](./research/experiments/bun-treeshake-probe-1.4.2.md)
and [`schema-build-timings.md`](./research/experiments/schema-build-timings.md).

### Experiment 1: Bun.build tree-shaking probe on Bun 1.4.2

Probe mirrors `test/bundle-build.ts`: consumer entry re-exports `integer` from `@beep/effect-drizzle/pg`. Externals `effect` and `drizzle-orm`.

| Output (Bun 1.4.2 era tools) | Bytes | node + bun import |
| --- | ---: | --- |
| bun-alias-minify | 8,187 | OK |
| esbuild-minify (shipped probe config) | 8,173 | OK |
| rolldown-minify | 3,478 | OK |
| bun-alias-ignoreDCE-nominify | 94,643 | OK |

| Bun version | Mirror config | pg barrel | Verdict |
| --- | --- | --- | --- |
| 1.3.9 | 14,641 B | 116,104 B, 44 keys | OK |
| 1.3.13 | 22 B stub | 53,422 B, 7 bindings dropped | SyntaxError |
| 1.4.0 | 22 B stub | 53,422 B | SyntaxError |
| 1.4.1 | 14,641 B | 116,046 B | OK |
| 1.4.2 | 14,641 B | 116,046 B | OK |

- **effect-drizzle finding: RETIRED on 1.4.2, fixed in 1.4.1.** The failing range is Bun ≥1.3.13 <1.4.1.
- The mise `bun/1.3.14` directory holds a 1.4.0 binary, so no true 1.3.14 was tested.
- All three public barrels (root 11, pg 44, sqlite 34 exports) match across Bun, esbuild and rolldown.
- **bun#18008 CONFIRMED on 1.4.2.** ESM `export *` over CJS with `sideEffects: false` throws `ReferenceError` on named and namespace imports. It fails on every tested version from 1.3.9 to 1.4.2.
- rolldown-minify (3,478 B) is valid yet sits under the probe's 4,096 B floor. A switch to rolldown would raise a false "collapse".
- The committed esbuild baseline (8,285 B) drifted to 8,173 B. That is source or dependency drift, not a bundler effect.
- Implication: any Bun.build gate still needs presence and import-validity checks. Floor-only size checks miss a 98-byte #18008 stub.

### Experiment 2: `@beep/schema` build timings

Package: 173 `.ts` under `src/`, 92 entry files. Cold tsbuildinfo each run, inside one `beep-heavy` job. Box was shared and noisy (load1 14 to 37 on 64 threads).

| Variant | Batch 1 (n=3) median | Batch 2 (n=10) median | Max RSS |
| --- | --- | --- | --- |
| A: tsc emit + Babel (today) | 1.38 s | 1.14 s | ~740 MB |
| B: tsc emit only | 0.88 s | 0.65 s | ~710-740 MB |
| C: tsdown unbundle + dts (stock tsgo, `--noCheck`) | 1.35 s | 1.34 s | ~900 MB |
| Cfx: C with the effect-tsgo binary | 1.25 s | 1.33 s | ~880-905 MB |
| Cjs: tsdown JS only | 0.19 s | 0.23 s | ~600-615 MB |
| D: `bun build --splitting` + `tsc --emitDeclarationOnly` | 0.64 s | 0.70 s | ~720 MB |

Brief ranges: A 1.14 to 1.38 s, B 0.65 to 0.88 s, C 1.34 s, D 0.64 to 0.70 s.

| Output | .js files | JS bytes | .d.ts | `__PURE__` markers |
| --- | ---: | ---: | ---: | ---: |
| A (tsc + Babel) | 173 | 678,448 | 173 | 1,808 |
| B (tsc only) | 173 | 677,955 | 173 | 0 |
| C (tsdown unbundle) | 172 | 654,441 | 158 | 21 (rolldown's own `__exportAll`) |
| D (bun build + D2 dts) | 185 (92 entries + 93 chunks) | 427,624 | 173 | 0 |

- C does not type-check: rolldown-plugin-dts runs tsgo with `--noCheck`. Matching A/B needs an extra check pass.
- `generator: "oxc"` fails with 93 isolated-declarations errors (TS9010, TS9021) on inferred `const` schemas and `S.Class` extends.
- D output is chunked, not per-module, with no maps and no JSDoc. The dts pass costs as much as a full emit.
- tsdown drops two modules, turns `export * as X` into runtime `__exportAll` objects and emits 15 fewer `.d.ts`.
- Verdict: no bundler beats B. The only real saving is removing Babel (~0.45 s, ~35-40% of A). Dropping Babel loses 1,808 markers across 114 files.

## 2026-10-09: Constraints surfaced

1. **dist is a declaration pipeline.** No runtime consumer reads `dist/*.js`. Turbo `check`, `coverage`, `test:integration`, `dev`, Vercel type checks and docgen read `dist/*.d.ts` (inference from census). [pipeline Q3][pipe-q3], [REPORT pipeline][report-pipeline]
2. **152 workspace members vs 161 manifests.** Root `workspaces` globs yield 152; 161 counts every `package.json` under `packages/` and `apps/`, adding 9 non-workspace fixtures. [pipeline Q1][pipe-q1]
3. **Babel is the only pure-annotation source.** No Rust bundler inserts annotations; Experiment 2 counts 1,808 markers from Babel and 0 otherwise. [bundle Q4][bundle-q4]
4. **tsdown dts via tsgo runs `--noCheck`.** It also writes the package's composite tsbuildinfo as a side effect. Effect diagnostics would need a separate pass. [Experiment 2](./research/experiments/schema-build-timings.md)
5. **Bun has no dts.** A Bun library build still needs `tsc --emitDeclarationOnly`, which costs a full type-check. [bun Q1][bun-q1]
6. **beep-heavy gotchas.** `beep-heavy -- <cmd>` execs `--` as the command. Inside the Nix devshell `env bash` lacks `compgen`, so env forwarding fails. Call `/usr/bin/bash ~/.local/bin/beep-heavy <cmd>`. [Experiment 2](./research/experiments/schema-build-timings.md)
7. **Coherence is the documented pain.** Non-build-mode `tsc -p` never checks its outputs exist; stale tsbuildinfo skipped emit on Vercel. [REPORT pipeline][report-pipeline]

## 2026-10-09: Open questions carried to align

Not answered here.

1. Does the operator accept the two-tier framing (effect-tsgo emit for private packages; tsdown publish tier; no `bun build` for libraries)?
2. SchemaCompiler dispute: the operator believes bundle-size and runtime wins exceed the record (+2 KB AOT / +7 KB JIT over an 18 KB baseline; 1.2x to 1.5x on `S.Class` rows). Which mechanism or newer numbers support that, and does placement change?
3. Should a shared build-kit package own the generated `beep:build` script?
4. Is tsdown worth adopting only for `publishConfig.access: "public"` packages?

[report]: ./research/deep-research/REPORT.md
[report-pipeline]: ./research/deep-research/REPORT.md#the-build-is-a-declaration-pipeline-and-the-pain-is-coherence-not-compile-time
[report-tsdown]: ./research/deep-research/REPORT.md#tsdown-is-the-only-credible-alternative-emitter-and-it-buys-hygiene-not-speed
[report-spencer]: ./research/deep-research/REPORT.md#spencer-bundles-for-manifests-and-type-surfaces-not-for-size
[report-schema]: ./research/deep-research/REPORT.md#schemacompiler-must-not-drive-the-bundler-choice
[pipe-q1]: ./research/deep-research/beep_effect_current_pipeline.md#q1-how-many-workspace-packages-exist-what-does-a-typical-scripts-block-look-like-and-what-do-the-tsconfigs-emit
[pipe-q2]: ./research/deep-research/beep_effect_current_pipeline.md#q2-dist-layout-exports-map-shape-sideeffects-and-publication-status
[pipe-q3]: ./research/deep-research/beep_effect_current_pipeline.md#q3-who-consumes-dist-and-src-nextjs-bun-clis-vercel-vitest-turbo-task-graph
[pipe-q4]: ./research/deep-research/beep_effect_current_pipeline.md#q4-runtimes-targeted-and-existing-bundler-usage
[pipe-q5]: ./research/deep-research/beep_effect_current_pipeline.md#q5-what-is-the-tsc-binary-does-build-emit-use-tsgo-and-what-build-timings-are-known
[pipe-q8]: ./research/deep-research/beep_effect_current_pipeline.md#q8-root-bun-run-build-how-long-it-is-known-to-take-and-which-gates-depend-on-dist
[bun-q1]: ./research/deep-research/bun_build_library_bundler.md#q1-does-bun-build-generate-dts-files-in-any-mode-isolateddeclarations
[bun-q2]: ./research/deep-research/bun_build_library_bundler.md#q2-type-checking-during-build-check-option--bun-build---check
[bun-q3]: ./research/deep-research/bun_build_library_bundler.md#q3-library-relevant-bundler-surface-externals-splitting-formats-targets-minify-sourcemaps-sideeffects-tree-shaking-pure-defineenv-bytecode-compile
[bun-q4]: ./research/deep-research/bun_build_library_bundler.md#q4-js-api-bunbuild-plugin-api-running-buildts-with-bun-run
[bun-q5]: ./research/deep-research/bun_build_library_bundler.md#q5-benchmarks-bun-build-speed-and-output-size-vs-esbuild-rolldowntsdown-rspack
[bun-q6]: ./research/deep-research/bun_build_library_bundler.md#q6-known-limitations-and-issues-for-libraries-cjs-interop-exports-map-declaration-maps-sourcemaps-effect-bundling-node-compatibility-of---target-bun
[bun-q7]: ./research/deep-research/bun_build_library_bundler.md#q7-real-world-libraries-published-with-bun-build-only-effect-ecosystem-libs-built-with-bun
[bun-q8]: ./research/deep-research/bun_build_library_bundler.md#q8-runtime-performance-angle---bytecode---compile-startup-wins-for-clis
[bun-q9]: ./research/deep-research/bun_build_library_bundler.md#q9-cross-cutting-gotcha-silent-acceptance-of-unknown-flagsoptions
[bundle-q1]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q1-why-do-effect--effect-ship-unbundled-per-module-output-with-a-big-exports-map-sideeffects-narrow-and-babel-plugin-annotate-pure-calls
[bundle-q2]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q2-dual-instance-hazard-what-breaks-if-a-library-bundles-effect-into-itself-and-what-the-effect-team-decided
[bundle-q3]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q3-does-bundling-a-librarys-own-modules-into-one-file-per-entry-hurt-consumer-tree-shaking-vs-per-module-files-rolluprolldownesbuildtsdowne18e-guidance
[bundle-q4]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q4-pure-annotations-do-rolldownoxc-esbuild-bun-preserve--__pure__--do-any-insert-them-and-is-babel-plugin-annotate-pure-calls-still-the-standard
[bundle-q5]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q5-runtime-performance-bundling-vs-many-small-esm-files-for-nodebun-startup-hot-path-effects
[bundle-q6]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q6-source-maps-and-debugging-in-bundled-vs-emitted-effect-libraries
[bundle-q7]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q7-monorepo-internal-consumption-built-dist-vs-raw-src-for-a-nextjs-app-importing-many-workspace-packages-turborepovercel-guidance-20252026
[bundle-q8]: ./research/deep-research/bundle_vs_emit_effect_libraries.md#q8-community-exemplars-which-effect-ecosystem-libraries-bundle-vs-emit-and-their-rationale
[schema-kq1]: ./research/deep-research/effect_schema_compiler.md#kq1--installed-api-what-the-three-modules-are-and-what-they-export
[schema-kq2]: ./research/deep-research/effect_schema_compiler.md#kq2--what-the-aot-compiler-emits-and-whether-generation-needs-the-live-ast
[schema-kq3]: ./research/deep-research/effect_schema_compiler.md#kq3--intended-workflow-authorship-stated-goals
[schema-kq4]: ./research/deep-research/effect_schema_compiler.md#kq4--performance-evidence-interpreted-vs-jit-vs-aot-and-bundle-size
[schema-kq5]: ./research/deep-research/effect_schema_compiler.md#kq5--build-integration-existing-pluginsclis-third-party-and-in-repo-usage
[schema-kq6]: ./research/deep-research/effect_schema_compiler.md#kq6--unsupported-schema-features-fallback-behaviour-and-meaning-for-beepschema
[schema-kq7]: ./research/deep-research/effect_schema_compiler.md#kq7--how-an-aot-build-pipeline-for-a-monorepo-of-schema-packages-would-look
[rust-kq1]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-1--tsdown-versionstatus-dts-unbundle-exports-publintattw-options-workspace-plugins-large-esm-library-issues
[rust-kq2]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-2--rolldown-stable-status-preservemodules-dts-vite-78
[rust-kq3]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-3--rslib-versionmaturity-bundlefalse-dts-modes-redirects-speed-adoption
[rust-kq4]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-4--esbuild-2026-status-dts-tree-shaking-pure-annotations---packagesexternal-maintenance
[rust-kq5]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-5--tsc--tsgo-emit-only-typescript-7-and-what-changes-for-build-pipelines
[rust-kq6]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-6--pure-annotations-which-tools-preserveinsert-them-is-babel-plugin-annotate-pure-calls-still-needed
[rust-kq7]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-7--benchmarks-with-dates
[rust-kq8]: ./research/deep-research/rust_library_bundlers_compared.md#key-question-8--monorepo-ergonomics-shortest-config-one-shared-config-package-turbo-caching
[spencer-kq1]: ./research/deep-research/spencer_bundler_rationale.md#key-question-1--what-does-savvy-webbundler-24x-do-end-to-end-what-are-the-concrete-steps-of-build-for---target-dev-vs---target-prod-and-what-differs-in-output
[spencer-kq2]: ./research/deep-research/spencer_bundler_rationale.md#key-question-2--what-is-in-distdevpkg-that-makes-it-the-publish-directory-how-does-the-manifest-transform-rewrite-exportsmaintypesfiles-remove-devdependencies-drop-private
[spencer-kq3]: ./research/deep-research/spencer_bundler_rationale.md#key-question-3--one-file-per-entry-or-preserved-module-structure-are-declaration-files-bundled-rolldown-plugin-dts--oxc-isolated-declarations
[spencer-kq4]: ./research/deep-research/spencer_bundler_rationale.md#key-question-4--does-he-externalize-effect-and-workspace-deps-how-are-peerdependencies--catalogeffectpeers-used
[spencer-kq5]: ./research/deep-research/spencer_bundler_rationale.md#key-question-5--any-readmeblogchangelogcommitdiscussion-explaining-the-why-of-bundling-for-libraries
[spencer-kq6]: ./research/deep-research/spencer_bundler_rationale.md#key-question-6--how-does-the-effect-monorepo-v4-build-and-publish-and-why-unbundled-per-module-emit
