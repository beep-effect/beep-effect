# TypeScript library bundlers other than Bun (tsdown, rolldown, Rslib, esbuild, Vite lib mode, tsc/tsgo emit-only) — state as of 2026-10-09

Scope: library publishing and in-monorepo consumption for a large pnpm/bun monorepo of Effect v4 TypeScript packages. Version/date facts below were pulled from the npm registry and GitHub API on 2026-10-09 unless a different source is cited. Anything dated before 2025 is marked historical.

## Summary comparison table

| Dimension | tsdown | rolldown (direct) | Rslib | esbuild | Vite library mode | tsc / tsgo emit-only |
| --- | --- | --- | --- | --- | --- | --- |
| Current version (npm `latest`, 2026-10-09) | 0.23.0 (2026-09-03); no 1.0 yet | 1.2.13 (2026-10-07); 1.0.0 stable 2026-05-07 | @rslib/core 1.0.3 (2026-09-29); 1.0.0 on 2026-09-03 | 0.28.2 (2026-08-08) | vite 8.3.4 (2026-10-08); Vite 8 = rolldown by default (2026-03-12) | typescript 7.0.2 (`latest`), 7.1 dev nightlies; TS 7.0 GA 2026-07-08 |
| Declaration generation | Built in via rolldown-plugin-dts; auto-picks oxc (isolatedDeclarations) → tsgo (TS 7 installed) → tsc | Only via rolldown-plugin-dts (same plugin) | Built in (rsbuild-plugin-dts): tsc API default, tsgo auto for TS 7+, `dts.isolated` (SWC) fastest | None | Needs vite-plugin-dts or similar (not researched in depth) | Native; `tsc -b` with `declaration`/`declarationMap`; isolatedDeclarations optional |
| Unbundled (per-file) output | `unbundle: true` / `--unbundle` | `output.preserveModules` (stable) with documented caveat on missing exports | `bundle: false` (default-friendly), plus `redirect.*` rewriting of alias paths and extensions in JS and d.ts | `--bundle` off = per-file transform; no module graph | lib mode is bundle-first; preserveModules through rolldown options | Native 1:1 |
| Bundled output | Default | Default | `bundle: true` (default) with API Extractor for d.ts bundling | Default with `--bundle` | Default | Not available |
| Tree-shaking / pure annotations | Rolldown treeshake on by default; `treeshake.annotations: true` respects `@__PURE__` and `@__NO_SIDE_EFFECTS__` | Same; `manualPureFunctions`, `moduleSideEffects` | Rspack tree-shaking; respects annotations | Respects `/*@__PURE__*/` and `sideEffects`; `--ignore-annotations` to disable | Via rolldown | None (tsc does no DCE); Effect adds `babel-plugin-annotate-pure-calls` after tsc |
| Multi-entry / `exports` generation | `exports: true` writes package.json `exports`, `exports.all`, `devExports` → publishConfig, `customExports` | No | No auto `exports`; publint/attw via Rsbuild plugins | No | No | No (hand-written, as Effect does) |
| publint / attw | Built-in options `publint`, `attw` (profiles strict/node16/esm-only, `ci-only`) | No | `rsbuild-plugin-publint`, `rsbuild-plugin-arethetypeswrong` | No | No | No |
| Workspace mode | `-W/--workspace`, `-F/--filter`, root config inherited by packages | No | Per-package config; Rsbuild plugin sharing | No | No | `tsc -b` project references |
| Speed claims (vendor) | ~2x tsup for JS, up to 8x for d.ts | Vite 8: 10–30x faster builds vs Rollup-era | 1.0: −24.3% uncached build, −56.7% cached, d.ts 2.4x (TS 7) / 4.2x (isolated) | Historically fastest JS-only transformer; Vite 8 says oxc-minify now beats it on speed and size | Inherits rolldown | TS 7 native: 7.7x–11.9x faster builds vs TS 6 |
| Maintenance | Very active (pushed 2026-10-09; 4,295 stars) | Very active (weekly releases) | Active (pushed 2026-10-09; 1,040 stars); ByteDance Web Infra | Maintained but slow cadence: 3 releases in 2026 (Apr, Jun, Aug); last commit 2026-08-09; 40,069 stars, 625 open issues | Very active | Very active (Microsoft) |
| Shortest config | `tsdown` with no config if package.json has `types`/`exports.types` (dts auto-on); `tsdown.config.ts` 3 lines | rolldown.config + plugin wiring | `rslib.config.ts` ~5 lines | one CLI line, no d.ts | vite.config lib block + dts plugin | `tsc -b` + tsconfig only |

## Key question 1 — tsdown: version/status, dts, unbundle, exports, publint/attw, options, workspace, plugins, large-ESM-library issues

### Takeaway
tsdown is still pre-1.0 (0.23.0, released 2026-09-03) but is the declared successor of tsup (tsup's README now says it is not actively maintained and points to tsdown), is the planned foundation of Vite's library mode, and already ships every library-publishing feature on the list: isolatedDeclarations-backed fast d.ts, `unbundle`, `exports` generation with `devExports`→`publishConfig`, built-in publint/attw, and a `--workspace` mode with root-config inheritance. I found no Effect-specific or "large ESM library" issues in its tracker.

### Cited Findings
- npm `latest` is tsdown 0.23.0 published 2026-09-03; 0.23.0 went through beta.1 (2026-07-26) → rc.1 (2026-08-28) → stable; no 1.x tag exists — [npm registry](https://registry.npmjs.org/tsdown).
- v0.23.0 release notes: `unbundle`, `outExtensions`, `copy`, `css.inject` replace older options; new `deps.neverBundle` and `resolveDepSubpath`; `dts.generator` exclusively controls generator selection with `tsgo` and `oxc` support; attw default profile changed from `strict` to `esm-only`; Node requirement `^22.18.0 || ^24.11.0 || >=26.0.0`; includes a migration guide from 0.22.14 — [tsdown releases](https://github.com/rolldown/tsdown/releases).
- tsup's README (fetched 2026-10-09 via GitHub API): "This project is not actively maintained anymore. Please consider using tsdown instead." tsup `latest` 8.5.1 was published 2025-11-12; repo is not archived — [tsup README](https://github.com/egoist/tsup); [npm tsup](https://registry.npmjs.org/tsup).
- tsdown FAQ: "tsdown is the spiritual successor to tsup, powered by Rolldown instead of esbuild"; built-in features listed: CSS support, executable bundling, workspace mode, package validation; supports Rolldown, Rollup and unplugin plugins — [tsdown FAQ](https://tsdown.dev/guide/faq).
- VoidZero: "tsdown has officially been adopted by Rolldown as part of their core ecosystem and will become the foundation for Rolldown Vite's Lib Mode" — [voidzero.dev whats-new-jul-2025](https://voidzero.dev/posts/whats-new-jul-2025) (search result excerpt; 2025).
- dts: tsdown uses rolldown-plugin-dts; dts is enabled by default when package.json has `types`/`typings` or `exports` type conditions; with `isolatedDeclarations` in tsconfig it uses oxc-transform ("extremely fast"), otherwise falls back to the TypeScript compiler; declaration maps via tsconfig `declarationMap` or `dts.sourcemap`; ESM output generates js + d.ts in one build, CJS uses a separate dts build — [tsdown dts docs](https://tsdown.dev/options/dts).
- rolldown-plugin-dts generator auto-selection when `generator` is omitted: `oxc` when `compilerOptions.isolatedDeclarations` is on, `tsgo` when TypeScript 7 is installed as `typescript`, else `tsc`; `tsgo` is "experimental and requires a tsconfig.json" and ignores `tsconfigRaw`/`compilerOptions`; tsc options `parallel`, `build` (project references), `incremental`; requires Rolldown 1.2.0+, ESM output only — [rolldown-plugin-dts README](https://github.com/sxzz/rolldown-plugin-dts). Latest 0.28.6 (2026-09-16) — [npm](https://registry.npmjs.org/rolldown-plugin-dts).
- `unbundle: true` / `--unbundle`: "each source file is compiled and transformed individually, and the output directory will contain a one-to-one mapping"; every file reachable from entries is emitted; output root defaults to the common base dir of entries, `root: '.'` preserves `src/`; recommended "in monorepo or library scenarios where consumers may want to import individual modules" — [tsdown unbundle docs](https://tsdown.dev/options/unbundle); [CLI reference](https://tsdown.dev/reference/cli).
- Historical issue (closed): "side-effects imports stripped with `unbundle` mode" (opened 2025-05-27) — [tsdown #273](https://github.com/rolldown/tsdown/issues/273). Still-open: "Potential side effect imports preserved in ESM `.d.ts`" (2025-07-22) — [tsdown #391](https://github.com/rolldown/tsdown/issues/391); "Missing PURE annotation for `React.forwardRef()`" (2025-05-24) — [tsdown #257](https://github.com/rolldown/tsdown/issues/257).
- `exports: true` auto-generates package.json `exports`; `exports.all` exports non-entry files too; `exports.legacy` (main/module/types) defaults false for ESM-only, true otherwise; `exports.devExports: true` points top-level exports at source and writes built-output exports to `publishConfig`, "which will override the top-level `exports` field when using `yarn` or `pnpm`'s `pack`/`publish` commands (note: this is not supported by npm)"; `devExports: '@my-org/source'` emits a custom condition for use with TS `customConditions`; `customExports` object/function hook — [tsdown package-exports docs](https://tsdown.dev/options/package-exports).
- publint and attw are built-in, optional-dependency-gated (`publint`, `@arethetypeswrong/core`): `publint: true | { level }`, `attw: true | { profile: 'strict' | 'node16' | 'esm-only', level: 'warn' | 'error', ignoreRules }`, CLI `--publint`/`--attw`, `'ci-only'` mode — [tsdown lint docs (docs/options/lint.md)](https://github.com/rolldown/tsdown/blob/main/docs/options/lint.md). (Note: the docs page still says `strict` is the default; the 0.23.0 release notes say the default moved to `esm-only`.)
- Dependencies: `dependencies`, `peerDependencies`, `optionalDependencies` external by default; devDependencies and phantom deps bundled if imported; `deps.neverBundle: true` externalizes every bare specifier "as written, without being resolved"; `deps.alwaysBundle`, `deps.onlyBundle`, `deps.onlyImport`; d.ts bundling follows the same rules — [tsdown dependencies docs](https://tsdown.dev/options/dependencies).
- Tree-shaking on by default, `--no-treeshake` to disable; CLI flags `--minify`, `--target`, `--platform`, `--sourcemap`, `--dts`, `--exports`, `--unbundle`, `--publint`, `--attw` — [tree-shaking docs](https://tsdown.dev/options/tree-shaking); [CLI reference](https://tsdown.dev/reference/cli).
- Workspace: "`-W, --workspace [dir]` Enable workspace mode for building multiple packages in a monorepo"; "`-F, --filter <pattern>` Filter configs by working directory or name. Supports string matching and regex"; `--concurrency <count>`; FAQ: "Root-level configuration is automatically inherited by workspace packages" — [CLI reference](https://tsdown.dev/reference/cli); [FAQ](https://tsdown.dev/guide/faq).
- Config file: `tsdown.config.{ts,mts,cts,js,mjs,cjs,json}` or a `tsdown` key in package.json; minimal config is `defineConfig({ entry: 'src/index.ts' })`; config loaders `auto|native|tsx|unrun`; experimental `--from-vite` reuses Vite/Vitest `resolve` and `plugins` — [config-file docs](https://tsdown.dev/options/config-file).
- No stub mode by design; recommended alternatives are watch mode or `exports.devExports` — [FAQ](https://tsdown.dev/guide/faq).
- Migration experience (May/June 2025, historical for the versions involved): 26-package monorepo, 14 built with tsup, each <10 files; build fell from 7.014 s (tsup + tsc) to 3.583 s (tsdown), −49%; `pnpm dlx tsdown migrate`; tsup `bundle: false` → tsdown `unbundle: true`; isolatedDeclarations forced explicit return types; author hit "two bugs ... one minor, one critical", fixed quickly — [alan.norbauer.com](https://alan.norbauer.com/articles/tsdown-bundler/).
- HN thread (~Nov 2025): praise for sub-second cold builds vs tsup; criticism that the site "doesn't tell me why I would use this instead of just Rolldown"; described as "opinionated Rolldown configuration with a simplified API"; adopters named: vue-macros, flystorage.dev — [HN](https://news.ycombinator.com/item?id=45708884).
- GitHub stats 2026-10-09: tsdown 4,295 stars, pushed 2026-10-09 — [GitHub API](https://api.github.com/repos/rolldown/tsdown).

### Inferences
- "Official successor" is accurate in practice: tsup's own README redirects to tsdown, tsdown lives under the `rolldown` GitHub org, and VoidZero positions it as the future Vite lib mode. It is not 1.0, and 0.23.0 (Sept 2026) was a breaking reorganization, so config churn risk is real.
- For a per-module-exports Effect-style library, the relevant combination is `unbundle: true` + `exports: { all: true, devExports: '<condition>' }` + `isolatedDeclarations` in tsconfig → oxc d.ts; this maps closely to what Effect hand-writes (source `exports` + `publishConfig.exports` to `dist`).
- A single shared config package can drive all packages: `-W` inherits the root config, and `-F` scopes a run, so a per-package `package.json` script could be just `tsdown` (or nothing, with a root `tsdown -W` task). Turbo caching still favors per-package invocations so `outputs: ["dist/**"]` hashes per package.

### Gaps
- No public 1.0 roadmap found for tsdown (search returned nothing authoritative).
- No tsdown issues mentioning `effect` or large-ESM-library problems were found via `gh search issues --repo rolldown/tsdown "effect"`; the results were unrelated word matches. Absence of evidence, not evidence of absence.
- Docs for `workspace` as a config option (include/exclude globs) were not found in `docs/options`; only the CLI flags and FAQ are documented.

## Key question 2 — rolldown: stable status, preserveModules, dts, Vite 7/8

### Takeaway
Rolldown reached 1.0.0 on 2026-05-07 and is at 1.2.13 (2026-10-07) with weekly releases; `output.preserveModules` is documented as stable, d.ts comes only through rolldown-plugin-dts, and Vite 8 (2026-03-12) made Rolldown the single default bundler with Oxc replacing esbuild.

### Cited Findings
- Rolldown v1.0.0 published 2026-05-07; v1.1.0 2026-06-03; v1.2.0 2026-07-15; latest v1.2.13 2026-10-07 — [GitHub releases API](https://api.github.com/repos/rolldown/rolldown/releases); [npm](https://registry.npmjs.org/rolldown). Secondary confirmation: "Rolldown 1.0 hit stable on May 7, 2026" — [byteiota](https://byteiota.com/?p=14474).
- Recent 1.2.x features: `inline-common-chunks`, property-name mangling in minification, `experimental.devMode.hotUpdate`, module-graph query on the dev engine, `NAMESPACE_CONFLICT` warning for conflicting star re-exports — [Rolldown releases](https://github.com/rolldown/rolldown/releases).
- `output.preserveModules` — Status: Stable, default `false`; tree-shaking still removes unused exports from non-entry modules; docs warn "It is therefore not recommended to blindly use this option to transform an entire file structure to another format if you directly want to import from those files as expected exports may be missing" and suggest listing all files as `input` entries instead; companions `preserveModulesRoot`, `virtualDirname` — [rolldown.rs preserveModules](https://rolldown.rs/reference/OutputOptions.preserveModules).
- `treeshake` sub-options and defaults: `annotations: true`, `manualPureFunctions: []`, `moduleSideEffects: true`, `propertyReadSideEffects: "always"`, `propertyWriteSideEffects: "always"`, `unknownGlobalSideEffects: true`, `commonjs: true`, `invalidImportSideEffects: false` — [rolldown.rs treeshake](https://rolldown.rs/reference/InputOptions.treeshake).
- Vite 8 released 2026-03-12: "Vite 8 ships with Rolldown as its single, unified, Rust-based bundler, delivering up to 10-30x faster builds while maintaining full plugin compatibility"; Oxc replaces esbuild; real-world builds: Linear 46 s → 6 s, Ramp −57%, Beehiiv −64%; install ~15 MB larger (lightningcss, rolldown); Node 20.19+/22.12+ — [Vite 8 announcement](https://vite.dev/blog/announcing-vite8). Vite 8.1 announced 2026-06-23; Vite 7 2025-06-24 — [Vite blog](https://vite.dev/blog).
- Vite 8 note (search excerpt): "`oxc-minify` is now the recommended minifier when using Rolldown ... already outperforming `esbuild` in terms of speed and size" — [voidzero.dev](https://voidzero.dev/posts/whats-new-jul-2025).
- Open rolldown issues touching pure annotations (2026): "`codeSplitting` with `maxSize` ignore `@__PURE__` annotations and causes inclusion of dead code" (2026-08-19) — [#10718](https://github.com/rolldown/rolldown/issues/10718); "NO_SIDE_EFFECTS annotation for variable declarations with non-function expression initializers" (2026-06-23) — [#9943](https://github.com/rolldown/rolldown/issues/9943); "Discussion: Add opt-in heuristic DCE for pure top-level call/new initializers" (2026-07-01) — [#10068](https://github.com/rolldown/rolldown/issues/10068).

### Inferences
- Using rolldown directly buys nothing over tsdown for a library unless you need a custom pipeline; tsdown is the rolldown team's own opinionated wrapper, and its `unbundle` mode is the sanctioned way to get per-file output without the `preserveModules` "missing exports" footgun (tsdown emits every reachable file 1:1).

### Gaps
- The Vite 7 and 8 posts were not read for explicit library-mode guidance; whether Vite docs now recommend tsdown for libraries is supported only by VoidZero's 2025 statement.

## Key question 3 — Rslib: version/maturity, bundle:false, dts modes, redirects, speed, adoption

### Takeaway
Rslib hit 1.0.0 on 2026-09-03 (Rsbuild/Rspack, ByteDance Web Infra). Bundleless mode is first-class with automatic path/extension redirects in both JS and d.ts; d.ts has three generators (tsc API default, tsgo auto for TS 7, SWC isolatedDeclarations fastest), and its 1.0 blog quotes 2.4x/4.2x d.ts speedups. Named library adopters were not found.

### Cited Findings
- @rslib/core 1.0.0 published 2026-09-03; 1.0.1 (09-15), 1.0.2 (09-23), 1.0.3 (09-29) — [npm](https://registry.npmjs.org/@rslib/core); [releases](https://github.com/web-infra-dev/rslib/releases). Blog "Announcing Rslib 1.0" dated September 3, 2026 — [rslib.rs/blog](https://rslib.rs/blog/) (an Open Collective aggregate says Sept 4 — [search excerpt](https://opencollective.com/rspack/updates)).
- 1.0 blog: in a 10,000-React-component benchmark, 1.0 reduced uncached build time ~24.3%, cached ~56.7%, output size ~32.2% (pre-gzip) vs the prior Rslib; d.ts generation table: TypeScript 7 (tsgo) 4.1 s / ~2.4x, Isolated Declarations 2.3 s / ~4.2x (vs tsc baseline); "When a project uses TypeScript 7 or later, Rslib automatically uses native TypeScript (tsgo)"; isolated declarations mode is "experimental"; publint/attw via `rsbuild-plugin-publint` and `rsbuild-plugin-arethetypeswrong` — [Rslib 1.0 blog source](https://github.com/web-infra-dev/rslib/blob/main/website/docs/en/blog/v1-0.mdx).
- 1.0.0 release: Web Worker support in ESM, WASM compilation modes, "enable declaration extension redirects by default" — [releases](https://github.com/web-infra-dev/rslib/releases).
- Bundle vs bundleless: `bundle` option defaults `true`; bundleless "maintains the original file structure and is more conducive to debugging and tree shaking"; requires `import type` for type-only imports (isolatedModules semantics) — [output-structure docs](https://rslib.rs/guide/basic/output-structure); [TypeScript docs](https://rslib.rs/guide/basic/typescript).
- dts generation methods: TypeScript Compiler API (`dts: true`, type-checks, slower), tsgo (`dts.tsgo`, type-checks, fast, auto for TS 7+), isolatedDeclarations (`dts.isolated`, no type check, fastest, SWC, "excludes modules outside build graph"); bundled d.ts via `@microsoft/api-extractor`; output path priority `dts.distPath` → tsconfig `declarationDir` → `output.distPath`; `redirect.dts.path/extension` — [Rslib dts docs](https://rslib.rs/guide/advanced/dts).
- Redirects (bundleless): `redirect.js.path` (default true) rewrites `resolve.alias`/tsconfig `paths` to relative paths; `redirect.js.extension` (true) appends real output extensions (`./foo` → `./foo.mjs`); `redirect.dts.path`/`redirect.dts.extension` (true) do the same in `.d.ts`/`.d.mts`; also `redirect.style`, `redirect.asset` — [Rslib redirect config](https://rslib.rs/config/lib/redirect).
- Rslib supports Rsbuild plugins plus many Rspack/webpack plugins and loaders; targets utility libs, UI component libs, CLIs, agent apps — [Rslib 1.0 blog](https://github.com/web-infra-dev/rslib/blob/main/website/docs/en/blog/v1-0.mdx).
- GitHub 2026-10-09: 1,040 stars, pushed 2026-10-09 — [GitHub API](https://api.github.com/repos/web-infra-dev/rslib).

### Inferences
- Rslib's bundleless mode is the most complete "tsc replacement with rewrites" among the bundlers: it rewrites tsconfig `paths` aliases and extensions in both JS and d.ts, which tsdown's unbundle docs do not claim. For a monorepo that uses tsconfig `paths` to source, that matters.
- Its d.ts default still type-checks (tsc API), so the "fast" path needs either TS 7 (tsgo) or `dts.isolated` (experimental, SWC-based, only files in the build graph).

### Gaps
- No notable library adopters found in Rslib docs or the 1.0 blog (the blog's benchmark is a React component library, not a utility library).
- Rslib's compared-against baseline for 24–57% is the previous Rslib version, not tsdown or tsc; no cross-tool numbers were found.

## Key question 4 — esbuild: 2026 status, dts, tree-shaking, pure annotations, `--packages=external`, maintenance

### Takeaway
esbuild is at 0.28.2 (2026-08-08), still 0.x, still no `.d.ts`, with a slow 2026 cadence (three releases, last commit 2026-08-09) and Vite 8 having replaced it with Oxc; its remaining case for libraries is a zero-config JS-only transform step, not a full library pipeline.

### Cited Findings
- Versions: 0.27.4 (2026-03-12), 0.27.5/0.27.7/0.28.0 (2026-04-02), 0.28.1 (2026-06-11), 0.28.2 (2026-08-08) — [npm](https://registry.npmjs.org/esbuild); [GitHub releases API](https://api.github.com/repos/evanw/esbuild/releases). Last commit on default branch 2026-08-09; 40,069 stars; 625 open issues — [GitHub API](https://api.github.com/repos/evanw/esbuild).
- Changelog highlights: `import { type: 'text' }` support (stage 3), security fixes (Windows path traversal, integrity verification), tree-shaking fix for TS import aliases, `--log-style=visualstudio`; no 1.0 plans, dts, or pure-annotation changes in recent entries — [esbuild CHANGELOG](https://github.com/evanw/esbuild/blob/main/CHANGELOG.md).
- Third-party health summary: "Healthy", 4 active maintainers in 3 months, 8 contributors in 12 months, no known vulnerabilities (as of search date) — [Snyk advisor](https://snyk.io/advisor/npm-package/esbuild).
- esbuild does not emit TypeScript declaration files; tree shaking honors `/*@__PURE__*/` and package.json `sideEffects`; `--ignore-annotations` disables them — [esbuild API docs](https://esbuild.github.io/api/).
- Vite 8 replaced esbuild with Oxc for transforms, and `@vitejs/plugin-react` v6 uses Oxc for React Refresh — [Vite 8 announcement](https://vite.dev/blog/announcing-vite8).

### Inferences
- With Rolldown/Oxc now covering transform + bundle + minify and the same annotation semantics, there is no capability esbuild offers a TS library that tsdown lacks; the only reasons to keep it are an existing pipeline or avoiding tsdown's pre-1.0 churn.

### Gaps
- No primary statement from evanw about esbuild's future (the search returned only aggregator health pages). `--packages=external` specifics were not confirmed from the fetched page section.

## Key question 5 — tsc / tsgo emit-only: TypeScript 7 and what changes for build pipelines

### Takeaway
TypeScript 7.0 (2026-07-08) ships the Go compiler as the `typescript` package and `tsc` binary with JS emit, declaration emit, `--build`, incremental and `--watch` all supported and 7.7x–11.9x faster builds; the programmatic API is deferred to 7.1. Emit-only via `tsc -b` keeps 1:1 files, declaration maps and source maps but does no tree-shaking, minification or pure-annotation insertion — which is why Effect still runs a Babel pass after tsc.

### Cited Findings
- TypeScript 7.0 released July 8, 2026; npm package remains `typescript`, command remains `tsc` (native binary); TS 6 available side-by-side as `@typescript/typescript6` (`tsc6`); emit support confirmed for JS, declarations, `--build`, incremental, `--watch` (rebuilt on a Parcel watcher port); build speedups 7.7x–11.9x, memory −6% to −26%; programmatic API deferred to 7.1 ("new (and different) API"); embedded-language support (Vue, MDX, Astro, Svelte) deferred; hard errors for `target: es5`, `baseUrl`, `moduleResolution: node/node10/classic`, `module: amd/umd/systemjs/none`, `esModuleInterop: false`, `alwaysStrict: false` — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- TS 6.0 (2026-03-23) was "the last release based on the current JavaScript codebase"; 7.0 Beta 2026-04-21; 7.0 RC 2026-06-18 — [TypeScript blog index](https://devblogs.microsoft.com/typescript/).
- npm: `typescript@latest` = 7.0.2; `next` = 7.1.0-dev nightlies (daily through 2026-10-09); `@typescript/native-preview` last published 2026-07-07 — [npm typescript](https://registry.npmjs.org/typescript); [npm native-preview](https://registry.npmjs.org/@typescript/native-preview).
- TS 7 announcement on isolatedDeclarations: "building project references is fundamentally bottlenecked by the dependency graph of projects (with the exception of type-checking on codebases that leverage `--isolatedDeclarations`)" — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- Pre-TS-7 isolatedDeclarations numbers (talk, historical/2025): ~20-file package, `tsc` with isolatedDeclarations ~340 ms vs ~860 ms for check+emit; oxc isolated-declarations transform ~5 ms (~168x) — [GitNation talk](https://gitnation.com/contents/faster-typescript-builds-with-isolateddeclarations).
- Secondary 2026 guides still advised "keep TypeScript 6.x as the source of truth for emit and tooling until 7.1 lands" (pre-GA framing; conflicts with the 7.0 GA emit statement above) — [ecorpit.com](https://ecorpit.com/typescript-7-migration-readiness-eslint-astro-blockers-2026/).
- Effect's own build (local checkout, effect 4.0.2): root `build` = `tsc -b tsconfig.packages.json && pnpm -r run build`; per package `build: tsc -b tsconfig.json && pnpm babel`, `babel: babel dist --plugins annotate-pure-calls --out-dir dist --source-maps`; tsconfig.base: `module: NodeNext`, `rewriteRelativeImportExtensions: true`, `erasableSyntaxOnly: true`, `declarationMap: true`, `sourceMap: true`, `composite`/`incremental`, no `isolatedDeclarations`; devDeps include `@effect/tsgo ^0.51.0` (Effect language service for TypeScript-Go; `prepare` runs `effect-tsgo patch`), `babel-plugin-annotate-pure-calls ^0.5.0`; `packages/effect` emits 458 `dist/*.js` files; `exports` points `.`/`./*` to `./src/*.ts` with `publishConfig.exports` pointing to `./dist/*.js`; `sideEffects` lists only the SchemaJITCompiler enable module — local files `~/YeeBois/references/effect/effect/package.json`, `packages/effect/package.json`, `tsconfig.base.json`.

### Inferences
- TS 7 makes `tsc -b` emit the default fast path for type-checked emit: the same command, ~10x faster, no new tool. What it does not change: emit-only still produces many files with no DCE/minify and no pure annotations, so a per-module library that wants tree-shakeable `dist` still needs either a bundler pass or a Babel annotate pass (Effect's choice).
- Effect's tsconfig has `erasableSyntaxOnly` and `rewriteRelativeImportExtensions`, i.e. source is already runnable as-is; emit is essentially type-stripping plus d.ts, which keeps the tsc path cheap and the debugging story (declarationMap + sourceMap) perfect.
- Because `@effect/tsgo` patches the Go toolchain for the Effect language service, a repo on TS 7 that wants Effect diagnostics in `tsc` must track that package; this is a reason for the Effect org itself to stay on tsc emit rather than a bundler.

### Gaps
- No TS 7-specific declaration-emit-only benchmark (tsc vs oxc isolated declarations under TS 7) was found beyond Rslib's 2.4x/4.2x table.
- Whether `tsgo` supports `--isolatedDeclarations` as an emit-only fast path independent of checking was not confirmed from primary docs.

## Key question 6 — Pure annotations: which tools preserve/insert them; is babel-plugin-annotate-pure-calls still needed?

### Takeaway
Rolldown/Oxc, Rspack and esbuild all respect `@__PURE__` and `@__NO_SIDE_EFFECTS__` when consuming code, but I found no primary-source evidence that Rolldown or Oxc inserts pure annotations into library output; the annotation-insertion tools that exist are `babel-plugin-annotate-pure-calls` (which Effect still runs) and `rollup-plugin-pure`.

### Cited Findings
- Rolldown DCE docs: `@__PURE__` marks a call/`new` as side-effect-free and must immediately precede the expression; `@__NO_SIDE_EFFECTS__` on a function declaration marks every call pure "without annotating each call site"; `sideEffects` in package.json (false or glob list) guides module-level elimination; the page does not discuss whether Rolldown inserts annotations — [rolldown.rs dead-code-elimination](https://rolldown.rs/in-depth/dead-code-elimination).
- Oxc minifier respects pure annotations by default (`compress.treeshake.annotations`, default true) and supports `manualPureFunctions`; `#__NO_SIDE_EFFECTS__` supported — [oxc.rs minifier DCE](https://oxc.rs/docs/guide/usage/minifier/dead-code-elimination).
- `rollup-plugin-pure` "automatically adds `/* #__PURE__ */` annotations before definition functions" and can inject `/* @__NO_SIDE_EFFECTS__ */` in front of function declarations — [npm rollup-plugin-pure](https://npmjs.com/package/rollup-plugin-pure).
- Effect runs `babel dist --plugins annotate-pure-calls` after `tsc -b` for every published package (effect 4.0.2 checkout) — local `packages/effect/package.json` (see KQ5).
- tsdown open issue: "Missing PURE annotation for `React.forwardRef()`" (2025-05-24, open) — [tsdown #257](https://github.com/rolldown/tsdown/issues/257). Rolldown open issue: "transform() drops comments at expression positions, silently breaking coverage-tool ignore pragmas" (2026-05-06) — [rolldown #9304](https://github.com/rolldown/rolldown/issues/9304).
- Rspack tree-shaking docs describe the same two annotations — [rspack.rs tree-shaking](https://rspack.rs/guide/optimization/tree-shaking).

### Inferences
- For Effect-style `dual`/`pipe` top-level call initializers (`export const map = dual(2, ...)`), consumers' bundlers need a `@__PURE__` on each call or the module to be marked side-effect-free. Emit-only tsc gives neither, hence Effect's Babel pass. A bundler (tsdown/Rslib) in `unbundle` mode will *preserve* annotations present in source and tree-shake internally, but nothing found suggests it synthesizes them; rolldown #10068 ("opt-in heuristic DCE for pure top-level call/new initializers", open) is the closest discussion and is unresolved.
- Practical options for the monorepo: (a) keep `babel-plugin-annotate-pure-calls` as a post-step regardless of emitter; (b) write `/* @__PURE__ */` / `/* @__NO_SIDE_EFFECTS__ */` in source so every tool preserves them; (c) rely on `"sideEffects": false` per package (coarser, and Effect itself only uses an allowlist).

### Gaps
- Could not find authoritative documentation that Oxc has a pure-annotation *insertion* pass; the "oxc has a pure-annotation pass?" question is unanswered by primary sources.
- Did not verify whether Oxc's transformer preserves leading `/* @__PURE__ */` comments through `unbundle` emission in tsdown; #9304 suggests comment positions can be fragile in `transform()`.

## Key question 7 — Benchmarks (with dates)

### Takeaway
Vendor numbers: tsdown ~2x tsup (JS) and up to 8x (d.ts); Rslib 1.0 −24%/−57% vs prior Rslib and 2.4x/4.2x d.ts; TS 7 7.7–11.9x vs TS 6; Vite 8 10–30x vs Rollup-era. The only independent user number found is 7.0 s → 3.6 s (tsup+tsc → tsdown, 26 packages, 2025). No head-to-head tsdown vs Rslib vs bun build vs tsc benchmark with hardware and date was found.

### Cited Findings
- tsdown docs: "approximately 2 times faster than tsup for standard builds, and up to 8 times faster when generating TypeScript declaration files"; points to gugustinette's bundler-benchmark — [tsdown benchmark page](https://tsdown.dev/advanced/benchmark). The benchmark site is JS-rendered; fetch returned only the title — [bundler-benchmark](https://gugustinette.github.io/bundler-benchmark/).
- PkgPulse (Feb 2026 downloads): tsup ~6M/wk, unbuild ~3M/wk, tsdown ~500K/wk; "real-world library with 50 files: tsup ~2.5s, tsdown ~0.6s"; "tsdown is the emerging performance leader" (aggregator, methodology unspecified) — [PkgPulse guide](https://www.pkgpulse.com/guides/tsup-vs-tsdown-vs-unbuild-typescript-library-bundling-2026).
- Independent migration: 7.014 s → 3.583 s (May 2025) — [alan.norbauer.com](https://alan.norbauer.com/articles/tsdown-bundler/).
- Rslib 1.0 (Sept 2026): −24.3% uncached, −56.7% cached, d.ts 4.1 s (TS 7, ~2.4x) and 2.3 s (isolated, ~4.2x) — [Rslib 1.0 blog source](https://github.com/web-infra-dev/rslib/blob/main/website/docs/en/blog/v1-0.mdx).
- TS 7.0 (July 2026): 7.7x–11.9x build speedups; earlier preview numbers VS Code 89.1 s → 8.74 s (10.2x), Sentry 133.1 s → 16.3 s (8.2x), TypeORM 15.8 s → 1.06 s (9.9x) — [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/); [nerdleveltech summary](https://nerdleveltech.com/typescript-7-native-compiler-tsgo).
- Vite 8 (Mar 2026): 10–30x builds; Linear 46 s → 6 s — [Vite 8 announcement](https://vite.dev/blog/announcing-vite8).
- Historical (2025 talk): oxc isolated declarations ~5 ms vs tsc ~340 ms (isolated) / ~860 ms (check+emit) for ~20 files — [GitNation](https://gitnation.com/contents/faster-typescript-builds-with-isolateddeclarations).

### Inferences
- All cross-tool numbers are vendor- or aggregator-sourced; a local benchmark on the beep-effect monorepo (tsc -b under TS 7 vs tsdown unbundle+oxc dts vs Rslib bundleless+isolated) would be more decision-relevant than any published figure.

### Gaps
- No rolldown-team benchmark with absolute numbers was retrieved; no bun build comparison from 2026 was found; bundler-benchmark results could not be read (client-rendered).

## Key question 8 — Monorepo ergonomics: shortest config, one shared config package, turbo caching

### Takeaway
tsdown has the shortest per-package footprint (dts auto-enabled from package.json, root config inherited in `-W` mode, `exports`/publint/attw built in); Rslib needs a small `rslib.config.ts` per package but can share Rsbuild config/plugins; tsc stays at zero extra config but needs hand-maintained `exports`/`publishConfig` (Effect's approach). Turbo caching is tool-agnostic as long as the package script runs per package with `dist/**` outputs.

### Cited Findings
- tsdown minimal config `defineConfig({ entry: 'src/index.ts' })`; config may live in a `tsdown` package.json key; dts auto-enabled from `types`/`exports.types` — [config-file docs](https://tsdown.dev/options/config-file); [dts docs](https://tsdown.dev/options/dts).
- tsdown workspace mode: `tsdown -W -F my-package`; "Root-level configuration is automatically inherited by workspace packages" — [FAQ](https://tsdown.dev/guide/faq).
- tsdown `exports.devExports` writes built exports into `publishConfig`, honored by pnpm/yarn publish but not npm — [package-exports docs](https://tsdown.dev/options/package-exports).
- Rslib bundleless mode handles alias and extension redirects automatically (default true) so source can keep tsconfig `paths` — [Rslib redirect](https://rslib.rs/config/lib/redirect).
- Effect monorepo pattern: `exports` → `src/*.ts`, `publishConfig.exports` → `dist/*.js`, `files` whitelists `src/**/*.ts`, `dist/**/*.js(.map)`, `dist/**/*.d.ts(.map)`; build is `tsc -b` + Babel annotate; no bundler — local `packages/effect/package.json`.
- Turborepo caches build outputs by content hash and `^build` orders upstream packages first (generic docs via search) — [Strapi Turborepo guide](https://strapi.io/blog/turborepo-guide).

### Inferences
- A shared `@beep/bundler`-style package can own one `tsdown.config.ts` exported as a function (`defineConfig(sharedLibConfig())`) so each package's config is one import line; with `-W` even that can collapse to a root-level run, but per-package `turbo` tasks are what make caching granular, so keep `"build": "tsdown"` per package with `outputs: ["dist/**"]`.
- `exports: true` writing package.json during build is a turbo-cache hazard: it mutates an input of the task. Either commit the generated `exports` and run generation in a separate lint/check lane, or treat `package.json` as an output.

### Gaps
- No source found that documents turbo-specific guidance for tsdown or Rslib; the @savvy-web/bundler reference was not researched (not in scope of fetched sources).
- Vite library mode as a library pipeline was not deeply researched; given Vite 8 is rolldown-based and VoidZero plans tsdown as the lib-mode foundation, it is treated here as "use tsdown instead".
