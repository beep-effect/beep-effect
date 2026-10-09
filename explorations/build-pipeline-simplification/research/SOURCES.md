# Build Pipeline Simplification — Sources & Provenance

- **Cluster / origin:** a 2026-10-09 deep-research session (six research
  threads plus a synthesis), filed under [`deep-research/`](./deep-research/),
  and two measured experiments the synthesis named, filed under
  [`experiments/`](./experiments/). Mined sources are read-only local
  checkouts of Spencer Beggs's `effected` and `pluginfinity` repos, the
  `@savvy-web/bundler` 2.4.24 and `@savvy-web/tsdown-plugins` 2.8.22 sources
  installed inside `effected`, and the Effect v4 monorepo.
- **Provenance:** synthesis [`deep-research/REPORT.md`](./deep-research/REPORT.md);
  stage-1 distillation [`../RESEARCH.md`](../RESEARCH.md). No packet codex
  review exists yet.
- **Path convention:** `.repos/effected`, `.repos/pluginfinity` and
  `.repos/effect` are the repo-local symlinks to `~/YeeBois/references/effect/*`.
  `$BUNDLER` = `.repos/effected/node_modules/.pnpm/@savvy-web+bundler@2.4.24_*/node_modules/@savvy-web/bundler`.
  `$PLUGINS` = `.repos/effected/node_modules/.pnpm/@savvy-web+tsdown-plugins@2.8.22_*/node_modules/@savvy-web/tsdown-plugins`.
- **Line numbers:** the notes cite these files by path and symbol only. The
  line numbers below were located by this pass on 2026-10-09 against the
  same checkouts.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `bundler-run` | `build()` front door and `runBuild` orchestration | savvy-web/systems (`packages/bundler`) | `$BUNDLER/run.js:69` (`runBuild`), `:344` (`build`), `:80` (`issues.json` writer) | build orchestration, artifact-first diagnostics | reference; port-with-attribution (pattern) |
| `bundler-config` | `parseArgs` targets and `defineBuild` defaults | savvy-web/systems (`packages/bundler`) | `$BUNDLER/config.js:9` (`defineBuild`), `:33` (`parseArgs`) | per-package build config shape | reference |
| `bundler-ecma` | shared tsconfig with `isolatedDeclarations: false` | savvy-web/systems (`packages/bundler`) | `$BUNDLER/tsconfig/ecma.json:16` | why the oxc dts path is off for Effect code | reference |
| `plugins-target-groups` | per-target tsdown options (JS pass, dts passes) | savvy-web/systems (`packages/tsdown-plugins`) | `$PLUGINS/build/target-groups.js:26,49,69` | unbundle JS + bundled dts split | reference |
| `plugins-transform` | `transformManifest` manifest projection | savvy-web/systems (`packages/tsdown-plugins`) | `$PLUGINS/manifest/transform.js:180` | private source manifest to publishable manifest | port-with-attribution (pattern) |
| `plugins-emit-manifest` | `generateBundle` emits `package.json`, `LICENSE`, `README.md` | savvy-web/systems (`packages/tsdown-plugins`) | `$PLUGINS/manifest/emit-manifest.js:60` | manifest as a build artifact | reference |
| `plugins-resolved-tsconfig` | `stableTypeOrdering` temp tsconfig for dts | savvy-web/systems (`packages/tsdown-plugins`) | `$PLUGINS/dts/resolved-tsconfig.js:104,123` | rolled-up dts friction on `Layer` unions | reference (cost evidence) |
| `effected-catalogs` | `effect` / `effect:peers` two-catalog pattern | spencerbeggs/effected | `.repos/effected/pnpm-workspace.yaml:7,37` | peer floor vs dev pin | port-with-attribution (pattern) |
| `effected-scripts` | `build:dev` via `node savvy.build.ts`; `types:check` is `tsc --noEmit` | spencerbeggs/effected | `.repos/effected/packages/semver/package.json:29,32` | per-package script shape | reference |
| `okf-tsc-not-tsgo` | "The typechecker: tsc, not tsgo" | spencerbeggs/effected | `.repos/effected/okf/decisions/tsc-not-tsgo.md` | why he has no tsgo gate | reference |
| `okf-no-barrel` | only entrypoints re-export | spencerbeggs/effected | `.repos/effected/okf/conventions/no-barrel-re-exports.md` | source-level tree-shaking | reference |
| `okf-workspace` | never run `--target prod` directly (truncated `issues.json` looks clean) | spencerbeggs/effected | `.repos/effected/okf/modules/workspace.md` | artifact assertions over exit codes | reference |
| `okf-ui-declarations` | `dtsExternals` fix for duplicated private members | spencerbeggs/effected | `.repos/effected/okf/decisions/ui-declarations-reference-the-root-by-name.md` | rolled-up dts cost | reference (cost evidence) |
| `pluginfinity-build` | `savvy.build.ts` with `emitDts: false` (~13 s/build saving) | spencerbeggs/pluginfinity | `.repos/pluginfinity/packages/core/savvy.build.ts` | three TS program loads per prod build | reference (cost evidence) |
| `effect-aot` | `SchemaAOTCompiler` module emit and runtime specifier | Effect-TS/effect | `.repos/effect/packages/effect/src/schema/SchemaAOTCompiler.ts` | AOT output shape, version pinning | reference |
| `effect-codegen` | `Declaration` / `encoding` fallback in code generation | Effect-TS/effect | `.repos/effect/packages/effect/src/internal/schema/codegen.ts:34,45-47,135` (lines as cited in `explorations/effect-schema-parity/DECISIONS.md`) | why `S.Class` rows gain only 1.2x to 1.5x | reference |

**How these inform this packet:**

- *Manifest projection:* take the `transformManifest` idea (export-key-derived
  conditions, `private` flip, dev-field stripping). Run it as a committed
  `--check`/`--write` lane, never as a build side effect (inference, REPORT).
- *Peers:* take the two-catalog `effect` / `effect:peers` discipline for any
  publishable tier.
- *Diagnostics:* take `issues.json` plus the "assert artifacts, not exit
  codes" reflex from `okf-workspace`.
- *Leave:* rolled-up `.d.ts`, API Extractor, stripped maps, `tsc` over `tsgo`.
  The `plugins-resolved-tsconfig`, `okf-ui-declarations` and
  `pluginfinity-build` rows are cost evidence for that call.
- *SchemaCompiler:* `effect-aot` and `effect-codegen` are evidence for
  per-app placement and for the modest `S.Class` gains. Nothing is ported.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/spencerbeggs/effected | MIT (`.repos/effected/LICENSE` and `package.json` `"license": "MIT"`, checked 2026-10-09) | port-with-attribution | catalog pattern, okf conventions as reference; no code vendored |
| https://github.com/savvy-web/systems (hosts `packages/bundler`, formerly `savvy-web/bundler`, and `packages/tsdown-plugins`) | MIT per the installed `@savvy-web/bundler` 2.4.24 and `@savvy-web/tsdown-plugins` 2.8.22 `LICENSE` + `package.json` (checked 2026-10-09). No note records it, and the repo-root LICENSE was not fetched. | port-with-attribution for patterns (manifest transform, `issues.json`); treat code as reference-only until the repo LICENSE is recorded | manifest projection, auto-externals, artifact diagnostics |
| https://github.com/savvy-web/bun-builder | unverified | reference-only | nothing; sibling project, not what `effected` builds with |
| Effect-TS/effect (https://github.com/Effect-TS/effect/pull/7908 and issues below) | MIT (`.repos/effect/LICENSE`, Effectful Technologies Inc, checked 2026-10-09) | port-with-attribution | build convention (`tsc -b` + Babel pure pass, `sideEffects` allowlist); SchemaCompiler facts |
| oven-sh/bun (https://github.com/oven-sh/bun/issues/18008) | unverified (no note records it) | reference-only | nothing ported; tool under evaluation |
| rolldown/tsdown (https://github.com/rolldown/tsdown/releases) | MIT per installed `tsdown` 0.23.0 `package.json` in `~/.cache/beep/tsdown-probe` (checked 2026-10-09; not in notes) | tool dependency only | candidate publish-tier emitter |
| rolldown (https://github.com/rolldown/rolldown/releases) | MIT per installed `rolldown` 1.2.13 `package.json` (same probe, checked 2026-10-09) | tool dependency only | probe control |
| https://github.com/sxzz/rolldown-plugin-dts | MIT per installed 0.28.6 `package.json` (same probe, checked 2026-10-09) | tool dependency only | dts generator under tsdown |
| web-infra-dev/rslib, evanw/esbuild | unverified | reference-only | landscape only; esbuild already used by the effect-drizzle probe |

## 3. External research sources

All URLs below appear verbatim in `deep-research/*.md`. Grouped by topic.

**Bun**

- https://bun.com/docs/bundler
- https://bun.com/docs/bundler/vs-esbuild
- https://bun.com/docs/bundler/bytecode
- https://bun.com/docs/bundler/executables
- https://bun.com/docs/bundler/plugins
- https://bun.com/docs/runtime/check
- https://bun.com/reference/bun/BuildConfig/ignoreDCEAnnotations
- https://bun.com/blog/bun-v1.4
- https://bun.com/blog/bun-v1.4.2
- https://github.com/oven-sh/bun/issues/5141
- https://github.com/oven-sh/bun/issues/18008
- https://github.com/oven-sh/bun/pulls
- https://bunup.dev/notes/why-bunup.html
- https://bunup.dev/docs/guide/typescript-declarations
- https://github.com/wobsoriano/bun-plugin-dts
- https://github.com/ryoppippi/bun-plugin-isolated-decl
- https://peterbe.com/plog/trying-bun-compile-to-bytecode

**tsdown, rolldown, Rslib, esbuild, TypeScript 7, Vite**

- https://tsdown.dev/guide/faq
- https://tsdown.dev/options/unbundle
- https://tsdown.dev/options/package-exports
- https://tsdown.dev/options/dts
- https://tsdown.dev/options/dependencies
- https://tsdown.dev/advanced/benchmark
- https://github.com/rolldown/tsdown/blob/main/docs/options/lint.md
- https://github.com/rolldown/tsdown/releases
- https://github.com/egoist/tsup
- https://github.com/sxzz/rolldown-plugin-dts
- https://rolldown.rs/reference/OutputOptions.preserveModules
- https://rolldown.rs/in-depth/dead-code-elimination
- https://github.com/rolldown/rolldown/releases
- https://github.com/rolldown/rolldown/issues/10068
- https://github.com/rolldown/benchmarks
- https://rslib.rs/guide/advanced/dts
- https://rslib.rs/config/lib/redirect
- https://github.com/web-infra-dev/rslib/blob/main/website/docs/en/blog/v1-0.mdx
- https://api.github.com/repos/evanw/esbuild/releases
- https://esbuild.github.io/api/#pure
- https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- https://vite.dev/blog/announcing-vite8
- https://alan.norbauer.com/articles/tsdown-bundler/

**Pure annotations and tree-shaking**

- https://oxc.rs/docs/guide/usage/minifier/dead-code-elimination
- https://app.unpkg.com/babel-plugin-annotate-pure-calls@0.5.0/files/README.md
- https://npmjs.com/package/rollup-plugin-pure
- https://rspack.rs/guide/optimization/tree-shaking

**Effect build practice and dual instances**

- https://raw.githubusercontent.com/Effect-TS/effect/main/packages/effect/package.json
- https://raw.githubusercontent.com/Effect-TS/effect/main/tsconfig.base.json
- https://github.com/Effect-TS/effect/issues/1479
- https://github.com/Effect-TS/effect/issues/1561
- https://github.com/Effect-TS/effect/issues/3308
- https://github.com/Effect-TS/language-service
- https://effect.website/blog/releases/effect/312
- https://turborepo.dev/docs/core-concepts/internal-packages
- https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages
- https://raw.githubusercontent.com/tim-smart/effect-atom/main/packages/atom/package.json
- https://raw.githubusercontent.com/floydspace/effect-aws/main/packages/client-s3/package.json

**Spencer Beggs's tooling**

- https://github.com/savvy-web/systems
- https://raw.githubusercontent.com/savvy-web/systems/main/packages/bundler/CHANGELOG.md
- https://raw.githubusercontent.com/savvy-web/systems/main/packages/tsdown-plugins/CHANGELOG.md
- https://github.com/savvy-web/bun-builder
- https://github.com/spencerbeggs/effected
- https://raw.githubusercontent.com/spencerbeggs/effected/main/packages/semver/package.json

**Effect SchemaCompiler**

- https://github.com/Effect-TS/effect/pull/7908
- https://github.com/Effect-TS/effect/pull/8384
- https://github.com/Effect-TS/effect/pull/8597
- https://github.com/Effect-TS/effect/issues/8595
- https://github.com/nikhilsnayak/effective-rsc/pull/53

The notes carry about 80 further URLs (registry metadata, secondary blogs,
benchmarks). They stay in the notes and are not repeated here.

## 4. In-repo capability references

Paths verified on `main` @ e62411d63f, 2026-10-09. Details in
[`../RESEARCH.md`](../RESEARCH.md) "In-repo capability inventory".

| Brick | Package | Path | Mark |
| --- | --- | --- | --- |
| Package-scripts policy (generator) | `@beep/repo-cli` | `packages/tooling/tool/cli/src/internal/package-scripts/PackageScriptsPolicy.ts` | extend |
| `beep:build` per-kind defaults | `@beep/repo-cli` | `packages/tooling/tool/cli/src/internal/package-scripts/PackageScripts.schemas.ts:1169,1199,1225,1297` | extend (value replaced) |
| `build` task to `beep:build` binding | `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:276` | reuse |
| Babel script scaffold | `@beep/repo-cli` | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1950`; `.../Architecture/OperationPlanPackageJson.ts:109` | extend (publishable tier only) |
| Shared emit settings | repo root | `tsconfig.base.json` | reuse |
| effect-tsgo compiler swap | repo root | `docs/runbooks/typescript-toolchain.md`; `tools/tsgo-shim/tsgo.js` | reuse |
| Turbo build graph | repo root | `turbo.json` (`build` task, line 279) | reuse, extend inputs |
| Docgen example compile | `@beep/docgen` | `packages/tooling/tool/docgen/src/Core.ts:606-607` | reuse |
| effect-drizzle bundle probe | `@beep/effect-drizzle` | `packages/ecosystem/effect-drizzle/test/bundle-build.ts`; `test/bundle-size.ts:6` | reuse (oracle pattern) |
| practice-kg-mcp compiled binary | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp/src/package.ts:313-325` | reuse (CLI/release lane) |
| Desktop sidecar binary | `@beep/professional-desktop` | `apps/professional-desktop/scripts/build-sidecar.ts:46` | reuse |
| Ecosystem-package standard | standards | `standards/architecture/14-ecosystem-packages.md:108,143` | reuse (defines publishable tier) |
| SchemaCompiler DEFER ruling | effect-schema-parity | `explorations/effect-schema-parity/DECISIONS.md:611` | constraint |
| Compiler spike numbers | effect-schema-parity | `explorations/effect-schema-parity/research/2026-09-28-compiler-evaluation.md` | evidence |
| Shared build-kit package | (proposed `packages/tooling/library/build-kit`) | NOT FOUND | NET-NEW |

## 5. Cross-links & provenance

- Packet: [`../README.md`](../README.md), [`../CAPTURE.md`](../CAPTURE.md),
  [`../RESEARCH.md`](../RESEARCH.md), [`../ops/manifest.json`](../ops/manifest.json).
  No `DECISIONS.md` yet (align has not started).
- Deep-research notes: [`deep-research/`](./deep-research/), synthesis
  [`deep-research/REPORT.md`](./deep-research/REPORT.md).
- Experiments: [`experiments/`](./experiments/):
  [`bun-treeshake-probe-1.4.2.md`](./experiments/bun-treeshake-probe-1.4.2.md),
  [`schema-build-timings.md`](./experiments/schema-build-timings.md). Raw
  outputs stayed in the session scratchpad; the tsdown probe stays at
  `~/.cache/beep/tsdown-probe/`.
- Packet opened by PR #1557 (`e62411d63f`, "docs(explorations): open
  build-pipeline-simplification packet").
- Sibling packet: [`../../effect-schema-parity/`](../../effect-schema-parity/)
  (SchemaCompiler DEFER, 2026-09-28).
- Friction receipts: [`OPPORTUNITIES.md`](./OPPORTUNITIES.md).
- No graduated goals yet.
