# GritQL migration candidates for repo analysis/rewrite passes

## Executive answer

The best follow-up pilot is **the syntax front-end of `quality jsdoc-inventory`**, run in
shadow mode and parity-diffed against today's inventory. The user-observed wall time tonight
was **~230s**. The implementation creates an in-memory `ts-morph` project per package, adds
every package source file to it, and asks for exported declarations before running mostly
text/JSDoc-shape rules; packages are processed with `concurrency: 1`
(`packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:1111-1144`,
`:1458-1467`). This is the largest measured syntax-heavy target.

Do **not** interpret this as “replace TypeScript analysis with Grit everywhere.” GritQL is a
syntax engine. It cannot answer questions that require TypeScript symbol identity, inferred
types, resolved exports, call signatures, or package/inventory graphs. In this repo, the
right split is:

1. GritQL finds local syntactic candidates (and, with the standalone engine, may rewrite
   strictly local shapes).
2. Existing Effect code keeps file/package discovery, exclusions, allowlists, inventory
   reconciliation, deterministic rendering, and writes.
3. A TypeScript-checker sidecar remains authoritative for genuinely semantic candidates.

The repo already has a GritQL maintenance surface: `@beep/lint-rules` owns one `.grit` file
per rule, loads them into the existing Biome pass, and has fixture/registry tests
(`packages/tooling/policy-pack/lint-rules/README.md:1-17`). Therefore diagnostic patterns do
not require a brand-new pattern convention. However, repo policy currently makes this path
**diagnostics-only** and reserves remediation for Biome fixes, `ts-morph` codemods, or hand
edits (`packages/tooling/policy-pack/lint-rules/README.md:29-37`). Introducing standalone
Grit for rewrites or machine-readable inventory extraction would still add a pinned Rust
binary/version, CI/cache/platform wiring, output decoding, and a second execution path.

## Cost and feasibility rubric

- **Measured** means there is a retained local number or the 230s observation supplied with
  this task. Otherwise cost is a structural class; current local per-step timing is not
  generally persisted (`goals/quality-speedup/research/quality-time-inventory.md:176-182`).
- **Gain** is a planning class, not a benchmark. The 10-100x premise is credible only for a
  simple structural scan replacing a fresh full `ts-morph` project. Whole-command gains are
  smaller when discovery, inventory work, typechecking, or rendering remains.
- Existing local evidence is instructive: three fresh-project law checks took about 17s
  combined, while one simple Grit rule inside Biome scanned 2,763 files in 124ms
  (`goals/lint-toolchain-modernization/research/p0-spike-result.md:107-121`). But a complex
  ancestor-sensitive `effect-fn` Grit spike instead took ~98s and produced 51 false positives
  (`goals/lint-toolchain-modernization/research/rule-inventory.md:12-18`). Pattern shape,
  not “Rust,” determines the outcome.

## Ranked candidates

| Rank | Pass | Current cost / cause | Grit-expressible? | Estimated gain | Migration sketch |
|---:|---|---|---|---|---|
| 1 | `quality jsdoc-inventory` syntax front-end | **~230s observed tonight.** Per-package recursive source listing, a new in-memory project, incremental `addSourceFileAtPath`, then `getExportedDeclarations`; packages are serial (`JSDocDocumentationInventory.ts:1111-1167`, `:1458-1467`). A second docgen analyzer independently creates a project per requested package and calls `getExportedDeclarations` (`packages/tooling/tool/cli/src/commands/Docgen/internal/JsDocAnalysis.ts:421-485`, `:526-555`). | **High for direct export/re-export shapes; medium for the full inventory.** Required/forbidden tags, explicit export forms, overload declarations, unsafe example tokens, schema initializer/annotation shapes, and same-file same-name aliases are syntactic (`JSDocDocumentationInventory.ts:834-939`, `:941-1011`). Grit cannot resolve an export graph or symbol identity. Leading-comment attachment and `export { local as public }` parity must be proven rather than assumed. | **Whole command: plausibly 5-20x; structural collector alone: 10-100x.** Target <30s before adoption. | Make one reusable Grit collector emit normalized `{file,line,kind,name,comment/span}` candidates for direct declarations and re-export edges, and share it with the package JSDoc analyzer after inventory parity. Keep the current Effect JSDoc text rules and inventory renderer. Group overloads in the postprocessor. Send indirect/ambiguous exports to a small TS fallback. Shadow-run both and diff the final JSON inventory, not merely finding counts. |
| 2 | `laws native-runtime` / allowlist validation | Previously measured **6.8s**, with 18 allowlisted rows (`p0-spike-result.md:109-119`). It builds a repo-wide project (`packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:562-583`). | **Hybrid.** Imports, `new Error`, `globalThis.fetch`, and named member calls are structural. Hotspot/ancestor scope and allowlist bookkeeping stay in TypeScript/Effect. The prior inventory reached the same verdict (`goals/lint-toolchain-modernization/research/rule-inventory.md:14-18`). | **2-10x whole check**, depending on how small the semantic fallback becomes. | Extend the existing `.grit` rules to emit syntax candidates in the Biome pass; reconcile candidate keys against the current allowlist in repo-cli. Do not rebuild ASTs merely to revalidate every syntax-only key. |
| 3 | `lint package-test-imports` | Unmeasured, likely **low-medium**: recursively walks all packages/test files, reads each file, then creates a source file to collect imports, exports, and dynamic imports (`packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts:165-250`, `:283-304`). | **High.** Literal module specifiers in `import`, `export ... from`, and `import("...")` are local syntax. The owning package/source-root and relative-path resolution are filesystem context, not Grit. | **5-30x scanner portion; likely seconds saved, not minutes.** | Grit emits literal module-specifier uses; retain the existing path/package resolver. Prefer the existing Biome-Grit pass if its diagnostics contain sufficient path/span data; otherwise use a small standalone JSON adapter. |
| 4 | `lint identity-registry` local-root-composer scan | Unmeasured, likely **low-medium**. It recursively walks source roots, text-prefilters on the identity package name, then parses only survivors (`packages/tooling/tool/cli/src/commands/Lint/IdentityRegistry.ts:56-110`, `:206-227`). | **High for the local misuse check.** Import alias collection and calls through a known local alias are syntax. **Not** for package discovery, missing registry entries, or the `--fix` registration edit. | **2-10x whole command**; existing text prefilter limits upside. | Port only `collectLocalRootComposerUses` to Grit. Keep workspace slug discovery, registry completeness, and registration repair in TypeScript/Effect. |
| 5 | `lint tooling-schema-first` regex battery / repo-wide read loops | Previously **1.5s** for the command (`p0-spike-result.md:109-115`). It recursively discovers files, reads them, applies regexes for exported interfaces, runtime imports/calls, native methods and schema shapes, then re-reads tooling files for required tagged unions (`packages/tooling/tool/cli/src/commands/Lint/Lint.command.ts:225-341`, `:344-391`). | **High** for the content rules, although the filename rule belongs in Biome's filename builtin. Simple shapes should be Grit/Biome rules; file/path/global-presence conditions remain orchestration. | **Small absolute gain**; consolidation into the existing Biome pass removes duplicate reads. | Add narrow diagnostic `.grit` patterns for the remaining structural rules where a Biome/oxlint rule does not already own them. Preserve the global “required declaration exists” check as a tiny post-pass. |
| 6 | `laws terse-effect` **check-only leaf patterns** | Unmeasured, structurally **high**: creates a repo-wide tsconfig project and walks arrows, calls, spreads, and functions (`packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:572-621`, `:675-729`). The same project also performs mutations, import organization, and save (`:731-760`). | **Partial.** Direct helper/thunk substitution, a one-parameter `pipe` passthrough, nested known matcher calls, and conditional spreads are structural. Binding safety, parameter-use exclusion, overload grouping, import alias management, coordinated rewrites, and `organizeImports` are not a good single-pattern fit. Prior routing therefore kept the full pass in `ts-morph` (`rule-inventory.md:17-21`). | **3-15x check-only** if simple candidates move into the already-running Biome pass. Little/no write-mode gain unless the standalone rewriter proves byte-for-byte parity. | Split the law: Grit diagnostics for independent leaf rules; retain one smaller codemod for safe writes and multi-node/import work. Never run both scanners over the same subrule after parity promotion. |
| 7 | `lint schema-catalog` syntax collector | Unmeasured, structurally **high** on a cold/full regeneration: it globs repo-wide, builds a tsconfig project, adds every path, and scans all source files (`packages/tooling/tool/cli/src/commands/Lint/SchemaCatalog.ts:597-634`). | **Medium.** Direct schema constructors, tagged templates, annotation literals, and local `.pipe(...)` chains are structural. Following identifier initializers currently uses symbol declarations (`SchemaCatalog.ts:358-409`), so aliases/re-exports require TS or a conservative fallback. | **2-10x cold collector**; little warm benefit if existing sharding/cache already avoids full regeneration. | Grit extracts direct schema candidates and metadata; TS handles identifier indirection. Diff complete catalog entries and keys in shadow mode. Do not regress the current shard/cache fast path. |
| 8 | `lint schema-first` syntax-only advisories | Unmeasured, structurally **very high**: the command creates a full project once for inventory and a second time for `LiteralKit(... as const)` (`packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstScan.ts:49-97`, `:459-465`). | **Mixed.** `LiteralKit([... ] as const)`, explicit inline object parameter/return annotations, explicit `null | undefined` returns, `JSON.parse`, defaults, and named call shapes are syntactic (`SchemaFirstDetectors.ts:660-773`). Export identity, inherited/data-like type classification, schema companions and symbols use `getSymbol()`, `getType()`, and `getExportedDeclarations()` (`SchemaFirstDetectors.ts:78-103`, `:240-305`) and cannot move. | **1.5-5x whole command** if Grit removes the second project and prefilters the semantic project; **10-100x** only for extracted leaf rules. | First eliminate the duplicate project by folding the `LiteralKit` rule into Grit/Biome. Then use Grit as a prefilter for explicit-syntax advisories. Keep the semantic inventory and baseline reconciliation authoritative. |
| 9 | `laws effect-fn` | Measured **5.3s / 1,601 files** in the earlier baseline, but the attempted Grit pattern was **~98s on apps** and wrong (`p0-spike-result.md:109-119`; `rule-inventory.md:12-18`). Current correctness depends on finding the direct return owner, skipping generators, and recognizing existing wrappers (`packages/tooling/tool/cli/src/commands/Laws/EffectFn.ts:146-243`, `:339-393`). | **Superficially yes, operationally no with the existing engine/pattern.** The necessary ancestor/owner scope caused false positives and pathological runtime. | **Negative based on local evidence.** | Keep `ts-morph`. Revisit only with a different lint AST visitor or a demonstrated constant-time ancestry primitive; do not repeat the failed Grit spike. |
| 10 | `laws effect-imports --write` | Measured **4.8s** (`p0-spike-result.md:109-119`). It consolidates imports across a whole file, creates/removes declarations, renames namespaces, and is a repair codemod (`packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:138-235`). | **Low as one faithful Grit rule.** Individual bad imports match structurally, but whole-file alias consolidation and safe coordinated rewrite do not. The prior spike explicitly retained it (`rule-inventory.md:14-18`). | **No credible whole-pass gain.** | Keep the codemod. At most, let a cheap diagnostic mirror report simple cases inside Biome, but avoid duplicate enforcement unless it replaces a real scan. |
| 11 | `laws dual-arity` | Unmeasured, structurally **high** full semantic scan. Candidate classification reads return-call signatures, parameter types, factory return types, and JSDoc category (`packages/tooling/tool/cli/src/commands/Laws/internal/DualArity.analysis.ts:350-411`, `:560-602`). It scans exported functions, values, and static members and then reconciles an inventory (`:797-917`; `packages/tooling/tool/cli/src/commands/Laws/DualArity.ts:356-399`). | **Low.** Grit can preselect declarations with 2-3 explicit parameters or visible `dual(...)`, but cannot validate inferred callable overloads, pipeability, constructor factories, or third-parameter type. | **0-2x whole pass**; likely not worth the new boundary. | Keep TypeScript checker authoritative. Only add a Grit prefilter after profiling proves candidate reduction outweighs serialization/startup cost. |
| 12 | Full `lint schema-first` inventory | Same full-project cost as rank 8, plus committed inventory merge/write. | **No** as a complete replacement: cross-file export identity, type classification, owner resolution, exceptions, missing/stale reconciliation remain. | **No 10-100x claim.** | Preserve the semantic core; migrate only the leaf rules listed at rank 8. |
| 13 | Full package docgen (JSDoc analysis + rendered docs/examples) | Entire hosted Docgen lane p50 **498s**, p95 **1085s**; a cold-local observation was ~24 min (`goals/quality-speedup/research/quality-time-inventory.md:56-68`, `:120-122`). This is a ceiling, not parser-only time. Package docgen reads/globs source, parses modules, checks docs, writes examples/Markdown, and typechecks examples (`packages/tooling/tool/docgen/src/Core.ts:82-104`, `:768-790`). Its parser calls `getType().getText(...)` (`packages/tooling/tool/docgen/src/Parser.ts:223-239`) and builds a TypeScript project (`:840-864`). | **Low for full docgen; medium for metadata extraction.** Grit can find declarations/JSDoc candidates but cannot render inferred types or replace example `tsc`. | **Unknown whole-lane gain; likely modest** unless profiling shows parse/JSDoc walk dominates. Existing package proof reuse is a safer large win than a parser swap. | Do not replace docgen. If rank-1's JSDoc collector succeeds, reuse it as a shadow metadata feeder, while retaining TS type rendering and example checking. Prior cost work correctly requires shadow soundness and full fallback (`goals/repo-quality-throughput/research/batch-01-docgen-cost-model.md:14-23`, `:31-48`). |

### Additional inventoried pass: `laws frozen-grant-set`

This is below the ranked migration cut. It uses the same repo-wide `LawScan`, then computes a
fixed-point taint set over import aliases, variable aliases, destructuring, extracted methods,
calls, and `new` expressions
(`packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts:144-242`, `:268-330`). Direct
construction and one-hop aliases are structural, but arbitrary alias-chain propagation is
dataflow analysis and a poor declarative-pattern fit. If profiling makes it material, a
purpose-built visitor in the existing oxlint lane is more credible than Grit; do not weaken its
alias-bypass coverage merely to remove a project load.

## Other repo-wide parse-loop observations

- `LawScan` already requests `mode: "syntax"`, but it still constructs a repo project and
  walks every included file for each supplemental law (`packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:21-28`,
  `:89-143`). The large architectural win is **one shared syntax pass**, not merely porting
  TypeScript visitor code line-for-line into many separately launched Grit commands.
- `jsdoc-inventory` performs package discovery, topo sort, `git ls-files`, root-policy
  analysis, per-package scanning, and rendering (`JSDocDocumentationInventory.ts:1439-1485`).
  Grit should replace only the expensive declaration collector; it should not absorb this
  orchestration.
- Hand-written regex scans are not necessarily the largest costs. For example, identity
  registry already text-prefilters before parsing (`IdentityRegistry.ts:214-227`), while
  schema-first pays two repo project constructions (`SchemaFirstScan.ts:54-97`). Prioritize
  avoided project loads over replacing cheap regex predicates.
- `allowlist-check` parses only the files named by no-native-runtime allowlist entries, then
  reuses the native-runtime visitor (`packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:213-235`).
  It is a poor standalone migration target: accelerate the owning native-runtime candidate
  stream and keep this small reconciliation check.
- Docgen quality-subject collection independently creates a syntax-only project per package and
  walks direct/re-export subjects
  (`packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts:881-956`).
  Rank 1 should produce a reusable collector rather than adding a third JSDoc AST implementation.
- The existing Grit rules demonstrate the maintainable sweet spot: one local AST shape and
  one diagnostic (`packages/tooling/policy-pack/lint-rules/rules/prefer-array-flat-map.grit:1-6`).
  Complex ancestry, cross-file joins, and mutation orchestration quickly leave that sweet spot.

## Recommended pilot: JSDoc direct-surface collector

### Scope

Pilot only the candidate-collection portion of `quality jsdoc-inventory`:

1. Enumerate direct exported declarations, explicit re-export declarations, export
   assignments, and same-file export lists.
2. Capture file, byte/span or line, syntactic declaration kind, local/public name, and leading
   comment text/span.
3. Preserve the existing functions for tags, summaries, fenced examples, documentation shape,
   schema-annotation heuristics, inventory aggregation, and rendering. Those rules are already
   mostly deterministic text processing (`JSDocDocumentationInventory.ts:314-419`, `:600-702`,
   `:718-766`).
4. Route ambiguous indirect exports and any leading-comment attachment Grit cannot reproduce to
   a small TS fallback.

### Acceptance gates

- **Shadow only first.** Run current and candidate collectors over the same tree and normalize
  to `{package,file,line,symbol,kind,all finding arrays}`. Require an exact final JSON inventory
  diff, not merely equal totals. The repo's established migration gate likewise requires shared
  fixtures plus current-tree normalized output comparison (`goals/lint-toolchain-modernization/SPEC.md:109-120`).
- Add fixtures for direct exports, `export default`, export assignments, `export { x as y }`,
  `export ... from`, namespace exports, overload groups, declaration merging, type-only exports,
  aliased imports/re-exports, detached comments, fenced examples, and schema/type-alias pairs.
- Benchmark at least three warm and three cold runs. Record wall time, peak RSS, candidate count,
  TS-fallback count, and final parity. **Go** if median wall time is <30s, final inventory is
  byte-equivalent after timestamp normalization, and fallback is a small bounded fraction
  (suggested <5%). **Stop** if comment/export parity requires rebuilding a near-full TS project,
  if Grit ancestry patterns regress toward the prior 98s failure, or if output cannot be made
  deterministic.
- Keep the old collector behind an explicit fallback for at least one PR/CI observation window.

### Why this pilot, not `effect-fn`

It attacks the only supplied pass-level 230s measurement, has a large syntax-heavy core, and
can preserve semantic escape hatches. `effect-fn` has already failed the exact empirical test a
new proposal would need to pass (slow and 51 false positives), while dual-arity and full
schema-first are checker/inventory problems rather than structural-search problems. The JSDoc
pilot is therefore the highest expected wall-time reduction without pretending GritQL is a
TypeScript type system.

## Maintenance and rollout cost

- **Existing surface:** `.grit` registry, Biome plugin wiring, fixture harness, severity
  convention, and registry drift tests already exist (`lint-rules/README.md:8-21`;
  `packages/tooling/policy-pack/lint-rules/test/harness.ts:1-14`, `:83-110`).
- **New if standalone Grit is used:** pinned binary/version and checksum provenance, developer
  bootstrap, Linux/macOS parity, cache policy, machine-readable output schema/decoder, timeouts,
  path normalization, CI invocation, failure diagnostics, and safe rewrite/diff policy.
- **Pattern maintenance:** AST grammar/version drift, fixture matrices for TS/TSX syntax,
  import alias and scope false positives, and duplicated knowledge if the same rule remains in
  TypeScript. Remove the old implementation only after parity; otherwise label the Grit path
  advisory/shadow and keep a deletion-ready boundary.
- **Rewrite risk:** the repo's current Grit contract is diagnostics-only. A follow-up that enables
  standalone structural rewrites is a policy change, not just an optimization. Require clean
  worktree/diff review, idempotence (second run produces no diff), formatting/import proof, and
  the existing TypeScript codemod fallback.

## Bottom line

Pursue **one shadow pilot on `jsdoc-inventory` direct-surface extraction**. Then, if its shared
parser invocation is stable, fold cheap syntax-only rules (`package-test-imports`, identity local
composer misuse, native-runtime leaf patterns, and the duplicated `LiteralKit as const` scan)
into the same existing Biome/Grit pass. Keep `effect-fn`, `effect-imports` write mode,
dual-arity, semantic schema-first, and type-rendering docgen on TypeScript unless new measured
evidence overturns the repo's existing parity failures and type-system boundary.
