# Consumers of comments: what reads, requires, counts, hashes or parses them

Checkout: `beep-effect-worktrees/comment-law`, origin/main `a1b08269809`. Every claim cites a file I read. Items marked MEASURED were run in the scratchpad; items marked UNVERIFIED were not. Scenario names follow the census strip: A = free prose, B = A + non-exported JSDoc, C = B + member JSDoc, D = everything except what the census calls directive or license. Abbreviation: `cli/` = `packages/tooling/tool/cli/`.

## 1. Short answer

Nothing *requires* free prose or non-exported JSDoc. No gate fails because one is missing. Deleting them still goes red in a small, enumerable set of places, because seven mechanisms read bytes, tokens or lines:

| Consumer | Scenario A effect | Scenario D effect | Remedy |
| --- | --- | --- | --- |
| Scanner byte seals | 9 sealed files, red on any edit | same | re-review and re-pin nine sha256 values |
| schema-first inventory line keys | 30 entries, 22 files shift (MEASURED) | 59 entries, 36 files | `bun run beep lint schema-first --write` |
| effect-vitest occurrence digests | 21 of 22 comment-bearing findings | 22 (21 are reviewed exceptions) | re-review; `--write` drops the reason |
| Biome organizeImports | 57 files (MEASURED) | 64 files | `biome check --write` |
| Fallow dead-code visibility tags | 0 new (MEASURED) | 130 new, 119 in law-practice/server (MEASURED) | keep the tag, or un-export/delete the symbol |
| Triple-slash references | 13 real compiler directives die | same | exempt; the census files them under "prose" |
| Suppressions that say "reason above" | 123 lose their reason | same | fold the reason into the directive first |

Fallow duplication and complexity do not move in the harmful direction. MEASURED on a copy of packages/apps/infra: clone groups 353 -> 350 (no new group in A or D), the same 118 health findings with identical cyclomatic, cognitive and CRAP values in D, and 25 shorter unit line counts.

Exported JSDoc is the opposite case: eight independent consumers require it (section 3). It cannot be deleted under the current law; it can only be reshaped, or the law changed first.

## 2. Census corrections this lane found

The census drives deletion, so these must be fixed before any codemod.

1. **Triple-slash references are classed as prose.** The classifier tests `/^\s*(<reference…)/` but the comment value is `/ <reference …/>`, with the leading slash. 13 sites, for example `apps/oip-web/src/app/sw.ts:2` (`lib="webworker"`), `packages/drivers/cosmos/src/Cosmos.renderer.ts:7`, `packages/drivers/oxigraph/src/Oxigraph.sparql.ts:7`, `packages/drivers/shacl/src/Shacl.validation.ts:7`, `packages/party/domain/src/internal/IdentifierCore.ts:7`, `packages/foundation/modeling/html/src/Html.conformance.ts:12`. All simulations delete them.
2. **Semgrep case markers are classed as prose.** `.semgrep/first-party.ts` carries 10 `ruleid:` and 6 `ok:` lines. `cli/test/quality-tasks.test.ts:1490-1506` fails when a rule lacks either marker, and the SAST lane runs `semgrep --test` (`cli/src/commands/Quality/Quality.command.ts:1497`).
3. **About 24 of the 975 "directives" are prose.** The pattern's `effect-`, `region`, `semgrep`, `istanbul`, `typos`, `syncpack`, `knip` and `gitleaks` alternatives match sentences, e.g. `packages/foundation/modeling/yaml/src/YamlFormat.ts:1648` ("Region-confined scalar replacement"), `cli/src/commands/Ci/LaneTimings.ts:2074` ("Knip removed"), `syncpack.config.ts:179`.
4. **Directives live inside JSDoc.** `packages/foundation/primitive/types/src/TUnsafe.types.ts:27` holds a `biome-ignore` inside an exported block. Biome honors it: deleting the block adds one `noExplicitAny` (MEASURED).
5. **`@public` and `@internal` inside JSDoc are live suppressions** (section 3.3), not documentation.
6. **The strip trees were already reformatted.** `census/strip/base` differs from repo formatting in 6,478 files under the repo's own Biome settings (MEASURED), so the simulated line deltas include formatter drift in both directions. Compare strip/X with strip/base, never with the checkout.

## 3. Consumers that REQUIRE comments

### 3.1 Docs oxlint rules (blocking, warnings included)
- Config `.oxlintrc.docs.json`; rules `packages/tooling/policy-pack/lint-rules/src/rules/docs.ts`; run with `--max-warnings=0` (`cli/src/commands/Lint/LintJsdoc.command.ts`, `runDocsWorker`).
- `packages/tooling/*/*/src/**/*.ts` must carry: `require-jsdoc`, `informative-docs`, `require-description`, `require-category-tag`, `require-param`, `require-returns`, `match-description`, `require-file-overview`. Ignored: tests, stories, `packages/tooling/*/*/scripts/**`, `packages/tooling/*/*/src/internal/**` (the glob stops at that depth).
- `require-jsdoc` also covers **public class methods** (`docs.ts:218-247`, MethodDefinition), so member JSDoc in tooling is partly mandatory. Object-type members and interface members are not covered.
- `tsdoc-syntax` applies to all of apps, packages and infra (`tsdoc-syntax.ts:82`) but only judges blocks that exist.
- `informative-docs` already bans name-restating JSDoc leads in tooling src: an existing tautology rule with a working AST attachment helper to extend.

### 3.2 JSDoc inventory and ratchet (a required ruleset context)
- `cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:240-241`: exports need `@example` (or an Example section), `@category`, `@since`; modules with exports need `@since` and a summary. Pure type-level exports skip the example (`missingRequiredExportTags`).
- `JSDocRatchet.ts` compares against `standards/jsdoc-totals.regression-baseline.jsonc`: missing examples, categories and since are pinned at 0. `"JSDoc Ratchet"` is a required check (`packages/tooling/infra/github/src/Production.ts:157`).
- The inventory does not skip `@internal` exports, so dropping one `@category` on an internal export is red.
- Zero-legacy scan bans `@example` and `@remarks` tags outright (`JSDocRatchet.ts`, `JSDocLegacyTag`).
- `isGeneratedSourceFile` and `hasGeneratedFileHeader` (`JSDocRatchet.ts:506,530`) read path plus `GENERATED FILE` in the first 512 characters. Deleting that header pulls the file into scope.

### 3.3 Fallow dead-code (zero baseline, blocking)
- Fallow treats a JSDoc `@public`, `@internal` or `@expected-unused` tag as an unused-export suppression. MEASURED twice: a two-file prototype, and the repo copy where scenario D turns 0 unused exports/types into 130 (101 + 29; 119 in `packages/law-practice/server/src`, e.g. `internal/Citation/AnnotationSpan.ts` `CitationAnnotationSpanFailure`). A, B and C add none.
- `.fallowrc.jsonc:641` `require-suppression-reason: error`: every `fallow-ignore-*` and `@expected-unused` needs `-- <reason>` on the directive itself.
- Rule: exempt the tag, or handle each of the 130 as a real dead-export decision. This is an unplanned finding worth its own slice.

### 3.4 Docgen
- `packages/tooling/tool/docgen/src/Checker.ts:60-75`; `enforceVersion` defaults to true (`Configuration.ts:150`), so every non-ignored export and class needs `@since`. 201 `docgen.json` files; 199 mention `src/internal` (the standard exclude). Three set `enforceDescriptions: true`, including `packages/foundation/ui-system/ui/docgen.json` and `packages/tooling/tool/cli/docgen.json`.
- `Parser.ts:193`: `@internal` or `@ignore` removes the entry. Deleting an `@internal` block outside `src/internal/` makes the export visible and red for a missing `@since`. This is the trap in "delete non-public JSDoc": the tag is the exemption.
- Module docs come from the leading comment of the first statement (`parseModuleDocumentation`, `Parser.ts:874`). A remaining license or prose block that becomes first changes what is parsed.
- Docgen analyze and quality read the same tags: `cli/src/commands/Docgen/internal/JsDocAnalysis.ts`, `internal/quality/Quality.subjects.ts:252-270`.
- Examples compile during docgen, so an export renamed or un-exported in the same PR breaks other files' Example sections and `{@link}` text.

### 3.5 Doctest lane (required: "Heavy / Doctest")
- `@effect/doctest` is a Vitest plugin loaded only under `BEEP_VITEST_DOCTEST=1` (`vitest.shared.ts:77,267,366`). It executes fenced examples carrying `import.meta.vitest` in `src/**`; 2,784 blocks. Inside them, `// => value` comments are the assertions.
- **Ownership is derived from comment text**: `packages/tooling/library/repo-cli-kit/src/package-scripts/PackageScriptsPolicy.ts` (`markedSource`) greps sources for the marker and generates the package's `beep:doctest` script. Removing a package's last marked block drifts its manifest: run `bun run beep lint package-scripts --write`, then the package `turbo.json`/cache-baseline consequences of a removed task.
- `cli/test/doctest-lane.test.ts:163-180` requires at least one marked source per owner and `passWithNoTests: false`.
- Coverage is unaffected: doctest runs are a separate mode and never feed the coverage ratchet.
- The marker in prose or a string is enough to select a file; the repo composes it at runtime for that reason (`packages/tooling/library/repo-utils/src/JSDoc/DoctestSource.ts`). A new `/delete-comment` tool, rule or ADR template in TS must not spell it.

### 3.6 `lint:jsdoc-module-tags`
Only bans `* @module` lines (`Quality.command.ts`, `runJSDocModuleTagsCheck`). Deletion is safe.

### 3.7 Law text and agent instructions
`standards/effect-laws-v1.md` law 15 ("JSDoc is required for exported APIs"), `AGENTS.md` Code Laws, `.patterns/jsdoc-documentation.md` (461 lines), and skills `jsdoc-annotation-specialist` and `effect-first-development` (`SKILL.md:51`) all instruct agents to write it. A ban that leaves them unchanged will be fought by every lane.

### 3.8 TSDoc root policy
The inventory's `rootPolicy` requires custom tags in `tsdoc.json` (`requiredTsdocCustomTags`, `JSDocDocumentationInventory.ts:243`). Leave `tsdoc.json` alone.

## 4. Consumers that HASH bytes or tokens

| Path | What breaks | Rule |
| --- | --- | --- |
| `cli/test/root-tasks-turbo-inputs.test.ts:525-566` | sha256 of nine live files: walker `Expand.ts` and `Descend.ts`, `JSDocDocumentationInventory.ts`, `QualityArtifactSupport.ts`, `JSDocRatchet.ts`, `EffectImports.ts`, `ProjectFactory.ts`, `FsUtils.ts`, `WorkspacePatterns.ts`. The loop stops at the first mismatch. | Confirm only comments changed, recompute all nine, re-pin in the same PR. |
| `cli/src/commands/Lint/internal/EffectVitestDetectors.ts:3391-3438` | `statementTokenParts` hashes `getChildren()` leaves *including* ts-morph synthetic comment nodes and JSDoc. MEASURED: own-line comments and JSDoc add a leaf; trailing comments and comments inside an argument list do not. 22 of 659 findings contain such nodes, 21 of them `exception`. The key also contains `evidence`, 200 chars of raw node text (`Lint.schemas.ts:1861`), and at least four EV009 rows quote a comment (`apps/professional-desktop/test/composer-dispatch-confirm.test.ts:76,101`, `packages/agents/client/test/selected-thread-lifetime.test.ts:20`, `packages/ontology/client/test/workbench-state-lifetime.test.ts:35`). | Either fix the digest to skip comment kinds (the next row shows the pattern) and re-baseline once, or re-review each row. `--write` drops the exception reason when the occurrence changes. |
| `cli/src/commands/Lint/internal/SchemaFirstDetectors.ts:2001` | `normalizedTokenText` skips comments. | Safe. Model for fixing the previous row. |
| `cli/src/commands/Ci/CiBinaryClosure.ts:275` | Digest of every file the CI binary bundles moves. The PR itself is gated by the pinned binary in `.github/actions/fetch-beep-ci/action.yml`, not by its own head. | After merge `beep-ci-binary.yml` builds a release and opens a pin-bump PR. No hand edit. Expect one per merged wave that touches the closure. |
| Alchemy CI-runner Lambdas (`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts:13-18`) | Alchemy hashes each function zip with its source map; the map embeds module text. Any comment edit in a handler-reachable module changes the code hash and **redeploys production runner functions** on the next armed deploy. | Isolate these modules in one named slice, deploy deliberately. |
| `packages/law-practice/use-cases/test/fixtures/eyecite/divergences.json` | Digests of 120 live source and test files, checked by `goals/citation-extraction-engine/ops/check-divergences.ts:97-112`. Run only by `citation:parity-check` (`packages/law-practice/use-cases/package.json:34`); no CI workflow calls it (grep of `.github`, `turbo.json`, `lefthook.yml`). The Python exporter was deleted. | Already operator-run. Re-export path needs a TS writer, or exempt the 120 files. |
| same directory: `canonical-cases.json` (26 files), `vocabulary-mapping.json`, `typescript-extensions.json`; `packages/law-practice/domain/test/fixtures/bluebook-layout.json` | Same family; the last three pin goal ops files. | Same. |
| `packages/law-practice/server/test/fixtures/claim-element/implementation-freeze.json` | 6 files still match; verified by `test/evaluation/positive.main.ts:113` and siblings, which are manual programs. | Historical once edited; note it, do not re-pin. |
| `goals/**` evidence | about 360 files in ten packets record digests that still match live files, up to 742 live files for one packet (`boolean-creep`; then `turborepo-*`, `claim-check-performance`). | Point-in-time evidence. I found no CI reader that re-hashes live source against them. Leave. |
| `skills-lock.json` | Pins three files under `.claude/skills/shadcn/`. `biome.jsonc` documents that vendored skills stay byte-exact. | Exempt vendored skill roots. |
| `.gitleaks.toml` | Contains the same digests as literals to silence scanner hits on goal evidence; it does not hash source. | Safe. |
| `standards/policy-tools.fingerprint.json` | Lists files, not hashes; built from the TypeScript AST (`PolicyFingerprintGraph.ts:306`). | Safe unless an import changes. Policy tasks re-run because inputs changed. |
| `standards/cache-baseline/**` | Digests of `turbo.json` files, commands and review docs. | Safe unless a `doctest` script disappears (3.5). |
| Turbo task hashes | Every touched package and its dependents go cold. | Plan few, large waves; one hosted run each. |

Method for the hash rows (MEASURED): sha256 and git-blob sha1 of all 11,137 tracked TS/JS files, searched as hex in every tracked text file. Digests of *concatenated* or *derived* content would escape this; CiBinaryClosure and the Lambda bundles are two such cases found by reading.

## 5. Consumers that count or pin LINES

- **`standards/schema-first.inventory.jsonc`**: `makeSchemaFirstEntryKey` (`cli/src/commands/Lint/Lint.schemas.ts:858`) includes `line` when there is no `occurrence`; 106 entries in 83 files. A shift makes `lint schema-first` red with one missing plus one stale entry (`SchemaFirstScan.ts:617-618,694`). `--write` re-matches by line-free identity and keeps the reason when the identity is unique; MEASURED: no duplicate identities exist among the 106 today, so `--write` is lossless.
- **`standards/effect-vitest.inventory.jsonc`**: `id` embeds line and column but membership ignores both except the `#n` ordinal. Line shifts are benign there. However `cli/src/commands/Knowledge/Knowledge.refs.ts:2613` trusts host-path evidence only when `line:endLine` still matches source. MEASURED: 0 rows currently contain `/tmp` or `/home`, so it is dormant.
- **Coverage baseline** (`standards/coverage.regression-baseline.jsonc`): percentages per file with epsilon 0.001. Comment lines carry no statements, so I expect no movement (UNVERIFIED by a run). The real cost is that touched packages are re-measured, which can surface inherited rows.
- **Fallow health baseline**: counts per file, no lines. `maxUnitSize: 60` can only improve.
- **`.beep/effect-vitest/census.json`** has bytes and lines per test file but is untracked output.
- **Markdown `path:line` citations**: about 9,800 across tracked md/json/yml (7,010 in goals, 776 in explorations, 22 in `standards/effect-first-development.md`, 79 in `docs/agent-memory-infra`). Knowledge refs resolve path and symbol; I found no line-range check in `Knowledge.refs.ts`. They go stale silently.
- **`check-census`**: type instantiations; comments do not count. Unaffected.
- **`PrivateHomePaths` sealed-archive rows** fail on a count mismatch (`cli/src/commands/Laws/PrivateHomePaths.ts:360-375`). Those rows cover archives. Frozen goal files under `goals/**` must stay byte-identical anyway.

## 6. Consumers that PARSE comment text for behavior

| Consumer | Reads | If deleted |
| --- | --- | --- |
| TypeScript | `/// <reference`, `@ts-expect-error` (160 in test), `@ts-nocheck` (generated) | type errors; expect-error is the assertion in type tests |
| TypeScript, one package | `stripInternal: true` in `packages/ecosystem/effect-drizzle/tsconfig.json:9` and the package template `CreatePackage/templates/tsconfig.json.hbs:9`; base note says it flips on publish (`tsconfig.base.json:40`) | `@internal` members appear in emitted `.d.ts` |
| Biome | 220 `biome-ignore*`; `{@link X}` counts as a use of an import | 3 new `noUnusedImports` in D: `EdgeVersion.behavior.ts`, `PackageManagerRange.ts`, `BlobStore.githubCache.ts` (MEASURED). Comments also split import chunks: 57 files re-sort in A |
| Fallow | `fallow-ignore-next-line`, `fallow-ignore-file` with reason; `@public`, `@internal`, `@expected-unused` | findings return; a directive left alone is a stale suppression |
| `@effect/tsgo` | `@effect-diagnostics`; admitted only in two root files as an exact untrimmed line (`Quality.command.ts:369-520`), and "reasons live in the comment above the directive" is the documented format | 6 directives in `vitest.setup.ts`/`vitest.shared.ts`; keep the reason comment or change the format |
| Coverage | `istanbul ignore next` (23) | branch counts drop |
| Vitest | `@vitest-environment` docblock (33 files) | wrong environment |
| Bundlers | `#__PURE__`/`@__PURE__` (319), `@vite-ignore` (4), `webpackIgnore` (`ConfigDependencyHooks.ts:788`) | tree-shaking loss; `IdentityRegistration.ts:449` fails registration when a leaf lacks the annotation |
| oxlint | `oxlint-disable-next-line` (8) | `no-deprecated` findings |
| gitleaks | `gitleaks:allow` (77, 72 generator-emitted by `IanaMediaTypes.ts:553`) | Secret Scanning red |
| Semgrep | `nosemgrep` (5), `ruleid:`/`ok:` | SAST red |
| `@deprecated` readers | Biome `noDeprecatedImports`, oxlint `no-deprecated` | no live `@deprecated` tag in enforced source today, but the tag must stay legal |
| Schema-first | leading comment block in first 800 chars matching generated wording, including "generated by" and "do not edit" (`SchemaFirstSchemaClass.ts:22-24,416`) | file leaves or enters the plain-data exemption |
| EffectImports law (writer) | copies leading and trailing import comments (`EffectImports.ts:1144-1163`) | none |
| TSMorph outline | JSDoc on symbols (`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.shared.ts:223`) | outline loses text; tests assert names and fixture content, not live JSDoc |
| Knowledge doctor | blanks block comments before scanning exports (`KnowledgeDoctor.domain.ts:559-590`) | safe; deletion only removes work |
| effect-schema-inventory | upstream Effect's JSDoc at the pin (`EffectSchemaInventoryExtract.ts:97-153`) | unrelated to this repo's comments |
| Tailwind v4 | scans raw source through `@source` (`packages/foundation/ui-system/ui/src/styles/globals.css:16`), comments included | a class mentioned only in a comment drops out of CSS. I found no intentional safelist comment; visual effect UNVERIFIED |
| React/Storybook docgen | Storybook's React docgen can read prop JSDoc; no explicit autodocs setting found in `apps/storybook/.storybook` | UNVERIFIED |

Not consumers, checked: `standards/schema-catalog`, `standards/instrumentation-catalog`, `effect-laws.allowlist` (AST-based, keyed by file/kind), effect-vitest "reason" (stored in the inventory, not in a comment; must contain `Owner:` and `Exit:`, `Lint.schemas.ts:1260`), MCP and CLI descriptions (from schema annotations), `repo-exports.catalog` (no such tracked file or generator remains; only ignore globs in `biome.jsonc:66` and `turbo.json:6424`), changesets (every real workspace manifest is `private: true`, and private packages are skipped by `changeset-status`), RoadmapRefs (Markdown only).

## 7. Tests that read source text

15 suites glob `src/**/*.ts?raw` and about ten more use `readFileString`. The ones I read assert *absence* of imports or tokens, or extract import edges after stripping comments, so deletion is safe. I read `github-actions`, `cli-kit`, `repo-workspaces`, `gate-report`, `markdown/stringify-scalability`, `observability`, `effect-first-regressions`, `yaml`, `PartyContactSource`, `github/reachability` and `execution-authority-recording` at the assertion; the rest only at the loader. Members: `cli-kit/test/boundary.test.ts`, `runtime-env/test/support/sources.ts`, `xdg/test/support/rawModules.ts`, `github-reporting/test/reachability.test.ts`, `sbom` and `package-json` support graphs, `schema-org/test/sources.ts`, `skill-contract`, `repo-workspaces/test/support/sourceGraph.ts`, `gate-report/test/Dispatch.test.ts:415`, `markdown/test/stringify-scalability.test.ts:118-130`, `observability/test/Boundary.test.ts:87-130`, `repo-configs/test/effect-first-regressions.test.ts`, `github/test/reachability.test.ts`, `law-practice/server/test/PartyContactSource.boundary.test.ts:104-120`, `professional-desktop/.../execution-authority-recording.pglite.test.ts:62`.

Two positive assertions on live source: `ci-runner-security.test.ts:1930` requires quoted env names in `CiOperational.service.ts` (they are code literals), and `quality-tasks.test.ts:1506` requires the semgrep markers. Generator tests compare whole files: `foundation/modeling/html/test/Generate.check.test.ts`, `technical-drawing/test/Generate.check.test.ts`, `drivers/govinfo/test/Govinfo.generated.test.ts`. I screened by reading plus a literal search; I did not execute suites against a stripped tree, so a regex-based positive assertion could remain (UNVERIFIED).

## 8. Producers that will re-create comments

A ban without these changes goes red on the next scaffold or regeneration:
- Templates: 57 `.hbs` files under packages, e.g. `CreatePackage/templates/src-index.ts.hbs` (module header), `vitest.config.ts.hbs` (the "Package-specific overrides" prose repeated across packages).
- `CreatePackage/internal/IdentityExportBlock.ts`: emits a JSDoc block with a doctest fence per identity export.
- `Architecture/internal/ModelFirstTemplates.ts` and `TemplateRetarget.ts`: new slices are rendered from live `packages/architecture-lab` sources (`Architecture.plan.ts:297`), so cleaning that package cleans future slices.
- `SyncDataToTs/targets/*.ts`, codegen-kit OpenAPI output, `foundation/modeling/html/scripts/generate.ts`.
- Vendored ports mark upstream deviations with `// beep:` lines (over 100 groups in `packages/drivers/duckdb`) and `KIT EXTENSION` fences (`packages/tooling/test-kit/memfs/src/internal/volume.ts`). No tool reads them, but they are the resync ledger: move to a per-package `UPSTREAM.md`-style record before deletion.
- `KEEP (D-nn)` prose: 120 notes carry the reason for a `no-hand-rolled-git-gh-spawn` or spawner-double suppression. The GritQL messages and `registry.test.ts:203-211` document the form `biome-ignore …: KEEP (D-nn): <reason>` on one directive, so the two-comment form is already off the documented shape. 123 directives say "above".

## 9. Exempt syntaxes (complete list for the rule)

Match on the raw comment (after `//` or `/*`), anchored at the first non-space, with the exact tokens; never by prefix words.

1. `#!` hashbang (not a comment node in most parsers; keep anyway).
2. `/// <reference …>`, `/// <amd-…>`.
3. `@ts-expect-error`, `@ts-nocheck`, `@ts-check`; `@ts-ignore` should be reported, not exempt.
4. `biome-ignore`, `biome-ignore-all`, `biome-ignore-start`, `biome-ignore-end`.
5. `fallow-ignore-next-line`, `fallow-ignore-file`.
6. `oxlint-disable*`/`oxlint-enable`; `eslint-disable*` only in generated files (one stray: `packages/drivers/duckdb/src/DuckDbMessageStorage.service.ts:16`, no ESLint here).
7. `@effect-diagnostics`, `@effect-diagnostics-next-line` (already policed elsewhere).
8. `istanbul ignore …`, `v8 ignore …`, `c8 ignore …`, `node:coverage …`.
9. `@vitest-environment`, `@vitest-environment-options`.
10. `#__PURE__`, `@__PURE__`, `#__NO_SIDE_EFFECTS__`, `@__NO_SIDE_EFFECTS__`, `@__INLINE__` family.
11. `@vite-ignore`, `webpack[A-Z]\w*:`, `turbopack[A-Z]\w*:`.
12. `@jsx`, `@jsxRuntime`, `@jsxImportSource`, `@jsxFrag`.
13. `gitleaks:allow`, `nosemgrep`, and `ruleid:`/`ok:`/`todoruleid:`/`todook:` in `.semgrep/**` only.
14. `sourceMappingURL=`, `sourceURL=`.
15. `#region`/`#endregion` where a doc extractor uses them (only `scratchpad/osdk` today; out of scope).
16. License and provenance: `SPDX-License-Identifier`, `Copyright`, `@license`, `@preserve`, "Ported from"/"Port of" notices. Required by `THIRD_PARTY_NOTICES.md` practice and the port-with-attribution ruling.
17. Generated-file headers (`GENERATED FILE`, `@generated`, `DO NOT EDIT`, `Generated by`), and all files under generated/`_generated`/`*.gen.*`.
18. Managed-section markers, when a TS host appears (`packages/foundation/modeling/managed-section/src/CommentStyle.ts` supports `slash` and `block`; current writers use HTML).
19. JSDoc blocks: exported declarations, module headers with `@packageDocumentation`, public class methods in tooling src, any block carrying `@internal`, `@public`, `@expected-unused`, `@ignore` or `@deprecated`, and any block with an `import.meta.vitest` fence.
20. Everything inside a fenced example (`// =>`, `// value`, `@ts-expect-error`): the rule works on real comment nodes, so these are never visited. Do not implement the rule with a regex over text.
21. Paths: `goals/**`, `explorations/**`, `research/**`, `scratchpad/**`, `.repos/**`, vendored skills, `infra/ci-runners/sdks/**`, `**/vendor/**`, `**/test/fixtures/**`, `.semgrep/**`, `*.d.ts`.

Deletion hygiene the codemod must honor: remove the whole JSX container for `{/* … */}` (177 prose comments sit between braces, most of them JSX or placeholder objects such as `{ // Package-specific overrides }`); never leave a suppression separated from its target; re-run `biome check --write`; drop imports used only by deleted `{@link}`s.

## 10. Regeneration order for one wave

1. Edit. 2. `biome check --write` on touched files. 3. `bun run beep lint schema-first --write`. 4. effect-vitest: diff the occurrence rows, re-review, restore reasons. 5. `bun run beep lint package-scripts --write` if any doctest block went. 6. JSDoc inventory plus ratchet if any JSDoc went. 7. Re-pin scanner seals if one of the nine files is touched. 8. Fallow dead-code and audit. 9. `citation:parity-check` inputs noted for law-practice. CI binary pin follows by itself after merge.

## 11. Where the ban itself should live

Biome GritQL is the repo preference for syntactic guards, but the decision needs attachment (exported? public method? doctest fence?), and all 13 existing grit rules match code patterns, none match comments. `docs.ts` already has `getAllComments`, attachment, export detection and an exempt-path config, so the rule fits `@beep/lint-rules` as a fourteenth docs rule, or a sibling in the main plugin when tests are included: `.oxlintrc.docs.json` ignores all tests, `.oxlintrc.json` does not. Ratchet precedent to copy: `JSDocRatchet.ts` totals (line-free, fail on growth). Do not copy schema-first's line key or effect-vitest's comment-inclusive digest.
