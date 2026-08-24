# Lane G1 — Effect community & upstream guidance: barrel vs per-module imports

**Research question:** Is the premise `import { Effect } from "effect"` is less optimal than `import * as Effect from "effect/Effect"` actually true for Effect — especially Effect v4 (the effect-smol codebase) — and under what conditions?

**Lane:** web / X research only. No repository exploration.
**Report started:** 2026-08-23
**Status:** complete (web/X lane, 2026-08-23)

---

## Method

- Official Effect docs/website (v3 and v4 era) for import-style and tree-shaking guidance.
- npm packaging of `effect` (barrel, `exports` map, `sideEffects`, pure annotations) and what that implies for named barrel imports under esbuild, Rollup/Vite, webpack, Rspack.
- Core-team statements (Michael Arnaldi, Tim Smart, Mattia Manzati, Giulio Canti, others) on X / GitHub / Discord.
- Community measurements with numbers (bundle bytes, tsserver ms, typecheck deltas).
- What the Effect repo itself models in docs/examples/internal imports.
- Honest verdict: where the premise is strong, where bundlers already solved it, and what that means for a repo with bundled frontends *and* unbundled Node/bun servers and tests.

Citations use URL + access/publish date. X posts include author + date.

---

## 1. Official Effect docs / website guidance (v3 and v4)

**Headline:** Official docs teach `import { Effect } from "effect"` as the default for *users*, document `import * as Effect from "effect/Effect"` as an equivalent namespace form, and explicitly warn that **named barrel imports can fail to tree-shake on bundlers that lack “deep scope analysis.”** They name Rollup and Webpack 5+ as safe; they do **not** name esbuild, Vite, or Rspack. That warning is unchanged from v3 docs into v4 docs.

### 1.1 Default documented style is the named barrel

Both the v3 and v4 “Importing Effect” pages open with the named import from the package root:

```ts
import { Effect } from "effect"
```

Then they show the per-module namespace form as an alternative:

```ts
import * as Effect from "effect/Effect"
```

- v3: https://www.effect.website/docs/v3/getting-started/importing-effect (accessed 2026-08-23)
- v4: https://www.effect.website/docs/v4/getting-started/importing-effect (accessed 2026-08-23)

Schema docs do the same pairing: namespace from `effect/Schema` *and* named from `"effect"`, then the running examples use `import { Schema } from "effect"`.

- https://www.effect.website/docs/v3/schema/getting-started (accessed 2026-08-23)

Getting-started examples across Creating Effects, Fibers, Runtime, etc. overwhelmingly use `import { Effect } from "effect"` / `import { Effect, Fiber } from "effect"`. The docs-site default for **application authors** is the barrel.

### 1.2 The tree-shaking caveat is official, not folklore

The same Importing Effect page (v3 *and* v4, same wording):

> Named imports may generate tree shaking issues when a bundler doesn’t support deep scope analysis.
>
> Here are some bundlers that support deep scope analysis and thus don’t have issues with named imports:
>
> - Rollup
> - Webpack 5+

That is the core-team-authored statement of the premise. It is **not** “named barrel imports always bloat production bundles.” It is “named barrel imports need a bundler that can see through re-exports.”

A second, orthogonal tree-shaking claim on the same page: Effect APIs are **functions, not methods**, so unused functions can be dropped. That is about `Effect.map` vs `effect.map()`, not about barrel vs `effect/Effect`.

### 1.3 v4 packaging/docs do not retract the caveat

v4 docs keep the identical Rollup / Webpack 5+ list. They still do not claim that v4 packaging made named barrels free for every bundler.

What v4 *does* claim, separately, is that **module implementations got smaller**:

> Effect has always been tree-shakable, and in v4, many core modules have been rewritten from the ground up to be smaller and more efficient. A minimal program using Effect, Stream, and Schema drops from roughly **70 kB in v3 to about 20 kB in v4**.

- Maxwell Brown, *Effect v4 Beta*, 2026-02-18: https://www.effect.website/blog/releases/effect/40-beta

That 70→20 kB number is about rewritten modules, not about changing import style. It also asserts Effect “has always been tree-shakable” — i.e. the *library* is marked for shaking; whether a given *import form* actually shakes still depends on the bundler (the Importing Effect page).

v4’s other packaging story is consolidation: `@effect/platform`, `@effect/rpc`, `@effect/cluster`, etc. now live under `effect` / `effect/unstable/*`. That **increases** what a root barrel *could* pull in if a bundler or runtime follows every re-export. Unstable modules are on explicit subpaths (`effect/unstable/http`, …) and are not the same as `import { Effect } from "effect"`, but they do enlarge the package surface TypeScript and Vite pre-bundling see.

### 1.4 What official docs do *not* say

- They do not tell application authors to prefer `import * as Effect from "effect/Effect"`.
- They do not mention tsserver memory, Vite cold start, or Node ESM graph size.
- They do not list esbuild. That omission matters: Vite’s production bundler was historically esbuild (now Rolldown/Rollup depending on version), Vite’s *dev* pre-bundle is still esbuild-class, and many libraries are consumed via esbuild (Cloudflare workers, tsx, bun build).

**Docs-lane takeaway:** the premise is **officially true for tree-shaking on bundlers without deep scope analysis**. It is **not** the documented default for user code. The documented default is the named barrel, with a bundler caveat.

---

## 2. Packaging reality: barrels, `exports`, `sideEffects`, pure annotations

**Headline:** Both v3 and v4 publish a giant root barrel of `export * as Module from "./Module.js"`, mark the package `sideEffects: []`, annotate calls with `#__PURE__`, and expose per-module subpaths (`effect/Effect`). That combination is *designed* so a capable bundler can drop unused *modules* from `import { Effect } from "effect"`. It does **not** make named barrel imports free for TypeScript, Node ESM, Vite's esbuild pre-bundle, or esbuild-class production bundlers. The barrel's real cost is graph size and analysis, not (usually) production bytes on Rollup/Webpack 5.

### 2.1 What the published package actually is

**v3 latest (`effect@3.22.1`, npm registry, accessed 2026-08-23):**

- Dual publish: CJS (`dist/cjs`) + ESM (`dist/esm`) + DTS (`dist/dts`).
- `"sideEffects": []` (webpack/Rspack/Rollup treat empty array as “no side-effectful modules”).
- Explicit `exports` map with one entry per module (`"."`, `"./Effect"`, `"./Schema"`, …). `import { Effect } from "effect"` hits `dist/esm/index.js`; `import * as Effect from "effect/Effect"` hits `dist/esm/Effect.js`.
- Unpacked size on npm: **~27 MB / 2715 files** (mostly `.d.ts` + maps). That is the TypeScript surface, not the runtime.

**v4 RC (`effect@4.0.0-rc.111`, jsDelivr, accessed 2026-08-23):**

- ESM-only (`"type": "module"`). Published `exports["."]` is `./dist/index.js`; `"./*"` is `./dist/*.js`.
- `"sideEffects": []` in both source `package.json` and the published package.
- Source (effect-smol era and current `Effect-TS/effect` main) also lists `"sideEffects": []`.
- Build still runs Babel `annotate-pure-calls` (`pnpm babel` / `build-annotate`) so intra-package calls get `#__PURE__`.
- Unstable modules live on **explicit subpaths** (`effect/unstable/http`, …) and are **not** re-exported from the root barrel. The root barrel is the stable stdlib only.
- `publishConfig.exports` also sets `"./index": null` and `"./*/index": null` so there is one canonical specifier per module.

v3 source `package.json` on the `v3` branch does **not** declare `sideEffects` at the workspace source; the published tarball does (`sideEffects: []`). v4 declares it in source.

Sources:

- https://github.com/Effect-TS/effect/blob/main/packages/effect/package.json (v4, accessed 2026-08-23)
- https://github.com/Effect-TS/effect/blob/v3/packages/effect/package.json (v3 source, accessed 2026-08-23)
- https://github.com/Effect-TS/effect-smol/blob/main/packages/effect/package.json (`sideEffects: []`, same exports shape)
- https://cdn.jsdelivr.net/npm/effect@4.0.0-rc.111/package.json
- https://registry.npmjs.org/effect/latest (3.22.1)

### 2.2 The barrel shape is namespace re-exports, not `export *`

v4 published `dist/index.js` (and source `packages/effect/src/index.ts`, marked `@barrel: Auto-generated`) is:

```js
export { absurd, cast, flow, hole, identity, pipe } from "./Function.js"
export * as Array from "./Array.js"
export * as Effect from "./Effect.js"
export * as Schema from "./Schema.js"
// … ~140 stable modules
```

That is **exactly** the pattern esbuild documents as hard: a *re-exported namespace*. Direct `import * as Effect from "effect/Effect"` is the pattern esbuild *can* shake; `import { Effect } from "effect"` goes through one extra re-export hop.

v3 `packages/effect/src/index.ts` is the same `export * as X from "./X.js"` shape, with more modules (STM, Micro, test helpers, …).

- https://cdn.jsdelivr.net/npm/effect@4.0.0-rc.111/dist/index.js (accessed 2026-08-23)
- https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/src/index.ts
- https://raw.githubusercontent.com/Effect-TS/effect/v3/packages/effect/src/index.ts

### 2.3 What that means per tool

| Tool | Named barrel `import { Effect } from "effect"` | Per-module `import * as Effect from "effect/Effect"` |
| --- | --- | --- |
| **Rollup / Vite production (historical Rollup; Rolldown with lazy-barrel)** | With `sideEffects: []`, unused *module* re-exports are droppable. Official Effect docs list Rollup as “deep scope analysis.” | Direct; smaller analysis graph. Final bytes similar if shaking works. |
| **Webpack 5+** | Same: `sideEffects` + usedExports. Docs list Webpack 5+. | Direct. |
| **Rspack** | Lazy barrel (stable, on by default) skips unused re-exports in side-effect-free barrels, including `export * as ns from './module'`. Effect's `sideEffects: []` is the required marker. | Direct; lazy-barrel is unnecessary. |
| **esbuild / Bun bundler / Vite *dev* pre-bundle** | Known gap: re-exported namespaces become `__export({...})` objects; unused siblings of the used namespace, and unused members *inside* the namespace, often survive. Evan Wallace (esbuild): tree-shaking of `import *` works, but **not through a re-export hop** (webpack 4 also lacked this; webpack 5 added it). | Avoids the hop. This is why Arnaldi says “lib land” uses `effect/Effect` “primarily [for] esbuild users.” |
| **Node / bun *runtime* (no bundler)** | **No tree-shaking exists.** `export * as X from "./X.js"` is a static dependency of the barrel. `import { Effect } from "effect"` instantiates **every** module the barrel re-exports (Schema, Stream, STM/Tx*, Match, …), then their dependency graphs. | Instantiates `Effect.js` and *its* imports only (still large — Effect is the runtime — but not Schema/Stream/etc.). |
| **TypeScript / tsserver** | `effect/index.d.ts` re-exports every public module. One named import from `"effect"` pulls the whole declaration graph into the program for that file. | Loads `effect/Effect.d.ts` + what Effect itself imports. |
| **Next.js** | `effect` and `@effect/*` are on the **default** `optimizePackageImports` list (since 2024-05-16, PR #65465). The compiler rewrites named barrel imports to direct modules *before* webpack/turbopack pay the graph cost. Vite/plain Node do **not** get this rewrite. | Already direct; rewrite is a no-op. |

esbuild citations:

- https://github.com/evanw/esbuild/issues/1420 (opened 2021-07-04, still Open as of this research; label `suboptimal-output`). Evan Wallace: “Tree shaking is supported with `import * as x` but not when `x` is then re-exported and re-imported. Imports are only tracked through one level… This is a fairly advanced optimization; it was only added in Webpack 5.”
- https://github.com/evanw/esbuild/issues/3278 (2023-07-30): bundling `export * as array from "./array.ts"` emits `__export` and kills shaking for consumers.
- https://github.com/evanw/esbuild/issues/2193 (2022-04-19): same pattern as Effect's barrel.

Rspack lazy barrel (supports `export * as`, requires `sideEffects: false` / `[]`):

- https://rspack.rs/guide/optimization/lazy-barrel (accessed 2026-08-23)

Rolldown (Vite 8 path) has the same lazy-barrel idea:

- https://rolldown.rs/in-depth/lazy-barrel-optimization (accessed 2026-08-23)

Vite specifically: **dev** pre-bundles `node_modules` with esbuild into `node_modules/.vite/deps`. A named import from `"effect"` is one optimization-boundary package; esbuild then inlines the barrel. That is the cold-start / “Outdated Optimize Dep” surface. **Production** Vite historically used Rollup (now Rolldown), which is the “deep scope analysis” case the Effect docs bless.

Next.js default list (docs last updated 2025-12-19):

- https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports
- Added in https://github.com/vercel/next.js/pull/65465 (merged 2024-05-16). Datner: “This is usually tree-shaken but in nextjs we must declare it to be optimized to behave this way.” Related Effect issue: https://github.com/Effect-TS/effect/issues/2701 (steida, 2024-05-05; Arnaldi later mentioned the Next PR).

### 2.4 Pure annotations vs the barrel question

Two different shaking problems get mixed:

1. **Unused sibling modules** (`Schema` when you only imported `Effect`) — solved by `sideEffects: []` + a bundler that understands unused re-exports, *or* by not going through the barrel.
2. **Unused functions inside a used module**, and **top-level calls in *your* code** (`export const bar = Schema.Struct({})` in a file that also exports an unused-by-entry `foo`) — needs `#__PURE__` / `#__NO_SIDE_EFFECTS__` on those constructors.

Effect already runs `babel-plugin-annotate-pure-calls` so *internal* calls are `#__PURE__`. It does **not** mark `Schema.Struct` itself `#__NO_SIDE_EFFECTS__`. phibr0 opened https://github.com/Effect-TS/effect/issues/5967 (2026-01-08, closed as not planned, v3 label): bundling a file that imports Schema only for an unused export still kept Schema, because `Schema.Struct()` is not proven side-effect-free (it throws on bad input). That is orthogonal to barrel vs `effect/Effect`. Per-module imports do not fix “I constructed a Schema at module top-level in a file the bundler cannot prove is unused.”

Mattia Manzati (2026-07-29, Effect-TS/tsgo#471): **class static Layer members cannot be tree-shaken at all** — a bundler cannot delete a static property without changing the class's observable shape. That is a third, stronger failure mode than barrels. Import style does not save you if a Tag class carries `.Default` / mock layers.

### 2.5 Where the barrel actually costs

Ranked, for Effect specifically:

1. **Unbundled Node/bun servers and tests** — full barrel evaluation. No bundler, no `sideEffects`, no lazy barrel. This is the strongest runtime argument.
2. **tsserver / `tsc` memory and time** — `index.d.ts` is the public surface. Language-service even has `importFromBarrel` (off by default) and `namespaceImportPackages` to steer the other way.
3. **Vite/esbuild *dev* pre-bundle and HMR graph**; Next.js *without* the default optimize (or non-Next bundlers that still use esbuild).
4. **Production bytes on esbuild/Bun.build/some serverless “bundle the server” pipelines.**
5. **Production bytes on Rollup / Webpack 5 / Rspack / Rolldown** — *weak*, if `sideEffects: []` is honored. You still pay analysis/compile time to walk the barrel (Vercel: shaking the barrel is slower than rewriting imports).

---

## 3. Core-team statements (X / GitHub / tooling)

**Headline:** The core team runs a **split policy**. Library authors (and the Effect repo itself) must use `import * as Effect from "effect/Effect"`. Application authors “should use bundlers that can tree-shake `import { Effect } from "effect"`.” Docs teach the app style. Tooling exists to enforce the lib style.

### 3.1 Michael Arnaldi — the split, in his own words

**User code vs lib code** — 2025-04-30, reply to Mattia Manzati:

> that's really for lib code, user code should use bundlers that can tree-shake `import { Effect } from "effect"`

- https://x.com/MichaelArnaldi/status/1917588446522048748
- Parent: Mattia describing the auto-fixable eslint rule that rewrites `import { Data } from "effect"` → `import * as Data from "effect/Data"` (https://github.com/Effect-TS/eslint-plugin/blob/main/test/no-import-from-barrel-package.test.ts). Tomas Zaluckij replied that he still consumes the lib with the named barrel in user code.

**esbuild + lib land** — 2025-07-11, thread with Sam Goodwin (itty-aws):

> I would never use `esbuild` to tree-shake, it's the worst of all. Give rsbuild a spin (or even rollup+terser)
>
> Also in lib code you should avoid imports like [named barrel in itty-aws] due to primarly esbuild users, it won't be able to tree-shake anything. In lib land we use `import * as Effect from "effect/Effect"`

- https://x.com/MichaelArnaldi/status/1943700397350170863
- https://x.com/MichaelArnaldi/status/1943700660907589698 (2025-07-11)

That is the most precise official-adjacent statement of the premise: **true for libraries whose consumers may bundle with esbuild; not the recommended user-app default.**

**Rspack / Next.js barrel rewrite** — 2025-06-21:

> why does the rspack version use the barrel optimization? it should be able to tree-shake barrels just fine no?

- https://x.com/MichaelArnaldi/status/1936541407730352589

He treats Rspack as a “barrels should shake” bundler (consistent with lazy-barrel + `sideEffects: []`). The Next.js rewrite exists because webpack *dev* / module-graph *time* is the pain, not because Rspack cannot shake.

Same day, on Next.js aliasing when Effect is duplicated:

> basically this only materialize when you have a dupe of Effect (or any lib in the barrel optimization path of next.js build system)

- https://x.com/MichaelArnaldi/status/1936521909438402643

He closed Effect-TS/effect#2701 after Next.js merged the default optimize list (mentioned 2024-05-23 on that issue).

### 3.2 Mattia Manzati — enforce per-module in tooling

- 2025-04-30: the eslint rule exists *because* named barrels are the thing to rewrite in the Effect ecosystem. https://x.com/MattiaManzati/status/1917582137751982427
- Effect language service diagnostic `importFromBarrel` (off by default, autofixable): “Suggests importing from specific module paths instead of barrel exports.” v3 and v4. https://github.com/Effect-TS/language-service (README, accessed 2026-08-23)
- Plugin options (same README):
  - `namespaceImportPackages: ["effect", "@effect/*"]` — completions prefer `import * as Effect from "effect"` / `"effect/Effect"` style.
  - `topLevelNamedReexports: "follow"` rewrites `{ pipe } from "effect"` → `{ pipe } from "effect/Function"`.
  - `barrelImportPackages` is the *opposite* knob (prefer the barrel) — default empty.

### 3.3 What the Effect *repo* configures (team dogfooding)

`tsconfig.base.json` on `Effect-TS/effect` main (accessed 2026-08-23):

```json
"plugins": [{
  "name": "@effect/language-service",
  "namespaceImportPackages": ["effect", "@effect/*"]
}]
```

https://raw.githubusercontent.com/Effect-TS/effect/main/tsconfig.base.json

effect-smol oxlint config (archived repo, still the v4-era law):

```json
"effect/no-import-from-barrel-package": ["error", {
  "checkPatterns": ["^effect$", "…", "^@effect/[^/]+$"]
}]
```

https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/tools/oxc/oxlintrc.json

`@effect/eslint-plugin` rule `no-import-from-barrel-package`:

- Invalid: `import { Effect } from "effect"` → autofix `import * as Effect from "effect/Effect"`
- Valid: `import * as T from "effect/Effect"`, and **type-only** `import type { Effect } from "effect"` (types don't execute the barrel at runtime)

https://github.com/Effect-TS/eslint-plugin/blob/main/src/rules/no-import-from-barrel-package.ts
https://github.com/Effect-TS/eslint-plugin/blob/main/test/no-import-from-barrel-package.test.ts

Giulio Canti / Tim Smart: no X hits in this lane on barrel vs per-module. Tim's relevant published work is packaging (`preserveModules`, dual CJS/ESM in v3, codegen of the barrel), not a public “named imports are fine” thread.

### 3.4 Discord (secondary)

Older AnswerOverflow threads (2023) asked for a style guide and whether to import types from the barrel. The later, binding answer is the language-service + eslint rule + Arnaldi tweets above, not a Discord FAQ. Public Discord search is incomplete from this lane; treat X/GitHub/tooling as the record.

---

## 4. Community measurements (numbers)

**Headline:** Almost nobody published a clean A/B of `import { Effect } from "effect"` vs `import * as Effect from "effect/Effect"` in **production gzip bytes**. The measurements that exist are about **module-graph time**, **dev boot**, **tests**, and **tsserver** — and they are large. Effect-specific production-byte claims are v3→v4 *implementation* shrinkage (70 kB → 20 kB), not import-style shrinkage.

### 4.1 Effect-specific

| Claim | Number | What it actually measured | Source |
| --- | --- | --- | --- |
| v4 vs v3 min program (Effect+Stream+Schema) | **~70 kB → ~20 kB** | Rewritten modules, not import style. Assumes tree-shaking already works. | Maxwell Brown, Effect v4 Beta, 2026-02-18, https://www.effect.website/blog/releases/effect/40-beta |
| Next.js treats Effect as a barrel that needs compiler rewrite | (qualitative) | `effect` + `@effect/*` added to default `optimizePackageImports` because named+namespace mix is “usually tree-shaken” elsewhere but not in Next without the flag | Datner, vercel/next.js#65465, 2024-05-07 / merged 2024-05-16; Effect-TS/effect#2701 |
| Schema top-level ctor not shaken | “large bundle still including the Schema definition” | `Schema.Struct({})` in an unused export; `#__PURE__` on callees isn't enough | phibr0, Effect-TS/effect#5967, 2026-01-08; repro https://github.com/phibr0/effect-treeshaking |

No public gist in this lane showed “named barrel = N kB, per-module = M kB” for Effect on Rollup. Absence is informative: if production bytes were the scandal, someone on Discord would have posted the two `esbuild`/`rollup` outputs.

### 4.2 Same pattern, different library (Zod — esbuild-class bundlers)

Michael Hart (Cloudflare), 2025-10-06:

> `import * as z from "zod"` → **68 kb**
> `import { z } from "zod"` → **244 kb**
> (Lambda / Vercel / CF Workers, with a bundler)

https://x.com/hichaelmart/status/1975328481669226946 (2025-10-06); Colin’s reply https://x.com/colinhacks/status/1975609105596490154 (2025-10-07)

Colin (Zod) reply: Bun's bundler is an esbuild port; esbuild lacks “deep tracking” needed to shake `import { z }`. “any decent modern bundler would not have this problem.” He changed Zod docs to `import *` because of that class of bundler.

This is the **closest numerical analogue** to Effect's `import { Effect } from "effect"` vs `import * as Effect from "effect/Effect"`: same namespace-re-export / named-import-from-barrel failure on esbuild. Effect's own docs named the same gap without giving bytes.

### 4.3 Barrel-file graph costs (not Effect, but the mechanism)

| Source | Date | Numbers |
| --- | --- | --- |
| Shu Ding / Vercel, “How we optimized package imports in Next.js” https://vercel.com/blog/how-we-optimized-package-imports-in-next-js | 2023-10-13 | Importing popular React barrels: **200–800 ms**. `next build` **~28% faster** after rewrite. Node server start **~10% faster**. Serverless cold start **up to 40%** (with other 13.5 work). Per-lib module counts: `@material-ui/icons` 11738 → 632 modules, 10.2s → 2.9s; `lucide-react` 1583 → 333, 5.8s → 3.0s. Recursive 10k-module barrel: compile **~30s → ~7s**. |
| Dominik Dorfmeister (TkDodo), “Please Stop Using Barrel Files” https://tkdodo.eu/blog/please-stop-using-barrel-files | 2024-07-26 | Next.js pages loading **>11k modules, 5–10 s** startup; after deleting *internal* barrels, **~3.5k modules (−68%)**. Runtime: “If we `import { useTabState } from '@/tab'`, JavaScript will traverse the index and load every module, synchronously.” |
| Marvin Hagemeister, “The barrel file debacle” https://marvinh.dev/blog/speeding-up-javascript-ecosystem-part-7 | 2023-10-08 | Empty-module load cost on M1 Air: 500 → 0.15s, 1k → 0.31s, 10k → 3.12s, 25k → 16.81s, 50k → 48.44s. Jest-style 100 files × 4-wide: 10k modules ≈ **1m18s overhead** *before tests run*. “If constructing the module graph takes 6s and you have 100 test files, you waste 10 minutes.” |
| Atlassian, “75% Faster Builds by Removing Barrel Files” https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files | 2025-06-26 | TS hover “upwards of **2 minutes**” before. After: TS highlighting **>30% faster**; local unit tests **~50% faster** (some packages **10×**); typical build tests 1600 → 200 (**−88%**), runtime **−73%**; overall build minutes **−75%**. Bundle *size* only “a slight drop (though we were hoping for more)” — **time and tests**, not bytes. |

Takeaway that maps onto Effect: **expect tsserver, vitest, bun test, and unbundled server boot to move**; do **not** expect a Rollup frontend's gzip to collapse unless you were on an esbuild-class bundler.

### 4.4 What is *not* measured publicly

- tsserver ms for a beep-sized monorepo switching only Effect import style.
- Vite `optimizeDeps` cold start with `effect` as a single pre-bundle vs many `effect/Effect` deep imports (deep imports can *increase* Vite pre-bundle cache fragmentation — a counter-cost).
- Node ESM `time node app.js` with barrel vs per-module for a realistic Effect server.

Those are the experiments a migration should run locally; the literature predicts the *sign* of the effect, not the magnitude for this repo.

---

## 5. What the Effect repo and its docs/examples model

**Headline:** Two audiences, two styles, both first-party.

| Surface | Style | Why |
| --- | --- | --- |
| **effect.website docs (v3 and v4)** | `import { Effect } from "effect"` as the taught default; namespace form shown as the tree-shake-safe alternative | User/app onboarding |
| **JSDoc examples in v4 source** | Mix: `import { BigInt } from "effect"`, `import type { Struct } from "effect"` | Matches docs; type-only from barrel is eslint-legal |
| **v4 migration snippets** | `import { Effect, Option } from "effect"` | User-facing |
| **`@effect/vitest` README** | `import { Effect } from "effect"` | User-facing |
| **effect-smol / v4 LLMS.md agent guide** | `import { Effect, Schema } from "effect"` | Teaching agents the *user* style |
| **Library implementation (`packages/effect/src/*.ts`)** | Relative namespace: `import * as Option from "./Option.ts"` — never the package barrel | Avoid cycles + match lib-land rule |
| **Repo tsconfig + oxlint + eslint-plugin** | **Forbid** `import { Effect } from "effect"` in first-party code; rewrite to `effect/Effect` | Lib-land, dogfooded |
| **Generated `index.ts`** | `export * as Effect from "./Effect.ts"` | The convenience barrel for users |

So: **if you are writing Effect, you do not import from `"effect"`. If you are teaching Effect to app authors, you do.** A downstream app that copies the Effect *repo*'s lint is following lib policy. A downstream app that copies the *docs* is following user policy. Both are “what Effect does.”

`index.ts` barrels are generated (`pnpm codegen`); `.agents/AGENTS.md` says do not hand-edit them.

---

## 6. Honest verdict

### Where the premise is STRONG

1. **Unbundled Node / bun servers and tests.** There is no tree-shaker. `import { Effect } from "effect"` evaluates the entire stable stdlib barrel (v4: ~140 `export * as` targets, including Schema, Stream, Graph, Optic, all Tx*, …). `import * as Effect from "effect/Effect"` evaluates Effect + *its* internal graph only. TkDodo, Marvin, and Vercel all measure this as **module-graph time**, which is exactly what `bun test` / `vitest` / a long-running Node server pay on every process start. **This is the best reason for a repo that has unbundled servers and tests to migrate.**

2. **TypeScript language service and `tsc`.** One named import from `"effect"` means `index.d.ts` and every re-exported module's types. Effect built `importFromBarrel`, `namespaceImportPackages`, and `no-import-from-barrel-package` for this. Atlassian saw **>30%** highlighting and **minutes → usable** hover after de-barrelling a large app (their barrels were *internal*, but the mechanism is the same: TS must load every re-export).

3. **esbuild-class bundlers** (esbuild itself, Bun.build, Vite *dev* pre-bundle, many Cloudflare/Lambda “bundle with esbuild” pipelines). Official Effect docs omit esbuild from the “safe” list. Arnaldi: esbuild “won't be able to tree-shake anything” through the named barrel; “in lib land we use `effect/Effect`.” esbuild#1420 is still open. Zod measured **244 kb vs 68 kb** on the analogous pattern.

4. **Library packages you publish** that re-export or depend on Effect and will be consumed by those esbuild users. First-party Effect policy is unambiguous here.

5. **Next.js *dev/build graph*** if you were on an old Next without the default list. Today Next rewrites `effect` for you (since 2024-05-16), so this is **already mitigated on current Next**, not a reason to rewrite imports *for Next specifically*.

### Where the premise is WEAK or already solved

1. **Production frontend bytes on Rollup, Webpack 5+, Rspack, Rolldown.** Effect ships `sideEffects: []` and `#__PURE__` on internal calls. Docs explicitly bless Rollup and Webpack 5. Rspack lazy-barrel supports `export * as`. Arnaldi: user code should rely on those bundlers; he expected Rspack not to need a barrel rewrite. Atlassian's de-barrel: “slight drop in bundle size (though we were hoping for more).” **Do not sell the migration as a gzip win for a Vite/Rspack SPA.**

2. **v4 packaging did not “solve” named barrels — and did not need to, for Rollup-class tools.** v4 made *modules smaller* (70→20 kB) and moved experimental APIs off the root barrel onto `effect/unstable/*`. The root barrel is still a generated `export * as` list. The esbuild caveat is unchanged in v4 docs.

3. **Per-function shaking inside `Effect.ts` / top-level `Schema.Struct` in *your* modules / static Layer fields on classes.** Import style does not fix these. #5967 (closed not planned) and tsgo#471 are the real leftover byte leaks.

4. **Official onboarding.** Docs, playground, vitest README, and LLM guides still lead with `import { Effect } from "effect"`. A repo that forbids that will fight every copy-paste from effect.website.

5. **Vite deep-import fragmentation.** Switching a Vite app to many `effect/Effect`, `effect/Schema`, … specifiers can create **more** `optimizeDeps` entries, not fewer. Worth measuring; not automatically a cold-start win.

### Implications for a repo with bundled frontends *and* unbundled Node/bun servers and tests

Treat import style as a **runtime-graph and TS-graph** change, not a production-SPA-byte change.

| Target | Recommendation | Why |
| --- | --- | --- |
| **Unbundled bun/Node servers, `bun test`, vitest without deps optimizer** | **Migrate.** Per-module (or at least don't import `"effect"`). | Strongest, bundler-independent win. |
| **Internal `@beep/*` libraries** consumed by those servers *and* by frontends | **Migrate (lib-land).** Match Effect's own eslint rule. | Protects esbuild consumers; avoids re-exporting the barrel. |
| **Bundled SPAs (Vite+Rollup/Rolldown, Rspack)** | **Optional.** Production bytes likely unchanged. Consider it for tsserver / Vite-dev if profiling shows `effect` in the pre-bundle. Don't expect a 3× gzip drop. | Docs + Arnaldi: this is the “use a real bundler” case. |
| **Next.js app** | Already rewritten at compile time for `effect` / `@effect/*`. Import style is cosmetic for Next's compiler; still matters for `tsc` and for any route that externalizes `effect`. | Next.js default list since 2024-05. |
| **Type-only** | `import type { Effect } from "effect"` is fine (eslint plugin explicitly allows it). | No runtime graph. |

Practical split that matches upstream, not a purity crusade:

- **Law for packages and unbundled entrypoints:** `import * as Effect from "effect/Effect"` (and the same for Schema, Layer, …). Autofix exists.
- **Allowed in app UI that is fully bundled by Rollup/Rspack, if you want docs-compatibility:** `import { Effect } from "effect"`, knowing you pay TS and (maybe) Vite-dev.
- **Never expect** the named-barrel rewrite to shrink a Rollup SPA the way it shrinks a Zod-on-esbuild Worker. Measure servers/tests/tsserver; treat frontend gzip as a sanity check, not the success metric.

**Bottom line:** The premise is **true, but for the reasons people usually aren't looking at.** It is not “named imports bloat production bundles of well-configured Vite/Webpack apps.” It is “named imports from Effect's namespace-re-export barrel force the entire stdlib into the **module graph** that TypeScript, Node, bun, tests, and esbuild will actually walk.” For a mixed bundled-frontend + unbundled-server monorepo, that is a real migration, and the server/test/IDE side is where the receipts will show up.

---

## Sources (compact)

- Effect docs v3/v4 Importing Effect: https://www.effect.website/docs/v3/getting-started/importing-effect , https://www.effect.website/docs/v4/getting-started/importing-effect (accessed 2026-08-23)
- Effect v4 Beta (bundle 70→20 kB): https://www.effect.website/blog/releases/effect/40-beta (2026-02-18)
- Package manifests: npm `effect@3.22.1`; jsDelivr `effect@4.0.0-rc.111`; GitHub `Effect-TS/effect` main + v3 branch; `Effect-TS/effect-smol` packages/effect/package.json
- Published barrel: https://cdn.jsdelivr.net/npm/effect@4.0.0-rc.111/dist/index.js
- Arnaldi X: 1917588446522048748 (2025-04-30), 1943700660907589698 (2025-07-11), 1936541407730352589 (2025-06-21)
- Manzati X: 1917582137751982427 (2025-04-30); eslint-plugin tests as linked above
- Language service README: https://github.com/Effect-TS/language-service
- Next.js optimizePackageImports + PR 65465 + Effect issue 2701
- esbuild#1420, #3278, #2193
- Rspack lazy barrel; Rolldown lazy barrel
- Vercel 2023-10-13; TkDodo 2024-07-26; Marvin 2023-10-08; Atlassian 2025-06-26
- Effect-TS/effect#5967; Effect-TS/tsgo#471
- Zod analogue: Michael Hart https://x.com/hichaelmart/status/1975328481669226946 (2025-10-06); Colin https://x.com/colinhacks/status/1975609105596490154 (2025-10-07)

---


