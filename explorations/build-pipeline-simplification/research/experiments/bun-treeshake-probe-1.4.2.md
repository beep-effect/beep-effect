# Bun.build tree-shaking probe for @beep/effect-drizzle, re-run on Bun 1.4.2

Date: 2026-10-09. Packet: `explorations/build-pipeline-simplification`, experiment 1 of 2.
Repo: beep-effect2 `main` @ e62411d63f, clean before and after (`git status --short` showed 0 lines; nothing in the repo was written).
Scripts and outputs: `scratchpad/experiments/bun-probe/` (scripts named below).

## Toolchain

| Tool | Version | How |
|---|---|---|
| Bun (installed default) | 1.4.2 (rev 744846f844374847c902b5e7fd59b4342a51ef99) | `~/.local/share/mise/installs/bun/1.4.2` (`1`, `1.4` and `latest` symlink to it) |
| esbuild | 0.28.2 | `node_modules/.bin/esbuild` / `import { build } from "esbuild"` |
| rolldown | 1.2.13 | `node_modules/.bin/rolldown` / JS API |
| node | v24.20.0 | validation runtime |
| Bun bisect binaries | 1.3.9, 1.3.13, 1.4.0, 1.4.1, 1.4.2 | mise installs |

**Gotcha:** the mise dir `bun/1.3.14` holds a **1.4.0** binary (`--revision` is `1.4.0+34cbb9a40`, the same as `bun/1.4.0`). No true 1.3.14 binary is on this box. 1.3.13 and 1.4.0 both reproduce the recorded failure byte for byte (a 30-byte stub), so the 1.3.14 attribution is consistent with that range. The bisect brackets are therefore 1.3.13 (and 1.4.0) failing and 1.4.1 fixed.

## Probe config (mirrors `test/bundle-build.ts`)

- Entry: `test/bundle-pg-integer.consumer.ts`, which is `export { integer } from "@beep/effect-drizzle/pg";`.
- Externals: `effect`, `effect/*`, `drizzle-orm`, `drizzle-orm/*`.
- Aliases: `@beep/effect-drizzle{,/pg,/sqlite}` map to `src/{index,pg/index,sqlite/index}.ts`. Bun.build has no `alias` option, so the Bun runs use an `onResolve` plugin.
- Bun settings: `format: "esm"`, `target: "node"`, `sourcemap: "none"`, with `minify` set to false and to true. The shipped esbuild probe uses `minify: true`.
- `sideEffects: false` comes from the package manifest. Bun reads it from the nearest package.json, so every variant inherits it, the alias variant included. The `bun-workspace-*` variant skips the plugin and resolves through workspace `exports` instead. The `ignoreDCEAnnotations: true` variant turns off pure and sideEffects DCE.
- The original 1.3.14-era Bun config came from commit 6eb1f37024 (`import-boundary.test.ts` "bundle isolation"): `Bun.build({ entrypoints:[consumer], format:"esm", minify:true, target:"bun" })`, with **no externals and no alias**. It is reproduced as `orig-*`.

Scripts: `build-bun.ts` (Bun), `build-controls.mjs` (esbuild + rolldown), `build-original.ts`, `build-entries-*.{ts,mjs}` (full barrels), `validate*.mjs`, `diff-exports.mjs`, `bisect.ts`.
Outputs import externals through the symlink `bun-probe/node_modules -> <repo>/node_modules`.

Validation for each output:
- import it under node 24.20.0 and under bun 1.4.2;
- list `Object.keys`;
- call `integer()` as a smoke test, which returns a function;
- parse the `export {}` clause and check that each local name has a declaration.

The declaration check uses a regex. It is reliable only on non-minified output: its "undeclared" hits on minified output are false positives from comma `var` lists, for example `Yr={id:"@beep...` is declared. A dropped binding in an export clause is a link-time `SyntaxError` in node, so a successful import is the authoritative check.

## Results on Bun 1.4.2: consumer entry (`out/`)

| Output | Bytes | node import | bun import | Exports |
|---|---:|---|---|---|
| bun-alias-nominify | 14641 | OK | OK | `[integer]` (`integer2 as integer`) |
| bun-workspace-nominify | 14641 | OK | OK | `[integer]` |
| bun-alias-minify | 8187 | OK | OK | `[integer]` (`Re as integer`) |
| bun-alias-ignoreDCE-nominify | 94643 | OK | OK | `[integer]` |
| esbuild-nominify | 14945 | OK | OK | `[integer]` |
| esbuild-minify (the shipped probe's config) | 8173 | OK | OK | `[integer]` (`Le as integer`) |
| rolldown-nominify | 12950 | OK | OK | `[integer]` |
| rolldown-minify | 3478 | OK | OK | `[integer]` (`L as integer`) |

- `integer()` returns a function in all 8 outputs on both runtimes.
- The non-minified outputs have no undeclared exports.
- Export-set diff: all 8 outputs share 1 distinct set, `{integer}`.
- The Bun minified output (8187 B) is within 14 B of esbuild's (8173 B).
- Side note on the committed baseline: it says 8285 B with esbuild 0.28.2, and esbuild-minify now gives 8173 (-112 B). That is drift from source or deps since the baseline was recorded, not a bundler effect.
- Side note on the probe floor: rolldown-minify (3478 B) is **below** the probe's `minimumBundleRawBytes = 4096` floor, yet it is a valid, working module. If the probe ever switches engine to rolldown, that floor would raise a false "collapse".

Original 1.3.14-era config (`out-original/`, Bun 1.4.2):
- `orig-target-bun-minify`: 93542 B.
- `orig-target-bun-nominify`: 202067 B.
- `orig-target-node-minify`: 93534 B.

All three import OK under node and bun with 1 key, `integer`. All three of the original absence assertions hold (no "Custom-column identity must agree", no "Timestamp identity must agree", no "timestamp_ms"), and `integer` is present. These are real bundles; effect and drizzle are inlined because the original config has no externals.

## Wider check: full public barrels (`out-entries/`, 3 bundlers × {nominify, minify})

| Barrel | Bun nomin / min | esbuild nomin / min | rolldown nomin / min | Exports, all 6 outputs |
|---|---|---|---|---|
| root `src/index.ts` | 171557 / 92205 | 181833 / 90940 | 217376 / 82937 | 11, 1 distinct set |
| pg `src/pg/index.ts` | 116046 / 62384 | 122814 / 61490 | 149557 / 56823 | 44, 1 distinct set |
| sqlite `src/sqlite/index.ts` | 84826 / 46292 | 90307 / 45653 | 107410 / 41728 | 34, 1 distinct set |

All 18 outputs import OK under both node and bun, and the export-name sets are identical across bundlers for each barrel.

## Version bisect (`bisect.ts`, `bisect/<ver>/`)

| Bun | orig (target bun, min, no externals) | mirror (alias + externals, target node) | pg barrel | node import |
|---|---|---|---|---|
| 1.3.9 | 94178 B OK | 14641 B OK | 116104 B OK, 44 keys | OK |
| 1.3.13 | **30 B** `// @bun\nexport{o as integer};` | **22 B** `export {\n  integer\n};` | 53422 B, 7 bindings dropped | **SyntaxError** |
| "1.3.14" dir (actually 1.4.0) | **30 B** (same stub) | **22 B** | 53422 B | **SyntaxError** |
| 1.4.0 | **30 B** | **22 B** | 53422 B | **SyntaxError** |
| 1.4.1 | 93542 B OK | 14641 B OK | 116046 B OK | OK |
| 1.4.2 | 93542 B OK | 14641 B OK | 116046 B OK | OK |

Exact errors on the failing versions:
- node: `SyntaxError Export 'o' is not defined in module` (orig), `Export 'integer' is not defined in module` (mirror), `Export 'NumberDeclarationRepresentation2' is not defined in module` (pg).
- bun: `SyntaxError: Exported binding 'o' needs to refer to a top-level declared variable.`; for the mirror, `BuildMessage: "integer" is not declared in this file`.

Failing shape: Bun emits the export clause but drops the binding it names.
- In the pg barrel on 1.3.13 and 1.4.0, the dropped names are `toPgTable`, `schema`, `make2`, `default_2`, `Table`, `SchemaAssemblyError` and `NumberDeclarationRepresentation2`. These all come from the named `export { x } from` and namespace `export * as Table from` re-exports in `src/pg/index.ts`. The names that come in through `export * from "./combinators.ts"` mostly survive in that barrel. In the consumer graph, `integer` itself is dropped.
- A two-file micro shape (`micro-named-reexport/`) did **not** reproduce on any version. That shape is a `sideEffects:false` package whose index is `export * from "./a.ts"; export { b } from "./b.ts"`, consumed through `export { b } from "pkg"`. The trigger needs more of the real graph, so it is not minimized further. The real-graph reproducers are kept in `bisect/1.3.13/`.

## bun#18008 miniature (`repro-18008/`)

Package `barrel-pkg`:
- `package.json` sets `"sideEffects": false` and `"main": "index.mjs"`, with no `type`, so `.js` files are CJS.
- `index.mjs` is `export * from "./impl.js";`.
- `impl.js` is `module.exports = { a: 1, b: "two" };`.

`barrel-pkg-se` is identical except for `sideEffects: true`.

Consumers:
- `import {a,b}`
- `export {a,b} from`
- `export * from`
- `import * as ns`

Each consumer was built with Bun (target node and target bun), esbuild 0.28.2 and rolldown 1.2.13, then imported under node and bun.

| Consumer | Bun 1.4.2, sideEffects:false | Bun 1.4.2, sideEffects:true | esbuild (both) | rolldown (both) |
|---|---|---|---|---|
| named import | **ReferenceError: exports_barrel_pkg is not defined** (98 B) | OK `[1,"two"]` | OK | OK |
| named re-export | **ReferenceError** (120 B) | OK `{a:1,b:"two"}` | OK | OK |
| namespace import | **ReferenceError** (95 B) | OK | OK | OK |
| `export *` re-export | keys `[]` (2274 B) | keys `[]` | keys `[]` | keys `[]` |

Exact failing Bun 1.4.2 output (target node). The `__commonJS` wrapper, `require_impl` and the `exports_barrel_pkg` declaration are all dropped:

```js
var export_a = exports_barrel_pkg.a;
var export_b = exports_barrel_pkg.b;

export {
  export_a as a,
  export_b as b
};
```

The `export *`-of-CJS case yields an empty namespace in all three bundlers, which is expected static-ESM behavior and not a Bun bug.

bisect.ts `r18008-sefalse` throws the same ReferenceError on **every** version tested: 1.3.9, 1.3.13, 1.4.0, 1.4.1 and 1.4.2. It has never been fixed in this range.

## Verdicts

1. **The effect-drizzle finding is RETIRED for Bun 1.4.2, and was already fixed in 1.4.1.** Every config is valid and export-equivalent to esbuild and rolldown on 1.4.2: the original 1.3.14-era config, the esbuild-mirroring config, and all three public barrels. The over-shake regression is bracketed: absent in 1.3.9, present in 1.3.13 and 1.4.0, fixed in 1.4.1. The comment's "1.3.14" date-stamp is accurate as far as it goes; the precise statement is "Bun ≥1.3.13 <1.4.1".
2. **bun#18008 (ESM barrel `export *` over CJS + `sideEffects:false`) is CONFIRMED on 1.4.2.** Named and namespace imports compile to references to a dropped `exports_<pkg>` binding, which throws a ReferenceError at import time. It is not fixed in any installed version.
3. Implication for the packet: Bun.build is fine as a bundle oracle for this package on ≥1.4.1. The bug class (dropped binding behind an export clause under `sideEffects:false`) is still live for CJS-behind-ESM barrels, so any Bun.build-based gate still needs the presence assertion and import-validity check the reflection prescribed. `bundle-size.ts` floor-only checks are not enough: a 98-byte #18008 stub throws only at import.
4. Unchanged files: `test/bundle-build.ts` comment, `bundle-size.baseline.json`. This experiment changed no tracked files.
