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
  Rows stay `pending` here until workstream A applies a disposition with
  evidence.

## `exports` (32)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `boxContentMigrationPlanDigest` | reproduced |  | pending | workstream A |  |
| 2 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `boxProvisioningPlanDigest` | reproduced |  | pending | workstream A |  |
| 3 | exports | `packages/drivers/box-provisioning/src/internal/canonical.ts` | `canonicalBoxContentMigrationMap` | reproduced |  | pending | workstream A |  |
| 4 | exports | `packages/drivers/box/src/internal/Box.runtime.ts` | `diagnosticsFor` | reproduced |  | pending | workstream A |  |
| 5 | exports | `packages/drivers/occt/src/internal/shading.ts` | `lightFor` | reproduced | named | pending | workstream A |  |
| 6 | exports | `packages/drivers/occt/src/internal/shading.ts` | `pitchFor` | reproduced | named | pending | workstream A |  |
| 7 | exports | `packages/drivers/pdf-tools/src/internal/ppm.ts` | `parseP6Header` | reproduced | named | pending | workstream A |  |
| 8 | exports | `packages/foundation/capability/colors/src/internal/ColorsSchema.ts` | `FormatterInput` | reproduced |  | pending | workstream A |  |
| 9 | exports | `packages/tooling/library/ai-metrics/src/internal/transcript-utils.ts` | `repoPathToClaudeProjectName` | reproduced |  | pending | workstream A |  |
| 10 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `makeDistributeUnionSiblings` | reproduced |  | pending | workstream A |  |
| 11 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `makeFlattenAllOfRefVariants` | reproduced |  | pending | workstream A |  |
| 12 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `nullableTypeArray` | reproduced |  | pending | workstream A |  |
| 13 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `openObjects` | reproduced |  | pending | workstream A |  |
| 14 | exports | `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `stripExamples` | reproduced |  | pending | workstream A |  |
| 15 | exports | `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.subjects.ts` | `PackageSubjectCandidateResult` | reproduced |  | pending | workstream A |  |
| 16 | exports | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerChains.ts` | `supersededRowIds` | reproduced | named | pending | workstream A |  |
| 17 | exports | `packages/tooling/tool/cli/src/commands/HarnessLedger/internal/LedgerFiles.ts` | `ledgerRowsDir` | reproduced | named | pending | workstream A |  |
| 18 | exports | `packages/tooling/tool/cli/src/commands/Lint/internal/WorkspaceWalk.ts` | `ignoredDirectoryNames` | reproduced |  | pending | workstream A |  |
| 19 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `expandWorkspacePattern` | reproduced |  | pending | workstream A |  |
| 20 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `ignoredSourceSuffixes` | reproduced |  | pending | workstream A |  |
| 21 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readPackageJson` | reproduced |  | pending | workstream A |  |
| 22 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readRootPackage` | reproduced |  | pending | workstream A |  |
| 23 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `readText` | reproduced |  | pending | workstream A |  |
| 24 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `resolveEntryWithinRoot` | reproduced |  | pending | workstream A |  |
| 25 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `sourceExtensions` | reproduced |  | pending | workstream A |  |
| 26 | exports | `packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts` | `workspacePatternsFrom` | reproduced |  | pending | workstream A |  |
| 27 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts` | `CHROME_EPOCH_OFFSET_SECONDS` | reproduced | named | pending | workstream A |  |
| 28 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts` | `remoteToHttpsUrl` | reproduced | named | pending | workstream A |  |
| 29 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts` | `RESEARCH_UNITS` | reproduced | named | pending | workstream A |  |
| 30 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts` | `VAULT_ENV_VAR` | reproduced | named | pending | workstream A |  |
| 31 | exports | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts` | `parseCard` | reproduced | named | pending | workstream A |  |
| 32 | exports | `packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallPreflight.ts` | `HEAD_INSTALL_PREFLIGHT_FAILURE_HINT` | reproduced |  | pending | workstream A |  |

## `files` (5)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | files | `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` | `packages/drivers/govinfo/src/_generated/Govinfo.gen.ts` | reproduced | inspect | pending | workstream A |  |
| 2 | files | `packages/foundation/primitive/data/src/internal/data/currency-codes.ts` | `packages/foundation/primitive/data/src/internal/data/currency-codes.ts` | reproduced | inspect | pending | workstream A |  |
| 3 | files | `packages/foundation/primitive/data/src/internal/data/index.ts` | `packages/foundation/primitive/data/src/internal/data/index.ts` | reproduced | inspect | pending | workstream A |  |
| 4 | files | `packages/foundation/primitive/data/src/internal/data/timezones.ts` | `packages/foundation/primitive/data/src/internal/data/timezones.ts` | reproduced | inspect | pending | workstream A |  |
| 5 | files | `packages/foundation/primitive/data/src/internal/index.ts` | `packages/foundation/primitive/data/src/internal/index.ts` | reproduced | inspect | pending | workstream A |  |

## `types` (2)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | types | `packages/drivers/wink/src/internal/bm25.ts` | `BM25Accessor` | reproduced | inspect | pending | workstream A |  |
| 2 | types | `packages/tooling/library/codegen-kit/src/internal/format.ts` | `Formatter` | reproduced |  | pending | workstream A |  |

## `devDependencies` (1)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | devDependencies | `packages/drivers/freshbooks/package.json` | `@beep/test-utils` | reproduced | inspect | pending | workstream A |  |

## `unresolved` (1)

| # | Kind | File | Name | Fresh @e62411d63f | Brief | Disposition | Owner | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | unresolved | `packages/drivers/freshbooks/tsconfig.test.json` | `bun-types` | reproduced | inspect | pending | workstream A |  |
