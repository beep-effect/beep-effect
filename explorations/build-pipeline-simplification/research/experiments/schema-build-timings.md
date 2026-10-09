# Experiment 2: `@beep/schema` build timings (effect-tsgo emit vs bundlers)

Packet: `explorations/build-pipeline-simplification`. Date: 2026-10-09. Repo `main` @ e62411d63f, clean before and after.
Package: `packages/foundation/modeling/schema` (173 `.ts` under `src/`; 87 `exports` targets ending in `.ts`, one is the glob `./src/SchemaUtils/*.ts`, expanding to 92 unique entry files).

## Machine
- CPU: AMD Ryzen Threadripper 9970X 32-Cores, `nproc` = 64
- RAM (`free -g`): 125 total, 57 used, 16 free, 67 available; swap 47
- Kernel 7.2.9-2-cachyos
- Load average at start: 15.16 15.75 12.22. During batch 1: load1 13.7 to 28.7. Batch 2: 25.6 at start, 36.7 at end. Other agent sessions were running throughout, so this is a shared, noisy box, not a quiet bench.

## Versions
- `node_modules/.bin/tsc` -> `@typescript/native` = `Version 7.0.2+effect-tsgo.0.47.2` (TS 7 Go with the Effect fork)
- `@babel/core` 8.0.7, `babel-plugin-annotate-pure-calls` 0.5.0 (via `@babel/cli`)
- bun 1.4.2, node v24.20.0
- Probe (`~/.cache/beep/tsdown-probe`, `bun init -y` + `bun add tsdown@latest rolldown-plugin-dts@latest typescript@7`): tsdown 0.23.0, rolldown 1.2.13, rolldown-plugin-dts 0.28.6, typescript 7.0.2 (stock, `typescript-linux-x64`)

## Method
- One driver script (`schema-timings/driver.sh`) runs inside one `beep-heavy` job, so slot-queue wait is outside every measurement. Each variant is timed with `/usr/bin/time -v` (wall clock plus max RSS).
- Before every run: `rm -rf <pkg>/dist <pkg>/node_modules/.tmp/tsconfig.tsbuildinfo`. Every run is cold for tsc's incremental state. The OS page cache and the dists of referenced projects stay warm.
- Iteration 0 is a warm-up and is discarded. Within each iteration the variants run interleaved (A1, A2, B, C, Cfx, Cjs, D1, D2), which spreads load drift across all of them.
- Batch 1 = 3 timed runs (as briefed). Batch 2 = 10 timed runs, added because each run takes about 1 s and load was high. Raw data: `schema-timings/results-batch1-n3.tsv`, `results-batch2-n10.tsv`, per-run logs and `time -v` files in `schema-timings/logs/`.
- Output census uses the iteration-0 copies for A/B and the last iteration's outputs for C/Cfx/Cjs/D (`schema-timings/out/`).

### Exact commands (cwd = package dir unless noted)
- A1: `$R/node_modules/.bin/tsc -p tsconfig.json`
- A2: `bun run babel` (= `babel dist --plugins annotate-pure-calls --out-dir dist --source-maps`)
- B: `$R/node_modules/.bin/tsc -p tsconfig.json` (separate run, same command as A1)
- C (cwd = probe): `node node_modules/.bin/tsdown -c tsdown.config.ts`. Config: `entry` = resolved `exports` `.ts` values, `unbundle: true`, `root: src`, `format: "esm"`, `platform: "neutral"`, `sourcemap: true`, `tsconfig: <pkg>/tsconfig.json`, `dts: { sourcemap: true }` (default generator), `deps.neverBundle` = deps + peerDeps + `effect`, `/^effect\//`, `/^@beep\//`, and `<dep>/` subpath regexes. `TMPDIR` points at the scratch dir because the tsgo generator `mkdtemp`s under `os.tmpdir()`. Config copy: `schema-timings/tsdown.config.ts`.
- Cfx: C with `dts.tsgo.path = $R/node_modules/.bin/tsc` (the Effect fork)
- Cjs: C with `dts: false` (JS only; isolates the rolldown share of the time)
- D1: `bun build <92 entries> --root src --outdir <scratch>/D --format esm --target node --packages external --splitting`
- D2: `$R/node_modules/.bin/tsc -p tsconfig.json --emitDeclarationOnly --outDir <scratch>/D-dts`
- Trial only, not timed: C with `dts.generator: "oxc"`

## dts generator outcome
- Default generator: rolldown-plugin-dts picks `tsgo` when TypeScript 7 is installed ("Emit types with typescript@7.0.2"). It succeeded, with the warning "TypeScript 7.0 does not yet have a stable API and is experimental".
- `generator: "tsgo"` pointed at the Effect-fork binary (Cfx) is also accepted and succeeds. The fork is not a problem.
- The plugin runs tsgo as `--noEmit false --declaration --emitDeclarationOnly -p <tsconfig> --outDir <tmp> --rootDir <root> --noCheck [--declarationMap]`. **`--noCheck`: C and Cfx do not type-check.** A, B and D2 run a full type-check, so C needs an extra `tsgo --noEmit` pass to match them.
- `generator: "oxc"` (isolatedDeclarations) **fails**: `Build failed with 93 errors`. The first ones printed: `TS9010: Variable must have an explicit type annotation with --isolatedDeclarations` (for example `src/URL.ts:50` `export const URLStr = NonEmptyTrimmedStr.pipe(`, and `src/Float64Array.ts:44` `export const Float64Arr = S.instanceOf<...>(`) and `TS9021: Extends clause can't contain an expression with --isolatedDeclarations`. As expected for Effect schema code, where most exports are inferred `const`s and the classes are `class X extends S.Class<X>(...)`.

## Timings (wall seconds; cold tsbuildinfo; median [min..max]; RSS = median max RSS)

| Variant | Batch 1 (n=3) median [min..max] | Batch 2 (n=10) median [min..max] | max RSS |
| --- | --- | --- | --- |
| A1 tsc emit | 0.87 [0.64..0.91] | 0.66 [0.62..1.21] | ~740 MB |
| A2 babel | 0.49 [0.39..0.51] | 0.44 [0.40..1.06] | ~186 MB |
| **A total (A1+A2 per run)** | **1.38 [1.03..1.40]** | **1.14 [1.02..1.81]** | ~740 MB |
| **B tsc emit only** | **0.88 [0.71..1.21]** | **0.65 [0.59..0.75]** | ~710-740 MB |
| **C tsdown + dts (stock tsgo, --noCheck)** | **1.35 [1.20..1.84]** | **1.34 [1.22..1.51]** | ~900 MB |
| Cfx tsdown + dts (Effect-fork tsgo) | 1.25 [1.11..1.38] | 1.33 [1.26..1.85] | ~880-905 MB |
| Cjs tsdown JS only | 0.19 [0.18..0.21] | 0.23 [0.18..0.51] | ~600-615 MB |
| D1 bun build | 0.02 [0.02..0.02] | 0.02 [0.02..0.03] | ~50 MB |
| D2 tsc --emitDeclarationOnly | 0.62 [0.55..0.73] | 0.68 [0.62..1.05] | ~720 MB |
| **D total (D1+D2 per run)** | **0.64 [0.57..0.75]** | **0.70 [0.64..1.08]** | ~720 MB |

The RSS for `bun run babel` is the largest single descendant process (`ru_maxrss` semantics), not the sum.

## Artifact census

| Output | .js files | JS bytes | .d.ts | .d.ts.map | .js.map | `__PURE__` total | `FileTypeChecker.schema.js` markers |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A (tsc + babel) | 173 | 678,448 | 173 | 173 | 173 | 1,808 (`/*#__PURE__*/`) | 75 |
| B (tsc only) | 173 | 677,955 | 173 | 173 | 173 | 0 | 0 |
| C / Cfx (tsdown unbundle) | 172 (171 modules + `_virtual/_rolldown/runtime.js`) | 654,441 | 158 | 128 | 144 | 21 (all on rolldown's own `__exportAll(...)` namespace objects) | 0 |
| D (bun build --splitting) + D-dts | 185 = 92 entries + 93 hash-named `index-xxxxxxxx.js` shared chunks (**chunked, not per-module**) | 427,624 (no comments or JSDoc kept) | 173 (from D2) | 173 | 0 (no `--sourcemap` passed) | 0 | n/a (module merged into chunks; 0 markers in the chunk) |

Notes on the outputs:
- tsdown unbundle does not mirror `src` 1:1. `Color/Color.js` and `HttpHeaders/HttpHeaders.schema.js` disappear (inlined or merged). `export * as X` namespace re-exports become runtime `X_exports = __exportAll({...})` objects plus a shared rolldown runtime file. 15 fewer `.d.ts` files, and maps are missing for some modules.
- Neither oxc (rolldown) nor Bun adds call-site purity annotations. **Dropping Babel's annotate-pure-calls loses 1,808 `#__PURE__` markers** (114 of 173 files carry at least one), with or without a bundler. Whatever replaces Babel has to keep that pass, or show consumers do not need it (rolldown/Bun tree-shaking of `S.*` calls at top level).

## Verdict
- **Bun plus declaration-only emit (D) is faster than A in both batches; against the plain-emit baseline B the result is mixed (batch 1: D 0.64 s vs B 0.88 s; batch 2: B 0.65 s vs D 0.70 s), so B and D are within noise. tsdown (C/Cfx) is slower than B in both batches.** effect-tsgo emit alone (B) takes about 0.65-0.9 s cold with a full type-check.
- The only real saving in A is **removing Babel (~0.45 s, ~35-40% of A)**. B and D both capture it. D gains nothing meaningful over B: `bun build` costs 0.02 s, but the declaration-only tsc pass costs as much as a full emit (0.62-0.68 s vs 0.65-0.88 s), because type-checking dominates and emitting JS is nearly free. D also gives chunked output with no maps.
- **tsdown (C/Cfx) is slower than B** (1.33 s vs 0.65 s median in batch 2, ~2x) and about equal to A, while **skipping type-checking** (`--noCheck`). Add the required check pass and it would be the slowest variant. Its rolldown JS stage alone (0.2 s) is fast, but the dts plugin (a tsgo dts emit plus bundling the declarations) costs more than tsc's whole check-and-emit. It also uses ~20% more RSS and changes the module and namespace shape.
- Conclusion for the packet: the claim holds on this machine. A bundler buys no wall-clock win over effect-tsgo emit. The worthwhile lever is the Babel step, and only if the `#__PURE__` annotations are kept some other way (or shown to be unnecessary).

## Caveats
- The absolute times are tiny (~1 s), and `/usr/bin/time` resolves to 10 ms. Background load (load1 14-37 on 64 threads, other sessions active) adds outliers of about 0.3-0.5 s. That is why batch 2 (n=10) was added. The medians agree across batches within about 0.2 s, and the ordering B ≈ D < A ≈ C holds in both.
- "Cold" means no tsbuildinfo and no `dist`. The OS file cache, node's compile cache and the referenced projects' built `dist` (`@beep/identity`, `@beep/utils`, `@beep/data`, test-kit) were warm. Incremental (warm-tsbuildinfo) builds were not measured.
- A1/B call the tsc binary directly. `beep:build` runs it through `bun run` (adds tens of ms). A2 goes through `bun run babel`, as the script does.
- C's entry list includes `src/internal/test/Markdown.test-kit.ts` because the package exports it. The comparison is like for like, since tsc emits the whole `src` anyway.
- The rolldown-plugin-dts tsgo generator writes the package's composite tsbuildinfo (`node_modules/.tmp/tsconfig.tsbuildinfo`) as a side effect. The driver cleared it before every run.
- `beep-heavy` must be called as `/usr/bin/bash ~/.local/bin/beep-heavy <cmd>` (no `--` separator: it would be exec'd as the command). Inside the repo's Nix devshell, `env bash` resolves to a Nix bash without `compgen`, so the env forwarding fails ("compgen: command not found").

## Cleanup
- The final step was the canonical `bun run beep:build` (through beep-heavy) after clearing `dist` and the tsbuildinfo. Result: 173 `.js` in `dist`, 114 files with `#__PURE__`, fresh tsbuildinfo. `git status` is clean. Nothing was committed.
- The disposable probe stays at `~/.cache/beep/tsdown-probe/`. Outputs (26 MB) are in `schema-timings/out/`.
