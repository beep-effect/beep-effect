# #1855 detector repairs wave 7: the EV010 owner/exit register

Lane R of the overnight effect-vitest burn-down, worktree `rsc-detectors-w7`, branch
`feat/residue-detectors-wave7`, on `main` `77edd3db28`. Scope: the 90 open EV010 rows in the 89
repo-cli test files of `lanes.R`, every EV010 exception repo-wide (137 at the base), and the EV010
detector (`EffectVitestDetectors.ts`, with `effect-vitest-detectors.test.ts`). No other test file
is edited. The `files-command` `withReplacedPath` exception and the seven `#1855 wave 4 register`
exceptions are not EV010 rows and are untouched.

Input: the evidence classes of `vitest-canon-wave-7.md` (#1875 wave 7). H1 and H6 carried
detector counterexamples; H2-H5, H7 and H8 are live-resource classes for this register.

## Census at `77edd3db28`

`bun run beep lint effect-vitest`: 712 rows, 465 exceptions and 247 open. 30 exceptions carry
both `Owner:` and `Exit:`. EV010 holds 264 rows: 137 exceptions (84
`platform-resource-provenance-review`, 53 `platform-filesystem-candidate`) and 127 open (90 and
37). 90 of the 127 open rows sit in this lane's 89 files (`corpus-provenance-index.test.ts`
carries two).

Every count below comes from one census paired by `(ruleId, file, occurrence)` against
`git show 77edd3db28:standards/effect-vitest.inventory.jsonc`.

## Detector repairs

Each repair has paired fixtures in `effect-vitest-detectors.test.ts`, written first. Against the
base detector all six new tests (three blocks) failed on their first false-positive assertion; after the repair
the near misses still flag.

### Repair 1 (H6): a native FileSystem layer whose every harness exercises a native link

EV010 always flagged a direct `@effect/platform-*/NodeFileSystem` or `BunFileSystem` import as a
`platform-filesystem-candidate`, even when every `it.layer` it reaches binds
`yield* FileSystem.FileSystem` and calls `symlink`, `realPath`, `readLink`, `link`, `chmod`,
`chown` or `utimes` on it. The same harness over `NodeServices.layer` already passed
`harnessProvesNativeFileSystem`. That was the H6 counterexample.

`nativeFileSystemLayerIntegration` now applies that proof to the three FileSystem subpath
modules: it follows each `layer` reference with `harnessFlows` and clears the row only when every
reached harness proves a native operation. A provided workspace subject is not enough here,
unlike the services bundle, because a direct filesystem import is a memory-filesystem candidate
by default. `servicesBundleLayers` becomes `platformBundleLayers`, parameterized by a
`PlatformBundle` (subpath modules plus root bundle names), so the services and filesystem paths
share one reference walk. `node:fs`, `node:os` `tmpdir` and `require` forms are unchanged and
always flag.

Fixtures ("clears a $module layer only when every harness proves native links", three modules).
Silent: a namespace import with a `symlink` harness, a renamed `layer` import merged into two
`symlink` harnesses, and a `realPath` reached through a same-file helper. Still EV010: a
read-only harness, one native and one read-only harness, an extra `Fx.provide` use, a provided
subject with a read-only harness, a `symlink` on a non-FileSystem receiver, an `os.tmpdir()` call,
and a `node:fs` import.

### Repair 2 (H6): a runtime choice between the Node and Bun bundles

`corpus-provenance-index.test.ts` selects
`process.versions.bun === undefined ? NodeServices.layer : BunServices.layer`. The flow walk
stopped at the conditional, so both imports stayed opaque although the harnesses prove native
links. `runtimeBundleChoice` now climbs a conditional when the current node is a branch and both
branches are services bundle layers (`isServicesBundleLayer`). Any other branch stays opaque, so
the existing `layer(flag ? NodeServices.layer : Fake.layer)` fixture still flags.

Fixtures ("follows both branches of a conditional platform bundle"). Silent: the corpus shape and
a conditional inside `L.provideMerge`. Still EV010: the same conditional over a read-only harness
(both imports, two rows), and a bundle in the condition position.

### Repair 3 (H1): a later memory filesystem replaces the bundle's FileSystem

`Layer.merge` and `Layer.mergeAll` build their operands into one context with `Context.mergeAll`,
where a later service replaces an earlier one (checked against `node_modules/effect`).
`Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer)` therefore gives the harness a memory
FileSystem, which `agent-effectiveness-command.test.ts` uses for its CLI environment type. The
detector still reported the bundle.

`memoryReplacesFileSystem` stops the walk with no harness flows when a `merge`/`mergeAll` argument
after the bundle is `MemoryFileSystem.layer`, `layerWith(...)` or `layerFaulty(...)` from
`@beep/memfs` (named or namespace import). `bindingFlows` now treats a binding as opaque only
when it has no references, and `canonicalPlatformIntegration` requires at least one reached
layer instead of at least one harness, so a fully replaced bundle clears while an unused binding
still flags.

Fixtures ("clears a $services bundle whose FileSystem a later memory layer replaces", Node and
Bun). Silent: `mergeAll` and `merge` with memory last, a renamed import through a `const`, a
namespace `layerWith`, and the `provideMerge(mergeAll(...))` shape. Still EV010: memory first in
`mergeAll` and `merge`, a local `./memory.ts` look-alike, a non-layer member, `provideMerge`
(not a merge), and a second harness over the bare bundle.

### Mutation probes

Each probe changed one guard, ran the paired fixture on Bun, failed without hanging, and was
restored byte-identical from a scratch copy:

- Repair 3 without the operand order: the memory-first near misses fail (2 tests).
- Repair 1 with `A.some` instead of `A.every` over harnesses: the mixed native/read-only near miss
  fails (3 tests).
- Repair 2 without the both-bundles check: the existing `flag ? NodeServices.layer : Fake.layer`
  fixture fails.

### Rows retired by the repairs: 17

| Repair | Open | Exceptions | Rows |
| --- | ---: | ---: | --- |
| 1 | 5 | 9 | open: `quality-scheduler`, `yeet-ack`, `yeet-portfolio-index-guard`, `yeet` (repo-cli), `OutboxAuditLog` (m365-mcp, lane C's file); exceptions: `PgliteDataDirCompatibility` (professional-desktop), `PathSafety` (file-processing), `SemanticFoundation` (ontology), `Workspaces` (repo-utils), `EffectTsgoEffectFnPolicy` (repo-configs), `quality-artifact-generators`, `quality-scheduler-degraded-inputs`, `reviewer-bootstrap`, `yeet-inbox` (repo-cli) |
| 2 | 2 | 0 | `corpus-provenance-index` ×2 |
| 3 | 1 | 0 | `agent-effectiveness-command` |
| **Total** | **8** | **9** | |

Each retired file was read: its native harnesses call `symlink`, `realPath`, `readLink`, `chmod`
or `utimes` on the bound FileSystem (fake executables, permission-denied directories, link
refusal), or its bundle's FileSystem is the memory one.

Not repaired, by finding: `drawings-intake` and `yeet-economics` (H6) also hold read-only harnesses
over the same bundle, reached through a factory return (`laneLayer()`, `sourceFailingWith(...)`).
Following factory returns would not clear them, so no such rule was added. `ci-lane-timings` (H1)
uses the bare bundle, which the detector correctly flags.

## Open rows converted to exceptions: 80

Each row was checked against its source (imports, harness layers and the resource the file
reaches) before conversion. Each reason names the file's resource and an exit condition, in the
form `<why>. Owner: @beep/repo-cli. Exit: retire when <condition>.`

| Class | Rows | Files |
| --- | ---: | --- |
| H2 real checkout or committed fixtures | 32 | `agent-effectiveness-eval-scorer`, `architecture-operation-plan`, `cache-conformance`, `cache-conformance-lab`, `check-census`, `ci-heavy-admission`, `ci-rerun-runner-loss`, `commitlint-config`, `coverage-turbo-inputs`, `create-package-identity-template`, `effect-schema-inventory-fixture`, `effect-vitest-contract`, `effect-vitest-primitives`, `gate-order-handoff`, `knowledge-doctor-evaluators`, `knowledge-doctor-grouping`, `knowledge-refs`, `lint-judge-rubric`, `lint-subcommand-allowlist`, `models-locators`, `native-runtime-prefix`, `proof-digest`, `proof-ledger`, `single-project-emit`, `skills-materialize`, `skills-relock`, `test-tsgo-turbo-inputs`, `yeet-command-wiring`, `yeet-merge-gate`, `yeet-review-body-signal`, `yeet-scripted-process`, `yeet-status-triage` |
| H3 process-global working directory | 13 | `ci-lane`, `effect-fn`, `goals-doctor-path-security`, `goals-graph`, `goals-manifest-capabilities`, `goals-set-risk-tier`, `lab-identity-segment`, `schema-catalog`, `schema-first-parity`, `schema-topology`, `skills-command`, `sync-data-to-ts`, `tsconfig-sync` |
| H4 live process | 33 | `cache-baseline-merge`, `cache-command`, `cache-dependencies`, `cache-pilot-orchestration`, `corpus-preservation`, `drawings-command`, `graft-deep-refresh`, `jsdoc-inventory-detector-fixes`, `knowledge-doctor`, `knowledge-mint-bootstrap`, `knowledge-semantic-delta`, `package-verify`, `palantiri-command`, `quality-tasks`, `stream-console`, `tmpfs-reap`, `yeet-base-conflict`, `yeet-check-fidelity`, `yeet-comment-actor`, `yeet-converge`, `yeet-inbox-porcelain`, `yeet-inbox-view`, `yeet-pr-comment-rows`, `yeet-pr-wave-notifier`, `yeet-push-ack-timeline`, `yeet-ready-gate`, `yeet-remediation`, `yeet-resume`, `yeet-review-fixes`, `yeet-watch-mode`, `yeet-wave-exempt`, `yeet-wave-rerun`, `fixtures/graft/crux-batches.test.js` |
| H5 native timestamps | 1 | `turbo-lane-digest` |
| H8 real multi-chunk streaming | 1 | `cli-kits` |
| **Total** | **80** | |

Two corrections to wave 7's classes, from the source check:

- `yeet-scripted-process` moves from H4 to H2. Only its "yeet ready native repo root" block uses
  `NodeServices.layer`, and there `runYeetReady` gets no root, so it resolves the real checkout.
  Its other blocks already run on `MemoryFileSystem`.
- The inbox writers in H4 (`yeet-base-conflict`, `-check-fidelity`, `-comment-actor`, `-converge`,
  `-inbox-porcelain`, `-inbox-view`, `-pr-comment-rows`, `-push-ack-timeline`, `-remediation`,
  `-wave-exempt`, `-wave-rerun`) reach the inbox's active projection, which runs `flock`, `sh`
  and `jq` through `Bun.spawnSync` in the real inbox directory (`Yeet/internal/Inbox.ts`), outside
  any `ChildProcessSpawner` the tests provide. Their reasons name that spawn.

### Lane rows left open: 3

- `ci-lane-timings.test.ts:34` (H1). Its harnesses use the bare `NodeServices.layer` merged with
  `TestConsole.layer`; wave 7 found every test passes on memory at runtime. It is a migration, not
  a live-resource need: `Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer, ...)` keeps
  the CLI environment type and now clears under repair 3. Test files are outside this lane.
- `drawings-intake.test.ts:24` and `yeet-economics.test.ts:37` (H6). Their link-refusal blocks are
  native, but read-only blocks over the same import are not (`laneLayer()`, the `beep drawings
  intake` command blocks, and `sourceFailingWith(...)`). Splitting those blocks onto
  `MemoryFileSystem` would clear the rows.

## Exceptions rewritten: 128

All 128 surviving EV010 exceptions (137 at the base minus the 9 retired by repair 1) now read
`<why>. Owner: @beep/<package>. Exit: retire when <condition>.` The owner is the row's package. The
why keeps the reviewed claim (research references kept, run counts, durations and source SHAs
dropped), and each source was scanned for the claimed resource (links, modes, spawns, engines,
checkout reads, sockets, procfs, existing memory blocks).

No exception was retired by source: every surviving row's import is still used by a harness the
detector cannot clear. 18 exceptions describe only ordinary temporary files, so their exit is a
move to `MemoryFileSystem.layer`, marked "a #1875 migration candidate": `Gold`, `FilingDecisionLlm`,
`VaultSyncDrift`, `MailTagging.files`, `MailTagging.layers` (whose old reason said Effect has no
in-memory FileSystem; `@beep/memfs` is one), `archive`, `circuit-breaker`, `telemetry-v2-store`,
`telemetry-v2`, `accounts-usage`, `coverage-baseline-subtraction`, `explore-check`,
`explore-graduate-plan`, `match-person-model-store`, `research-library-paper-bounds`,
`yeet-artifact-writers`, `yeet-monitor-check-registration` and `yeet-reply-engine`.

## After the wave

`lint effect-vitest --write` was run twice; the inventory sha256 was identical both times
(`c9cb42918c23dceb75aaadef3e93b1a724a2dd09a2428ac3687e6fb5317dba81`). A plain scan reports
`introduced=0 resolved=0`.

Against `77edd3db28`, paired by `(ruleId, file, occurrence)`:

| | Rows |
| --- | ---: |
| Base | 712 (465 exceptions, 247 open) |
| Gone | 17 (all EV010: 8 open, 9 exceptions) |
| New | 0 |
| Status changed | 80 (open to exception, all EV010) |
| Reason changed | 208 (128 rewritten exceptions plus the 80 conversions) |
| After | 695 (536 exceptions, 159 open) |

Check: 465 − 9 + 80 = 536 exceptions; 247 − 8 − 80 = 159 open; 712 − 17 = 695 rows. EV010 goes
from 264 rows (137 exceptions, 127 open) to 247 (208 exceptions, 39 open). Every EV010 exception
now carries an owner and exit, and the repo-wide count of owner/exit exceptions goes from 30 to
238.

## What remains

- EV010: 39 open rows. 3 in this lane's files (above), 36 outside it: the H7 packages without a
  `@beep/memfs` dependency, the deferred `step-capture-lifecycle` pair, and the repo-cli H2-H6
  files of other lanes.
- The owner/exit register for the other rules: 298 exceptions without an owner and exit (EV002,
  EV004, EV006 and the rest).
- 18 EV010 exceptions are #1875 memory-filesystem migration candidates.

## Verification

Route: S39/S41 Claude chain, `claude-opus-5-5` child, no cross-provider lane. Every heavy command ran
alone through `beep-heavy` with stdin from `/dev/null`. Dependency dists were built first
(`bunx turbo run build --filter=@beep/repo-cli^...`, 67 of 67 tasks, 66 cached); the first
`check`, run before that build, failed with TS6305 floods and is not counted.

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=17` before `--write`, then `introduced=0 resolved=0` |
| `--write` byte stability | two consecutive writes, sha256 `c9cb4291...dba81` both times |
| repo-cli `bun run check` (tsconfig.check, scripts, test overlay) | exit 0 |
| `effect-vitest-detectors` and `effect-vitest-contract` tests | 291 of 291 on Bun, 291 of 291 on Node |
| New fixtures against the base detector | 6 of 6 failed before the repair |
| Mutation probes (Bun) | each of the three probes failed its near miss, none hung; source restored byte-identical |
| repo-cli full test suite (`beep:test`, Bun) | 374 files, 7,889 tests passed. A first `beep:audit` run was killed with SIGTERM (exit 143) 30 s into vitest during host memory pressure; the rerun passed. |
| Coverage ratchet `bun run coverage --filter=@beep/repo-cli` | 374 files passed, `coverage-ratchet ok` |
| `quality package-verify @beep/repo-cli` | failed twice with `Failed to spawn bun run docgen.` (environment: host memory pressure, earlyoom active). Its parts were run directly instead: `beep:test` above, and `bun run --cwd packages/tooling/tool/cli docgen` exit 0 (3,538 examples typechecked) |
| `bun run docgen:local` | ok (repo-cli aggregated; no export changed) |
| Biome on the two changed source files | clean (after one format-only rewrite) |
| root `lint:oxlint`; root docs oxlint | exit 0, exit 0 |
| `lint:schema-first` | `introduced=0` |
| `quality fallow audit --base origin/main --check` | first run: 1 introduced complexity finding (`callStep` cognitive 9 over 8), fixed by extracting `compositionStep`; rerun 0 findings |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `goals:doctor` | OK, `blocking_new=0` |

## Reversal

Revert the PR. The detector loses `nativeFileSystemLayerIntegration`, `runtimeBundleChoice` and
`memoryReplacesFileSystem` (and `platformBundleLayers` returns to `servicesBundleLayers`), the
three new fixture blocks (six tests) go, and the inventory returns to the base: 712 rows, 465 exceptions, 247
open. The 17 retired rows come back with their old status and reasons, the 80 converted rows
reopen, and the 128 rewritten reasons return to their earlier text.
