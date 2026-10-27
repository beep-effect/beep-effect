# #1875 Effect Vitest canon wave 10: record

Lane `rsc-vitest-w10` (overnight lane C), branch `test/residue-vitest-canon-wave10` off
`main` `77edd3db28`. Scope: the 20 open rows in 20 test files outside `@beep/repo-cli`:
18 EV010, one EV004 in `@beep/workspace-server` and one EV014 in `@beep/practice-kg-mcp`.
This wave changes no detector and adds no exception. No `src/` file is edited.

## Census at the lane base `77edd3db28` (historical snapshot)

The lane branched from `77edd3db28`; the PR's merge base is `190572531f` (see "Against the PR merge base" below). At the lane base the inventory holds 712 rows: 465 exceptions and 247 open. EV010 holds 264 rows (127
open), EV004 139 (50 open), EV014 1 (1 open). The 20 rows of this lane are all open.

| Package | Rule | Open at base | Retired | Open after |
| --- | --- | ---: | ---: | ---: |
| `@beep/workspace-server` | EV004 | 1 | 1 | 0 |
| `@beep/practice-kg-mcp` | EV014 | 1 | 1 | 0 |
| `@beep/practice-identify` | EV010 | 2 | 1 | 1 |
| `@beep/pdf-tools` | EV010 | 1 | 1 | 0 |
| `@beep/m365-mcp` | EV010 | 3 | 0 | 3 |
| `@beep/occt` | EV010 | 3 | 0 | 3 |
| `@beep/law-practice-server` | EV010 | 2 | 0 | 2 |
| `@beep/ciops` | EV010 | 1 | 0 | 1 |
| `@beep/box-provisioning` | EV010 | 1 | 0 | 1 |
| `@beep/effect-drizzle` | EV010 | 1 | 0 | 1 |
| `@beep/technical-drawing` | EV010 | 1 | 0 | 1 |
| `@beep/utils` | EV010 | 1 | 0 | 1 |
| `@beep/repo-utils` | EV010 | 1 | 0 | 1 |
| `@beep/lint-rules` | EV010 | 1 | 0 | 1 |
| **Total** | | **20** | **4** | **16** |

## Migrations

| File | Package | Rule | Change | Tests |
| --- | --- | --- | --- | ---: |
| `test/ThreadStore.test.ts` | workspace-server | EV004 | `Effect.scoped` dropped from `Layer.build, Effect.scoped, Effect.exit` in the public-id initialization-failure test. The build fails by design, so no scope outlives it and the test's own Scope owns the empty build (the wave 3 `SanitizedToolkit` and `SessionServer` precedent). | 12 |
| `test/Host.test.ts` | practice-kg-mcp | EV014 | The outer `it.layer(smokeTemplateLayer)` block gets `{ timeout: "2 minutes" }`, the budget its nested blocks already use. | 26 |
| `test/PracticeIdentify.command.test.ts` | practice-identify | EV010 | `NodeServices.layer` becomes the bundle's own composition with the memory volume: `Layer.provideMerge(NodeChildProcessSpawner.layer, Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer, NodeStdio.layer, NodeTerminal.layer))`. This is the `Command.Environment` the CLI type requires, so the test overlay stays clean, which answers wave 7's H1 class for this file. No case reads a file or spawns. | 12 |
| `test/PdfTools.service.test.ts` | pdf-tools | EV010 | `NodeServices.layer` (two `provideMerge` sites) becomes `Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer)`. The spawner is already a fake that writes every file the subject reads. | 37 |

Both EV010 packages gain `@beep/memfs` as a devDependency through `bun add -d
@beep/memfs@workspace:^`, then `bun run beep tsconfig-sync`. That adds the memfs
reference to each package's `tsconfig.json` and `tsconfig.check.json` and regenerates the
two pdf-tools/practice-identify allow lists in `standards/fallow.boundaries.generated.jsonc`.
The manifest bytes drift 8 cached tasks (`build`, `check`, `lint:deprecated-apis`, `test`
of each package), recorded with a reviewed baseline request
(`research/cache-baseline-review-vitest-canon-wave-10.md`). Afterwards `cache audit`
reports 0 blocking findings. No generated script block was edited; `lint
package-scripts` reports 0 drifting manifests.

No assertion, expected value, test name or registration changed. No test was skipped,
added or removed.

## Not migrated: 16 EV010 rows

Each file was tried on the memory filesystem unless marked "from source"; the trial was
then restored byte for byte from `HEAD`. No exception was added. Under S31 these rows stay
open for #1855's owner/exit register.

- **`PracticeIdentify.runtime.test.ts` (practice-identify), real checkout root.** The
  trial fails 1 of 5: "refuses repository outputs" gets `unavailable` instead of
  `unsafe-output`. The subject's output guard (`repositoryMarker` in `runtime/Layer.ts`)
  looks for the real checkout above the requested path, so it needs the native volume
  (wave 7 H2).
- **`BoxContentMigration.test.ts` (box-provisioning), the subject wires the native
  filesystem.** The trial fails 21 of 25 with `source-missing`: the subject
  `BoxContentMigration.liveLayerWithJournal` provides its own
  `NodeFileSystem.layer`/`NodePath.layer` inside `src/`, so files the test writes to a
  memory volume are invisible to it. Changing that is a source change, which is out of
  this lane's scope.
- **`OutboxAuditLog.test.ts` (m365-mcp), OS permission enforcement.** The trial fails 1
  of 5: "surfaces a failed append as a typed error" makes the directory read-only with
  `chmod 0o500`. Memory-filesystem modes are metadata and never enforced, so the append
  succeeds.
- **`OutboxAttachmentSource.test.ts` (m365-mcp), native link guards.** The trial passes 4
  of 4, because the memory volume models links and `realPath`. The test proves that the
  attachment source refuses escaping symlinks. That guard defends against
  operating-system links, so it stays native under wave 7's H6 ruling.
- **`integration/Outbox.live.test.ts` (m365-mcp), live integration (from source).** It
  drives the live Microsoft Graph outbox with `excludeTestServices: true`.
- **`Occt.service.test.ts`, `PrimitiveLineStyle.test.ts`, `Shading.test.ts` (occt), a
  native engine binary (from source).** `Occt.layer` reads the installed
  `replicad-opencascadejs` WASM through `require.resolve` and the package's
  `package.json` from `node_modules` (wave 7 H5).
- **`PracticeKg.compare.test.ts`, `PracticeKg.correspondents.test.ts`
  (law-practice-server), DuckDB files (from source).** They write and reopen DuckDB
  database files on disk (wave 7 H5).
- **`evidence.test.ts` (ciops), committed artifacts.** The trial fails 3 of 6 with
  `PolicyDecodeError: Failed to read repo-relative artifact ".../abox.ttl"`: the replay
  reads the committed `explorations/` graph and journal and the committed mismatch fixture
  (wave 7 H2).
- **`import-boundary.test.ts` (effect-drizzle), the package's own sources (from
  source).** It walks `../src/` and `../package.json` through `import.meta.url` (wave 7
  H2).
- **`FigureSet.test.ts` (technical-drawing), workstation fonts.** The trial passes 48 and
  skips 1. "Re-derives both vendored faces from their source fonts" reads
  `/usr/share/fonts/liberation/*.ttf`, which this workstation has, and skips itself when
  they are absent. On the memory volume that test silently stops running, so the
  migration would lose coverage. The row stays open.
- **`FileSystem.test.ts` (utils), the native helpers are the subject (from source).** It
  tests `@beep/utils`'s synchronous `FileSystem` wrappers against `node:fs` in
  `os.tmpdir()`. Also, `@beep/memfs` depends on `@beep/utils`, so the devDependency would
  form a cycle.
- **`TsNativeApi.test.ts` (repo-utils), a live native binary (from source).** It spawns
  the real TypeScript native API binary against committed fixtures in
  `test/fixtures/ts-native/` (wave 7 H2/H4).
- **`docs-rules.test.ts` (lint-rules), a live subprocess.** The trial's fixture cases fail
  with `JsonReportError`: `oxlint-harness.ts` spawns the oxlint CLI on files it writes,
  and that process reads the real filesystem (wave 7 H4).

## After the wave

`lint effect-vitest --write` was run twice, and the inventory sha256 was identical both
times (`021e57f53b921285aef31d126cf862b20c5453f21f7d4844fad3376ee75c2cfc`). The scan before
`--write` reported `introduced=0 resolved=4`.

Against `77edd3db28`, paired by `(ruleId, file, occurrence)` as a multiset:

| | Rows |
| --- | ---: |
| Base | 712 (465 exceptions, 247 open) |
| Gone | 4 (all open: EV004 `inner-helper-scope-lifetime-review` ThreadStore, EV014 `resource-layer-without-hook-timeout` Host, EV010 `platform-resource-provenance-review` PracticeIdentify.command and PdfTools.service) |
| New | 0 |
| Status changed | 0 (reasons also unchanged) |
| After | 708 (465 exceptions, 243 open) |

That reconciles exactly: 247 − 4 = 243 open, 712 − 4 = 708 rows, and exceptions stay at
465. EV010 open falls from 127 to 125, EV004 open from 50 to 49, and EV014 from 1 to 0.

## Against the PR merge base `190572531f`

Waves 8 (#2281, 77 rows), 9 (#2278, 32 rows) and #1855 wave 7 (#2282, 17 rows) merged while
this PR was open, so main was merged in and the inventory regenerated twice, byte-stable.
Those three waves account for the 126-row difference between the lane base (712) and the
merge base (586). One of them touches this lane's scope: #2282's detector repair retired the
open `OutboxAuditLog.test.ts` (m365-mcp) EV010 row, so `@beep/m365-mcp` holds 2 open rows at
the merge base, not 3.

Paired by `(ruleId, file, occurrence)` against `190572531f`:

| | Rows |
| --- | ---: |
| Base | 586 (536 exceptions, 50 open) |
| Gone | 4 (the same four rows) |
| New | 0 |
| Status changed | 0 |
| After | 582 (536 exceptions, 46 open) |

That reconciles: 50 − 4 = 46 open, 586 − 4 = 582 rows, exceptions unchanged at 536.
EV010 open falls from 38 to 36, EV004 from 10 to 9, and EV014 from 1 to 0.

## Verification

Route: S39/S41 Claude chain, `claude-opus-5-5` child, no cross-provider lane. Every heavy
command ran alone through `beep-heavy` with stdin from `/dev/null`.

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=4`, then two byte-stable `--write` runs |
| Exceptions | 465 before and after, reasons unchanged |
| `bun run check` (practice-identify, pdf-tools, workspace-server, practice-kg-mcp) | exit 0 each, test files included. A first run printed diagnostics in untouched sources before the dependency dists were restored with `turbo run build --filter=<pkg>^...`; the rerun is clean. |
| `package-test-typecheck` (same four) | exit 0 each |
| Touched tests, Bun (`bunx --bun vitest run`) and Node (`bunx vitest run`) | 12, 37, 12 and 26 tests pass on each runtime, the same counts as `HEAD` |
| Mutation probes (Bun) | Each probe failed, and none hung. Command routing: the fake stage records the wrong name (5 failures). pdf-tools: the fake converter writes non-PDF bytes (3 failures). ThreadStore: the digest succeeds, so `Exit.isFailure` fails (1 failure). Host: a never-completing outer layer with a 2 s budget fails with `Hook timed out in 2000ms` instead of hanging. All files restored. |
| Coverage ratchet `bun run coverage` for the four packages | exit 0, `coverage-ratchet ok: compared 4 package(s)` |
| `lint:schema-first` | `introduced=0 resolved=0` |
| Root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) | exit 0 |
| `quality fallow audit --base origin/main --check` | exit 0, `introduced=0` |
| Biome on the changed files | clean (one import order fixed with `--write`) |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `cache audit` | 8 configuration-drift blocks from the new devDependency, then 0 after the reviewed baseline |
| `lint package-scripts`; `lint policy-fingerprint` | 0 drifting; current |
| `quality package-verify` (practice-identify, pdf-tools, workspace-server, practice-kg-mcp) | ok each (practice-identify has no docgen step) |
| `goals:doctor` | OK, no new blocking findings |

## Reversal

Revert the PR. The four test files return to `Effect.scoped`, the untimed outer block and
`NodeServices.layer`; the two devDependencies, tsconfig references, fallow allow-list
entries and cache baseline reviews go away with it. The inventory returns to the merge base
`190572531f`: 586 rows, 536 exceptions, 50 open (EV010 38, EV004 10, EV014 1 open). The
712-row lane base above is a historical snapshot; reverting does not undo waves 8, 9 or
#1855 wave 7.
