# #1875 Effect Vitest canon wave 11: record

Lane `rsc-vitest-w11`, branch `test/vitest-canon-wave11` off `main` `8b4d63b1f3` (which has
#1855 wave 8, #2292). Scope: the last 15 open #1875 migration rows, 8 EV004 in
`step-capture-lifecycle.test.ts` and 7 EV010 in seven files. The EV002 `roadmap-refs.test.ts`
remainder is held for a `--root` seam in `src/` and is untouched. This wave changes no
detector and no `src/` file. After the first pass, the driver authorised two follow-up steps
in the same lane: migrating `OutboxAttachmentSource` with a new `@beep/memfs`
devDependency, and converting `Outbox.live` to an exception with the reason proposed below.
That conversion is the wave's only status change.

## Census at the base `8b4d63b1f3`

One census, paired by `(ruleId, file, occurrence)` as a multiset. At the base the inventory
holds 560 rows: 544 exceptions and 16 open (EV002 1, EV004 8, EV010 7).

| File | Package | Rule | Open at base | Retired | Open after |
| --- | --- | --- | ---: | ---: | ---: |
| `test/step-capture-lifecycle.test.ts` | repo-cli | EV004 | 8 | 8 | 0 |
| `test/ci-lane-timings.test.ts` | repo-cli | EV010 | 1 | 1 | 0 |
| `test/yeet-review-window.test.ts` | repo-cli | EV010 | 1 | 1 | 0 |
| `test/test-typecheck-coverage.test.ts` | repo-cli | EV010 | 1 | 1 | 0 |
| `test/yeet-economics.test.ts` | repo-cli | EV010 | 1 | 1 | 0 |
| `test/drawings-intake.test.ts` | repo-cli | EV010 | 1 | 1 | 0 |
| `test/OutboxAttachmentSource.test.ts` | m365-mcp | EV010 | 1 | 1 | 0 |
| `test/integration/Outbox.live.test.ts` | m365-mcp | EV010 | 1 | 0 (converted) | 0 |
| `test/roadmap-refs.test.ts` (not in scope) | repo-cli | EV002 | 1 | 0 | 1 |
| **Total** | | | **16** | **14 + 1 converted** | **1** |

## Migrations: 14 rows

### EV004: the eight `step-capture-lifecycle` capture scopes

Each of the eight tests (`:604`, `:624`, `:646`, `:672`, `:693`, `:720`, `:742`, `:770`) piped
`runCaptured(...)` or `collectStepOutput(...)` through `Effect.scoped`. Both subjects already
own their scope. `runCaptured` (`src/internal/process/StepExec.ts`) wraps its spawn, watchdog
and reap in its own `Effect.scoped`, and its `RunCaptured` signature has no `Scope` in its
requirements. `collectStepOutput` requires `QualityTaskEnvironment` (Crypto, FileSystem, Path,
ChildProcessSpawner), also without `Scope`. The fake spawners register no finalizer. So each
outer scope was empty: nothing was attached to it, and its close could not reach an
assertion. The kill, unref and interruption ordering that the earlier proof
(`goals/effect-vitest-canon/research/step-capture-scope-proof.md`) attributed to these scopes
happens inside `runCaptured`'s own scope, which this wave does not change. That settles the
question #1875 wave 9 (K3) left open and #1855 wave 8 reopened: the scopes were redundant.
The eight `Effect.scoped` stages were deleted. Nothing else changed.

### EV010: five repo-cli files move to the memory filesystem

`@beep/repo-cli` already depends on `@beep/memfs`, so no manifest changed.

| File | Change | Tests |
| --- | --- | ---: |
| `ci-lane-timings.test.ts` (H1) | `laneTimingsCommandLayer` becomes `Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer, TestConsole.layer)`. The later memory operand replaces the native filesystem, while `NodeServices` keeps the `Command.run` environment type (`ChildProcessSpawner`, `Crypto`, `Stdio`, `Terminal`). This is the shape #1855 wave 7's `memoryReplacesFileSystem` recognises. | 68 |
| `yeet-review-window.test.ts` (H1) | The two `NodeServices.layer` blocks use one `reviewReadPlatform = Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer)`. | 25 |
| `test-typecheck-coverage.test.ts` (H6) | `NodeFileSystem.layer` becomes `MemoryFileSystem.layer` in `FileSystemLayer`. | 5 |
| `yeet-economics.test.ts` (H6) | `NodeServices.layer` becomes `Platform = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer, NodeCrypto.layer)` for the live source and the failing-source command blocks. No block runs a CLI command, so no spawner or terminal is needed. The first trial without `NodeCrypto.layer` failed 4 of 31 with `Service not found` for the crypto service (the effect 4.0 key that `effect/crypto/Digest` and `effect/crypto/SecureRandom` replaced); with it, 31 of 31 pass. | 31 |
| `drawings-intake.test.ts` (H6) | Its four `NodeServices.layer` uses become `Platform = Layer.mergeAll(NodeServices.layer, MemoryFileSystem.layer)`, because two blocks run `Command.runWith(drawingsCommand, ...)`. | 17 |

The H6 files test link refusal: walking a followed symlink and skipping a cycle
(`test-typecheck-coverage`), refusing a symlinked journal, run directory or checkout
(`yeet-economics`), and refusing an out directory reached through a link (`drawings-intake`).
Each subject calls these guards through the `effect/FileSystem` service only (`readLink`,
`realPath`, `stat`, `FsGuards.readContainedFileStringNoFollow`), never `node:fs`. So the memory
volume, which models links and `realPath`, runs the same guard code. Probes 4 to 6 below show
that the link cases still decide each test's outcome on the memory volume.

### EV010: `OutboxAttachmentSource` (m365-mcp), authorised follow-up

The subject resolves attachments only through the `effect/FileSystem` service: its `src/`
files import no `node:` module, `NodeFileSystem` or `Bun` API. So its escaping-symlink and
outside-root refusals run the same code on the memory volume. Commands, run from the
worktree:

- `cd packages/drivers/m365-mcp && bun add -d @beep/memfs@workspace:^`, which installed
  `@beep/memfs@workspace:packages/tooling/test-kit/memfs` and added the devDependency to
  `package.json` and `bun.lock`.
- `bun run beep tsconfig-sync`: "applied changes (3 file change(s))". The memfs reference was
  added to `packages/drivers/m365-mcp/tsconfig.json` and `tsconfig.check.json` (9 → 10
  references each), and `standards/fallow.boundaries.generated.jsonc` was regenerated (the
  m365-mcp allow lists gain `@beep/memfs`). None of these was edited by hand.
- In the test, `NodeFileSystem.layer` becomes `MemoryFileSystem.layer` in `PlatformLayer`
  (4 tests).
- `bun run beep lint package-scripts`: "189 manifests, 0 drifting, 0 written".
- `bun run beep cache audit` reported 5 blocking `configuration-drift` findings:
  `@beep/m365-mcp#build`, `#check`, `#lint:deprecated-apis`, `#test` and `#test:property`.
  These come from the new manifest bytes and the dependency edge. The review is
  `research/cache-baseline-review-vitest-canon-wave-11.md` (sha256 `ba4c32d1...4e6d`) and the
  request `research/cache-baseline-request-vitest-canon-wave-11.json` (subject
  `@beep/m365-mcp`, previous baseline digest `b8378901...8a60`).
  `bun run beep cache baseline --request <request>` reported "Review stamped on 1 subject(s):
  @beep/m365-mcp. Carried 188 prior review(s). Dropped: none.", and `cache audit` then
  reported 0 blocking findings.

No assertion, expected value, test name or registration changed. No test was added,
removed or skipped.

## Mutation probes

Each probe ran one file on Bun through `beep-heavy`, then restored the migrated file byte for
byte (checked by comparing contents). None hung: the longest run took 3 s.

| # | File | Mutation | Result |
| --- | --- | --- | --- |
| 1 | `step-capture-lifecycle` | in the eight migrated tests, expected `exitCode` 124 → 125 and each `killCount` expectation shifted by one | 8 of 22 fail (exactly the eight migrated tests) |
| 2 | `ci-lane-timings` | the summary must contain `ci lane timingz` | 1 of 68 fails |
| 3 | `yeet-review-window` | the clock moves 1 minute, not 13, before the window must read elapsed | 1 of 25 fails |
| 4 | `test-typecheck-coverage` | `ws/linked` is a plain directory instead of a symlink to `outside` | 1 of 5 fails (`linked/c/package.json` missing) |
| 5 | `yeet-economics` | the run-c journal is a regular file instead of a symlink | 1 of 31 fails (the loader no longer counts it unreadable) |
| 6 | `drawings-intake` | `root/link` is a plain directory instead of a symlink to `elsewhere` | 1 of 17 fails (the link refusal no longer fires) |
| 7 | `OutboxAttachmentSource` | `root/escape` is a regular file instead of a symlink to `outside/secret.txt` | 2 of 4 fail (the escape refusal and the one-bad-path case no longer refuse), in 1.3 s |

## Converted: `integration/Outbox.live.test.ts:13` (m365-mcp)

The test drives the live Microsoft Graph outbox under `excludeTestServices: true`. The live
block writes a real attachment file that the live service reads back from disk, and the
block skips itself unless `M365_OUTBOX_*` credentials are set. Without credentials, a memory
trial observes nothing (1 skipped either way), so no failing trial can exist on this
workstation, and the test's purpose is real platform I/O. On the driver's authorisation the
row's status became `exception`, with exactly the reason this record proposed:

> Credential-gated live Microsoft Graph smoke whose attachment file the live service reads
> from the native volume; skips without M365_OUTBOX_* settings. Owner: @beep/m365-mcp.
> Exit: retire when EV010 excludes test/integration/*.live.test.ts suites, or the smoke moves
> out of the effect-vitest scope.

Only that row's `status` and `reason` were set. Two `--write` runs then kept the edit
unchanged.

## After the wave

Before the follow-up, `lint effect-vitest` reported `introduced=0 resolved=13`. After the
follow-up, two consecutive `--write` runs produced identical inventory bytes (sha256
`895f8bb4ee118fc754b7eb95ace9f0c50459352ae9b298ff73399c86690bddb5`). A later plain scan
reports `introduced=0 resolved=0`.

Against `8b4d63b1f3`, paired by `(ruleId, file, occurrence)` as a multiset:

| | Rows |
| --- | ---: |
| Base | 560 (544 exceptions, 16 open) |
| Gone | 14, all open: EV004 `inner-helper-scope-lifetime-review` ×8 (`step-capture-lifecycle`); EV010 `platform-resource-provenance-review` ×4 (`ci-lane-timings`, `drawings-intake`, `yeet-economics`, `yeet-review-window`); EV010 `platform-filesystem-candidate` ×2 (`test-typecheck-coverage`, `OutboxAttachmentSource`) |
| New | 0 |
| Status changed | 1 (open to exception: `Outbox.live.test.ts:13` EV010) |
| Reason changed | 1 (the same row) |
| After | 546 (545 exceptions, 1 open) |

That reconciles: 16 − 14 − 1 = 1 open, 544 + 1 = 545 exceptions, 560 − 14 = 546 rows. EV004
open falls from 8 to 0 and EV010 open from 7 to 0, and EV002 stays at 1 open. All 545
exceptions carry `Owner: @beep/<package>` and an exit.

## Remaining frontier: 1 open row

- `roadmap-refs.test.ts:78` EV002, held for a `--root` seam in `src/`.

## The #1855 closeout gap after this wave

#1855 accepts on "fresh zero actionable scan, individually justified surviving exceptions with
owner and exit, unchanged coverage floors".

- **Zero actionable scan:** not met by one row, `roadmap-refs.test.ts:78` EV002, which
  needs the held `--root` seam in `src/`. Every #1875 test migration is done.
- **Owner and exit:** met. All 545 exceptions name an owner and an exit: the 544 from
  #1855 wave 8, unchanged, plus the `Outbox.live` conversion.
- **Individually justified:** unchanged from #1855 wave 8. The 280 rewritten reasons rest on
  a per-row source check, not a fresh trial each. This wave's finding sharpens that caveat:
  the eight step-capture scopes, whose recorded claim was a scope-close ordering, were empty
  scopes, and that is visible from the subject's requirement type without running anything.
  A sweep that checks every EV004 exception's wrapped effect for `Scope` in its requirements
  would be a cheap strict form of this condition.
- **Coverage floors:** see Verification.

## Verification

Route: S39/S41 Claude chain, `claude-opus-5-5` child, with no cross-provider lane. Every heavy
command ran alone through `beep-heavy` with stdin from `/dev/null`. Dependency dists were
built first with `bunx turbo run build --filter=@beep/repo-cli^...` (68 of 68, 67 cached).
The lane report `.beep/vitest-w11-report.md` lists every gate result.

| Check | Result |
| --- | --- |
| `bun run beep lint effect-vitest` | `introduced=0 resolved=13` (first pass); after the follow-up, two byte-stable `--write` runs and a plain scan `introduced=0 resolved=0` |
| repo-cli `bun run check` (tsconfig.check, scripts, test overlay) | exit 0 |
| repo-cli `package-test-typecheck` | exit 0 |
| 6 touched files, Bun (`bunx --bun vitest run`) | 168 passed |
| 6 touched files, Node (`bunx vitest run`) | 168 passed |
| Mutation probes | 7 of 7 fail, none hang |
| m365-mcp `bun run check` (tsconfig.check plus test overlay); `package-test-typecheck` | exit 0, exit 0, after `turbo run build --filter=@beep/m365-mcp^...` (18 of 18) |
| m365-mcp tests, Bun and Node (`bunx --bun vitest run`, `bunx vitest run`) | 99 passed, 1 skipped (`Outbox.live`, no credentials) on each runtime |
| Coverage ratchet `bun run coverage --filter=@beep/m365-mcp` | `coverage-ratchet ok: compared 1 package(s)`, 99 passed |
| `quality package-verify @beep/m365-mcp` | ok (audit, docgen) |
| `lint package-scripts`; `lint policy-fingerprint` | 0 drifting; current |
| `cache audit` | 5 m365-mcp configuration-drift blocks, then 0 after the reviewed baseline |
| Coverage ratchet `bun run coverage --filter=@beep/repo-cli` | `coverage-ratchet ok: compared 1 package(s)`, 7902 passed and 5 skipped. The first run failed one test, `knowledge-doctor-evaluators` "reads the same packets ... as the live filesystem", which compares the `HEAD` tree with the working tree and so fails on any uncommitted packet edit (here the statusNote). That is environment-only: with the packet edits parked (restored from `HEAD`, then put back byte for byte), all 376 files pass. |
| `quality package-verify @beep/repo-cli` | ok (audit, docgen) on a run with the packet edits parked. A run with the edits in place failed only the same `knowledge-doctor-evaluators` dirty-tree test. |
| `lint:schema-first` | `introduced=0 resolved=0` |
| root `lint:oxlint`; root docs oxlint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) | exit 0, exit 0 |
| `quality fallow audit --base origin/main --check` | ok, 0 findings (rerun after the boundary regeneration) |
| Biome on the touched tests, m365-mcp manifest, tsconfigs and the request | clean |
| `jsdoc:inventory:check` then `jsdoc:ratchet:check` | ok, `increased=0`, zero-legacy ok |
| `goals:doctor` | OK, no new blocking findings |

## Reversal

Revert the PR. The eight capture tests get their `Effect.scoped` stages back, and the six
EV010 files return to their native layers. The `@beep/m365-mcp` devDependency and its
`bun.lock` entry, the two tsconfig references, the regenerated fallow allow-list entries,
the `@beep/m365-mcp` baseline review stamp and dependency edges in
`standards/cache-qualification-baseline.json`, and the review and request files are all
removed with it. The `Outbox.live` row returns to open without a reason. The inventory
returns to the base `8b4d63b1f3`: 560 rows, 544 exceptions, 16 open (EV002 1, EV004 8,
EV010 7).
