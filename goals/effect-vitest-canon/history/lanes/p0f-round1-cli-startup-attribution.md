# P0f round 1 — read-only CLI startup attribution

This lane analyzes the retained direct-entrypoint CPU profile and frozen CLI/foundation import edges. It will not run detection, timing, tests, package proof or another profile. Current test-utils runner/factory work is excluded. All earlier reports/evidence and Root’s concurrent work are read-only. The complete-command <=10s gate remains open; sampled inclusive costs are overlapping intervals, not additive savings. New private evidence: `~/.cache/beep/effect-vitest-canon/p0f-round1-cli-startup-attribution/`.

The retained profile matches Root’s accepted SHA256. Before analysis, 2,114 frozen CLI/foundation/scoped inputs matched the prior handoff, and 181 original evidence files were hashed. Offline stack attribution reproduces 1,215.013 ms of module-evaluation samples: `MimeType.ts` owns 443.972 ms and `FileExtension.ts` 160.257 ms; their nested `cloneObject` self samples are 419.908 and 148.050 ms. These are module-local stack observations, not measured import-edge savings. The full command tree and required shared utility imports both reach the schema barrel; changing one lint import alone cannot eliminate its initialization.

The analysis confirms **one bounded CLI routing candidate**, with no measured speedup. The largest schema initialization remains reachable through required dependencies, so this evidence does not establish a solution to the ten-second gate.

For source references below, `C` means `packages/tooling/tool/cli/src`, `S` means `packages/foundation/modeling/schema/src`, and `R` means `packages/tooling/library/repo-utils/src`. Full paths and numbered excerpts are in private `source-excerpts.txt`.

| Sample group | Inclusive ms | Nested native cloneObject self ms |
|---|---:|---:|
| All module evaluation | 1,215.013 | 617.959 |
| LiteralKit within module evaluation | 760.164 | Included in the enclosing module totals |
| `S/MimeType.ts` module | 443.972 | 419.908 |
| `S/FileExtension.ts` module | 160.257 | 148.050 |
| `packages/drivers/duckdb/src/DuckDb.errors.ts` module | 71.031 | 0 sampled |
| `S/Conformance/Conformance.source.schema.ts` module | 42.690 | 0 sampled |
| `S/AbortSignal.ts` module | 32.843 | 0 sampled |
| `S/TerritoryCode.ts` module | 28.973 | 21.290 |
| `packages/foundation/modeling/html/src/Html.model.ts` module | 25.326 | 2.088 |
| `S/Timezone.ts` module | 19.634 | 17.582 |

`analyze.py` sums retained sample deltas, counts each module frame once per stack, and assigns nested work to the nearest module. Module buckets are disjoint in this profile; LiteralKit and cloneObject overlap them and each other. Native cloneObject totals 648.307 ms across the whole profile, including 617.959 ms during module evaluation. These are sampled main-thread intervals, not independently measured CPU or potential wall-time savings.

The expensive source operation is visible: `S/LiteralKit/LiteralKit.schema.ts:236`, `:266`, `:278` spread the accumulated enum/guard/thunk objects during reductions; `:786–790` invokes those builders. `S/MimeType.ts:56–90` constructs category and aggregate kits; `S/FileExtension.ts:102–109` and `:360–371` construct extension kits. The profile attributes stacks to those operations; it does not count copies or prove a timing complexity bound. No foundation change is proposed.

**Import attribution.** Sample stacks identify executing modules, not their ESM importer. The following edges are verified source-level explanations:

- `C/bin.ts:46–47` loads `bin-main.ts`; the policy-name exclusion at `bin-main.ts:87–88` sends `lint effect-vitest` through `:244–263`, loading `commands/Root.ts`, repo-utils and scheduler layers. `Root.ts:10–42` eagerly imports every command group. The lint facade loads `Lint.command.ts`, whose `:24` imports EffectVitest.
- `Lint.schemas.ts:9` imports the schema root, whose `S/index.ts:141`, `:312`, `:60`, `:13`, `:482`, `:487` expose the sampled extension, MIME, conformance, abort, territory and timezone modules. Separately, **required** `EffectVitestScan.ts:4 → R/FsUtils.ts:18 → errors/DomainError.ts:11` reaches the same root. `C/internal/tsmorph/OwnerResolver.ts:9 → R/Workspaces.ts:11,21 → schemas/PackageJson.ts:13` provides further required routes.
- `Root.ts:11 → AIMetrics/index.ts:13 → AIMetrics.command.ts:21 → internal/Forwarder.ts:7–11 → Programs.ts:8 → @beep/duckdb` reaches its root export `DuckDb.errors.ts:21` (in `duckdb/src/index.ts`), then `DuckDbOperation` at errors `:59`. `Root.ts:37 → SyncDataToTs/index.ts:13 → SyncDataToTs.command.ts:8 → @beep/md` reaches `md/src/index.ts:71,86`, `Md.html.ts:13` and `Md.model.ts:8`, then the HTML modules. These command groups are unrelated to running this detector. Other import paths may also reach them.

**One candidate for a later frozen-source lane.** In existing `C/bin-main.ts`, extend the established CI fast-path pattern (`:218–241`) with a narrowly matched normal `lint effect-vitest` route before the full-tree branch. Import the existing private same-package `./commands/Lint/EffectVitest.ts` command, compose the same `beep-cli → lint → effect-vitest` names using public rc.112 `Command.make/withSubcommands/run`, and retain the existing `runRepoCliMain`, BaseLayers and scoped service lifetime. Supply the existing `FsUtilsLive` service through its public `@beep/repo-utils/FsUtils` path. Do not create a second detector, hand-parse its options, or change its Project engine.

This would avoid the **full command tree’s import edges and command construction**, including the demonstrated AIMetrics/DuckDB and SyncDataToTs/Markdown/HTML branches if no alternative retained import reaches them. The detector command still constructs its existing options and executes the same graph decode, pin refusal, discovery, validation, full-token identities, exception policy and row writer. The schema costs above remain: even narrowing `Lint.schemas.ts` cannot sever the required repository utility edges. `EffectVitestScan.ts:3` also still imports the repo-utils root, so do not count the repo-utils barrel or TSMorph model initialization as avoided.

Scope: existing CLI bootstrap and focused routing regressions; no foundation edits or new export. Preserve the full route for help, version, completions, root/global flags, other commands and ambiguous invocations. Shared-parent parsing, error rendering, argument separators, missing/duplicate flag values, environment services and exit/finalizer behavior are the risks. Avoid bypassing validation to make dispatch cheaper. The private import is internal package composition: architecture `:708–711` keeps external CLI deep roles private. The public facade remains `@beep/repo-cli/commands/Lint`; importing that facade here would reload the broader lint suite.

The existing schema `LiteralKit`/`SchemaUtils` subpaths are real source/publish exports; repo-utils `Root`/`FsUtils` resolve through its existing `./*` source/publish mapping, with real target files. `export-boundaries.json` records exact keys and distinguishes missing keys from null blocks. No manifest change or resolver-execution proof is implied. Architecture `:400–405`, `:728–755`, `:1938–1958` supports narrow boundaries without a whole-package migration. A lone barrel substitution is therefore **not a second justified performance candidate** here.

Later validation should first freeze/hash inputs and compare the selected-route import set against the old route, then exercise existing routing/allowlist and 98 detector regressions plus the argument/error/lifecycle cases above. Keep graph/version refusal and all detector payloads equal; compare every complete row, attributing only new test-fixture rows. Root can then run a fixed before/after canonical-command measurement plan with all observations, phase/process timing and pressure retained, followed by its package proof. No estimate in this report predicts that outcome.

**Measurement limits.** The accepted profile used direct `bin.ts`, Bun 1.4.1 / Node 24.20.0 / rc.112, not the outer canonical command (`package.json:345`). Its 9.704371 s process wall minus 7.6155 s scanner timer leaves 2.088871 s outside that timer; this includes work other than imports. Root discovery, graph decode and pin checking precede `EffectVitestScan.ts:327`; loader/native work, process startup and teardown are not separately isolated. The outer `bun run beep` wrapper was not independently profiled. Installed rc.112 declarations and pinned reference revision `2600f62f4532026928454dcea8d1c48557b3f942` support the CLI API reading. Thirty-eight relevant startup sources match profile-era hashes; the profile predates the accepted detector memoization/tests. None of the subsequent 9.459970, 11.130, 13.842003, 16.885761 or 13.914645 s full-command observations is discarded. Host pressure qualifies them without explaining their entire variance. The complete-command ≤10 s gate remains unresolved.

**Terminal verification:** `verify.py` exited 0: all 2,236 unique current source/guidance/package/API inputs and all 181 original evidence files are unchanged; the retained profile evidence path set is unchanged. The 14 accepted detector/KG inputs are included. Mutable test-utils implementation and concurrent Root packet work were excluded. No scans, tests, package proofs, source/config writes, profiles, Git or inbox actions occurred. Graft was unavailable; targeted source fallback used, with no initialization (0 Graft calls).

Private receipts: `~/.cache/beep/effect-vitest-canon/p0f-round1-cli-startup-attribution/` contains `module-attribution.json`, `source-excerpts.txt`, `profile-source-identity.json`, `export-boundaries.json`, before/after manifests, `commands.md` and `integrity.json`. `manifest.json` hashes every receipt/script.

| Input / receipt | SHA256 |
|---|---|
| Retained `scan.cpuprofile` | `ef640a14f0872a50095b892b096915a3f8b9e2da60dac9a52e23741bff34ef7a` |
| `C/bin-main.ts` | `a8eba686bcfd61b0f2617152d8542f75f8a1de39fd9e3ce7c3d90524aa76180e` |
| `S/MimeType.ts` | `afc10ea3ae9a0410fdf193e7d9383c9b8b443f69cee1c1cecbab126db97ebe45` |
| `S/FileExtension.ts` | `4934c88b9b7d51985decec233bae16e088f5d27f9e268cb810e5b40fdedb2db5` |
| `S/LiteralKit/LiteralKit.schema.ts` | `36915d6791ed01e0f1e33384513441570597e84d9b5750f6b6cc009a4aea24be` |
| `C/commands/Lint/internal/EffectVitestScan.ts` | `6462fbbab72636ee96afdbbb0eff7cafcf9e9450025c20eb14be48e37ac54749` |
| `standards/effect-vitest.primitives.jsonc` | `faf7b04f240aa4f909c89c49bec473d7b6f2b518df80ef15825401f52e7ea6a8` |
| New `module-attribution.json` | `43f973301f6f8357ac3d3f83bd4ac4bb8cb11af0e43c5808c97bccfa0199eabe` |
| New `integrity.json` | `ddc04b28c6de378d3b7b40f5d3549554fedf600635d9773d6193676288724b4e` |
| New `manifest.json` | `f08f0ea0607291fdf29227bc6e9d5791812bb9acb0583a5e3eaeecd2a186184b` |

This is read-only attribution and a proposed later validation boundary, not timing, package or phase acceptance.
