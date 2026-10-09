# `bun build` as a library bundler (status as of 2026-10-09)

Scope: what Bun's built-in bundler can and cannot do for publishing TypeScript *library* packages from a monorepo, with evidence, for a fair comparison against tsdown/rolldown, rslib, esbuild and plain `tsc` emit.

Evidence base: (a) the locally installed Bun **1.4.2** (`~/.local/share/mise/installs/bun/latest/bin/bun`, which is also the latest stable release, tagged 2026-09-05 per `gh api repos/oven-sh/bun/releases/latest`), probed with a throwaway project in the session scratchpad (`scratchpad/bunprobe/`); (b) bun.com docs; (c) Bun release blog posts 1.3 / 1.4 / 1.4.2; (d) oven-sh/bun issues and merged PRs via `gh`; (e) the rolldown team's benchmark repo and third-party posts. Local probe results are marked **[local probe, Bun 1.4.2]**. There is no Bun 2.x: the release list is 1.3.14 (2026-05-13) → 1.4.0 (2026-08-20) → 1.4.1 (2026-09-04) → 1.4.2 (2026-09-05), all non-prerelease.

Version framing: Bun 1.4 (2026-08-20) is the release where "Bun is now written in Rust" (ported from Zig); the bundler internals are now in `src/bundler/*.rs` — [Bun v1.4 blog](https://bun.com/blog/bun-v1.4); [issue #18008 maintainer comment referencing `src/bundler/linker_context/scanImportsAndExports.rs`](https://github.com/oven-sh/bun/issues/18008).

---

## Q1. Does `bun build` generate `.d.ts` files in any mode? isolatedDeclarations?

### Takeaway
No. As of Bun 1.4.2 (latest stable, Sept 2026) the bundler has no declaration output of any kind, no `dts`/`--dts` option, and no isolatedDeclarations-based emit; the docs still say "use `tsc`". The 2023 feature request (#5141) is open with 109 upvotes and no maintainer commitment beyond a 2023 "after isolated declarations ships" remark. Declarations must come from `tsc`/`tsgo --emitDeclarationOnly`, a community plugin (`bun-plugin-dts` wraps dts-bundle-generator; `bun-plugin-isolated-decl` wraps oxc-transform), or a wrapper like bunup.

### Cited Findings
- Bundler docs: "It does not generate type declarations. Use `tsc` to produce `.d.ts` files." No `dts`, `declaration`, or `isolatedDeclarations` option exists in the documented `Bun.build` option list — [bun.com/docs/bundler](https://bun.com/docs/bundler)
- The new `bun check` type-checker docs (unreleased, see Q2) also state it "Does not generate `.d.ts` files (use `tsc` for that)" — [bun.com/docs/runtime/check](https://bun.com/docs/runtime/check)
- Issue #5141 "Generate type declarations during `bun build`" (opened 2023-09-12) is **open**, 27 comments, **109 👍**, last updated 2026-08-04. Maintainers initially called it out of scope; Jarred Sumner (2023-09-14) said support would come "weeks or months" after TypeScript's Isolated Declarations shipped; a 2025-04-28 comment noted TS 5.5 shipped it, with no official response since — [oven-sh/bun#5141](https://github.com/oven-sh/bun/issues/5141); counts from `gh api repos/oven-sh/bun/issues/5141`
- Workarounds named in the issue thread: `tsc --emitDeclarationOnly`; [bun-plugin-dts](https://github.com/wobsoriano/bun-plugin-dts); [bun-plugin-isolated-decl](https://github.com/ryoppippi/bun-plugin-isolated-decl); oxc-transform directly; or switching to tsdown — [oven-sh/bun#5141](https://github.com/oven-sh/bun/issues/5141)
- `bun-plugin-isolated-decl` "uses the oxc-transformer to generate isolated declaration files for each entrypoint" and "is optimized for and limited to source code that is compatible with TypeScript 5.5's isolatedDeclarations option" — [bun-plugin-isolated-decl README](https://unpkg.com/bun-plugin-isolated-decl@0.2.0/README.md)
- bunup (the "tsdown for Bun") ships its own declaration generator: isolated declarations by default ("processes each file independently"), an `inferTypes` option that falls back to full TypeScript compilation, optional tsgo for "approximately 10x faster declaration generation", declaration splitting, minification, `dtsOnly`. Docs version v0.16.32 — [bunup TypeScript declarations guide](https://bunup.dev/docs/guide/typescript-declarations)
- bunup's own rationale: "Bun's bundler currently cannot generate TypeScript declarations, requiring you to use a separate TypeScript declaration generator alongside your build configuration, which is slow and defeats the purpose of Bun's speed advantage." — [Why bunup](https://bunup.dev/notes/why-bunup.html)
- **[local probe, Bun 1.4.2]** `bun build --dts --outdir dist src/a.ts` printed "Bundled 2 modules" and emitted only `a.js`; `find dist -name '*.d.ts'` → 0. `Bun.build({ ..., dts: true })` succeeded with only a `.js` output. See Q9 for why no error was raised.
- Adoption of the pairing pattern is large: GitHub code search `"bun build" emitDeclarationOnly filename:package.json` → **2,084** files; `"bun build" "--declaration" filename:package.json` → 696; `bun-plugin-dts filename:package.json` → 595; `bun-plugin-isolated-decl filename:package.json` → 28 (counts from `gh api search/code`, 2026-10-09). Sample repos: humanlayer/humanlayer, nostr-dev-kit/ndk, neovateai/neovate-code, pojntfx/panrpc, DavidWells/markdown-magic, chdb-io/chdb-bun, honestjs/honest.

### Inferences
- For a library publish pipeline, Bun alone cannot produce a complete npm artifact; a second tool is mandatory for types. Any "Bun-only" comparison row should be scored as "JS only; types via tsc/tsgo".
- Because the plugin API has no "emit extra output file" hook (Q4), the community dts plugins run a separate program inside `onStart`/`onEnd`, i.e. they are orchestration, not bundler integration.
- The bunup and tsdown dts stories are equivalent in approach (oxc isolated declarations fast-path + tsc fallback); only tsdown's is maintained by the rolldown/Vite team.

### Gaps
- No public statement from Bun maintainers dated 2025–2026 about a native dts roadmap was found (the #5141 thread has no maintainer post after 2023).

---

## Q2. Type checking during build (`check` option / `bun build --check`)

### Takeaway
Bun's docs describe a built-in TypeScript-7-based type checker (`bun check`, `bun build --check`, `Bun.build({ check: true })`) that fails the build on type errors, but it is **not in any stable release**: the implementation PR merged 2026-10-06, after 1.4.2 (2026-09-05). On the installed 1.4.2 the option is silently ignored (a file with a type error "built" successfully).

### Cited Findings
- Docs: "`bun check` reads your `tsconfig.json`, reports the same errors as `tsc` from TypeScript 7, and uses every CPU core"; `bun build --check src/app.ts` type-checks before bundling; `check: true` in `Bun.build()` fails builds on type errors; "If there is a type error, Bun prints it, exits with code 1, and does nothing else"; it does not cover dynamic imports or worker scripts — [bun.com/docs/runtime/check](https://bun.com/docs/runtime/check)
- Merged PRs: #44361 "`bun check` - a TypeScript type checker builtin to Bun" (merged 2026-10-06), followed by #44665/#44685/#44711 "fix [378 more] differences from `tsc`" (2026-10-07) and #44726/#44748 (2026-10-08) — `gh search prs -R oven-sh/bun "bun check" --merged`
- Already-open bug: #44763 (2026-10-08) "`bun check`: loading time grows with the number of project references; each referenced project re-reads the libs and node_modules declarations" — relevant to a monorepo with many project references — `gh issue list -R oven-sh/bun`
- **[local probe, Bun 1.4.2]** `bun check` → `error: Script not found "check"`. `Bun.build({ entrypoints: ["./src/bad.ts"], check: true, throw: false })` where `bad.ts` is `export const n: number = "str"` → `success: true`, 0 logs (with TypeScript 6.0.3 symlinked into node_modules and a strict tsconfig present). `bun build --check` likewise bundled the bad file.

### Inferences
- Expect `bun check` in the next stable (1.4.3 or 1.5). Until then, the repo's `tsgo`/`tsc` gate stays authoritative; a `check: true` in a build script gives false confidence on 1.4.2.
- A type-checker that is "fixing hundreds of differences from tsc" per day (Oct 7–8 PRs) is pre-production for a gate; treat as experimental for at least one release cycle.

### Gaps
- No release note yet states which stable version will carry `bun check`.

---

## Q3. Library-relevant bundler surface: externals, splitting, formats, targets, minify, sourcemaps, sideEffects, tree-shaking, PURE, define/env, bytecode, compile

### Takeaway
Bun covers the esbuild-class feature set well: `--packages external`, `--external` with `*` globs, multi-entry `--splitting` with shared chunks, `esm|cjs|iife`, `browser|bun|node`, granular minify, four sourcemap modes, `define`, `env` inlining, PURE-annotation emission, `--bytecode`, `--compile` with cross-targets. It lacks several esbuild options that matter to libraries (`outExtension`, `alias`, `mainFields`, `legalComments`, syntax-downlevel `target`, `inject`, `pure`), and has **no preserveModules/unbundled mode** (only `--no-bundle`, which transpiles per-file but does not rewrite extensionless relative specifiers, so Node cannot load the result).

### Cited Findings
**Documented options (bun.com/docs/bundler, all read 2026-10-09)** — [source](https://bun.com/docs/bundler)
- `target`: `browser` (default) | `bun` | `node`. `format`: `esm` (default) | `cjs` | `iife`, with `cjs`/`iife` marked **experimental** in the docs. `packages`: `bundle` (default) | `external`. `external`: list, supports `*` wildcard. `splitting` (default false). `minify`: boolean or `{ whitespace, identifiers, syntax }`. `sourcemap`: `none | linked | external | inline`. `define`, `env` (`inline` | `disable` | prefix like `PUBLIC_*`), `bytecode` (requires `target: "bun"`), `bytecodeDepth`, `naming` (`[name] [ext] [hash] [dir]`), `root`, `publicPath`, `banner`, `footer`, `drop`, `loader`, `plugins`, `conditions`, `metafile` (esbuild-compatible JSON, or markdown), `throw`, `emitDCEAnnotations`, `optimizeImports`, `deprecatedNamespaceObjectSetters`, `jsx`.
- Tree-shaking "respects `package.json` `sideEffects` fields; dead code elimination follows `@__PURE__` annotations"; `optimizeImports` "skip[s] parsing unused submodules of barrel files", automatically enabled for packages with `"sideEffects": false`.
- Bun "tree-shakes the exports of `import()`/`require()` targets down to the names the importing code reads", unlike esbuild — [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)
- esbuild options Bun **does not support**: `alias`, `mainFields`, `resolveExtensions`, `preserveSymlinks`, `inject`, `pure`, syntax-downlevel `target`, `legalComments`, `outExtension`, `sourceRoot`, `sourcesContent`, `analyze`, `mangle*`, `supported`, `charset`; `allowOverwrite` always false — [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)

**Release-note additions**
- Bun 1.3 (2025-10-10): `Bun.build({ compile: true })`; cross-compile targets `bun-linux-x64`, `bun-darwin-arm64`, `bun-windows-x64`; Windows/macOS code signing; new minifier passes (drop unused function/class names unless `--keep-names`, fold `new Object()/Array()/Error()`, `typeof undefined`, unused `Symbol.for()`, dead `try/catch/finally`); plugin `onEnd` hook; glob patterns in `sideEffects` (e.g. `"*.css"`); `jsxSideEffects`; `--compile-exec-argv` — [Bun v1.3 blog](https://bun.com/blog/bun-v1.3)
- Bun 1.4 (2026-08-20): code-splitting 14x faster on a 20,000-module graph (320 ms vs 4.65 s, BFS reachability); `--metafile-md`; `metafile: true` returns esbuild-compatible metadata; `--feature=FLAG` compile-time feature elimination; `--asset <path>` embedding for `--compile`; `--bytecode --format=esm` (with `--compile`) incl. top-level await; `files` option for in-memory bundling; TC39 decorators; `--react-compiler`; `optimizeImports` barrel optimisation — [Bun v1.4 blog](https://bun.com/blog/bun-v1.4)
- Bun 1.4.2 (2026-09-05): one bundler fix — a renaming regression producing `var exports2 = exports2` — [Bun v1.4.2 blog](https://bun.com/blog/bun-v1.4.2)

**[local probe, Bun 1.4.2] — `bun build --help` flags present**: `--target`, `--format`, `--packages`, `-e/--external` ("can use * wildcards"), `--splitting`, `--no-split-require`, `--min-chunk-size`, `--sourcemap`, `--minify[-syntax|-whitespace|-identifiers]`, `--keep-names`, `--env`, `--bytecode`, `--bytecode-depth`, `--compile` (+ `--asset`, `--compile-executable-path`, `--compile-exec-argv`, windows metadata), `--metafile`, `--metafile-md`, `--root`, `--entry-naming/--chunk-naming/--asset-naming`, `--banner/--footer`, `--conditions`, `--emit-dce-annotations`, `--no-bundle`, `--allow-unresolved`, `--reject-unresolved`, `--production`, `--watch`, `--css-chunking`, `--app` (EXPERIMENTAL), `--server-components` (EXPERIMENTAL). **Not listed**: `--define` (works anyway, see below), `--dts`, `--preserve-modules`, `--check`, `--drop`, `--loader`.

**[local probe, Bun 1.4.2] behaviours**
- `--define 'FOO="hi"'` substituted correctly despite absence from `--help` (`var v = "hi"`).
- `--packages external` left both `effect` and `@scope/pkg` as `import` statements; `--external '@scope/*'` externalised only the scoped package and inlined `effect`.
- `--splitting` with three entries produced `e1.js`, `e2.js`, `a.js` plus a shared chunk `e1-asthp7h5.js` (chunk name derives from the first entry, not `chunk-`; via the JS API the chunk was named `chunk-bm1b8ps1.js`). Library-shaped test (two entries sharing `shared.ts`, `effect` external): entries import `shared` from a hash-named chunk and keep `import * as Effect from "effect/Effect"`.
- PURE: `/* @__PURE__ */` annotations on used calls are **re-emitted** in unminified output (incl. in class static initialisers) and stripped under `--minify` (default for `--minify-whitespace`; `--emit-dce-annotations` re-enables). Bundling `effect/Effect` + `effect/HashMap` unminified preserved 43 `__PURE__` markers (esbuild 0.28 preserved 78 on the same input).
- Side-effect handling: `import { unused } from "./pure"` where `pure.ts` has a side-effectful IIFE → Bun dropped the module entirely; `import "./pure"` or an actually-used import kept it. **esbuild 0.28.2 and rolldown 1.x produced the same result** on the same input, so this is not a Bun-specific divergence.
- `--format cjs --target node`: emits an `__toCommonJS`/`__export` prelude with `__esModule: true`; `require()` from Node gives `['default','named']`, `default` a function; `import()` of that CJS from Node ESM yields keys `['default','module.exports']` (Node's standard CJS-namespace shape). Externals under `cjs` become `require("effect")`.
- Sourcemaps: `--sourcemap=external` and `linked` require `--outdir` (`error: cannot use an external source map without --outdir` when used with `--outfile`); the map has `sourcesContent` and correct relative `sources`; a minified `effect` bundle's map had 19 sources, `sourcesContent` present, **`names` array empty (0)** — identifier names are not mapped.
- `--metafile-md` requires the `=` form (`--metafile-md=dist/meta.md`); the space form treated the path as an entrypoint. The markdown report lists total size, module counts, node_modules contribution, external imports, largest modules.
- `--no-bundle`: per-file transpile, keeps directory structure under `--root`, strips `import type`/`export type`/inline `type` specifiers, but leaves `export * from "./b"` extensionless → Node fails with `ERR_MODULE_NOT_FOUND` on the output. Outputs are reported as `(chunk)`, not entry points.
- `--target bun` output starts with a `// @bun` pragma; the simple and the `effect` bundles both loaded fine under Node 24.20 (`import()` ok). Output size for `effect/Effect`+`HashMap` entry: Bun 48,702 B unminified / 22,677 B minified; esbuild 0.28.2 unminified on the same entry: 71,817 B. Build time both ≈10–20 ms wall.
- `--bytecode` without `--compile` requires `--format cjs` (`error: ESM bytecode requires --compile. Use --format=cjs for bytecode without --compile.`) and `--outdir`; emits `cli.js` (147 B, header `// @bun @bytecode @bun-cjs`) + `cli.js.jsc` (568 B). `--bytecode --outfile` → `error: cannot write multiple output files without an output directory`.
- `--compile`: 81,315,296-byte executable from a 1-line script vs 79,500,640-byte `bun` binary (Linux x64, 1.4.2) — overhead ≈1.8 MB; runs standalone (`hello 4`). `--compile --bytecode` same size.

### Inferences
- "Externals via `--packages external`" is the right library default; `--external '@beep/*'`-style globs work for workspace siblings.
- Bun has no `outExtension`, so dual `.mjs`/`.cjs` emission from one invocation needs two runs with `--entry-naming '[dir]/[name].cjs'` style naming (this is exactly what bunup automates).
- The empty `names` array in minified sourcemaps means stack traces from minified Bun output will show mangled identifiers even with maps; keep library output unminified (as most libraries do) or accept this.
- `--no-bundle` is not a substitute for rollup `preserveModules`/tsdown `unbundle`; it is closer to `tsc`'s per-file transpile but without specifier rewriting, which makes it unusable for Node ESM consumers without a post-pass.

### Gaps
- Did not measure `sideEffects` glob handling or `optimizeImports` on `@beep/*` barrels; the 1.4 blog claims only.
- Did not verify CJS→ESM default-import interop for *bundled* third-party CJS packages (the historical weak spot); only own-code CJS emission was probed.

---

## Q4. JS API (`Bun.build`), plugin API, running `build.ts` with `bun run`

### Takeaway
`Bun.build({...})` mirrors the CLI, returns `{ success, outputs: BuildArtifact[], logs }`, and a TypeScript build script runs with plain `bun run build.ts` (no tsx/ts-node). Plugins have `onStart/onResolve/onLoad/onBeforeParse(native)/onEnd`; there is no transform-after-parse, render-chunk, or emit-file hook, so plugins cannot post-process chunks or add outputs (hence no plugin-based dts emission into the artifact list).

### Cited Findings
- Hooks: `onStart()`, `onResolve({filter, namespace})`, `onLoad({filter, namespace})` with `defer()`, native-only `onBeforeParse()` (NAPI, runs on any thread), `onEnd(result)` (added in 1.3). Loaders: `js jsx ts tsx json jsonc toml yaml file napi wasm text css html`. "Configuration modifications cannot occur within lifecycle callbacks — only during setup." No documented ability to emit additional output files or access output chunks — [bun.com/docs/bundler/plugins](https://bun.com/docs/bundler/plugins); `onEnd` from [Bun v1.3 blog](https://bun.com/blog/bun-v1.3)
- Plugins are shared with the runtime plugin system (`plugins` option "Shared with Bun runtime plugin system") — [bun.com/docs/bundler](https://bun.com/docs/bundler)
- Open plugin-API gaps: #6173 "Support sourcemaps in `onLoad` plugins" (open since 2023-09-29); #8994 "Missing Esbuild plugin API options (resolveDir, pluginData)" (open since 2024-02-19); #5866 "Support `watch: true` in `Bun.build()`" (open since 2023-09-21) — `gh issue list -R oven-sh/bun --label bundler`
- **[local probe, Bun 1.4.2]** `bun run build.ts` with `Bun.Glob` entry discovery, `splitting`, `packages: "external"`, `sourcemap: "linked"`, `target: "node"`, and an `onLoad` plugin appending an export to `b.ts` → `success: true`; outputs: `a.js:entry-point`, `chunk-bm1b8ps1.js:chunk`, `b.js:entry-point`, three `*.map:sourcemap`; the injected export appeared in all three JS files (it was hoisted into the shared chunk and re-exported).
- **[local probe, Bun 1.4.2]** `Bun.build({ ..., bogusOption: true })` → accepted, `success: true` (unknown options are not validated).

### Inferences
- A repo-owned `build.ts` is viable and dependency-free, but every option name must be checked against the installed version's `bun-types`, because misspellings/unsupported options (`dts`, `check` on 1.4.2) are silently ignored at runtime.
- The absence of sourcemap passthrough in `onLoad` (#6173) means any plugin that transforms code breaks sourcemap fidelity for that file.

### Gaps
- Did not test native `onBeforeParse` plugins.

---

## Q5. Benchmarks: `bun build` speed and output size vs esbuild, rolldown/tsdown, rspack

### Takeaway
On the rolldown team's own benchmark (not Bun's), updated 2026-10-07 with Bun 1.4.2, rolldown 1.2.13, esbuild 0.28.2, Bun is the fastest bundler on a 19k-module app on all three OSes (Ubuntu 955 ms vs rolldown 1,822 ms vs esbuild 2,108 ms, minify+sourcemap on). The same repo cautions that Bun "produces substantially different output", so the comparison is not like-for-like. Independent library-bundler (dts-inclusive) benchmarks with Bun were not retrievable; bunup claims 0.37 s vs tsdown 0.41 s on its own page.

### Cited Findings
- rolldown/benchmarks, "Updated 2026-10-07", apps/10000 (19,014 modules: 10,000 JSX components + 9,014 JS modules), production mode, minify on, sourcemaps on, gzip off. Tools: bun 1.4.2, rolldown 1.2.13, esbuild 0.28.2, vite 8.3.2, rspack 2.2.8, rsbuild 2.2.11, rollup 4.64.0. Ubuntu: bun 954.58 ± 7.29 ms; rolldown 1,821.61 ± 16.23 ms (1.9x); esbuild 2,107.77 ± 18.48 ms (2.2x). macOS: bun 766 ms; rolldown 2,037 ms; esbuild 2,277 ms. Windows: bun 1,777 ms; rolldown 3,051 ms; esbuild 3,287 ms. Caveat in repo: Bun "produces substantially different output compared to other tools, suggesting potential differences in tree-shaking and feature implementation" — [github.com/rolldown/benchmarks](https://github.com/rolldown/benchmarks)
- An earlier snapshot of the same benchmark (Sept 2026) reported bun 699.58 ± 12.98 ms, rolldown 1,252.72 ± 10.93 ms, esbuild 1,457.61 ± 17.09 ms on Ubuntu — [decodeapps/pkgpulse summary via search](https://www.pkgpulse.com/guides/state-of-javascript-build-tools-2026) (secondary source; the primary is the rolldown repo above)
- Independent small-project cold-build test (2026-03-03, 16-core/16 GB Arch Linux, Node 22.14, 10 runs): esbuild 0.27.3 0.19 s; rolldown 1.0.0-rc.6 0.27 s; rspack 1.7.6 1.58 s; webpack 5.105.4 1.98 s. **Bun not included; no output-size data** — [decodeapps.pp.ua benchmark](https://decodeapps.pp.ua/blog/post/fastest-js-bundler-2026-rolldown-vs-esbuild-vs-webpack-benchmark)
- Bun's own claim: "1.75x faster than esbuild on esbuild's three.js benchmark" — [vs esbuild](https://bun.com/docs/bundler/vs-esbuild) (vendor claim)
- bunup (vendor): "bunup builds in 0.37s compared to tsdown at 0.41s" — [bunup.dev](https://bunup.dev/) via search; tsdown (vendor): "approximately 2 times faster than tsup for standard builds, and up to 8 times faster when generating TypeScript declaration files", pointing to an external benchmark — [tsdown.dev/advanced/benchmark](https://tsdown.dev/advanced/benchmark)
- Rolldown "became the default bundler in Vite 8 beta (December 2025) and Vite 8 stable (March 2026)" — [pkgpulse state of build tools 2026](https://www.pkgpulse.com/guides/state-of-javascript-build-tools-2026)
- **[local probe, Bun 1.4.2]** single-entry `effect/Effect`+`HashMap` bundle: Bun 48.7 KB unminified vs esbuild 0.28.2 71.8 KB unminified (same entry, `--platform=node`); both ≈10–20 ms. Bun 20k-module code-splitting claim: 320 ms vs 4.65 s before — [Bun v1.4 blog](https://bun.com/blog/bun-v1.4)

### Inferences
- Raw JS bundling speed is a wash for library-sized inputs (tens of ms for everyone); in a monorepo the dominant cost is declaration emit, where Bun contributes nothing and the comparison is really `tsc`/`tsgo`/oxc-isolated-decl regardless of JS bundler.
- The smaller Bun output on the `effect` probe is consistent with the rolldown-repo caveat that Bun's output differs (more aggressive export-level tree-shaking of namespace imports); it is a plus for size but a reason to run the test suite against built output.

### Gaps
- The gugustinette "TS Bundler Benchmark" page referenced by tsdown.dev is JavaScript-rendered and returned no data via fetch; no independent, dts-inclusive library-bundler benchmark including Bun/bunup was obtained.
- No independent output-size comparison across bundlers for library output was found.

---

## Q6. Known limitations and issues for libraries (CJS interop, exports map, declaration maps, sourcemaps, `effect` bundling, Node compatibility of `--target bun`)

### Takeaway
Bun generates no `exports` map, no `.d.ts.map`, no `.mjs/.cjs` extension switching, and has 240 open bundler-labelled issues including a still-open `sideEffects: false` re-export drop (#18008, confirmed present on 1.4.3-canary in Sept 2026) that directly affects barrel-heavy libraries. Bundling `effect` into a library is technically fine with Bun but is the classic dual-instance hazard; keep `effect` external (`--packages external`) and declare it as a peer. `--target bun` output ran under Node 24 in both probes, but the docs reserve the right to use Bun-only module behaviour, so use `--target node` for Node consumers.

### Cited Findings
- Open bundler-labelled issues: **240** (`gh api search/issues q=repo:oven-sh/bun is:open label:bundler`, 2026-10-09).
- #18008 (opened 2025-03-09, **open**): with `"sideEffects": false`, a barrel `export * from './impl.cjs'` loses its re-exports → runtime `ReferenceError`; reproduced on 1.2.4, "also present in 1.4.3-canary.1 and main branch as of September 2026"; root cause located by a maintainer bot in `src/bundler/linker_context/scanImportsAndExports.rs` (uses `export_kind` instead of `other_export_kind`); no fix release — [oven-sh/bun#18008](https://github.com/oven-sh/bun/issues/18008)
- Other open library-relevant bundler issues (titles/dates from `gh issue list --label bundler`): #5344 duplicate exports when one entrypoint re-exports another entrypoint (2023-09-14, does not happen with minify); #11024 "`Bun.build` interprets some static require() calls as dynamic" (2024-05-12); #17755 "Bun build with cjs lib cannot run" (2025-02-27); #12304 "Implement `--keep-names` to prevent mangling function `.name` accesses" (2024-07-02) and #44121 "class renamed on name collision changes `.name`, even with `--keep-names`" (2026-09-27); #19729 "Directories in --outfile are ignored with --sourcemap" (2025-05-17); #6173 sourcemaps in `onLoad` plugins (2023); #3321 sourcemap `debugId` (2023); #21084 env vars via `?.` not inlined (2025-07-15); #41780 `type: "file"` imports emit cwd-relative paths (2026-09-07); #25144 "Bun build doesn't respect relative paths correctly" (2025-11-27); #18211 triple-slash `reference path` unsupported (2025-03-15).
- `exports`-map generation, `.mjs/.cjs` extension assignment, external-from-package.json, and workspace support are features bunup lists as things it adds on top of `bun build` — [Why bunup](https://bunup.dev/notes/why-bunup.html)
- No `outExtension`, `legalComments`, `alias`, `mainFields`, syntax-downlevel `target` — [vs esbuild](https://bun.com/docs/bundler/vs-esbuild)
- `format: cjs` and `iife` are labelled experimental in the docs — [bun.com/docs/bundler](https://bun.com/docs/bundler)
- Historical CJS interop fixes (so this is a known churn area): Bun inserts `__esModule` when `require`-ing ESM; fixed consecutive `module.exports = require()` re-export bug; fixed CJS→ESM transform injecting `exports.foo = undefined` — [Bun v0.6.12 notes](https://bun.com/blog/bun-v0.6.12) (2023, dated)
- Dual-instance hazard (general, not Bun-specific): "Both the ESM and the CJS version of a library can end up in your production bundle as two separate 'instances'", known as the dual-package hazard; `instanceof`/identity comparisons fail across instances; peerDependencies are the mitigation — [liveblocks dupes doc](https://liveblocks.io/docs/errors/dupes), [frontendchecklist duplicate-js](https://frontendchecklist.io/rules/performance/duplicate-js)
- **[local probe, Bun 1.4.2]** `--target bun` output (with `// @bun` pragma) for both the trivial module and the `effect` bundle loaded and ran under Node 24.20.0; `--format cjs` interop of own code was correct under both `require` and `import()`; `--no-bundle` output is **not** Node-loadable (extensionless specifiers); minified sourcemaps have empty `names`.
- **[local probe, Bun 1.4.2]** `bun build --totally-bogus-flag ...` ran normally with no warning — unknown CLI flags are silently ignored, so `--dts`, `--preserve-modules`, `--check` "succeed" without doing anything.

### Inferences
- For a package family like `@beep/*` with many barrels and `sideEffects: false`, #18008 is a live correctness risk whenever CJS is in the graph (e.g. a CJS dependency re-exported through an ESM barrel); keeping all dependencies external avoids the code path.
- For Effect libraries the only safe choice with any bundler is `effect` as external + peer; the question "can Bun bundle effect" (yes, 48 KB, runs in Node) is therefore moot for publishing and only matters for the CLI binary (Q7).
- `exports`/`types` maps, `.d.ts`, `.d.ts.map`, and extension switching all remain hand-authored or tool-generated outside Bun; tsdown and rslib generate these natively, which is the main qualitative gap rather than speed.

### Gaps
- No issue specifically titled "preserveModules" was found in oven-sh/bun (searches for preserve modules / one file per module / unbundled returned only `--preserve-symlinks` runtime issues); the absence of the feature is documented by omission (docs, `--help`) rather than by a tracked request.
- No 2025–2026 Bun issue specifically about incorrect sourcemap *mappings* (as opposed to missing features) was found; sourcemap correctness was only spot-checked structurally here.

---

## Q7. Real-world libraries published with `bun build` only; Effect-ecosystem libs built with Bun

### Takeaway
Thousands of repos pair `bun build` with `tsc --emitDeclarationOnly` (2,084 package.json hits), and bunup has ~677 package.json references versus tsdown's ~53,632, so Bun-native library tooling is a small minority. 160 files match `"bun build" "effect/Effect"`, but no prominent Effect-ecosystem library using Bun as its sole publish bundler was identified; the Effect ecosystem's mainstream remains tsc/tsup/tsdown.

### Cited Findings
- GitHub code search counts (2026-10-09, `gh api search/code`): `"bun build" emitDeclarationOnly filename:package.json` → 2,084; `"bun build" "--declaration" filename:package.json` → 696; `bun-plugin-dts filename:package.json` → 595; `bun-plugin-isolated-decl filename:package.json` → 28; `bunup filename:package.json` → 677; `tsdown filename:package.json` → 53,632; `"bun build" "effect/Effect"` (any file) → 160.
- Sample repos using `bun build` + `emitDeclarationOnly` in package.json: humanlayer/humanlayer, nostr-dev-kit/ndk, neovateai/neovate-code, pojntfx/panrpc, DavidWells/markdown-magic, chdb-io/chdb-bun, honestjs/honest, 6over3/exiftool, cloudshipai/station, jbilcke-hf/clapper (from the search sample).
- Repos depending on `bun-plugin-isolated-decl`: ryoppippi/pkg-to-jsr, labdigital-evolve/graphql-client, BiasPay/typescript-sdk, OMUAPPS/omuapps, pekochan069/astro-datastar, Atulin/bun-returning-rewriter (from `gh search code`).
- Common published recipe: build JS with `bun build`, then `bunx tsc --declaration --emitDeclarationOnly --outDir dist`, with `main`/`module`/`types`/`exports` written by hand — [daleseo bun-build skill](https://skills.sh/daleseo/bun-skills/bun-build), [jwynia npm-package skill](https://www.claudepluginhub.com/skills/jwynia-jwynia-agent-skills-1/npm-package)
- "Just as tsdown exists for Rolldown and tsup exists for esbuild, Bunup exists for Bun's bundler" — [bunup.dev](https://bunup.dev/)

### Inferences
- Search-count ratios (tsdown ≈ 79× bunup) indicate that for *library* publishing the ecosystem has standardised on rolldown-based tooling; Bun-built libraries are mostly Bun-first apps/CLIs that also publish a package.
- The 160 `effect/Effect` + `bun build` hits are dominated by application/CLI bundles (the probe pattern), not published libraries; I could not confirm any Effect library in that set.

### Gaps
- `gh search code` with quoted multi-word queries returned empty for several phrasings; the counts above come from the REST `search/code` endpoint and are approximate (GitHub code search indexes a subset of repos).
- No Effect-ecosystem library (e.g. under effect-ts/, or well-known community packages) was found whose publish pipeline is `bun build`.

---

## Q8. Runtime-performance angle: `--bytecode`, `--compile`, startup wins for CLIs

### Takeaway
Bytecode caching is a genuine, measured CLI startup win under Bun (vendor: ~2x for `tsc`, 1.5–2x for small CLIs; one independent measurement: 1.38x, 52.7 → 38.3 ms), at the cost of 2–8x larger `.jsc` files, Bun-only output, and bytecode tied to the exact Bun version. It is irrelevant to library packages consumed by Node, and only applies to the repo's Bun CLI binary, where `--compile --bytecode` (ESM allowed with `--compile` since 1.4) is the documented path.

### Cited Findings
- Vendor: "tsc starts 2x faster" with `--bytecode`; small CLIs (<100 KB) 1.5–2x, medium–large apps (>5 MB) 2–4x faster startup; bytecode files "typically 2-8x larger than source code", compress 60–70%; "Bytecode output does not run on Node.js — only on Bun"; CJS works with `--target=bun`, ESM "requires `--compile`"; bytecode "is not portable across Bun versions ... Bun silently rejects mismatched bytecode and falls back to source parsing" — [bun.com/docs/bundler/bytecode](https://bun.com/docs/bundler/bytecode)
- `--bytecode-order` (profile-guided) example: cold start 1.0 s → 0.53 s and −40 MB memory — [bun.com/docs/bundler/executables](https://bun.com/docs/bundler/executables)
- Independent measurement (peterbe.com, hylite CLI): bytecode build 38.3 ms vs 52.7 ms standard compiled → 1.38x — [peterbe.com "Trying bun --compile to bytecode"](https://peterbe.com/plog/trying-bun-compile-to-bytecode)
- `--compile` targets: linux x64/arm64 (glibc and musl), windows x64/arm64, macOS x64/arm64; limitations: no dynamic `require(variable)`, workers must be listed as entrypoints, only `with { type: "file" }` imports (or `--asset`, 1.4) are embedded; `--outdir` not supported with `--compile`; `.env` and `bunfig.toml` autoload by default, `tsconfig.json`/`package.json` do not; `BUN_BE_BUN=1` makes the binary act as the Bun CLI — [bun.com/docs/bundler/executables](https://bun.com/docs/bundler/executables); 1.3 added `Bun.build({compile:true})`, code signing, `--compile-exec-argv` — [Bun v1.3 blog](https://bun.com/blog/bun-v1.3)
- Bun 1.4 runtime claims (affect any CLI run under Bun, bundled or not): "starts 50% faster on Linux", 5x lower idle CPU, up to 35% less memory — [Bun v1.4 blog](https://bun.com/blog/bun-v1.4)
- **[local probe, Bun 1.4.2]** `--compile` binary = 81.3 MB (bun binary itself 79.5 MB); `--bytecode` without `--compile` forces `--format cjs` + `--outdir`; `.jsc` for a 147-byte script was 568 B (3.9x).
- Bundling for Bun "reduces server startup time" is the documented rationale for `--target=bun` bundles in `bun build --help` examples — **[local probe, Bun 1.4.2]**

### Inferences
- For `packages/tooling/tool/cli` (a Bun CLI bin), a `bun build --compile --bytecode --target bun-linux-x64` step is a plausible startup optimisation, but the `.jsc`/binary must be rebuilt on every Bun upgrade and cannot be shared with Node consumers; it belongs in a release/packaging lane, not in the library build.
- No evidence that Bun-bundled output runs faster under **Node** than tsc-emitted per-file output; the only runtime wins cited are Bun-specific (bytecode, fewer module resolutions).

### Gaps
- No independent 2026 measurement of `--bytecode` on a large (multi-MB) Effect-based CLI was found; the 2–4x large-app claim is vendor-only.

---

## Q9. Cross-cutting gotcha: silent acceptance of unknown flags/options

### Takeaway
Bun 1.4.2 silently ignores unknown `bun build` CLI flags and unknown `Bun.build` option keys. Every "works on Bun" claim in this file therefore had to be verified by output inspection, not by the command exiting 0.

### Cited Findings
- **[local probe, Bun 1.4.2]** `bun build --totally-bogus-flag --outdir dist src/a.ts` → "Bundled 2 modules", exit 0, no warning; `--dts`, `--preserve-modules`, `--check` likewise; `Bun.build({ bogusOption: true })` → `success: true`.
- No oven-sh/bun issue about this was found via web search (search returned unrelated CLIs).

### Inferences
- A repo build script should assert on the produced artifact list (e.g. that `.d.ts` files exist from the separate tsc step) rather than trusting Bun's exit code.

### Gaps
- Could not determine whether this is intentional (`bun build` passes unknown args through for `--compile`d binaries?) or an oversight; no documentation found.

---

## Summary matrix (for the comparison table)

| Capability | Bun 1.4.2 status | Evidence |
| --- | --- | --- |
| `.d.ts` emit | **Missing** (requested since 2023, #5141 open, 109 👍) | docs "use tsc"; local probe |
| isolatedDeclarations dts | Missing natively; via `bun-plugin-isolated-decl` (oxc) or bunup | plugin README; bunup docs |
| Type-check in build (`check`) | Documented, **unreleased** (PR merged 2026-10-06); silently ignored on 1.4.2 | docs; `gh` PRs; local probe |
| preserveModules / unbundle | **Missing**; `--no-bundle` transpiles per file but leaves extensionless specifiers (Node fails) | `--help`; local probe |
| `--packages external`, `--external` globs | Supported | docs; local probe |
| Multi-entry `--splitting` | Supported (chunks hash-named; 14x faster in 1.4) | 1.4 blog; local probe |
| `esm` / `cjs` / `iife` | Supported; `cjs`/`iife` labelled experimental | docs; local probe (cjs interop ok for own code) |
| `--target browser/bun/node` | Supported; `bun` output ran on Node in probes, not guaranteed | docs; local probe |
| Minify variants, `--keep-names` | Supported; `.name` collision bug #44121 open | 1.3 blog; `gh` |
| Sourcemaps 4 modes | Supported; external/linked need `--outdir`; minified map `names` empty | local probe |
| `sideEffects` / tree-shaking / PURE | Supported; PURE re-emitted unminified; #18008 (sideEffects:false + CJS re-export drop) **open** | docs; local probe; issue |
| `define`, `env` inlining | Supported (`--define` undocumented in `--help` but works) | docs; local probe |
| `--bytecode` | Supported; CJS unless `--compile`; Bun-only; version-locked | docs; local probe |
| `--compile` | Supported, 8 cross-targets, ~80 MB binary, `--asset` (1.4) | docs; local probe |
| `exports` map / `.mjs`+`.cjs` extensions / `.d.ts.map` | Not generated (bunup/tsdown/rslib territory) | bunup "why"; vs-esbuild (`outExtension` unsupported) |
| Plugin API | onStart/onResolve/onLoad/onBeforeParse/onEnd; no emit-file/render-chunk; no onLoad sourcemaps (#6173) | docs; `gh` |
| Unknown flags/options | Silently ignored | local probe |
| Speed (19k-module app, rolldown's bench, 2026-10-07) | bun 955 ms < rolldown 1,822 ms < esbuild 2,108 ms (Ubuntu), output "substantially different" | rolldown/benchmarks |
