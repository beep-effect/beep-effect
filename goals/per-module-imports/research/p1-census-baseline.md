# P1 executable import census baseline

Snapshot date: 2026-09-03

This is the P1 baseline for the inverted `laws effect-imports` vehicle. The
historical gross census is retained for reconciliation; the live family-sized
candidate scans are the baseline used by later migration batches.

## Historical gross reconciliation

The P0 syntax census (`import-census.md` sections 1 and 4) counted static import
declarations across the then-current repository:

| Surface | Root import statements |
| --- | ---: |
| `effect` | 2,089 |
| foundation package roots | 2,820 |
| gross repository total | 4,909 |
| excluded `scratchpad/` | -603 |
| excluded `explorations/` assets | -14 |
| excluded `goals/*/ops` and research assets | -18 |
| derived P0 in-scope total | 4,274 |

Those are historical static-import counts, not a claim about the live tree.
P1's structured counter also includes root re-exports and unsupported dynamic,
import-type, import-equals, and `require` forms so that none disappear from the
manual-review queue.

## Live P1 in-scope baseline

The live scans cover `apps/`, `packages/`, and `infra/`, including tests and
ecosystem members. The law itself excludes `scratchpad/`, `explorations/`,
`goals/*/ops`, `goals/*/research/assets`, package docs, generated output,
vendored trees, and `node_modules`.

| Candidate scope | Files scanned | Files with work | Planned root imports | Planned root exports | Root occurrences | Binding reviews |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `apps` | 883 | 256 | 491 | 0 | 493 | 2 |
| `infra` | 52 | 16 | 29 | 0 | 29 | 0 |
| `packages/_internal` | 25 | 12 | 19 | 0 | 19 | 0 |
| `packages/agents` | 96 | 48 | 82 | 0 | 83 | 1 |
| `packages/architecture-lab,documents,epistemic,law-practice,shared,workspace` | 979 | 422 | 669 | 0 | 670 | 5 |
| `packages/ecosystem,ontology,drivers` | 672 | 394 | 843 | 0 | 843 | 0 |
| `packages/tooling` | 981 | 765 | 1,463 | 0 | 1,468 | 5 |
| `packages/foundation` | 1,268 | 718 | 1,358 | 1 | 1,368 | 37 |
| **Total** | **4,956** | **2,631** | **4,954** | **1** | **4,973** | **50** |

Root-occurrence totals by source specifier:

| Root | Occurrences | Root | Occurrences |
| --- | ---: | --- | ---: |
| `effect` | 2,218 | `@beep/schema` | 1,020 |
| `@beep/utils` | 937 | `@beep/identity` | 475 |
| `@beep/dock` | 51 | `@beep/observability` | 42 |
| `@beep/lexical-schema` | 38 | `@beep/mcp-kit` | 38 |
| `@beep/provenance` | 22 | `@beep/md` | 20 |
| `@beep/skill-contract` | 18 | `@beep/html` | 15 |
| `@beep/dock-react` | 14 | `@beep/api-transport` | 12 |
| `@beep/colors` | 9 | `@beep/rdf` | 8 |
| `@beep/types` | 8 | `@beep/brand` | 6 |
| `@beep/chalk` | 6 | `@beep/data` | 5 |
| `@beep/ontology` | 4 | `@beep/semantic-web` | 4 |
| `@beep/file-processing` | 2 | `@beep/ui` | 1 |

The 50 binding-level reviews are deliberate and structured:

- 41 missing foundation leaves: 21 `@beep/brand` bindings and 20
  `@beep/semantic-web` bindings. These are outside the P1 pilot unblocks and
  remain queued for their P3 family batches.
- four dynamic imports and two type-level import expressions, all left for
  explicit lazy-load or qualifier decisions;
- three root-namespace surface tests, matching the packet's exception ledger
  for `@beep/identity`, `@beep/rdf`, and `@beep/semantic-web`.

There were zero parser warnings and zero ambiguous or collision reviews. P1
also found one post-P0 Effect binding, `MutableList`; the installed Effect
barrel and wildcard export map validate its `effect/MutableList` route, which
is now part of the vehicle's census data.

## Pilot proof

The proposed P2 pilot, `apps/professional-desktop`, is fully mapped:

| Mode | Files | Fences | Files with work | Root imports | Emitted imports | Manual reviews | Parser warnings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| executable | 135 | 0 | 106 | 212 | 504 | 0 | 0 |
| JSDoc | 135 | 210 | 25 | 41 | 42 | 0 | 0 |

Executable pilot roots are `effect` 101, `@beep/utils` 33,
`@beep/schema` 23, `@beep/observability` 20,
`@beep/lexical-schema` 16, `@beep/identity` 8, `@beep/dock` 6,
`@beep/dock-react` 4, and `@beep/mcp-kit` 1. JSDoc roots are `effect` 38,
`@beep/schema` 2, and `@beep/lexical-schema` 1.

## Authored Markdown advisory baseline

The permanent Markdown-fence Lint Policy step is intentionally advisory until
P3. Its full authored-corpus P1 scan exited successfully with 4,068 files,
41,776 TypeScript-family fences, 1,006 files with work, 3,966 root imports, 82
structured manual reviews, and two parser warnings. The machine summary was
successfully streamed through `jq`; this proves the large JSON result is not
truncated and gives P3 a reproducible corpus baseline without migrating it
before the pilot gate.

## Leaf export resolution proof

P1 added or routed 42 public leaf specifiers. A standalone probe importing
every leaf passed both `moduleResolution: NodeNext` and
`moduleResolution: Bundler` with no inherited root path aliases. Workspace and
publish keys are paired for every new leaf; `@beep/ui`, the only foundation
package that lacked `publishConfig`, now has a complete 17-entry publish mirror
instead of a `Version`-only exception. `bun run beep tsconfig-sync --check`
reports no drift after the 39 generated root aliases were added.

## Reproduction

Use the same compact JSON projection for each row; family-sized scans avoid an
unnecessary all-repository ts-morph memory peak while exercising identical
mapping and transformation logic:

```sh
set -o pipefail
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix apps | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix infra | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/_internal | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/agents | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/architecture-lab,packages/documents,packages/epistemic,packages/law-practice,packages/shared,packages/workspace \
  | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/ecosystem,packages/ontology,packages/drivers \
  | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/tooling | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'
bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix packages/foundation | jq '{scannedFiles,touchedFiles,rootImportsRewritten,rootExportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings}'

bun run beep laws effect-imports --mode code --candidate --json \
  --include-prefix apps/professional-desktop
bun run beep laws effect-imports --mode jsdoc --candidate --json \
  --include-prefix apps/professional-desktop

bun run beep laws effect-imports --mode markdown --check --json | \
  jq '{scannedFiles,scannedFences,touchedFiles,rootImportsRewritten,rootSpecifierCounts,manualReviews,parserWarnings,strictFailure}'

bun x tsgo -p .beep/per-module-imports/p1-leaf-resolution-probe/tsconfig.nodenext.json
bun x tsgo -p .beep/per-module-imports/p1-leaf-resolution-probe/tsconfig.bundler.json
bun run beep tsconfig-sync --check
```
