# Knip known findings — one-time remediation list (2026-10-09)

Workstream A transfers every Knip finding into this list before Knip is
removed (brief section 2.A and stage 2 exit condition). Knip's narrower
coverage after removal is an accepted reduction; this list is not a parity
project and Fallow's global entry-export reporting stays off.

## Source and counts

- Source: `standards/knip.regression-baseline.jsonc` at `e62411d63f`
  (`schema_version: 1`, command `bun run knip --reporter json`, normalization
  ordering `kind,file,name`, line/column omitted).
- Header counts: 41 findings = 32 `exports`, 5 `files`, 2 `types`,
  1 `devDependencies`, 1 `unresolved` (all other kinds 0).
- Fresh run (result): Knip 6.40.0 (patched) at `e62411d63f`,
  2026-10-09T13:44:13Z, exit 1 as expected with findings. All 41 baseline
  rows reproduced on kind/file/name; 0 disappeared, 0 new. Each row below
  carries the result in its "Fresh @e62411d63f" column. The normalized fresh
  rows are tracked as
  [`knip-fresh-rows-e62411d63f.tsv`](./knip-fresh-rows-e62411d63f.tsv)
  (kind, file, name; sorted). The raw JSON is kept as a private
  operational receipt in the orchestrator briefs directory
  (`knip/knip-e62411d63f.json`, not tracked).

## Reconciliation at `e62411d63f`

Command, run from the lane checkout:

```sh
bun run knip --reporter json > knip-e62411d63f.json
jq -r '.issues[] | . as $i | ("exports","types","files","devDependencies","unresolved") as $k | ($i[$k][]? | [$k,$i.file,.name]) | @tsv' knip-e62411d63f.json | sort > knip-fresh-rows-e62411d63f.tsv
diff knip-fresh-rows-e62411d63f.tsv <baseline rows from standards/knip.regression-baseline.jsonc, same normalization>
```

| Class | Count | Rows |
| --- | --- | --- |
| reproduced (fresh == baseline) | 41 | 32 `exports`, 5 `files`, 2 `types`, 1 `devDependencies`, 1 `unresolved` |
| disappeared since the baseline (baseline only) | 0 | none |
| new (fresh only) | 0 | none |

An earlier draft of the reconciliation reported 36 reproduced and the 5
`files` rows as disappeared. That was a normalizer defect (it skipped the
`.issues[].files[]` arrays); the fresh JSON carries all 5 `files` findings,
so no row is `vanished`.

## Disposition vocabulary

`pending` until resolved; then one of `fixed` (genuine issue repaired, PR
cited), `documented` (legitimate case, reason and owner recorded),
`vanished` (no longer reported at a recorded head). Evidence names the PR,
commit, or command output that proves the disposition.

## Brief call-outs

- **Named unmatched export candidates (brief section 7)** — the ten rows
  marked `named` in the Brief column: `lightFor`, `pitchFor`, `parseP6Header`,
  `supersededRowIds`, `ledgerRowsDir`, `CHROME_EPOCH_OFFSET_SECONDS`,
  `remoteToHttpsUrl`, `RESEARCH_UNITS`, `VAULT_ENV_VAR`, `parseCard`.
- **Also inspect (brief section 7)** — rows marked `inspect`: `BM25Accessor`,
  the five reported files, the FreshBooks `@beep/test-utils` development
  dependency, and the `bun-types` configuration reference.
- Exact scanner paths: the fresh run reproduced every baseline path (see
  "Reconciliation" above), so the paths below are the scanner's.
- Proposed per-row dispositions (genuine issue to fix vs legitimate case to
  document, with reasons) are in
  [`sweeps/2026-10-09/A-knip-dispositions.md`](./sweeps/2026-10-09/A-knip-dispositions.md).
  Every row now carries its applied disposition and evidence below.

## `exports` (32)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `boxContentMigrationPlanDigest` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 2 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `boxProvisioningPlanDigest` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 3 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `canonicalBoxContentMigrationMap` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 4 | exports | `packages/drivers/box/src/internal/Box.runtime.ts` | `diagnosticsFor` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 5 | exports | `packages/drivers/occt/src/internal/shading.ts` | `lightFor` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 6 | exports | `packages/drivers/occt/src/internal/shading.ts` | `pitchFor` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 7 | exports | `packages/drivers/pdf-tools/src/internal/ppm.ts` | `parseP6Header` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 8 | exports | `packages/foundation/capability/colors/src/internal/ColorsSchema.ts` | `FormatterInput` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 9 | exports | `packages/tooling/library/ai-metrics/src/internal/transcript-utils.ts` | `repoPathToClaudeProjectName` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 10 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `makeDistributeUnionSiblings` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 11 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `makeFlattenAllOfRefVariants` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 12 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `nullableTypeArray` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 13 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `openObjects` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 14 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `stripExamples` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 15 | exports | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts` | `PackageSubjectCandidateResult` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 16 | exports | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerChains.ts` | `supersededRowIds` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 17 | exports | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerFiles.ts` | `ledgerRowsDir` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 18 | exports | `packages/tooling/tool/cli/src/commands/Lint/internal/WorkspaceWalk.ts` | `ignoredDirectoryNames` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 19 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `expandWorkspacePattern` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 20 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `ignoredSourceSuffixes` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 21 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readPackageJson` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 22 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readRootPackage` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 23 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readText` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 24 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `resolveEntryWithinRoot` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 25 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `sourceExtensions` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 26 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `workspacePatternsFrom` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 27 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts` | `CHROME_EPOCH_OFFSET_SECONDS` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 28 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts` | `remoteToHttpsUrl` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 29 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts` | `RESEARCH_UNITS` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 30 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts` | `VAULT_ENV_VAR` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 31 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts` | `parseCard` | reproduced | named | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 32 | exports | `packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallPreflight.ts` | `HEAD_INSTALL_PREFLIGHT_FAILURE_HINT` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |

## `files` (5)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | files | `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` | `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` | reproduced | inspect | documented | `@beep/govinfo` | Generated drift oracle, not imported by design; `generate:check` and `test/Govinfo.generated.test.ts` compare it to the source OpenAPI document. Reconsider if the drift check becomes an in-memory comparison. |
| 2 | files | `packages/foundation/primitive/data/src/internal/data/currency-codes.ts` | `packages/foundation/primitive/data/src/internal/data/currency-codes.ts` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 3 | files | `packages/foundation/primitive/data/src/internal/data/index.ts` | `packages/foundation/primitive/data/src/internal/data/index.ts` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 4 | files | `packages/foundation/primitive/data/src/internal/data/timezones.ts` | `packages/foundation/primitive/data/src/internal/data/timezones.ts` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 5 | files | `packages/foundation/primitive/data/src/internal/index.ts` | `packages/foundation/primitive/data/src/internal/index.ts` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |

## `types` (2)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | types | `packages/drivers/wink/src/internal/bm25.ts` | `BM25Accessor` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |
| 2 | types | `packages/tooling/library/codegen-kit/src/internal/format.ts` | `Formatter` | reproduced |  | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |

## `devDependencies` (1)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | devDependencies | `packages/drivers/freshbooks/package.json` | `@beep/test-utils` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |

## `unresolved` (1)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | unresolved | `packages/drivers/freshbooks/tsconfig.test.json` | `bun-types` | reproduced | inspect | fixed | workstream A | `8f29e3528e`; final patched Knip 6.40.0 cross-check: absent; owning package default verification passed |

## A transfer implementation in progress

At base `3dbf109066` on 2026-10-09, the lane applied the sweep's 40 repairs: narrowed file-local exports, removed the unused `parseCard` and its decoder, deleted the redundant transcript re-export and four unreachable data files, and replaced the FreshBooks unused development dependency with `bun-types`. The 40 repair rows remain pending until the post-repair Knip cross-check runs; Govinfo is documented above. Heavy commands wait in the shared admission queue.

## Post-repair cross-check (2026-10-09)

At source commit `8f29e3528e`, `beep-heavy bun run knip --reporter json`
returned exit 1 with exactly one finding: the deliberately unimported
`packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` drift oracle.
All 40 repair rows disappeared; no new finding remained. The Colors
`FormatterInput` type was also narrowed after an intermediate run reported it.
The terminal output is preserved locally in `.beep/rsc-a/run2-final-knip.log`.
All eleven owner packages passed default package verification; the terminal
rows are in `.beep/rsc-a/package-results.tsv` and `run2-results.tsv`.
The schema catalog regenerated with exit 0. The attempted JSDoc command in
run 2 selected the broad lint pipeline; run 3 uses the owning
`beep quality jsdoc-inventory` command. No row remains pending.

Govinfo owner: `@beep/govinfo`. Reconsider the documented file if its
generation drift test moves to an in-memory comparison.
