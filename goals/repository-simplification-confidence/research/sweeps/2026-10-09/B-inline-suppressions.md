# Gap follow-up 5 — inline suppressions and config-level exclusions

## Gap follow-up (2.B items 2-5 (honest zero debt; no relabelling ordinary debt as exceptions or broad exclusions))

Provenance: lane `rsc-packet`, branch `docs/repository-simplification-confidence-packet`, head `e62411d63f` (= `main`), swept 2026-10-09. Read-only. Tools: `git ls-files` (tracked files minus `.repos/`, `goals/`, `explorations/`, `research/`, `node_modules/`: 9,559 files), `rg`, a Python classifier over those files (directive = token preceded only by a comment opener and not inside a string literal; `.md`/`.changeset` hits count as mentions), Python JSONC parse of `.fallowrc.jsonc` and `biome.jsonc`, `sed`/`grep` of `.oxlintrc*.json`, `eslint.config.mjs`, `repo-configs` ESLint profiles, `.semgrepignore`, `_typos.toml`, `knip.jsonc`. No linter was run. Fallow 3.32 inline syntax was checked in `node_modules/fallow/skills/fallow/references/cli-reference.md` (`fallow-ignore-next-line [rule]`, `fallow-ignore-file [rule]`). typos 1.x has no inline-comment directive; its only escape hatches are `_typos.toml` `extend-words` and `[files] extend-exclude`.

### Headline

- **407 inline directives** across tracked source: fallow-ignore 244, `@ts-expect-error` 94, `cspell:` 36, `biome-ignore` 26, `nosemgrep` 5, `oxlint-disable` 2. **Zero** `eslint-disable`, `@ts-ignore`, `@ts-nocheck`, typos-inline. There are also 14 prose or string mentions that are not directives (listed at the end).
- **3 unjustified directives** (no same-line or previous-line reason):
  - `packages/foundation/capability/chalk/src/Chalk.ts:57` and `Chalk.browser.ts:53`: file-scope `// oxlint-disable typescript-eslint/no-unsafe-declaration-merging`. These directives are also **dead**: `.oxlintrc.json` turns every native oxlint category `off` and enables only `beep/*` jsPlugin rules, so the suppressed rule never runs. Biome's twin rule `noUnsafeDeclarationMerging` is already `off` globally (`biome.jsonc:217`).
  - `packages/foundation/modeling/utils/test/Struct.test.ts:73`: a bare `// @ts-expect-error`.
- **36 `cspell:` comments are inert.** No cspell binary or config is installed (`node_modules/.bin` has none, and neither `package.json` nor any tracked config names cspell). The repo spell-checks with `typos`. Either delete these comments or move their words into `_typos.toml` if typos flags them.
- **No directive sits on a workstream-A path.** The Impeccable detector's `inline-ignores.mjs` only mentions `eslint-disable` in prose. The config-level exclusions on A paths are listed below.
- fallow `require-suppression-reason: "error"` (`.fallowrc.jsonc:613`) holds: all 244 fallow pragmas carry `-- <reason>`. Having a reason does not make an entry an exception, though:
  - 35 reasons say "pre-existing".
  - 28 say the finding is a diff-attribution or "re-entered the diff" artifact.
  - 29 defer the work: "future … candidate", "graduation-time work", "until".
  - These are ordinary debt carried under an exception label (brief 2.B item 4). Example: `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:2911,3186,3443`.
- **25 consumer-local `PosInt.ts` copies** each carry `fallow-ignore-file code-duplication` with the same reason, which points to the retired `@beep/schema` `PosInt`. That is one design decision suppressed 25 times. It should become one exception record, or one shared home.
- `.fallowrc.jsonc` `audit.gate: "new-only"` (`:601`) means fallow's PR gate rejects only new findings. Whatever the regression baselines (`standards/fallow.health.regression-baseline.jsonc`, 17.9 KB; `standards/fallow.dead-code.regression-baseline.jsonc`) absorb is not gated. The dead-code baseline records 0 issues, but it was recorded at fallow **3.15.0** and SHA `48b0a590d6` on 2026-08-16, which is stale against the installed 3.32.0.

### Inline directive totals

| Kind | Directives | src | test/story/fixture | justified | unjustified | file-scope |
|---|---:|---:|---:|---:|---:|---:|
| `fallow-ignore` | 244 | 226 | 18 | 244 | 0 | 53 |
| `@ts-expect-error` | 94 | 6 | 88 | 93 | 1 | 0 |
| `cspell` | 36 | 35 | 1 | 36 | 0 | 0 |
| `biome-ignore` | 26 | 25 | 1 | 26 | 0 | 1 |
| `nosemgrep` | 5 | 1 | 4 | 5 | 0 | 0 |
| `oxlint-disable` | 2 | 2 | 0 | 0 | 2 | 2 |
| `eslint-disable` | 0 | 0 | 0 | 0 | 0 | 0 |
| `@ts-ignore` | 0 | 0 | 0 | 0 | 0 | 0 |
| `@ts-nocheck` | 0 | 0 | 0 | 0 | 0 | 0 |
| `typos-inline` | 0 | 0 | 0 | 0 | 0 | 0 |
| **total** | **407** | | | **404** | **3** | |

### By rule id

| Kind | Rule / mode | Count |
|---|---|---:|
| `@ts-expect-error` | `(n/a)` | 94 |
| `biome-ignore` | `lint/suspicious/noUndeclaredEnvVars` | 14 |
| `biome-ignore` | `lint/security/noDangerouslySetInnerHtml` | 4 |
| `biome-ignore` | `lint/suspicious/noExplicitAny` | 3 |
| `biome-ignore` | `lint/suspicious/noConsole` | 1 |
| `biome-ignore` | `format` | 1 |
| `biome-ignore` | `lint/performance/noDynamicNamespaceImportAccess` | 1 |
| `biome-ignore` | `lint/a11y/noLabelWithoutControl` | 1 |
| `biome-ignore` | `assist/source/organizeImports` | 1 |
| `cspell` | `cspell:ignore` | 18 |
| `cspell` | `cspell:words` | 14 |
| `cspell` | `cspell:word` | 3 |
| `cspell` | `cspell:disable-next-line` | 1 |
| `fallow-ignore` | `fallow-ignore-next-line code-duplication` | 116 |
| `fallow-ignore` | `fallow-ignore-next-line complexity` | 73 |
| `fallow-ignore` | `fallow-ignore-file code-duplication` | 47 |
| `fallow-ignore` | `fallow-ignore-file unused-file` | 6 |
| `fallow-ignore` | `fallow-ignore-next-line unused-type` | 1 |
| `fallow-ignore` | `fallow-ignore-next-line unused-export` | 1 |
| `nosemgrep` | `javascript.lang.security.audit.unknown-value-with-script-tag.unknown-value-with-script-tag` | 4 |
| `nosemgrep` | `typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml` | 1 |
| `oxlint-disable` | `typescript-eslint/no-unsafe-declaration-merging` | 2 |

Notes:
- The `@ts-expect-error` rows are 88 test/fixture and 6 src. 72 of them are in `packages/ecosystem/effect-drizzle/test/{fixtures,sqlite-fixtures}.ts`, all with `invariant:` reasons. These are type-level negative tests (legitimate contract assertions), not debt.
- `biome-ignore` (26):
  - 14 are `noUndeclaredEnvVars`, justified by Biome not reading turbo `global.passThroughEnv`. This duplicates the `allowedEnvVars` workaround at `biome.jsonc:204-211`, so it is a candidate to fold into config.
  - 4 are `noDangerouslySetInnerHtml` (static build-time content and Mermaid SVG).
  - 3 are `noExplicitAny` (`effect-drizzle/src/core/Field.ts:50`, `core/variant.ts:150`, `primitive/types/src/TUnsafe.types.ts:27`).
  - 1 is `format` in the generated `biome.identity.jsonc:1`.
- `nosemgrep` (5) matches the A-retained-tools note: `editor/src/mermaid-view.tsx:770`, `editor/test/mermaid-race.test.tsx:587`, `cli/test/research-library-views.test.ts:202,218,223`. The last three are justified by a previous-line comment, not inline `--`.
- Generated-file directives: 6 `fallow-ignore-next-line code-duplication` at line 40 of each `packages/foundation/modeling/rdf/src/Vocab/generated/*.terms.ts`. The generator emits them; fix that in the generator, not the files.
- `scratchpad/**` is tracked and holds 5 directives (1 fallow, 4 ts-expect-error). Every linter excludes it.

### Per-package directive table

| Package dir | fallow | ts-expect-error | biome | nosemgrep | oxlint | cspell | total |
|---|---:|---:|---:|---:|---:|---:|---:|
| `packages/ecosystem/effect-drizzle` | 11 | 72 | 2 | 0 | 0 | 0 | 85 |
| `packages/tooling/tool/cli` | 66 | 0 | 9 | 3 | 0 | 6 | 84 |
| `apps/professional-desktop` | 6 | 0 | 4 | 0 | 0 | 6 | 16 |
| `packages/foundation/ui-system/ui` | 10 | 2 | 2 | 0 | 0 | 2 | 16 |
| `packages/drivers/venice-ai` | 10 | 0 | 0 | 0 | 0 | 0 | 10 |
| `(root)` | 8 | 0 | 1 | 0 | 0 | 0 | 9 |
| `packages/foundation/ui-system/editor` | 4 | 0 | 1 | 2 | 0 | 2 | 9 |
| `packages/drivers/xai` | 8 | 0 | 0 | 0 | 0 | 0 | 8 |
| `packages/drivers/ffmpeg` | 7 | 0 | 0 | 0 | 0 | 0 | 7 |
| `packages/foundation/modeling/rdf` | 6 | 0 | 0 | 0 | 0 | 1 | 7 |
| `packages/foundation/ui-system/dock-react` | 7 | 0 | 0 | 0 | 0 | 0 | 7 |
| `packages/tooling/library/repo-utils` | 0 | 0 | 1 | 0 | 0 | 6 | 7 |
| `apps/oip-web` | 4 | 0 | 2 | 0 | 0 | 0 | 6 |
| `packages/drivers/exiftool` | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| `packages/foundation/modeling/html` | 0 | 5 | 0 | 0 | 0 | 1 | 6 |
| `packages/foundation/modeling/schema` | 2 | 3 | 0 | 0 | 0 | 1 | 6 |
| `packages/foundation/ui-system/dock` | 6 | 0 | 0 | 0 | 0 | 0 | 6 |
| `apps/labs/semantica` | 5 | 0 | 0 | 0 | 0 | 0 | 5 |
| `scratchpad` | 1 | 4 | 0 | 0 | 0 | 0 | 5 |
| `apps/storybook` | 2 | 0 | 2 | 0 | 0 | 0 | 4 |
| `packages/architecture-lab/use-cases` | 4 | 0 | 0 | 0 | 0 | 0 | 4 |
| `packages/foundation/modeling/identity` | 0 | 4 | 0 | 0 | 0 | 0 | 4 |
| `packages/law-practice/use-cases` | 1 | 3 | 0 | 0 | 0 | 0 | 4 |
| `apps/labs/ciops` | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| `apps/practice-kg-mcp` | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| `packages/foundation/capability/chalk` | 1 | 0 | 0 | 0 | 2 | 0 | 3 |
| `packages/foundation/capability/technical-drawing` | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| `packages/foundation/modeling/lexical` | 1 | 0 | 0 | 0 | 0 | 2 | 3 |
| `packages/foundation/modeling/pandoc-ast` | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| `packages/tooling/policy-pack/repo-configs` | 0 | 0 | 0 | 0 | 0 | 3 | 3 |
| `infra` | 0 | 0 | 0 | 0 | 0 | 2 | 2 |
| `packages/agents/server` | 1 | 0 | 0 | 0 | 0 | 1 | 2 |
| `packages/agents/use-cases` | 1 | 0 | 0 | 0 | 0 | 1 | 2 |
| `packages/drivers/acp` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/firecrawl` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/govinfo` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/m365` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/occt` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/pdf-tools` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/poppler` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/drivers/sanity` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/foundation/capability/file-processing` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/foundation/capability/nlp-processing` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/foundation/modeling/utils` | 0 | 1 | 0 | 0 | 0 | 1 | 2 |
| `packages/law-practice/server` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/ontology/ui` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `packages/tooling/library/qa-capture` | 2 | 0 | 0 | 0 | 0 | 0 | 2 |
| `apps/labs/lejeune-bolt-workbench` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `apps/todox` | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `packages/drivers/ai-provider-cli` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/anthropic` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/box` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/drizzle` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/graph-3d` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/hubspot` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/nlp-mcp` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/obs` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/onepassword-cli` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/openai-compat` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/openai` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/openclaw` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/phoenix` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/tesseract` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/tika` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/drivers/uspto-mcp` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/epistemic/domain` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/epistemic/server` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/epistemic/use-cases` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/foundation/capability/langextract` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/foundation/primitive/types` | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `packages/law-practice/domain` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/ontology/domain` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/ontology/use-cases` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/shared/domain` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/tooling/library/ai-metrics` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/tooling/library/ai-sync` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |
| `packages/tooling/tool/docgen` | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| `packages/workspace/server` | 1 | 0 | 0 | 0 | 0 | 0 | 1 |

### Config-level exclusions

#### `.fallowrc.jsonc` (615 lines)

| Block | Line | Entries | Reason comments | Workstream-A / stale entries |
|---|---:|---:|---|---|
| `entry` | 7 | 74 globs | partial | `:93` `.claude/skills/impeccable/scripts/detector/cli/main.mjs` (A). 27 globs match no tracked file, e.g. `:13` `apps/*/src/main.ts`, `:40` `apps/labs/*/src/index.ts`, and the `apps/labs/*/src/app/**`, `middleware.ts`, `instrumentation.ts` families |
| `ignorePatterns` | 111 | 29 | most entries commented. The header `:110` says "Knip remains authoritative", which goes stale once Knip retires | `:113` `.github/skills/impeccable/**` (A). `:135-136` `packages/canvas/client/**` and `packages/canvas/ui/**` match **nothing** and have no comment. Broad entries: `goals/**`, `scratchpad/**`, `**/test/fixtures/**`, `**/examples/**`, and 4 generated `_generated/**` trees (justified) |
| `ignoreFindings` | 188 | 1 | yes | `.claude/skills/impeccable/**` (A): delete with Impeccable |
| `ignoreIssues` | — | 0 | — | key absent in fallow config (it exists only in `knip.jsonc:161`) |
| `ignoreUnresolvedImports` | 192 | 13 | yes: a fallow `.ts`→`.tsx` resolution gap, "remove when Fallow supports" | a tool limitation with a removal condition but no date or owner. Includes `**/plugins.ts` (check against the A "plugins" retirement) |
| `ignoreDependencies` | 207 | 45 | roughly 25 commented | `:220-223` css-select, css-tree, domutils, htmlparser2 exist only for the Impeccable detector (A). `:233` `@typescript-eslint/parser` and `:240-241` eslint-plugin-jsdoc/tsdoc are still used by ESLint profiles. `:280-282` three OTel deps were "staged 2026-06-12 … remove when wiring lands", which is 4 months open with no owner. About 20 entries have no comment (`@effect/vitest`, `tailwindcss`, `ws`, `@types/ws`, `@beep/repo-utils`, `@beep/test-utils`, `tsgo`, babel plugins…) |
| `ignoreDependencyOverrides` | 291 | 16 | one block comment | security-floor pins plus 7 `@effect/tsgo-*` platform binaries |
| `ignoreExports` | 314 | 6 files / 22 symbols | yes | `:318` `apps/canvas/src/commandBridge.ts` **does not exist**. 14 `OipContent.model.ts` symbols are kept "for barrel consumers", which is a broad public-surface exemption |
| `duplicates.ignore` | 361 | 2 | yes | `.claude/skills/impeccable/**` (A) |
| `health.ignore` | 378 | 2 | yes | `.claude/skills/impeccable/**` (A) |
| `health.thresholdOverrides` | 379 | 27 entries / 28 functions | every entry has `reason` + "Review by" date | 12 are "attribution artifact, not a budget" (11 `effect-drizzle` plus `repo-utils` `JSDocCategories.ts`), review by 2026-11-30. `MixedOutputJson.ts`: review by 2026-11-10. 14 UI/parser/scanner ceilings: review by 2026-12-03. Largest: `pg/model.ts collectPgModelState` (maxCrap 269), `link-preview.tsx` and `todo-item.tsx` (maxCrap 651) |
| `rules` offs | 604-608 | 3 | `unused-catalog-entries` has a reason; `duplicate-exports` and `empty-catalog-groups` have **none** | — |
| `audit.gate` | 601 | `new-only` | none | baseline-absorbing gate (see headline) |

#### `biome.jsonc` (317 lines)

- **43 rules globally `off`** (`:147-243`): a11y 5, complexity 8, correctness 9, performance 2, suspicious 16, style 3. **None carries a reason comment.** The only comments in the rules block justify the `warn` rules (`noUselessConstructor` `:155`, `noConsole` `:194`, `noUndeclaredEnvVars` `:199`). Some offs may be deliberate overlap removal or effect-smol alignment, e.g. `noForEach`, `noStaticOnlyClass`, `noBannedTypes`. Others are classic correctness and debt-hiding rules: `noUnusedVariables`, `useExhaustiveDependencies`, `useHookAtTopLevel`, `noDoubleEquals`, `noRedeclare`, `noDuplicateObjectKeys`, `noSelfCompare`, `noNonNullAssertion`, `noArrayIndexKey`. This is the largest unreviewed exclusion surface in the sweep.
- 5 advisory `warn` rules: `noDangerouslySetInnerHtml`, `noUselessConstructor`, `noConsole`, `noUndeclaredEnvVars`, `noExplicitAny`.
- `assist.useSortedKeys` `level: "off"` (`:122`) has a reason (preserves pre-2.5.1 behaviour).
- `overrides` (`:256`): 5 blocks, 1 rule-off: `noConsole: "off"` for 14 test/script/story/bin globs (`:295-314`, commented). The two formatter or size overrides target `goals/**` evidence files (commented).
- `files.includes`: 47 negations. Impeccable is excluded at `:28-29` (A). `biome.identity.jsonc` is a generated per-profile copy of the same rule set (`// biome-ignore format: Generated by beep cache profile`), so the 43 offs appear there too.
- `scratchpad/effect-ontology/biome.jsonc:40` turns `noUnusedVariables` off in a nested config.

#### `.oxlintrc.json` / `.oxlintrc.shadcn.json`

- `.oxlintrc.json` (47 lines): all 7 native categories `off`, by design (comment `:2-9`). Only 6 `beep/*` rules are on: 3 error, 3 warn. The header says promoting the advisory rules is "tracked in the SPEC exception ledger (re-assess 2026-09-20)". **That date is 19 days past** and the file was last touched 2026-09-08. 15 `ignorePatterns`, including `.claude/**`, `**/scripts/**`, `goals/**`, `explorations/**`.
- `.oxlintrc.shadcn.json` (88 lines): categories off by design. 6 shadcn rules, all `error`. One override turns `shadcn/no-restyle` and `shadcn/require-static-classes` **off** for `packages/foundation/ui-system/ui/src/components/**` (commented: design-system components style themselves). 13 `ignorePatterns`, including `**/src-tauri/**` and `.claude/**`.

#### ESLint

- `eslint.config.mjs` `globalIgnores`: 9 entries, commented. `.claude/skills/impeccable/**` and `.github/skills/impeccable/**` are A paths.
- `packages/tooling/policy-pack/repo-configs/src/eslint/DocsESLintConfig.ts`:
  - The top-level `ignores` (`:67`) is 16 globs. It includes `apps/labs/**`, justified by the goals/lab-apps-lifecycle D2 ceremony exemption.
  - The tooling-JSDoc block ignores `src/internal/**` and test files (`:91`).
  - Off rules: `jsdoc/require-description` and `jsdoc/match-description` for `**/tag-values/**` (`:220-224`), with no comment. The tsdoc block ignores tests, stories and `internal/**` (`:255`).
- `DeprecatedApisESLintConfig.ts:20-40`: build-output ignores, commented, including `apps/*/src/app/sw.ts`.
- No ESLint rule is turned off file-wide in source. The repo has zero `eslint-disable` comments.

#### `.semgrepignore` (13 lines)

- 6 path entries. The Impeccable ×2 entries are A paths.
- `apps/desktop/scripts/dev-with-portless.ts` **does not exist** (stale).
- `goals/**/history/outputs/` matches 19 directories.

#### `_typos.toml` (146 lines)

- 71 `extend-words` entries, about 50% with a group or line comment.
- 43 `extend-exclude` globs, most commented. Several are redundant with `.gitignore`: `node_modules`, `dist`, `.next`.
- No inline-ignore mechanism exists, so there is nothing to count inline.

#### `knip.jsonc` (A: retire wholesale)

Its exclusion blocks retire with the file:
- `ignore` (`:129`): 12 entries; `tools/skillopt/**` appears twice.
- `ignoreIssues` (`:161`): Impeccable, 8 issue types.
- `ignoreFiles`, `ignoreDependencies` (3 at root plus 9 workspace-level), `ignoreBinaries` (6), `ignoreWorkspaces` (2).

The debt it hid must transfer through the Knip 41-finding capture (brief §269), not disappear.

### Proposed plan (implementing lane)

1. Delete the 2 dead chalk `oxlint-disable` lines. Add a reason to `Struct.test.ts:73`.
2. Delete the 36 inert `cspell:` comments. Before deleting, run `typos` once on the affected files and move any word typos actually flags into `_typos.toml`.
3. Remove the stale and A-path config entries:
   - `.fallowrc.jsonc` `:93`, `:113`, `:188`, `:220-223`, `:361`, `:378` (Impeccable); `:135-136` (canvas); `:318` (canvas `ignoreExports`); the 27 no-match `entry` globs; the `:110` Knip wording.
   - `biome.jsonc:28-29`, `eslint.config.mjs` Impeccable ×2, `.semgrepignore` Impeccable ×2 plus `apps/desktop/...`.
4. Replace the 25 `PosInt.ts` file-pragmas with one decision. Either give `PosInt` a shared home, or keep one exception-registry row naming all 25 copies.
5. Reclassify the 63 fallow pragmas (union of the three signals; the reason text was truncated at 260 chars, so this is a lower bound) whose reason says pre-existing, attribution artifact or deferred work as **debt rows**, not exceptions. Give each an owner and a reconsideration condition, or fix it.
6. Review the 43 Biome `off` rules one by one. Record a reason (overlap with another tool, effect-smol alignment, or deliberate) or re-enable at `warn`. Do the same for the fallow `duplicate-exports` and `empty-catalog-groups` offs.
7. Give the 3 OTel `ignoreDependencies` an owner or remove them. Settle the overdue `.oxlintrc.json` 2026-09-20 re-assessment.
8. Re-record the fallow dead-code baseline at 3.32.0, or retire it. Report baseline-absorbed counts alongside "zero new" so `audit.gate: new-only` cannot pass for zero debt.

### Open questions

- Fresh hit counts per suppression. I could not establish whether each directive still suppresses a live finding, because no linter was run. Unused-suppression detection needs `fallow` (it reports stale pragmas) and `tsc` (an unused `@ts-expect-error` is an error, so the 94 are live by construction if typecheck is green).
- Whether `**/plugins.ts` in `ignoreUnresolvedImports` refers to the plugins tree retired by workstream A, or to an unrelated UI `plugins.ts`. I did not trace it.
- How many of `standards/fallow.health.regression-baseline.jsonc`'s rows are absorbed findings, as opposed to metadata. I did not parse it.
- Whether the "SPEC exception ledger" that `.oxlintrc.json:9` cites exists and is current. I did not locate it.

### Appendix

#### fallow-ignore reason signals (substring heuristics, overlapping)

| Signal | Count |
|---|---:|
| pre-existing | 35 |
| future/graduation/candidate | 29 |
| attribution/diff-charged | 28 |
| intentional/mirror | 44 |

Consumer-local `PosInt.ts` copies each carrying a `fallow-ignore-file code-duplication`: 25
- `apps/labs/ciops/src/projection/PosInt.ts:14`
- `apps/labs/lejeune-bolt-workbench/src/domain/PosInt.ts:14`
- `apps/labs/semantica/src/schema/PosInt.ts:14`
- `apps/professional-desktop/src/internal/PosInt.ts:14`
- `packages/drivers/anthropic/src/internal/PosInt.ts:14`
- `packages/drivers/govinfo/src/internal/PosInt.ts:14`
- `packages/drivers/openai-compat/src/internal/PosInt.ts:14`
- `packages/drivers/openai/src/internal/PosInt.ts:14`
- `packages/drivers/poppler/src/internal/PosInt.ts:1`
- `packages/drivers/tika/src/internal/PosInt.ts:14`
- `packages/drivers/uspto-mcp/src/internal/PosInt.ts:14`
- `packages/epistemic/domain/src/internal/PosInt.ts:14`
- `packages/epistemic/server/src/internal/PosInt.ts:14`
- `packages/epistemic/use-cases/src/internal/PosInt.ts:14`
- `packages/foundation/capability/file-processing/src/internal/PosInt.ts:14`
- `packages/foundation/capability/nlp-processing/src/internal/PosInt.ts:14`
- `packages/foundation/modeling/lexical/src/internal/PosInt.ts:14`
- `packages/law-practice/domain/src/internal/PosInt.ts:14`
- `packages/law-practice/server/src/internal/PosInt.ts:14`
- `packages/law-practice/use-cases/src/internal/PosInt.ts:14`
- `packages/shared/domain/src/internal/PosInt.ts:14`
- `packages/tooling/library/ai-metrics/src/internal/PosInt.ts:14`
- `packages/tooling/tool/cli/src/internal/schema/PosInt.ts:14`
- `packages/workspace/server/src/internal/PosInt.ts:14`
- `scratchpad/effect-ontology/Schema/PosInt.ts:14`

#### Unjustified directives

- `packages/foundation/capability/chalk/src/Chalk.browser.ts:53` `// oxlint-disable typescript-eslint/no-unsafe-declaration-merging`
- `packages/foundation/capability/chalk/src/Chalk.ts:57` `// oxlint-disable typescript-eslint/no-unsafe-declaration-merging`
- `packages/foundation/modeling/utils/test/Struct.test.ts:73` `// @ts-expect-error`

#### Directives on workstream-A paths

0

#### Generated-file directives

- `packages/foundation/modeling/rdf/src/Vocab/generated/Dcterms.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)
- `packages/foundation/modeling/rdf/src/Vocab/generated/Owl.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)
- `packages/foundation/modeling/rdf/src/Vocab/generated/Rdf.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)
- `packages/foundation/modeling/rdf/src/Vocab/generated/Rdfs.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)
- `packages/foundation/modeling/rdf/src/Vocab/generated/SchemaOrg.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)
- `packages/foundation/modeling/rdf/src/Vocab/generated/Skos.terms.ts:40` (fallow-ignore fallow-ignore-next-line code-duplication)

#### Full directive list (non-cspell)

| file:line | kind | rule | justified |
|---|---|---|---|
| `biome.identity.jsonc:1` | biome-ignore | `format` | yes (same-line :) |
| `vitest.setup.ts:178` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:212` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:264` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:302` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:337` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:401` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:460` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `vitest.setup.ts:472` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/labs/ciops/src/Api.ts:12` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/labs/ciops/src/main.ts:11` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/labs/ciops/src/projection/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `apps/labs/lejeune-bolt-workbench/src/domain/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `apps/labs/semantica/scripts/generate-g-entailment.ts:1` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/labs/semantica/src/canary/RuntimeProbeChild.ts:1` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/labs/semantica/src/schema/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `apps/labs/semantica/test/helpers/CrashProbeChild.ts:1` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/labs/semantica/test/helpers/EyeOracleChild.ts:1` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/oip-web/src/app/layout.tsx:266` | biome-ignore | `lint/security/noDangerouslySetInnerHtml` | yes (same-line :) |
| `apps/oip-web/src/app/page.tsx:137` | biome-ignore | `lint/security/noDangerouslySetInnerHtml` | yes (same-line :) |
| `apps/oip-web/src/app/sw.ts:1` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/oip-web/src/components/MattersCarousel.tsx:7` | fallow-ignore-file | `unused-file` | yes (same-line --) |
| `apps/oip-web/src/content/OipContent.model.ts:101` | fallow-ignore-next-line | `unused-type` | yes (same-line --) |
| `apps/oip-web/src/content/OipContent.model.ts:358` | fallow-ignore-next-line | `unused-export` | yes (same-line --) |
| `apps/practice-kg-mcp/src/package.ts:242` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/practice-kg-mcp/src/package.ts:291` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/practice-kg-mcp/src/smoke.ts:224` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/professional-desktop/server/IpcStdoutGuard.prelude.ts:42` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `apps/professional-desktop/src/App.tsx:106` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `apps/professional-desktop/src/App.tsx:719` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/professional-desktop/src/chat/ui/ThemeToggle.tsx:47` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/professional-desktop/src/intake/Intake.inspection.ts:42` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `apps/professional-desktop/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `apps/professional-desktop/src/main.tsx:16` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:295` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `apps/professional-desktop/test/setup.dom.ts:14` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/professional-desktop/vite.config.ts:27` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/storybook/.storybook/main.ts:35` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/storybook/.storybook/main.ts:56` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `apps/storybook/.storybook/preview.tsx:18` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `apps/storybook/.storybook/preview.tsx:26` | biome-ignore | `lint/suspicious/noConsole` | yes (same-line :) |
| `apps/todox/src/app/layout.tsx:102` | biome-ignore | `lint/security/noDangerouslySetInnerHtml` | yes (same-line :) |
| `packages/agents/server/src/AssistantTurn/ScanState.ts:230` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/agents/use-cases/src/entities/ProviderInstance/ProviderInstance.errors.ts:102` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.errors.ts:196` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.repository.ts:149` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/architecture-lab/use-cases/src/entities/Worker/Worker.errors.ts:156` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/architecture-lab/use-cases/src/entities/Worker/Worker.repository.ts:149` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/acp/src/Acp.errors.ts:455` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/acp/test/helpers.ts:57` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ai-provider-cli/src/AiProviderCli.service.ts:141` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/anthropic/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/box/src/Box.errors.ts:596` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/drizzle/src/Drizzle.errors.ts:125` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.errors.ts:18` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.errors.ts:80` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.models.ts:14` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.models.ts:34` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.service.ts:92` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/exiftool/src/Exiftool.service.ts:100` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:304` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:1622` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:1701` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:2012` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:2352` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:2388` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts:2467` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/firecrawl/src/Firecrawl.errors.ts:423` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/firecrawl/src/Firecrawl.errors.ts:428` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts:214` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/govinfo/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/graph-3d/stories/graph3d.stories.tsx:54` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/drivers/hubspot/src/HubSpot.errors.ts:223` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/m365/src/M365.errors.ts:322` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/m365/src/M365.errors.ts:327` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:475` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/obs/src/Obs.models.ts:30` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/occt/src/Occt.errors.ts:57` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/occt/src/Occt.service.ts:60` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/onepassword-cli/src/OnePasswordCli.service.ts:70` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/openai/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/openai-compat/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/openclaw/src/internal/spawn.ts:49` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/pdf-tools/src/PdfTools.errors.ts:56` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/pdf-tools/src/PdfTools.service.ts:130` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/phoenix/src/Phoenix.errors.ts:226` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/poppler/src/Poppler.service.ts:7` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/poppler/src/internal/PosInt.ts:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/sanity/src/Sanity.errors.ts:206` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/sanity/src/Sanity.errors.ts:235` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/tesseract/src/Tesseract.service.ts:7` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/tika/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/uspto-mcp/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:70` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:918` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:934` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:954` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:1595` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:1635` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:1764` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAI.service.ts:1880` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:92` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts:297` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.errors.ts:162` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.errors.ts:191` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.service.ts:245` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.service.ts:306` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.service.ts:425` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAi.service.ts:584` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAiLanguageModel.service.ts:121` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/drivers/xai/src/XAiLanguageModel.service.ts:298` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/core/Field.ts:50` | biome-ignore | `lint/suspicious/noExplicitAny` | yes (same-line :) |
| `packages/ecosystem/effect-drizzle/src/core/variant.ts:150` | biome-ignore | `lint/suspicious/noExplicitAny` | yes (same-line :) |
| `packages/ecosystem/effect-drizzle/src/pg/combinators.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/pg/derive.ts:30` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/pg/table.ts:19` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/Column.ts:7` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/combinators.ts:10` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/derive.ts:6` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/extras.ts:9` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/kit.ts:6` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/model.ts:9` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/schema.ts:10` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/src/sqlite/table.ts:9` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:278` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:280` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:282` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:284` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:326` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:333` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:336` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:339` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:343` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:348` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:355` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:365` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:375` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:386` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:396` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:407` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:417` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:428` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:439` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:450` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:461` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:471` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:478` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:488` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:496` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:504` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:512` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:531` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:552` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:560` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:584` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:591` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:598` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:607` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:618` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:626` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:637` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:649` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:686` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:694` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:707` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:736` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:751` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:766` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:794` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:962` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:972` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:999` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:1003` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:1010` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:1014` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:1026` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/fixtures.ts:1035` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:126` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:134` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:143` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:149` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:155` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:163` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:172` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:189` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:229` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:299` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:357` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:367` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:392` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:395` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:399` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:404` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:407` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:413` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ecosystem/effect-drizzle/test/sqlite-fixtures.ts:432` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/epistemic/domain/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/epistemic/server/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/epistemic/use-cases/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/chalk/src/Chalk.browser.ts:53` | oxlint-disable | `typescript-eslint/no-unsafe-declaration-merging` | **no** |
| `packages/foundation/capability/chalk/src/Chalk.browser.ts:58` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/chalk/src/Chalk.ts:57` | oxlint-disable | `typescript-eslint/no-unsafe-declaration-merging` | **no** |
| `packages/foundation/capability/file-processing/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/file-processing/src/test.ts:92` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:539` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/nlp-processing/src/Graph/AnnotatedTextGraph.ts:276` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/nlp-processing/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/technical-drawing/src/Approval.service.ts:138` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/technical-drawing/src/FigureSet.service.ts:98` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/capability/technical-drawing/src/TechnicalDrawing.errors.ts:57` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/html/test/Html.form-control.test.ts:133` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/html/test/Html.form-control.test.ts:135` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/html/test/Html.script.test.ts:247` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/html/test/Html.script.test.ts:249` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/html/test/Html.test.ts:110` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/identity/test/Fibered.test.ts:145` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/identity/test/Fibered.test.ts:158` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/identity/test/Fibered.test.ts:171` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/identity/test/IdentityRegistry.test.ts:115` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/lexical/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts:2077` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts:3606` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/pandoc-ast/src/Pandoc.model.ts:4037` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/Dcterms.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/Owl.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/Rdf.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/Rdfs.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/SchemaOrg.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/rdf/src/Vocab/generated/Skos.terms.ts:40` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:184` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/modeling/schema/src/SafeRemoteHost.ts:189` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/modeling/schema/test/Conformance.test.ts:94` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/schema/test/Conformance.test.ts:98` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/schema/test/collectAnnotationsAt.test.ts:18` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/modeling/utils/test/Struct.test.ts:73` | @ts-expect-error | `(n/a)` | **no** |
| `packages/foundation/primitive/types/src/TUnsafe.types.ts:27` | biome-ignore | `lint/suspicious/noExplicitAny` | yes (same-line :) |
| `packages/foundation/ui-system/dock/src/Dock.models-tree.ts:1408` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock/src/internal/Reducer.ts:333` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/dock/src/internal/Reducer.ts:369` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock/src/internal/Reducer.ts:508` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock/src/internal/Reducer.ts:694` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock/src/internal/Reducer.ts:863` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/FloatingPane.tsx:79` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/FloatingPane.tsx:140` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:83` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:225` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:234` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:294` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/dock-react/src/internal/GroupPane.tsx:517` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/editor/src/chat/atoms.ts:768` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:197` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:402` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:559` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/foundation/ui-system/editor/src/mermaid-view.tsx:769` | biome-ignore | `lint/security/noDangerouslySetInnerHtml` | yes (same-line :) |
| `packages/foundation/ui-system/editor/src/mermaid-view.tsx:770` | nosemgrep | `typescript.react.security.audit.react-dangerouslysetinnerhtml.react-da` | yes (same-line --) |
| `packages/foundation/ui-system/editor/test/mermaid-race.test.tsx:587` | nosemgrep | `javascript.lang.security.audit.unknown-value-with-script-tag.unknown-v` | yes (same-line --) |
| `packages/foundation/ui-system/ui/src/components/button.tsx:7` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/src/components/country-select.tsx:508` | biome-ignore | `lint/performance/noDynamicNamespaceImportAccess` | yes (same-line :) |
| `packages/foundation/ui-system/ui/src/components/label.tsx:28` | biome-ignore | `lint/a11y/noLabelWithoutControl` | yes (same-line :) |
| `packages/foundation/ui-system/ui/src/components/speech-input.tsx:422` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/ui-system/ui/src/components/speech-input.tsx:470` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/foundation/ui-system/ui/stories/components/collapsible.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/command.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/conversation.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/dialog.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/hover-card.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/navigation-menu.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/resizable.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/select.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/foundation/ui-system/ui/stories/components/table.stories.tsx:1` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/law-practice/domain/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/law-practice/server/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/law-practice/server/test/DocketIntake.fixture.ts:26` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/law-practice/use-cases/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/law-practice/use-cases/test/LegalPositionRelatorPolicy.test.ts:276` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/law-practice/use-cases/test/LegalPositionRelatorPolicy.test.ts:278` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/law-practice/use-cases/test/LegalPositionRelatorPolicy.test.ts:280` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `packages/ontology/domain/src/aggregates/Session/Session.model.ts:285` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/ontology/ui/src/aggregates/Session/Session.document.tsx:113` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/ontology/ui/src/aggregates/Session/Session.inspector.tsx:79` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:436` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/shared/domain/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/tooling/library/ai-metrics/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/tooling/library/ai-sync/src/generator.ts:380` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/library/qa-capture/src/witness/witness.iife.ts:185` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/library/qa-capture/src/witness/witness.iife.ts:299` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/library/repo-utils/src/index.ts:9` | biome-ignore | `assist/source/organizeImports` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Cache/Cache.command.ts:163` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:789` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts:791` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:388` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts:506` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:873` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:1553` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:2329` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:2911` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:2981` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3001` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3057` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3186` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3230` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3354` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3388` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3443` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts:3576` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/CreatePackage/ConfigUpdater.ts:218` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:874` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:1188` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Explore/Atlas.ts:344` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Explore/Atlas.ts:446` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Explore/Atlas.ts:531` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:103` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:579` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:821` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1074` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1148` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1178` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1253` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1348` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1401` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1629` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1677` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1814` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:1828` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:274` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Qa/Extract.ts:815` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Qa/Extract.ts:824` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Qa/JudgeIngest.ts:172` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts:744` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts:378` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/FallowQuality.command.ts:760` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1158` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1163` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2159` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:2875` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts:399` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateApply.ts:588` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateApply.ts:773` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateRewrite.ts:94` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateRewrite.ts:570` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts:200` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts:233` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts:223` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:373` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts:569` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Quality/internal/TurboConfigProof.ts:445` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/VocabTerms.ts:110` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:140` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts:190` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:135` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:430` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Planner.ts:532` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Reply.ts:981` | fallow-ignore-next-line | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:1006` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts:296` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/commands/Yeet/internal/WatchMode.ts:944` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/internal/process/StepExec.ts:615` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/src/internal/schema/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `packages/tooling/tool/cli/test/goals-bootstrap-plan.test.ts:57` | biome-ignore | `lint/suspicious/noUndeclaredEnvVars` | yes (same-line :) |
| `packages/tooling/tool/cli/test/proof-job.test.ts:1529` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/test/research-library-views.test.ts:202` | nosemgrep | `javascript.lang.security.audit.unknown-value-with-script-tag.unknown-v` | yes (previous-line comment) |
| `packages/tooling/tool/cli/test/research-library-views.test.ts:218` | nosemgrep | `javascript.lang.security.audit.unknown-value-with-script-tag.unknown-v` | yes (previous-line comment) |
| `packages/tooling/tool/cli/test/research-library-views.test.ts:223` | nosemgrep | `javascript.lang.security.audit.unknown-value-with-script-tag.unknown-v` | yes (previous-line comment) |
| `packages/tooling/tool/cli/test/yeet-settle.test.ts:1007` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/tooling/tool/cli/test/yeet-watch-mode.test.ts:218` | fallow-ignore-next-line | `complexity` | yes (same-line --) |
| `packages/workspace/server/src/internal/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `scratchpad/beep/Port.ts:96` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `scratchpad/beep/Port.ts:265` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `scratchpad/beep/Port.ts:316` | @ts-expect-error | `(n/a)` | yes (same-line text) |
| `scratchpad/effect-ontology/Schema/PosInt.ts:14` | fallow-ignore-file | `code-duplication` | yes (same-line --) |
| `scratchpad/encode-keys-probe.ts:23` | @ts-expect-error | `(n/a)` | yes (same-line text) |

#### cspell comment list

- `apps/professional-desktop/src-tauri/build.rs:1` cspell:words
- `apps/professional-desktop/src-tauri/src/lib.rs:1` cspell:ignore
- `apps/professional-desktop/src-tauri/web-extension/youtube_referrer.c:1` cspell:words
- `apps/professional-desktop/src-tauri/web-extension/youtube_referrer_test.c:1` cspell:words
- `apps/professional-desktop/src/runtime/Pglite.ts:4` cspell:words
- `apps/professional-desktop/src/transport/TauriIpcSocket.ts:4` cspell:words
- `infra/Pulumi.beep-ai-metrics-dankserver.yaml:14` cspell:disable-next-line
- `infra/src/AIMetrics.ts:132` cspell:ignore
- `packages/agents/server/src/AssistantTurn/AnthropicTurnCodec.ts:37` cspell:words
- `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:36` cspell:words
- `packages/foundation/modeling/html/src/Html.foreign.ts:86` cspell:words
- `packages/foundation/modeling/lexical/src/Lexical.model.ts:18` cspell:word
- `packages/foundation/modeling/lexical/src/Lexical.normalize.ts:15` cspell:word
- `packages/foundation/modeling/rdf/src/Iri.ts:15` cspell:words
- `packages/foundation/modeling/schema/src/AtURI.ts:27` cspell:words
- `packages/foundation/modeling/utils/src/Function.ts:6` cspell:words
- `packages/foundation/ui-system/editor/src/mermaid-view.tsx:761` cspell:ignore
- `packages/foundation/ui-system/editor/src/nodes.ts:8` cspell:ignore
- `packages/foundation/ui-system/ui/src/components/blocks/editor-00/nodes.ts:7` cspell:ignore
- `packages/foundation/ui-system/ui/src/components/editor/themes/editor-theme.ts:7` cspell:ignore
- `packages/tooling/library/repo-utils/src/JSDoc/JSDoc.ts:12` cspell:ignore
- `packages/tooling/library/repo-utils/src/JSDoc/models/ASTDerivability.model.ts:10` cspell:ignore
- `packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts:16` cspell:ignore
- `packages/tooling/library/repo-utils/src/JSDoc/models/index.ts:8` cspell:ignore
- `packages/tooling/library/repo-utils/src/index.ts:8` cspell:ignore
- `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts:19` cspell:ignore
- `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:8` cspell:word
- `packages/tooling/policy-pack/repo-configs/src/next/models/ConfigPrimitives.schema.ts:7` cspell:words
- `packages/tooling/policy-pack/repo-configs/src/next/models/ExperimentalConfig.schema.ts:7` cspell:words
- `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:141` cspell:words
- `packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerRunpodEval.ts:334` cspell:ignore
- `packages/tooling/tool/cli/src/commands/Files/internal/ImageAudit.schemas.ts:16` cspell:ignore
- `packages/tooling/tool/cli/src/commands/Files/internal/ImageCuration.ts:67` cspell:ignore
- `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:34` cspell:ignore
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Closeout.ts:7` cspell:ignore
- `packages/tooling/tool/docgen/src/Configuration.ts:40` cspell:ignore

#### Mentions (not directives: prose, string literals, detector code)

- `.claude/skills/effect-first-development/SKILL.md:44` (@ts-ignore)
- `.claude/skills/effect-first-development/SKILL.md:136` (@ts-ignore)
- `.claude/skills/impeccable/scripts/detector/shared/inline-ignores.mjs:2` (eslint-disable)
- `.github/skills/impeccable/scripts/detector/shared/inline-ignores.mjs:2` (eslint-disable)
- `.semgrep/first-party.yml:16` (nosemgrep)
- `docs/runbooks/design-system-lint.md:37` (eslint-disable)
- `docs/runbooks/design-system-lint.md:38` (oxlint-disable)
- `docs/runbooks/design-system-lint.md:258` (fallow-ignore)
- `knip.jsonc:48` (fallow-ignore)
- `packages/foundation/ui-system/editor/src/mermaid-view.tsx:761` (nosemgrep)
- `packages/tooling/policy-pack/repo-configs/src/eslint/DeprecatedApisESLintConfig.ts:31` (eslint-disable)
- `packages/tooling/tool/cli/src/commands/Cache/Cache.profile.ts:68` (biome-ignore)
- `standards/effect-first-development.md:1333` (@ts-ignore)
- `standards/effect-laws-v1.md:15` (@ts-ignore)
