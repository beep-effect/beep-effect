# #1880 restart recovery states for native exchange journals: record

Lane `residue-exchange-recovery`, branch `feat/residue-exchange-recovery`, stacked on
#1879's head `dcabf8ef17` (PR #1944), 2026-10-21. Route: ruling S39/S41, a
Claude-originated residue lane worked by a `claude-opus-5-5` child (wave 8, second of
#1879, #1880, #1881). Source evidence: finding R3-GROK-01 in the predecessor
[F-R3 fix wave](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/SPEC.md#f-r3-bounded-shell-links--panel-round-3-fix-wave-2026-10-15).

## Problem

Before this change a native publication wrote one journal record up front and never
updated it. A process that died between the backup, the `.preimage` hard link, the
`.tmp` stage and the exchange left artifacts and a journal that could not say which
step had run. `restore` only knew how to undo a finished apply, and nothing
reconciled an interrupted one on the next start.

## Design

Schema first, then the service contract, then the implementation. #1879's
`ModelsAtomicExchange.qualify` gate and `ModelsExchangeSystemShape` seam are reused
unchanged.

1. **Schema** (`packages/tooling/tool/cli/src/commands/Models/Models.exchange.schemas.ts`
   owns publication state; `Models.manifest.schemas.ts` owns the journal):
   - `ModelsPublicationStep`, a `LiteralKit` of `intent`, `backed-up`, `staged`,
     `exchanged`, `verified`, `completed`.
   - `ModelsPublicationState`, a `TaggedUnion` of the six steps plus
     `recovering { from }`, `recovered { from, outcome }` and
     `refused { from, reason, detail }`.
   - `ModelsRecoveryOutcome` (`preimage` | `intended`) and `ModelsRecoveryRefusal`
     (`competing-writer`, `foreign-artifact`, `target-missing`, `filesystem-changed`).
   - `ModelsPublicationOwner { bootId, pid, startTicks }` names the process that last
     wrote a state.
   - `ModelsTrackedPublication`: `state`, `owner`, `target`, `staging`, `retained`,
     `backup`, `preimageHash`, `stagedHash`, `targetAtIntentHash` (SHA-256 of the raw
     target bytes read at intent) and `filesystem` (the
     `modelsExchangeIdentityKey` of the target filesystem at intent).
   - `ModelsLegacyPublication` and the union `ModelsPublication`.
   - `ModelsApplyJournal` gains `publication` (decoding default and constructor
     default `legacy`, so a journal without the key decodes to the legacy state by
     schema transformation) and `restoration` (an optional tracked publication for
     the undo that `restore` publishes).
   - Reports: `ModelsPublicationRole`, `ModelsRecoverySkip` (`legacy` |
     `owner-alive`), `ModelsRecoveryResult` and `ModelsRecoveryReport`.
   - `ModelsLocatorRefusal` (`Models.errors.ts`) adds `owner-alive` and spreads
     `ModelsRecoveryRefusal.literals`, so every recovery refusal is typed.
2. **Contract** (`Models.apply.service.ts`): `ModelsApplyShape` gains
   `recover(backupDirectory) → ReadonlyArray<ModelsRecoveryReport>`. The recovery
   service is a member of the writer contract rather than a second service, because
   it reconciles the writer's own journals with the writer's private primitives, and
   manual and automatic recovery must share one path. `beep models recover` is the
   explicit entry point (a subcommand of the existing group, not a parallel CLI).
3. **Implementation**: one `reconcile(backupDirectory, journal, role, publication)`
   behind `apply --write` (target-scoped sweep before planning), `recover` (sweep of
   every journal) and `restore` (its own journal, retrying refusals).

## State machine

Each state is written with an atomic journal write before the step it guards: the
encoded journal goes to `<id>.json.<n>.partial` with an exclusive create, a full write
and `fsync`, then an exclusive `link` for the first state or a `rename` for every
later one, then a directory `fsync`.

| State | Written | Durable on disk when it is the latest state | Guards |
| --- | --- | --- | --- |
| `intent` | after `qualify`, before any artifact | journal with every path, hash and the filesystem key | the backup write |
| `backed-up` | after the backup is written `wx` and fsynced | + `<id>.backup` (apply only) | the `.preimage` link and the `.tmp` stage |
| `staged` | after the stage is written, fsynced, validated, chmodded and drift-checked | + `.preimage`, `.tmp` | the exchange |
| `exchanged` | right after the exchange returns | target and stage swapped | verification of both occupants |
| `verified` | after both occupants verify | as above | removal of the stage and link |
| `completed` | after the cleanup | journal + backup | — (terminal) |
| `recovering { from }` | before recovery changes anything; owner becomes the recoverer | unchanged artifacts | removals or an exchange-back |
| `recovered { from, outcome }` | after reconciliation | per crash-point table | — (terminal) |
| `refused { from, reason, detail }` | after a refusal | every artifact kept | — (terminal; only explicit restore retries) |
| `abandoned { from, detail }` | by the writer itself when it fails before `exchanged = true`, after `atomic`'s releases dropped the stage and link | journal only; the backup is dropped right after (a sweep drops one a crash left) | — (terminal; restore treats it as never landed) |
| `legacy` | never written; decoded for journals without `publication` | whatever the old writer left | — (never touched) |

Transitions: `intent → backed-up → staged → exchanged → verified → completed` for an
apply; `intent → staged → exchanged → verified → completed` for a restoration (it has
no backup of its own). Any pending state (`intent` … `verified`, `recovering`) →
`recovering → recovered | refused`. Explicit `restore` also takes `refused →
recovering`. A writer that fails before its exchange (planning drift, `validate`,
`assertDestination`, a failed stage or backup write) takes `intent`, `backed-up` or
`staged` → `abandoned`. Without it the next sweep would read the drifted target as a
competing writer and refuse, keeping a stale backup, although this writer never
touched the target. A decoder that predates `abandoned` rejects the journal, so it
is skipped as undecodable and restore refuses it as invalid; neither touches the
target.

Recovery leaves a pending publication alone while its owner is alive: same boot id,
`/proc/<pid>/stat` present, same start ticks, not a zombie. A reused pid, a reboot or
a reaped process reads as dead. Terminal states skip the owner check.

## Concurrency rule

Every reconciliation first takes the journal's exclusive recovery lock,
`<id>.recovering` in the backup directory. The owner stamp (boot id, pid, start
ticks) is written and fsynced to a uniquely named `<id>.recovering.<n>.stamp`
sibling, then published with `link(sibling, lock)`; the sibling is unlinked and the
directory fsynced. `link` fails with EEXIST when a lock exists, so acquisition stays
exclusive and a lock is never visible without its complete stamp. Only EEXIST means
the lock is held. Any other failure (EACCES, EROFS, ENOSPC, ...) is a typed
`ModelsLocatorError` with reason `lock-unavailable`, mapped from the platform error
code, never from message text, and fails `recover`, `apply --write` and `restore`
non-zero. The lock is held in an Effect scope (`acquireRelease`) and removed on every
exit path. Only after it is held does recovery re-read the journal from disk, check
that the publication is still eligible (pending, or also refused for an explicit
restore), and apply the owner check. A second recoverer reports `skipped`/`lock-held`
(restore: typed `lock-held` refusal) while the first holds the lock, or
`skipped`/`settled` if the publication went terminal before it got the lock.

A lock is stale when its stamp decodes to a dead owner (procfs rule above). A stamp
that does not decode (empty, partial, another version, a host without procfs) is
never read as dead while it is recent. It becomes stale only when it is more than ten
minutes older than a file freshly written beside it, a comparison on the same
filesystem's clock with no process clock involved. A stale lock is renamed aside and
reclaimed only when the renamed bytes are still the stale bytes read; otherwise the
fresh lock is linked back. `discard` treats an already-removed artifact as success.

## Crash-point recovery

Recovery decides from the bytes on disk; the recorded step only says which artifacts
may exist. Every recorded path must be this journal's own: the stage and link sit
beside the target as `<name>.<id>-*.tmp|.preimage`, and the backup is
`<backups>/<id>.backup` (compared through resolved directories). An artifact counts
as ours only when it is absent or its bytes hash to the preimage or the staged
content.

| Crash point (latest state) | Live target | Automatic (`recover`, next `apply`) | Manual (`restore --journal`) |
| --- | --- | --- | --- |
| before backup (`intent`) | preimage | nothing to undo; drop a partial journal write and any partial backup → `recovered`/`preimage` | same; nothing to restore |
| after backup (`backed-up`) | preimage | drop the stale backup → `recovered`/`preimage` | same |
| after stage (`staged`, exchange not run) | preimage | remove the stage and link, drop the backup → `recovered`/`preimage` | same |
| mid-exchange (`staged`, exchange returned) | staged | the stage holds the preimage: remove stage and link, keep the backup → `recovered`/`intended` | reconcile as automatic, then the journaled undo restores the preimage |
| after exchange (`exchanged`) | staged | as mid-exchange | as mid-exchange |
| after verification (`verified`) | staged | as mid-exchange | as mid-exchange |
| `completed` | staged | no-op | the undo, as before |
| during recovery (`recovering`) | either | reconciled again from the bytes | same |
| restoration at `staged` | applied content | `restoration` `recovered`/`preimage` | a fresh undo |
| restoration after its exchange | original content | `restoration` `recovered`/`intended` (the restore landed) | done |

## Competing-writer rule

Recovery never overwrites a competing native writer. When the target's bytes match
neither the preimage nor the staged content, or the target is missing, a symlink or
not a regular file, recovery records `refused` with a typed reason
(`competing-writer` or `target-missing`) and keeps every artifact. A stage or link
with foreign bytes, or a recorded path that is not this journal's, is
`foreign-artifact`. When the target holds the staged content but the stage holds
foreign bytes, the exchange displaced a competing writer: recovery qualifies the
target (`requireExchange`), compares the filesystem identity key with the one recorded
at intent (`filesystem-changed` refuses without exchanging), exchanges the competitor
back to the live path, and refuses with `competing-writer`. A refusal is terminal
for automatic recovery, does not block the next apply (which edits only owned fields
of the live bytes), and is retried only by an explicit restore.

## Matrix results

`packages/tooling/tool/cli/test/models-exchange-recovery.test.ts`, 40 tests under
`@effect/vitest` `layer(...)`, on scoped temporary trees only. The SIGKILL tests spawn
`test/fixtures/models/exchange-crash-writer.ts` with `bun`: a real `ModelsApplyLive`
over #1879's deterministic `makeModelsTestExchangeSystem` primitive. Its
`FileSystem` wrapper halts after the journal link or rename that publishes the named
state, and its exchange wrapper halts after the publication exchange returns. The
parent reads `HALTED <point>`, sends SIGKILL, reaps the child, recovers, and compares
SHA-256 of the raw target bytes. No crash-writer process outlives a run.

| Case | Result |
| --- | --- |
| SIGKILL at `intent`, `backed-up`, `staged` → `recover` | byte-exact preimage; backup, stage, link and partial journal removed; second run `[]`, identical listing |
| SIGKILL at `exchange-returned`, `exchanged`, `verified` → `recover` | byte-exact intended; backup equals the preimage; stage and link removed; second run `[]` |
| SIGKILL at `completed` → `recover` | no-op |
| each of the seven points → `restore --journal` | byte-exact preimage, no artifacts; a second restore leaves the bytes unchanged |
| each of the seven points → next `apply --write` | recovers first, then writes; byte-exact intended; old journal terminal |
| SIGKILL of the apply, then SIGKILL of `recover` at `recovering` | reconciled again to byte-exact intended; idempotent |
| SIGKILL of a restore at `staged` / after its exchange | `restoration` recovered to `preimage` / `intended`, byte-exact |
| competing writer replaces the target after SIGKILL at `staged`; in-place write after `exchange-returned` | `refused`/`competing-writer`; target keeps the competitor; stage, link and backup kept; second `recover` `[]`; explicit restore refuses again with the typed reason |
| legacy journal (no `publication` key) | decodes to `legacy`; `recover` reports `skipped`/`legacy` and changes nothing; `restore` undoes byte-exact |
| live owner | `skipped`/`owner-alive`; restore refuses with reason `owner-alive` |
| drift between planning and staging (failing first, review thread PRRT_kwDOPbO_N86uwoZi) | the apply fails with the drift message; journal `abandoned`/`from: backed-up`; no backup, stage or link left; `recover` returns `[]`; the next apply succeeds on the competitor's bytes |
| two recoverers that both read the journal before either records `recovering` (failing first, thread PRRT_kwDOPbO_N86uwoZp) | one exchange, competitor live, stage keeps the staged content; the winner refuses `competing-writer`, the loser reports `skipped`/`lock-held`; no lock left behind |
| recovery lock held by a live owner / by a dead owner | `skipped`/`lock-held` and restore refuses `lock-held`, lock untouched / stale lock reclaimed, recovered to the preimage, lock removed |
| recovery lock with an empty or partial stamp (failing first, review thread PRRT_kwDOPbO_N86ux9XK) | `skipped`/`lock-held`, lock bytes untouched, nothing renamed aside; once older than the grace period, reclaimed and recovered to the preimage |
| EACCES on lock creation (failing first, thread PRRT_kwDOPbO_N86ux9XU) | `recover` fails with `ModelsLocatorError` reason `lock-unavailable`; `beep models recover` exits non-zero and prints no `lock-held`; journal stays `staged`, backup kept, no lock or sibling left |
| displaced competitor (in-process) | exchanged back to the live path, `refused`/`competing-writer` |
| changed filesystem identity | `refused`/`filesystem-changed`, no exchange |
| foreign stage, foreign link, missing target, symlinked target, recorded path outside the target directory | typed refusal, every artifact and the outside file kept |
| symlinked backup directory | restore through the resolved directory recovers |
| property: every `ModelsTrackedPublication` | round-trips through the journal codec; dropping `publication` decodes to `legacy` |
| `beep models recover` | prints each decision and the legacy count; exits non-zero on a refusal |
| journal identity recorded without a mount id (pre-#1944 `device:type` key) | `refused`/`filesystem-changed`, no exchange; the stage keeps the competitor |

All existing race, rollback and #1879 capability tests are unchanged and green.

## Verification

Lane head `dcabf8ef17` plus the uncommitted diff.

| Check | Result |
| --- | --- |
| `@beep/repo-cli` models tests (9 files), Bun `bunx --bun vitest run test/models` | 165 passed (40 new in `models-exchange-recovery.test.ts`) |
| same, Node `bunx vitest run test/models` | 165 passed |
| `tsc-rs -p tsconfig.check.json` and `-p test/tsconfig.json`; the crash-writer fixture through a scratch overlay | 0 errors |
| `bun run beep quality effect-diagnostics --filter repo-cli` | 0 errors / 0 warnings on the check, test and scripts overlays |
| `bun run beep lint effect-vitest` | `introduced=0` |
| `bun run beep lint schema-first` | `introduced=0`, parity ratchet ok, no new advisory (the property test covers the journal codec) |
| oxlint and biome on the seven changed source/test files | clean |
| `bun run beep quality fallow audit --base origin/main --check` | exit 0, verdict pass, 0 complexity findings (settle, sweep, apply and restore split into helpers) |
| `bun run jsdoc:inventory:check` + `bun run jsdoc:ratchet:check` | `increased=0`, zero-legacy ok; prose sections precede every **Example** |
| `bun run beep observability catalog --write` | +2 conforming spans (`ModelsApply.recover`, `ModelsCommand.recover`) |
| `bun run beep lint schema-catalog --write` | +12 repo-cli entries, `ModelsLocatorRefusal` updated |
| `bun run beep laws retired-effect-paths` | findings=0 |
| `bun run coverage --filter=@beep/repo-cli` | `coverage-ratchet ok`; 342 files / 6944 tests pass; `Models.apply.service.ts` 96.08% lines (baseline 93.52), `Models.exchange.schemas.ts`, `Models.errors.ts`, `Models.manifest.schemas.ts` 100% |
| `bun run beep quality package-verify @beep/repo-cli` | exit 0 (`ok audit`, `ok docgen`) |
| `bun run beep goals doctor` | `OK: no new blocking findings` (inherited legacy completion-gate advisories only, none in this packet) |

Coverage and package-verify ran before the packet's `ops/manifest.json` edit, which
`knowledge-doctor-evaluators.test.ts` compares against the committed file (see the
#1879 record). Package-verify needs a real stdin: its steps spawn with
`stdin: "inherit"`, so a background run with a closed stdin fails with `Failed to
spawn bun run docgen`; binding `</dev/null` fixes it.

No crash-writer process or test temporary directory outlived any run. No baseline,
inventory or exception rows are added (S31). The package is private, so no
changeset.

## Rebuilt on main after #1944 round 1

The driver rebuilt the lane on `main` `bcb3509d54` (the #1879 base #1944 merged with
its round-1 fixes, plus `@effect/tsgo` 0.54.1) and cherry-picked this work as
`eecc366de4`. Round 1 made the filesystem identity mount-qualified
(`ModelsExchangeFilesystemIdentity.mount` from `/proc/self/mountinfo`, key
`mount:device:type`), added a `mount(path)` primitive to `ModelsExchangeSystemShape`,
and split launch failures into `ModelsExchangeLaunchError` (an uncached
`exchange-probe-failed`).

- **Cause of the red matrix:** the crash-writer fixture built its own exchange system
  from `identify` and `exchange` only, so the child died in `qualify` with
  `system.mount is not a function` before printing `HALTED`. Every SIGKILL case
  failed at its first assertion. The fixture is excluded from the test tsconfig,
  so the type checker never saw it. The fix spreads the base system (`...base`),
  so the child carries `mount` and any later primitive. The fixture was typechecked
  through a scratch overlay.
- **Identity:** `publication.filesystem` stores `modelsExchangeIdentityKey`, so new
  journals record the mount-qualified key. A key written without a mount id still
  decodes (it is a plain string), can never equal a mount-qualified identity, and
  recovery refuses its exchange-back with `filesystem-changed`. A new test pins
  that.
- **Launch errors:** recovery reaches the exchange only through `requireExchange`
  (`qualify`) and `ModelsAtomicExchange.exchange`, which map probe and launch
  failures to typed `ModelsLocatorError`s. The journal stays `recovering` and is
  retried on the next run. No recovery code change was needed.

No assertion was weakened. Results after the fix, one heavy command at a time
through `beep-heavy` with `</dev/null`:

| Check | Result |
| --- | --- |
| models tests (9 files), Bun and Node | 171 passed on each, including all #1944 capability tests and 41 recovery tests |
| effect-diagnostics `--filter repo-cli` (tsgo 0.54.1) | 0 in check and scripts overlays and in every #1880 file; 4 inherited `preferSchemaOverJson` errors in `test/quality-tsgo-git-visibility.test.ts` (#1951, untouched here) |
| effect-vitest / schema-first | `introduced=0` / `introduced=0`, parity ok |
| oxlint and biome on the changed files; fallow audit `--base origin/main --check` | clean; fallow verdict pass, 0 introduced |
| jsdoc inventory + ratchet | `increased=0`, zero-legacy ok |
| observability and schema catalogs `--write` | no diff (current) |
| retired-effect-paths; goals doctor | 0; no new blocking |
| package-verify `@beep/repo-cli` | `ok docgen`; audit red only on `test/architecture-operation-plan.test.ts` (ENOENT for the #1941 migration `20261021041032_row_version_default`, which the architecture generator does not produce); inherited from #1941 `2a42813ca1`, nothing here touches it |
| coverage | the full ratchet cannot report while that inherited test fails, and a direct full run with `reportOnFailure` was SIGTERMed by the host. A scoped run over the models tests puts every changed file at or above its baseline row: `Models.apply.service.ts` 95.89/93.82/88.63/90.68 (baseline 93.52/90.4/83.06/85.07), `Models.command.ts` 88.15/88.15/89.01/76.47 (70.23/70.58/33.33/50), `Models.errors.ts`, `Models.manifest.schemas.ts`, `Models.exchange.schemas.ts` 100 |

## Review round 1 (#1970)

Two beep-reviewer P2 findings, each fixed with a failing-first test in
`test/models-exchange-recovery.test.ts`:

1. PRRT_kwDOPbO_N86uwoZi: a publication that failed before its exchange stayed
   `backed-up`/`staged`, so the next sweep refused it as `competing-writer` and kept
   its backup. The fix records the new terminal `abandoned { from, detail }` state
   and then drops the backup. Pinned by "abandons a publication that failed before
   its exchange and drops its backup". It failed first with `{ _tag: "backed-up" }`.
2. PRRT_kwDOPbO_N86uwoZp: two recoverers could both pass the owner check on a stale
   read and exchange twice. The fix adds the exclusive recovery lock, the journal
   re-read under it, stale-lock reclaim and a tolerant `discard`. Pinned by "lets
   exactly one of two concurrent recoverers reconcile a journal", a deterministic
   interleaving through the filesystem and exchange seams. It failed first with
   two exchanges. "reclaims a stale recovery lock and refuses past a live one" pins
   both lock outcomes.

Schema: `ModelsPublicationState` gains `abandoned`, `ModelsRecoverySkip` gains
`lock-held` and `settled`, and `ModelsLocatorRefusal` gains `lock-held`. Every
existing #1879/#1880/#1944 test is unchanged. Results, each heavy command alone
through `beep-heavy` with `</dev/null`:

| Check | Result |
| --- | --- |
| models tests (9 files), Bun and Node | 174 passed on each (44 in the recovery file) |
| `tsc-rs` check and test overlays; effect-diagnostics `--filter repo-cli` | 0 / 0 errors on the check, test and scripts overlays |
| effect-vitest / schema-first | `introduced=0` / parity ok, `introduced=0` |
| oxlint / biome on the changed files; fallow audit `--base origin/main --check` | clean; verdict pass, 0 complexity findings |
| jsdoc ratchet; retired-effect-paths | `increased=0`, zero-legacy ok; 0 |
| observability / schema catalogs `--write` | no change / `ModelsPublicationState`, `ModelsRecoverySkip` descriptions updated |

## Review round 2 (#1970)

Two beep-reviewer P2 findings on the recovery lock, each fixed with a failing-first
test in `test/models-exchange-recovery.test.ts`:

1. PRRT_kwDOPbO_N86ux9XK: the lock was created with `wx` and stamped afterwards, so
   a second recoverer could read an empty stamp, take it for a dead owner, and rename
   a live lock aside. The stamp is now fsynced to a unique sibling and published with
   `link`, which stays exclusive. An undecodable stamp is honoured for a ten-minute
   grace period, measured against a fresh file's mtime. Pinned by "never reclaims a
   recent lock whose stamp is empty or partial", which failed first because the
   empty-stamp lock was reclaimed.
2. PRRT_kwDOPbO_N86ux9XU: every lock-creation error read as `lock-held`, so
   `recover` exited 0. Only EEXIST (`AlreadyExists`) now means held. Every other
   platform error code becomes the typed refusal `lock-unavailable`, newly added to
   `ModelsLocatorRefusal`. Pinned by "fails recovery with a typed error when the lock
   cannot be created", which injects `PermissionDenied` on lock creation through the
   filesystem seam. It failed first with a `lock-held` skip and success.

Every existing test is unchanged. Results, each heavy command alone through
`beep-heavy` with `</dev/null`:

| Check | Result |
| --- | --- |
| models tests (9 files), Bun and Node | 176 passed on each (46 in the recovery file) |
| `tsc-rs` check and test overlays; effect-diagnostics `--filter repo-cli` | 0 / 0 errors on the check, test and scripts overlays |
| effect-vitest / schema-first | `introduced=0` / parity ok, `introduced=0` |
| oxlint / biome on the changed files; fallow audit `--base origin/main --check` | clean; verdict pass, 0 complexity findings |
| jsdoc ratchet; retired-effect-paths | `increased=0`, zero-legacy ok; 0 |
| observability / schema catalogs `--write` | no change |

## Route and model evidence

Worked by a Claude Code Agent-tool child pinned to `claude-opus-5-5` (S39/S41 Claude
chain, step 1). No fallback was taken; no other provider ran in this lane.

## What #1881 can reuse

- The tracked-publication schema (`ModelsTrackedPublication`, `ModelsPublicationState`,
  `ModelsPublicationOwner`) and the refusal kit, for file publications. Directory
  publication needs a tree hash in place of a byte hash.
- The ledger pattern (fsynced partial, exclusive link for the first state, rename for
  the rest, directory fsync) and the owner-liveness check.
- The bytes-decide reconciliation and the competing-writer rule, including returning a
  displaced writer through a qualified exchange.
- The crash-writer fixture design: halt on the journal write that publishes a state,
  SIGKILL, reap, compare SHA-256.
- Gap for #1881: a replacing writer's own crash (the skill projection is a different
  writer), directory exchange and per-entry recovery are not covered here.

## Residual limits

- Recovery is excluded per journal by the recovery lock. Two processes reclaiming the
  same stale lock at once are separated by the compare-after-rename step. A host
  without procfs stamps an empty lock, which other recoverers honour for the
  ten-minute grace period (such hosts never publish, see below).
- Owner liveness reads procfs. Without procfs no owner is recorded and recovery
  treats the publication as abandoned; such hosts also fail #1879's exchange
  qualification, so they never publish.

## Reversal

Revert the PR. Journals written by this version carry extra `publication` and
`restoration` keys; the previous decoder ignores unknown keys, so its restore still
undoes a completed apply. Interrupted publications from this version then fall back
to the previous behavior: artifacts stay until removed by hand.
