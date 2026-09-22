# Post-main census boundary review

Source context: merge head `582502ed69`, including main `1969de85bf`, with
local qualification repairs. This review describes source/planner boundaries;
it does not grant qualification or establish runtime read/write completeness.
It supersedes the earlier root-script and doctest membership counts only for
this source context. Historical snapshots remain attributable to their sources.

## Census delta

The fresh census has 143 workspaces, 3,449 graph nodes and 1,957 executable
nodes. Comparing node ids and command strings with the prior attached census
finds 180 additions, no removals and no changed commands on existing nodes.
Of the additions, 65 have executable commands and 115 are graph-only.
Graph-only nodes remain excluded from the executable population.

The 65 executions split into 27 package doctests and 38 root quality tasks.
The complete exact command membership is in `command-groups-post-main.json`.
Root entrypoints can now also be executable Turbo nodes when the root manifest
script exists; the earlier report's blanket statement that root scripts are
not executable graph nodes no longer describes this source context.

## Package doctest boundary

All 27 added doctest tasks dispatch `bun run beep:doctest`; each owning
manifest resolves that wrapper to `BEEP_VITEST_DOCTEST=1 bunx vitest run`.
The package-scripts policy derives membership from evidence and supplies this
implementation default. A script's presence does not prove tests ran.

`vitest.shared.ts` reads the selector during configuration. Doctest mode
selects `src/**/*.{ts,tsx}`, clears ordinary test includes, excludes fixtures
and declaration files, disables concurrent test sequencing, limits workers
to two and does not permit an empty suite to pass. Shared setup, aliases,
package overrides and the doctest plugin remain part of execution semantics.
The Turbo definition declares the selector in `env`, source/test/config inputs,
`^transit` dependencies and no file outputs. `outputs: []` is a declaration,
not evidence that example execution cannot write files or use external state.

The Ci planner now produces the full Turbo doctest fleet for all captured
option variants. `heavy.yml` marks the lane as using Turbo, removes affected
example selection and invokes `ci lane doctest` without the old mode flags.
The workflow still has its common goals-only skip boundary. Old marked-file
selection snapshots must not be interpreted as the current plan.

## Root quality boundary

The following table covers all 38 new root executable nodes. Cache flags and
outputs are current declarations, not qualification decisions. Existing cache
settings remain unassessed under this goal; this review does not activate or
disable any broad task family.

| Task | Cache declared | Declared output boundary |
| --- | --- | --- |
| `//#changeset:status` | `false` | No file outputs declared |
| `//#config-sync:check` | `true` | No file outputs declared |
| `//#fallow:audit:check` | `false` | `.beep/fallow/audit.check.json` `.beep/fallow/raw/audit.check.*` |
| `//#fallow:boundaries:advisory` | `false` | `.beep/fallow/boundaries.advisory.json` `.beep/fallow/raw/boundaries.advisory.*` |
| `//#fallow:boundaries:config-check` | `false` | No file outputs declared |
| `//#fallow:dead-code:check` | `false` | `.beep/fallow/dead-code.check.json` `.beep/fallow/raw/dead-code.check.*` |
| `//#fallow:fix-preview:advisory` | `false` | `.beep/fallow/fix-preview.advisory.json` `.beep/fallow/raw/fix-preview.advisory.*` |
| `//#fallow:flags:advisory` | `false` | `.beep/fallow/flags.advisory.json` `.beep/fallow/raw/flags.advisory.*` |
| `//#fallow:health:advisory` | `false` | `.beep/fallow/health.advisory.json` `.beep/fallow/raw/health.advisory.*` |
| `//#fallow:health:check` | `false` | `.beep/fallow/health.check.json` `.beep/fallow/raw/health.check.*` |
| `//#fallow:security:advisory` | `false` | `.beep/fallow/security.advisory.json` `.beep/fallow/raw/security.advisory.*` |
| `//#goals:doctor` | `false` | No file outputs declared |
| `//#goals:index-check` | `true` | No file outputs declared |
| `//#jsdoc:inventory:check` | `false` | `.beep/ci/jsdoc-documentation.inventory.*` |
| `//#knip:check` | `false` | No file outputs declared |
| `//#knowledge:refs-check` | `false` | No file outputs declared |
| `//#knowledge:semantic-delta` | `false` | No file outputs declared |
| `//#lint:allowlist` | `true` | No file outputs declared |
| `//#lint:circular` | `true` | No file outputs declared |
| `//#lint:ecosystem-polarity` | `true` | No file outputs declared |
| `//#lint:effect-imports` | `true` | No file outputs declared |
| `//#lint:effect-imports-markdown` | `true` | No file outputs declared |
| `//#lint:identity-registry` | `true` | No file outputs declared |
| `//#lint:jsdoc-module-tags` | `false` | No file outputs declared |
| `//#lint:judge-rubric` | `true` | No file outputs declared |
| `//#lint:oxlint` | `false` | No file outputs declared |
| `//#lint:package-scripts` | `true` | No file outputs declared |
| `//#lint:reflection-artifacts` | `true` | No file outputs declared |
| `//#lint:roadmap-refs` | `true` | No file outputs declared |
| `//#lint:schema-first` | `true` | No file outputs declared |
| `//#lint:tsgo-rules` | `true` | No file outputs declared |
| `//#lint:typos` | `false` | No file outputs declared |
| `//#repo-sanity:bun-audit` | `false` | No file outputs declared |
| `//#repo-sanity:changeset-graph` | `true` | No file outputs declared |
| `//#repo-sanity:sherif` | `true` | No file outputs declared |
| `//#repo-sanity:syncpack` | `true` | No file outputs declared |
| `//#repo-sanity:versions` | `true` | No file outputs declared |
| `//#topo-sort` | `true` | No file outputs declared |

Fallow audit/dead-code/health checks and advisory commands name report paths
and may produce raw diagnostics. Preserve report materialization separately
from return-code reuse. `--base "$BEEP_PROOF_BASE"` adds shell expansion and
Git selection; advisory success has different authority from a blocking check.
The config-check task is a separate no-cache command.

JSDoc inventory explicitly writes JSON and Markdown despite its task name
ending in `:check`. It remains uncached and declares those outputs. Changeset
status and Bun audit likewise remain uncached; changeset selection and external
vulnerability state cannot be inferred from a source hash alone.

The other CLI-dispatched checks still cross their command-specific parsers,
repository/config readers and verdict handlers. The external `oxlint`, `typos`,
`syncpack` and pinned `sherif@1.10.0` launchers retain installed-tool/config and
process-capture obligations. Version checking passes `--skip-network`, which
narrows that invocation but does not establish runtime hermeticity. Topo-sort
prints the workspace dependency order (or reports cycles); it is not a manifest
rewrite. No row is promoted merely because its declared outputs are empty.

## Hosted source and remaining evidence

`workflow-boundaries-post-main.json` reproduces ten local workflow/action
files, 27 jobs, five matrix declarations, 77 uses occurrences and 21 distinct
references. Membership counts are unchanged; the doctest selection behavior
above changed. The reusable `heavy.yml@main` reference remains mutable.
Actual resolved hosted revisions, conditional execution and required statuses
retain their existing proof owners.

The seven prior semantic/runtime obligations remain open. This source review
narrows membership and dispatch classification; it does not prove nested
runtime behavior, reads/writes, output restoration, signed remote comparisons,
shadow decisions or hosted authority. The refreshed attachment must carry
those obligations forward explicitly.
