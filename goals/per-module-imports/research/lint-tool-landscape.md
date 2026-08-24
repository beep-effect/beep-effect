# Lane G2 — Lint / Autofix Tool Landscape

**Scope:** ongoing lint rule banning barrel imports of `effect` and `@beep/*` foundation packages (pointing to per-module form), ideally with autofix; plus a one-shot mechanical migration of ~1800+ files.

**Incumbent stack:** Biome 2.5.6 (+ GritQL plugins) and scoped ESLint lanes. New permanent tools only on decisive advantage.

**Target import shape (this is the hard constraint):** namespace-import per module for module re-exports, e.g. `import * as Effect from "effect/Effect"`. Flat exports — the `effect/Function` combinators (`pipe`, `flow`, `identity`, `cast`) and similar — stay **named** imports from their owning module, per SPEC Decision #2. The trap this lane screens for is tools that flatten *every* binding to named-from-source (e.g. `import { runPromiseExit } from "effect/Effect"`); most barrel-elimination tools do exactly that. <!-- packet-editorial 2026-08-24: original lane text framed the target as namespace-only; corrected to match SPEC Decision #2 (review thread PRRT_kwDOPbO_N86bl35U). -->

**Researched:** 2026-08-23. Web-research lane only; no repo exploration.

**Status:** complete. Web-research lane; no repo exploration.

---

## 0. Question and constraints

The repo wants two distinct capabilities:

1. **Ongoing enforcement** — a lint (or equivalent) that fails `import { … } from "effect"` and `import { … } from "@beep/<foundation>"` barrel forms, and ideally rewrites them to per-module namespace imports.
2. **One-shot migration** — mechanically rewrite ~1800+ files. A throwaway CLI / codemod / ast-grep / jscodeshift pass is acceptable even if it is not the permanent linter.

Constraints that kill otherwise-attractive tools:

- Autofix that emits **named imports from subpaths** is the wrong transform.
- Permanent new tools need a **decisive** advantage over Biome 2.5.6 + GritQL + scoped ESLint.
- Rule must be configurable per package / path (ban `effect`, allow `effect/Effect`; ban `@beep/schema` barrel, allow `@beep/schema/Foo`).

---

## 1. Biome — `noRestrictedImports` and GritQL plugins

Sources retrieved 2026-08-23 unless noted.

### 1.1 `style/noRestrictedImports` (built-in)

Official rule page: https://biomejs.dev/linter/rules/no-restricted-imports/

| Fact | Evidence |
| --- | --- |
| First shipped | **v1.6.0** (rule page “available since”) |
| Fix | **None.** The summary line is explicit: “This rule doesn’t have a fix.” |
| Recommended | No — must be enabled. Default severity **warning**. |
| Lineage | Same as ESLint `no-restricted-imports` and `@typescript-eslint/no-restricted-imports` |
| `paths` | Exact specifiers. Value is either a diagnostic string, or `{ message, importNames?, allowImportNames? }`. `importNames` / `allowImportNames` are mutually exclusive. |
| Named-import selectors | `"someIdentifier"`, `"default"`, `"*"` (namespace), `""` (side-effect / bare import) |
| `patterns` | **Stabilized in Biome 2.2.0** (PR [#5506](https://github.com/biomejs/biome/pull/5506), changelog https://biomejs.dev/internals/changelog/version/2-2-0/). gitignore-style `group` plus `!` negations. Also `importNamePattern` (regex) and `invertImportNamePattern`. |
| Import forms covered | static `import` / re-`export`; TypeScript type-only (`import type` and inline `type`); dynamic `import()` (best-effort name recovery via await-destructure / `.then`); `require()` treated as default import |

Incumbent **Biome 2.5.6 is past 2.2.0**, so `patterns` is already available. A config that bans the barrel while allowing per-module subpaths is expressible today:

```json
{
  "linter": {
    "rules": {
      "style": {
        "noRestrictedImports": {
          "level": "error",
          "options": {
            "paths": {
              "effect": "Import from effect/<Module> (e.g. effect/Effect), not the barrel."
            }
          }
        }
      }
    }
  }
}
```

`paths` matches the exact specifier `"effect"`, not `"effect/Effect"`. That is the right shape for the *ban*. It is **not** a rewrite: Biome will not emit `import * as Effect from "effect/Effect"`.

What it cannot do without a plugin or a different tool:

- Map `import { pipe, Effect } from "effect"` onto the Effect-style **namespace-per-module** target (`import * as Effect from "effect/Effect"` plus a separate Function import, plus rewriting every `pipe(` / `Effect.` use-site).
- Accept a runtime lookup table of “this named export lives on this submodule.” Options are static JSON.

Older enhancement PRs (e.g. [#2977](https://github.com/biomejs/biome/pull/2977) `allowedFrom` / `includeAllSubmodules`, May–June 2024) are **not** in the current option surface; do not plan around them.

### 1.2 GritQL plugins — rewrite / autofix status

Official plugin docs (live 2026-08-23): https://biomejs.dev/linter/plugins/

Current shipped behavior (not roadmap):

- Plugins are **GritQL `.grit` files** listed in `biome.json` `plugins`.
- They **can** `register_diagnostic(...)` **and** suggest rewrites with the `=>` operator plus `fix_kind = "safe" | "unsafe"`.
- Apply path:
  - no `--write` → rewrite shown as a suggestion
  - `biome lint --write` → apply `fix_kind = "safe"`
  - `biome lint --write --unsafe` → also apply unsafe
  - omitted `fix_kind` defaults to **unsafe**
- File targeting via `plugins[].includes` globs.
- Languages: JavaScript (and supersets), CSS, JSON.
- Suppressions: `lint/plugin` comments.

That is a reversal of the 2.0-beta story. In June 2025 Herrington Darkholme documented the GritQL plugin as **diagnostic-only**, with `=>` rewrites “planned” ([DEV article](https://dev.to/herrington_darkholme/biomes-gritql-plugin-vs-ast-grep-your-guide-to-ast-based-code-transformation-for-jsts-devs-29j2), citing [biomejs/biome#5687](https://github.com/biomejs/biome/issues/5687)). GritQL itself was transferred to the Biome org on **2025-12-18** ([blog](https://biomejs.dev/blog/gritql-under-biome-umbrella/)). Biome **v2.4** (2026-02-10) added JSON as a GritQL target language and a profiler that times GritQL plugins ([blog](https://biomejs.dev/blog/biome-v2-4/)). Recipes: https://biomejs.dev/recipes/gritql-plugins/

**For this repo at 2.5.6: plugin rewrites are shipped.** The remaining limitations are GritQL’s, not “roadmap”:

1. **No plugin options.** A `.grit` file is a pattern, not a parameterized rule. `biome-plugin-drizzle` (npm, 2026-01-08) states this explicitly: “Unlike ESLint, Biome plugins cannot accept configuration.” One plugin per banned specifier (or a giant `or` of hardcoded packages) is the realistic shape. A 50-package `@beep/*` allow-list does not belong in GritQL.
2. **No JS/TS plugin host.** The 2024 Plugin RFC ([discussion #1762](https://github.com/biomejs/biome/discussions/1762)) still lists JS/TS plugins as unfinished. Binding-to-module mapping (`pipe` → `effect/Function`, `Effect` → `effect/Effect`) cannot be looked up from `node_modules/effect/package.json` exports inside a `.grit` file.
3. **Rewrite granularity is pattern substitution**, not a multi-statement import splitter with a symbol table. GritQL `=>` can rewrite `import { Effect } from "effect"` to `import * as Effect from "effect/Effect"` when the named list is a single known identifier. A mixed named import (`{ Effect, pipe, Schema, type Context }`) needs either many specialized patterns or a host that can explode one statement into N statements — GritQL is a poor fit for the latter.
4. **Type-only / mixed type+value / `import()`** each need their own patterns. Official plugin docs do not advertise TypeScript-aware “this specifier is type-only” helpers.

### 1.3 Official statements on import-restructuring autofix

- Built-in `noRestrictedImports`: **documented as unfixable**. No changelog entry through 2.2.0 (and none found on the current rule page) adds a fixer.
- Plugin-level import restructuring: **no official “we will autofix barrel → per-module” statement.** The shipped `=>` rewrite is a generic GritQL feature, not an import-aware fixer.
- Biome also has `noBarrelFile` (https://biomejs.dev/linter/rules/no-barrel-file/) — that bans **authoring** `export *` barrels, the opposite of this task’s consumer-side rewrite.

### 1.4 Fit for this repo

| Job | Biome 2.5.6 verdict |
| --- | --- |
| Ongoing **ban** of `"effect"` / `"@beep/foo"` barrels | **Yes, use `noRestrictedImports.paths`.** Exact-specifier ban; subpaths allowed by construction. Messages can point at the per-module form. |
| Ongoing **autofix** to `import * as X from "pkg/X"` | **No, not with the built-in.** GritQL can cover a handful of 1:1 identifier rewrites, not a catalog-driven mixed-import explode. |
| One-shot 1800-file migration | **Do not use Biome.** No mapping table, no multi-binding rewriter. |

Do **not** add a second permanent linter just to get this ban — Biome already does the diagnostic. Autofix and migration are separate vehicles (sections 2–5).

---

## 2. Oxlint (oxc.rs)

Sources retrieved 2026-08-23. Primary index: https://oxc.rs/llms.txt. Rule index: 870 rules, 320 with some kind of fixer (https://oxc.rs/docs/guide/usage/linter/rules.html).

### 2.1 `eslint/no-restricted-imports`

Docs: https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports — added **v0.15.0**. Category: Restriction. **Fixable column is empty** in the rules table (not 🛠️, not 💡, not 🚧). Same diagnostic-only posture as ESLint core.

Options are the ESLint object form, including extras oxlint documents:

- `paths` with `name` / `message` / `importNames` / `allowImportNames`
- `allowTypeImports` (type-only exemption)
- `patterns` with `group` (gitignore), `regex` (**Rust regex**, no lookahead), `caseSensitive`, `importNames`, `allowImportNames`, `importNamePattern`, `allowImportNamePattern`

It covers static imports, `export * from`, and dynamic `import("literal")`. Computed `import(bar)` is ignored.

This is **enough to ban `"effect"` while allowing `"effect/Effect"`** — same as Biome `paths`. It is **not** an import rewriter.

### 2.2 Import plugin

Native Rust plugin, **off by default**. Enable with `"plugins": ["import"]` or `--import-plugin` (https://oxc.rs/docs/guide/usage/linter/plugins.html; alpha write-up 2024-05-04 https://oxc.rs/blog/2024-05-04-import-plugin-alpha). Equivalent advertised to `eslint-plugin-import` / `eslint-plugin-import-x`.

Relevant rules, none of which do barrel→namespace:

| Rule | What it does | Fix |
| --- | --- | --- |
| `import/namespace` | `import * as foo` members must exist | none |
| `import/extensions` | file extensions | none (v1.2.0) |
| `import/consistent-type-specifier-style` | `import type` vs inline | 🛠️ |
| `oxc/no-barrel-file` | bans **authoring** files whose `export *` count exceeds a threshold (https://oxc.rs/docs/guide/usage/linter/rules/oxc/no-barrel-file.html, v0.3.0) | none |

`oxc/no-barrel-file` is the opposite job (producer-side), same family as Biome `noBarrelFile` / unicorn `no-barrel-files`.

### 2.3 `--fix` maturity

https://oxc.rs/docs/guide/usage/linter/automatic-fixes

- `--fix` — safe (behavior-preserving)
- `--fix-suggestions` — may change behavior
- `--fix-dangerously` — aggressive
- JS-plugin fixers **are** applied by those flags
- Type-aware rules can also emit fixes (`oxlint --type-aware --fix`)

The machinery is mature. The specific rule we need does not plug into it.

### 2.4 Custom rules / JS plugins

https://oxc.rs/docs/guide/usage/linter/js-plugins — **alpha, not under semver** (config-file-reference note). Blogs: preview 2025-10-09, alpha 2026-03-11 (https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html). `@oxlint/plugins` npm **1.79.0**, published 2026-08-18.

What is shipped:

- ESLint v9+ plugin API: AST walk, selectors, `context.report` **fixes**, rule options, `SourceCode`, scope, CFA, inline disable, LSP suggestions
- Load local `./plugin.js` / `./plugin.ts` (TS needs Node ≥22.18 or ^20.19 type-stripping, or Deno/Bun)
- Load npm ESLint plugins
- `oxlint-plugin-eslint` bridge for core rules oxlint has not nativized (`no-restricted-syntax`, etc.)
- **Not yet:** custom parsers (Svelte/Vue/Angular); **JS-plugin rules that need TypeScript type-awareness**

A custom JS plugin that looks up `effect` / `@beep/*` export maps and rewrites `import { Effect, pipe } from "effect"` → `import * as Effect from "effect/Effect"` **could** run under oxlint. That is a real capability Biome GritQL does not have (no plugin options, no JS host, no `package.json` lookup).

Cost: a **new permanent linter** (or a parallel oxlint lane) for a rule the incumbent Biome already diagnoses, plus an alpha plugin host. The repo constraint is “new permanent tools only on decisive advantage.” JS-plugin-with-fixer is an advantage for **autofix**, not for the ban itself.

### 2.5 Monorepo config

`.oxlintrc.json` / `oxlint.config.ts` + `defineConfig`. `extends` (JSON: path list; TS: config objects). `overrides` with `files` / `excludeFiles` / per-override `rules` / `plugins` / `jsPlugins`. `ignorePatterns`. Nested configs. Next.js-in-a-monorepo `settings.next.rootDir` example in the config reference.

Usable. Not a reason to switch.

### 2.6 Decisive advantage for *this* rule shape?

| Capability | Biome 2.5.6 | Oxlint |
| --- | --- | --- |
| Ban exact `"effect"` barrel | `noRestrictedImports.paths` | `no-restricted-imports.paths` |
| Ban with gitignore patterns | `patterns` since 2.2.0 | `patterns` + Rust `regex` |
| Built-in fixer for this rule | no | no |
| Custom fixer with a symbol→module table | GritQL: no options, no JS | JS plugins (alpha): yes |
| Type-aware custom fixer | no | JS plugins: **not yet** |
| Permanent-tool tax | already incumbent | new runtime + alpha API |

**Verdict: no decisive advantage for enforcement.** Oxlint duplicates the unfixable ban. The only oxlint-unique path is an alpha JS plugin that Biome cannot express; that plugin would also run as a scoped ESLint rule (the incumbent already has scoped ESLint lanes) without adding oxlint.

---

## 3. ESLint — core, plugins, fixability

### 3.1 `no-restricted-imports` has no fixer (confirmed)

- Docs (v10.9.0 HEAD, retrieved 2026-08-23): https://eslint.org/docs/latest/rules/no-restricted-imports — rule type **suggestion**. No 🔧 icon, no “fixable” section.
- Source `lib/rules/no-restricted-imports.js` (`main`, last touched 2026-05-07, commit `9da3c7b`): `meta` contains `type`, `docs`, `messages`, `schema`. **There is no `meta.fixable`.** Reports are diagnostics only.
- Applies to **static** imports/re-exports. ESLint core still documents “static imports only, not dynamic ones” (oxlint and Biome both go further and inspect `import()`).
- Options: strings, `{ paths, patterns }`, `importNames` / `allowImportNames`, gitignore `group` + `!` negations, `regex`, `importNamePattern` / `allowImportNamePattern`, `allowTypeImports` (TS). Namespace `import * as X from "restricted"` is banned when the path is restricted.

`@typescript-eslint/no-restricted-imports` (https://typescript-eslint.io/rules/no-restricted-imports): extension rule, **deprecated**. As of ESLint **v9.37.0** the core rule understands `import type`, inline `type`, and `import x = require(...)`. `meta.fixable` is copied from the base rule — still none. Not marked 🔧 on the typescript-eslint rules index.

So: **the core restriction rule cannot be the migration vehicle.** It is a perfectly good *ban*, which Biome already has.

### 3.2 Community plugins that actually rewrite imports

Names checked against live npm/GitHub (2026-08-23). Almost all optimize **named imports from the resolved source file**, not `import * as Mod from "pkg/Mod"`.

| Package | Last signal | What it does | Fix? | Namespace-per-module target? |
| --- | --- | --- | --- | --- |
| **`eslint-plugin-no-barrel-files`** 2.2.0 (npm, ~1 month before 2026-08-23) | healthy, ESLint 8–10, TS peer `^5.6.3 \|\| ^6` | `no-barrel-files` (ban authoring); **`prefer-source-imports`** resolves barrel re-exports (`export { Foo } from "./foo"`, aliases, `export *`, type re-exports) and rewrites consumers | **yes**, only when the whole declaration is safe | **No.** Docs: “focuses on named imports”; “**namespace imports are not the target of this rule**”. Output is `import { Foo } from './foo'`. |
| **`eslint-plugin-barrel-files`** (thepassle/eslint-plugin-barrel-files, 183★, last commit 2025-02-14) | quiet ~1 year | `avoid-barrel-files`, `avoid-importing-barrel-files`, **`avoid-namespace-import`**, `avoid-re-export-all` | diagnostic; `avoid-namespace-import` **fights** `import * as` | **Opposite** of the target. |
| **`eslint-plugin-barrel-rules`** (npm 2026-01-05) | active | **enforces** barrels as public API; `isolate-barrel-file`; **disallows namespace imports** | n/a | Opposite. |
| **`eslint-plugin-barrel-boundary`** 1.0.3 (npm 2025-11-19) | small | `enforce-barrel-files` — require importing the index | 🔧 rewrite *to* the barrel | Opposite. |
| **`eslint-plugin-tree-shakable`** (uhyo, 36★) | stale | `import-star`: allow `ns.foo` static access, ban `ns` / computed | none | Does not rewrite barrels. (Note: the query’s `eslint-plugin-tree-shakable-imports` is not a real package name.) |
| **`eslint-plugin-import-x`** (un-ts, v4.17.1, 2026-06-28) | healthy fork of eslint-plugin-import | `no-restricted-paths` (zones), `no-internal-modules` (**forbids subpaths** — the opposite of per-module), `no-namespace` | those two: **not** 🔧 | Wrong direction. |
| **`eslint-plugin-import-next`** (npm 2026-08-21) | very new | `no-barrel-file`, `no-barrel-import`, `prefer-direct-import`, `prefer-tree-shakeable-imports` | table does **not** mark them 🔧 | `prefer-direct-import` is named-import flattening. Too new, no evidence of namespace-per-module. |
| **`eslint-plugin-import-boundaries`** | 2026-07 | canonical path spelling + boundary allow/deny; path-form **is** 🔧 | yes, path canonicalization | Rewrites aliases/relative depth, not barrel explode-to-namespace. |
| **`unicorn/no-barrel-files`** | current unicorn | bans *authoring* re-export-only files | “remove the barrel” | Producer-side. |
| **`@typescript-eslint/consistent-type-imports`** | current | `import type` style | 🔧 | Orthogonal. |

**There is no maintained ESLint plugin that autofixes `import { Effect, pipe } from "effect"` into `import * as Effect from "effect/Effect"` + `import * as Function from "effect/Function"`.** Closest consumer rewrite (`prefer-source-imports`) explicitly skips namespace imports and emits named imports from the resolved file.

### 3.3 Custom ESLint rule as the fixer (the Atlassian pattern)

Atlassian, 2025-06-26: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files

They did **not** use a published plugin. They wrote an internal ESLint rule with `meta.fixable: "code"`, resolved barrel chains via an internal “factsmap” graph, and ran `eslint --fix` on ~90k files in three waves (dormant packages → dormant files → remaining hot files). Output: **named direct imports**, not namespace-per-module.

That pattern is the right *vehicle* (scoped ESLint lane + custom fixer + graph), the wrong *transform* unless the fixer is written to emit `import * as X from "pkg/X"`. The incumbent already has scoped ESLint lanes, so this does not justify a new tool.

### 3.4 Fit

- **Ongoing ban:** ESLint `no-restricted-imports` works, but Biome already covers it faster. Keep ESLint only if you also want the custom fixer in the same process.
- **Ongoing autofix:** only a **custom** rule (or Effect LSP — §5/§6). No off-the-shelf plugin.
- **Migration:** custom ESLint `--fix` (Atlassian-scale proven) or a dedicated codemod. Do not expect unicorn / import-x / no-barrel-files to emit the Effect import style.

---

## 4. ast-grep — rewrite-rule maturity

Sources retrieved 2026-08-23.

### 4.1 Rewriters exist, and the official example is a barrel explode

https://ast-grep.github.io/reference/yaml/rewriter.html (docs label rewriters **experimental**). The worked example is exactly “one named import statement → N per-module imports”:

```yaml
id: barrel-to-single
language: JavaScript
rule:
  pattern: import {$$$IDENTS} from './module'
rewriters:
- id: rewrite-identifer
  rule:
    pattern: $IDENT
    kind: identifier
  transform:
    LIB: { convert: { source: $IDENT, toCase: lowerCase } }
  fix: import $IDENT from './module/$LIB'
transform:
  IMPORTS:
    rewrite:
      rewriters: [rewrite-identifer]
      source: $$$IDENTS
      joinBy: "\n"
fix: $IMPORTS
```

Input `import { A, B, C } from './module'` becomes default imports from `./module/a` etc. Binding mapping is **the identifier itself** (plus a case conversion). It is **not** a lookup table. Adapting the `fix` line to `import * as $IDENT from "effect/$IDENT"` is a one-line change — and that is the Effect-shaped transform for identifiers that *are* module names (`Effect`, `Layer`, `Schema`). It is the **wrong** mapping for `pipe` / `dual` / `identity` (those live on `effect/Function`).

Apply with `sg -U` / `--update-all` ([SO, 2024-02-21](https://stackoverflow.com/questions/78031943/how-to-apply-ast-grep-rewrite-rules-to-a-file-automatically)).

TypeScript catalog (https://ast-grep.github.io/catalog/typescript/, crawled 2026-08-21): import-without-extension finder, XState v4→v5 **named-import rewrite** (`Machine`/`interpret` → `createMachine`/`createActor` via `transform.replace`), import-usage correlator. Mature for specifier and identifier rewrites. TS vs TSX need different parsers (`languageGlobs` to force TSX).

### 4.2 Limitations that matter here

| Limitation | Consequence for this migration |
| --- | --- |
| Rewriters experimental; YAML cannot consult `package.json` exports | Symbol→module table (`pipe` → `Function`) must be **generated into many rules** or done in the **JS/NAPI API** (docs explicitly recommend the API over rewriters for hard cases). |
| One matched node → one `fix` string, unless rewriters explode `$$$` | Mixed `{ Effect, pipe, type Context }` needs rewriter + separate type-only handling. |
| `kind: identifier` also matches the `type` keyword’s neighbors poorly | `import { type Foo, Bar }` / `import type { Foo }` need dedicated patterns. Official rewriter example is value named imports only. |
| Does not merge with an existing `import * as Effect from "effect/Effect"` | Second pass or API required, or you emit duplicates. |
| Does not rewrite use-sites | If you keep `pipe(` as a free function you must either leave a named `import { pipe } from "effect/Function"` (`topLevelNamedReexports: "follow"` style) or rewrite every call. YAML will not do that as part of the import rule. |
| Hypermod comparison (2025-01-29, https://www.hypermod.io/blog/4-jscodeshift-vs-ast-grep) | ast-grep = speed + simple patterns; **jscodeshift when you need deep JS/TS transforms**. This job is the latter once `pipe`/`Function` and mixed type+value enter. |

**Fit:** excellent *throwaway* vehicle for the subset `import { Effect } from "effect"` → `import * as Effect from "effect/Effect"`. Insufficient as the only 1800-file tool unless a generated rule set or JS API walk carries a real export map. Not a permanent linter (Biome/ESLint already cover the ban).

---

## 5. Dedicated barrel-elimination codemods / tools

Every purpose-built tool found emits **named imports from the resolved source file**. None emit `import * as X from "pkg/X"` except Effect’s own lint/LSP stack (§6).

| Tool | Last signal | Transform | Namespace-per-module? |
| --- | --- | --- | --- |
| **`@effect/eslint-plugin` `no-import-from-barrel-package`** v0.3.2 (npm ~1 year; source [no-import-from-barrel-package.ts](https://github.com/Effect-TS/eslint-plugin/blob/main/src/rules/no-import-from-barrel-package.ts); changelog 2025-04-24 “Add rule for disallowing direct barrel imports”, then “Fix import type * as …”) | **This is the rule shape.** `meta.fixable: "code"`. Message: ``Use import * as {{localName}} from "{{packageName}}/{{moduleName}}"``. **Fixer only when the declaration has exactly one specifier.** Skips `import type` statements and inline `type` specifiers. Naive map: imported name = submodule path (`Effect` → `effect/Effect`). `pipe` would become `effect/pipe` — **wrong**. README is a stub. 2 npm dependents. | **Yes, for 1:1 module-named specifiers.** |
| **Effect-smol oxlint JS plugin** [`packages/tools/oxc/src/oxlint/rules/no-import-from-barrel-package.ts`](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/tools/oxc/src/oxlint/rules/no-import-from-barrel-package.ts) (types from `"oxlint"`, last rule-body commit Jan 8 2026) | Same diagnostic message for package imports. **No fixer.** Also flags `import * as X from "<barrel>"` and relative `index.ts` barrels via `fs.existsSync`. Wired in [`packages/tools/oxc/oxlintrc.json`](https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/tools/oxc/oxlintrc.json) with regex `checkPatterns` for `^effect$`, `^@effect/[^/]+$`, plus camelCase subpath traps. | Diagnostic only. **Effect v4’s own CI enforcement.** |
| **`@effect/language-service` `importFromBarrel`** (README + [schema.json](https://github.com/Effect-TS/language-service), plugin still current as of 2026-08-10) | Off-by-default style diagnostic, **🔧 quick fix**. Completions honor `namespaceImportPackages: ["effect", "@effect/*"]`. `topLevelNamedReexports`: `"ignore"` (leave `{pipe} from "effect"`) or `"follow"` (`{pipe} from "effect/Function"` — **named** from submodule). `barrelImportPackages` is the opposite preference. Editor/LSP, not a repo-wide `--fix`. | Closest *smart* mapping (knows re-export targets). Not a CI hammer unless you enable the diagnostic as error and click-fix. |
| **`@effect/codemod`** 0.0.16, last publish **2024-07-23** (https://github.com/Effect-TS/codemod) | jscodeshift transformers: `effect-3.0`, `effect-3.0.4`, `minor-2.{1,3,4}`, `platform-0.49`, `schema-0.{65,69}`. API/version renames. **No barrel→namespace transformer.** Effect v4 `MIGRATION.md` examples still show `import { Effect, Scope } from "effect"`. | No. |
| **`eslint-plugin-no-barrel-files` `prefer-source-imports`** 2.2.0 | Resolves re-export graph; autofix named/default; **explicitly not namespace**. | No. |
| **`unbarrelify`** (webpro-nl, knip author) | Rewire consumers to source, delete barrel, `--unsafe-namespace`, `--organize-imports`. After: `import { formatDate } from "./utils/date.ts"`. | No. |
| **`barrel-breaker`** (peterjcaulfield) | CLI rewrite + purge. Named/default/alias/type/path-alias. | No. |
| **`migrate-barrel-imports`** (brandhaug) | Monorepo CLI. `import { foo } from '@repo/package/src/foo'`. | No. |
| **`no-barrel-file` CLI** (dev.to 2025-12-26) | ts-morph rewrite to direct paths. | No. |
| **Mazzarolo jscodeshift gist** (2024-11-10) | TS compiler API export map; splits type vs value; named/default. | No. |
| **Atlassian factsmap + ESLint `--fix`** (2025-06-26) | 90k files, three-wave landing. Named direct imports. | No. |
| **Sheriff** (softarc 0.18) | Barrel-*less* **modules** (`enableBarrelLess`); “Deep Import” renamed Encapsulation Violation. Architecture linter, not a consumer rewrite to namespace. | No. |
| **Knip** | Unused files/exports/deps; `--fix` removes unused exports. Adjacent at best. | No. |
| **unicorn `no-barrel-files`** / Biome `noBarrelFile` / oxc `no-barrel-file` | Ban *authoring* re-export-only files. | Opposite job. |
| **Rolldown `experimental.lazyBarrel` / `@rolldown/plugin-transform-imports`** | Bundler-time rewrite (`import { Home } from '@mui/icons-material'` → default from esm path). Does not change source. | No. |

**Hard constraint, restated:** a tool that emits named-from-submodule for *every* binding (the LSP `follow` mode applied wholesale) is **not** the target — `import { pipe } from "effect/Function"` is correct only for the flat `effect/Function` combinators, per SPEC Decision #2. A tool that emits `import { Effect } from "effect/Effect"` is named-from-subpath, **not** the target. The target for module re-exports is `import * as Effect from "effect/Effect"`. Only `@effect/eslint-plugin` (partial fixer) and the Effect-smol oxlint diagnostic even *name* that form. <!-- packet-editorial 2026-08-24: clarified to match SPEC Decision #2 (review thread PRRT_kwDOPbO_N86bl35U). -->

---

## 6. Prior art in large TS monorepos (including Effect)

### 6.1 Effect-smol / Effect v4 — this is the reference implementation

- Linter: **oxlint** + a first-party **JS plugin** (`effect/no-import-from-barrel-package`), not Biome, not ESLint core.
- Enforcement is **diagnostic**. Message tells you the namespace-per-module form. **No `--fix`.**
- Matcher is regex (`^effect$`, `^@effect/[^/]+$`, plus a camelCase-subpath pattern) and optional relative `index` detection.
- They still skip whole `import type` statements.
- Editor side: `@effect/language-service` `namespaceImportPackages` + `importFromBarrel` quick-fix (Mattia Manzati, Effect Discord 2026-01-12: “For proper type aware linting and suggestions we recommend the Effect LSP”; `@effect/eslint-plugin` is “mostly a dprint formatter used by the effect packages”).
- Official docs still document **both** `import { Effect } from "effect"` and `import * as Effect from "effect/Effect"` ([effect.website importing-effect](https://effect.website/docs/getting-started/importing-effect/), 2026-07-03), citing tree-shaking.

### 6.2 `@effect/eslint-plugin` — the only published fixer for this exact AST shape

v0.3.1–0.3.2 (Apr 2025). Tiny, under-documented, single-specifier fixer, naive `pkg/ImportedName` path. Usable as a **starting copy** for a scoped ESLint lane, not as a 1800-file migration as-is (`{ Effect, pipe, Schema }` will report three times and fix none).

### 6.3 t3code / pingdotgg (May 2026)

[PR #2596](https://github.com/pingdotgg/t3code/pull/2596): “Migrates all Effect imports from barrel-style named imports (`import { Effect, Layer } from 'effect'`) to module-qualified namespace imports (`import * as Effect from 'effect/Effect'`)” so `@effect/language-service` `namespaceImportPackages` can be error-severity. Hundreds of files. Mechanism not published as a reusable codemod — it is a one-shot plus LSP going forward.

### 6.4 Atlassian Jira frontend (2025-06-26)

~100k files, 1000+ concurrent developers. Stop new barrels → ESLint fixable rule + internal export graph → three-wave VCS-hotness gating → delete unused barrels. **75% build-minute reduction.** Transform is named-direct, not namespace. Process (ban, then mechanical rewrite, then delete) is the right operational template for 1800 files.

### 6.5 Next.js / Rolldown / Vercel

Optimize *at the bundler* (`optimizePackageImports`, lazy barrels). Does not enforce source shape. Irrelevant for a source-level `import * as` law.

### 6.6 Effect core repo itself

Visible eslint configs in Effect-TS/examples and Effect-TS/eslint-plugin still center dprint + import plugin + `no-restricted-syntax`. Barrel enforcement has moved to **oxlint JS plugin in effect-smol** and **LSP**. Do not cargo-cult the old `@effect/eslint-plugin` dprint config as the v4 answer.

---

## 7. Verdict

Ranked against this repo’s constraints: Biome 2.5.6 + GritQL already in tree, scoped ESLint lanes exist, new permanent tools only on decisive advantage, target is **`import * as Mod from "pkg/Mod"`**, ~1800-file one-shot.

### 7.1 Ongoing enforcement

| Rank | Option | Why |
| --- | --- | --- |
| **1** | **Biome `style/noRestrictedImports` `paths` (and `patterns` since 2.2.0)** | Already the incumbent. Exact `"effect"` / `"@beep/foo"` ban; subpaths allowed by construction; custom messages can show the per-module form. **No fixer, and none is coming** (rule page is explicit). Enough for the *ban*. |
| **2** | **Scoped ESLint custom rule** cloned from `@effect/eslint-plugin` `no-import-from-barrel-package`, extended with a real export map | The **only** published fixer that emits the target AST. Incumbent already has ESLint lanes, so this is not a new tool. Must grow past single-specifier / naive `pkg/Name` (or `pipe` becomes `effect/pipe`). |
| **3** | **Biome GritQL plugin** | Rewrites **are shipped** at 2.5.6 (`=>` + `fix_kind`, applied via `--write`). No plugin options, no JS host, no export-map lookup. Fine for a handful of 1:1 identifiers, not for `@beep/*` catalogs. |
| **4** | **Oxlint `no-restricted-imports` + optional JS plugin** | Feature-equal ban, still unfixable natively. JS plugins (alpha, 2026-03-11; `@oxlint/plugins` 1.79.0 on 2026-08-18) *could* host a fixer — **this is what Effect-smol does, without a fixer.** Not a decisive advantage over (2) unless the repo is already switching linters. |
| **5** | **`@effect/language-service` `namespaceImportPackages` / `importFromBarrel`** | Best *editor* experience and the only smart re-export follower (`topLevelNamedReexports: "follow"`). Off by default, not a CI gate unless diagnostics are failed in `tsc`/patching mode. Complement, not substitute. |
| Reject | oxc/Biome/unicorn `no-barrel-file`, Sheriff, import-x `no-internal-modules`, barrel-boundary plugins | Wrong direction or producer-side only. |

**Do not add oxlint as a permanent third linter for this rule.** Effect-smol did because oxlint *is* their linter. Here the ban is free in Biome; the fixer belongs in the existing ESLint lane (or a one-shot).

### 7.2 Migration vehicle (1800+ files)

| Rank | Option | Why |
| --- | --- | --- |
| **1** | **Custom ESLint `--fix` rule with an export map, Atlassian-style waves** | Proven at 90k files. Can emit `import * as X from "pkg/X"`, split mixed specifiers, preserve `import type`, merge with existing namespace imports. Same rule then stays as rank-2 enforcement. Build the map from `effect` / `@beep/*` `package.json` `exports` (module names) plus a hand list for `pipe`→`Function` etc. — or steal LSP `follow` semantics for named re-exports you *want* to keep named. |
| **2** | **jscodeshift / ts-morph one-shot** (Mazzarolo pattern, or a thin wrapper around the same map) | Same transform, throwaway CLI. Prefer if you do not want the fixer living in ESLint. Use-site `pipe(` rewrites are easier here than in a lint fixer. |
| **3** | **ast-grep rewriter** for the `import { Effect }` subset, then a second pass for leftovers | Fast, official barrel-explode example. Stops at mixed type+value and `pipe`. Good as a first 80% if most files are single module-named specifiers. |
| **4** | **`@effect/eslint-plugin` as-is** | Correct output shape, but **no fix on multi-specifier statements** — the common case. Treat as a reference implementation, not the runner. |
| Reject | unbarrelify, barrel-breaker, migrate-barrel-imports, no-barrel-file CLI, `prefer-source-imports`, `@effect/codemod`, Knip, Rolldown transform-imports | They produce named-from-source, which is not the target. Running them would *create* the wrong style. |

### 7.3 Recommended pairing for this repo

1. **Permanent ban:** Biome `noRestrictedImports.paths` for `"effect"` and each `@beep/<foundation>` barrel. Message points at `import * as X from "<pkg>/<X>"`. No new tool.
2. **Permanent autofix (optional, scoped ESLint):** a custom rule that is `@effect/eslint-plugin`’s fixer with (a) multi-specifier explode, (b) export map so `pipe` does not become `effect/pipe`, (c) merge with existing namespace imports, (d) `import type` policy made explicit. This is the Effect-smol rule’s *intent* plus the published ESLint rule’s *fixer*, without adopting oxlint.
3. **One-shot:** run that ESLint rule with `--fix` (or the jscodeshift equivalent) in Atlassian waves. Do not run unbarrelify.
4. **Editor:** keep/enable `@effect/language-service` `namespaceImportPackages` so new code is born correct; do not rely on it as CI.
5. **GritQL:** skip unless you want a 1:1 `import { Effect } from "effect"` sugar on top of (1). It will not carry the catalog.

### 7.4 Evidence trail (key URLs)

- Biome `noRestrictedImports`: https://biomejs.dev/linter/rules/no-restricted-imports/ (v1.6.0; **no fix**; `patterns` since 2.2.0 / PR #5506)
- Biome GritQL rewrites shipped: https://biomejs.dev/linter/plugins/ (2026-08-23; `--write` applies `fix_kind: safe`)
- Historical “diagnostic-only” (stale as of 2.5.6): https://dev.to/herrington_darkholme/biomes-gritql-plugin-vs-ast-grep-your-guide-to-ast-based-code-transformation-for-jsts-devs-29j2 (2025-06-05)
- Oxlint rule + no fixer: https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-imports (v0.15.0); rules table empty Fixable column
- Oxlint JS plugins alpha: https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html ; llms.txt: https://oxc.rs/llms.txt
- ESLint core, no `meta.fixable`: https://github.com/eslint/eslint/blob/main/lib/rules/no-restricted-imports.js (main as of 2026-05-07)
- typescript-eslint extension deprecated: https://typescript-eslint.io/rules/no-restricted-imports (core gained TS syntax in ESLint v9.37.0)
- `@effect/eslint-plugin` fixer source: https://github.com/Effect-TS/eslint-plugin/blob/main/src/rules/no-import-from-barrel-package.ts
- Effect-smol oxlint rule (no fixer): https://github.com/Effect-TS/effect-smol/blob/main/packages/tools/oxc/src/oxlint/rules/no-import-from-barrel-package.ts
- Effect LSP options: `namespaceImportPackages`, `topLevelNamedReexports`, `importFromBarrel` — https://github.com/Effect-TS/language-service
- ast-grep barrel rewriter: https://ast-grep.github.io/reference/yaml/rewriter.html
- Atlassian 90k-file ESLint `--fix` migration: https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files (2025-06-26)
- t3code namespace migration: https://github.com/pingdotgg/t3code/pull/2596 (2026-05)

---

**Status:** complete. Web-research lane; no repo exploration. Researched 2026-08-23.



