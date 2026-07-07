# Lane A4 Summary: JSDoc Inventory Ratchet

## Design

Compare source decision: full live inventory regeneration is too slow for the
ratchet step. A bounded in-memory generation probe timed out at 60 seconds:

```text
$ /usr/bin/time -p timeout 60s bun -e '<buildJSDocDocumentationInventory probe>'
real 60.11
user 84.17
sys 5.20
```

Full temp inventory generations later completed in 164-184 seconds, confirming
the `>=60s` decision:

```text
wrote /tmp/jsdoc-ratchet-proof-clean.jsonc
missingExportExamples=1965 missingExportCategories=91 missingExportSince=91 publicExports=13971
real 172.01
user 215.89
sys 13.03

wrote /tmp/jsdoc-ratchet-proof-quality-command-fail.jsonc
missingExportExamples=1966 missingExportCategories=92 missingExportSince=92 publicExports=13972
real 164.16
user 205.34
sys 13.63
```

Chosen design: `bun run beep quality jsdoc-ratchet` reads the current generated
inventory file (`standards/jsdoc-documentation.inventory.jsonc`) and compares
its debt/finding totals against the small committed snapshot
`standards/jsdoc-totals.regression-baseline.jsonc`.

Tracked totals:

- `packagesNeedingRemediation`
- `missingExportExamples`
- `missingExportCategories`
- `missingExportSince`
- `unsafeExampleFindings`
- `schemaAnnotationFindings`

Decreases pass and emit a tighten advisory. Refresh sequence:

```sh
bun run beep quality jsdoc-inventory
bun run beep quality jsdoc-ratchet --write-baseline
```

## Files Changed

- `.github/workflows/check.yml`
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocRatchet.ts`
- `packages/tooling/tool/cli/src/test/Quality.test-kit.ts`
- `packages/tooling/tool/cli/test/quality-artifact-generators.test.ts`
- `packages/tooling/tool/cli/test/quality-tasks.test.ts`
- `standards/jsdoc-totals.regression-baseline.jsonc`

## Regeneration Command

```sh
bun run beep quality jsdoc-inventory
```

Snapshot refresh command:

```sh
bun run beep quality jsdoc-ratchet --write-baseline
```

## Two-Way Proof Transcript

Scratch inserted temporarily in included tooling source:

```ts
// packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts
export const jsdocRatchetProofScratch = 1;
```

Temp clean baseline from clean generated inventory:

```text
$ bun run beep quality jsdoc-ratchet --inventory /tmp/jsdoc-ratchet-proof-clean.jsonc --baseline /tmp/jsdoc-ratchet-proof-baseline.jsonc --write-baseline
[jsdoc-ratchet] wrote /tmp/jsdoc-ratchet-proof-baseline.jsonc with 6 tracked total(s)
```

Scratch inventory fails:

```text
$ bun run beep quality jsdoc-ratchet --inventory /tmp/jsdoc-ratchet-proof-quality-command-fail.jsonc --baseline /tmp/jsdoc-ratchet-proof-baseline.jsonc
[jsdoc-ratchet] regression: 3 tracked total(s) increased versus /tmp/jsdoc-ratchet-proof-baseline.jsonc
  - missingExportCategories: 92 > 91 (+1)
  - missingExportExamples: 1966 > 1965 (+1)
  - missingExportSince: 92 > 91 (+1)
[jsdoc-ratchet] fix the added JSDoc findings; this ratchet only tightens on decreases.
JSDoc totals regression baseline grew.
error: script "beep" exited with code 1
```

Scratch removed; clean inventory passes:

```text
$ bun run beep quality jsdoc-ratchet --inventory /tmp/jsdoc-ratchet-proof-clean.jsonc --baseline /tmp/jsdoc-ratchet-proof-baseline.jsonc
[jsdoc-ratchet] ok: tracked=6 increased=0 current_totals=17
```

Scratch cleanup check:

```text
$ rg -n "jsdocRatchetProofScratch|JSDocRatchetProofScratch" packages/tooling/tool/cli/src packages/tooling/tool/cli/test standards .github
<no matches; rg exited 1>
```

Default command proof:

```text
$ bun run beep quality jsdoc-ratchet
[jsdoc-ratchet] ok: tracked=6 increased=0 current_totals=17
```

## Check Results

```text
$ bunx vitest run packages/tooling/tool/cli/test/quality-tasks.test.ts packages/tooling/tool/cli/test/quality-artifact-generators.test.ts
Test Files  2 passed (2)
Tests  60 passed (60)

$ bun run --cwd packages/tooling/tool/cli beep:lint
$ biome check .
Checked 215 files in 790ms. No fixes applied.

$ bun run --cwd packages/tooling/tool/cli beep:check
$ tsgo -b tsconfig.json

$ bun run beep quality jsdoc-ratchet
[jsdoc-ratchet] ok: tracked=6 increased=0 current_totals=17
```
