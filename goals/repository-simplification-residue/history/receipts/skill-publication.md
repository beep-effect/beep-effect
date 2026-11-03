# #1881 atomic skill publication and replacing-writer recovery: record

Lane `residue-skill-publication`, branch `feat/residue-skill-publication`, first
stacked on #1880's head `8093be236e` (PR #1970), then rebuilt by the driver on `main`
`ab606411ed` (#1970 merged) as `5f25292ef4` plus this lane's follow-up, 2026-10-21. Route: ruling S39/S41, a
Claude-originated residue lane worked by a `claude-opus-5-5` child (wave 8, third of
#1879, #1880, #1881). Source evidence: finding R3-GROK-03 in the predecessor
[F-R3 fix wave](../../../repository-simplification-confidence/SPEC.md#f-r3-bounded-shell-links--panel-round-3-fix-wave-2026-10-15).

## Problem

`beep skills update` wrote `skills-lock.json` and `.codex/config.toml` with a backup,
a `.tmp-<suffix>` stage and a plain `rename`, and replaced `.claude/skills/<name>`
by renaming the old tree aside and the stage into place. Between the drift check and
the rename another writer's content could be overwritten (the POSIX rename window),
and a crash between the two directory renames left no live skill. Nothing recorded
which step had run, so nothing could recover it.

## Design

Schema first, then the service contract, then the implementation.

1. **Schema** (`packages/tooling/tool/cli/src/commands/Skills/SkillsPublication.schemas.ts`):
   - The state machine is #1880's `ModelsPublicationState` itself (`intent`,
     `backed-up`, `staged`, `exchanged`, `verified`, `completed`, `recovering`,
     `recovered`, `refused`, and #1970's `abandoned`), with `ModelsPublicationOwner`, `ModelsRecoveryResult`
     and `ModelsRecoveryRefusal` reused unchanged.
   - `SkillPublicationKind` (`file` | `directory`), `SkillTreeEntryKind`
     (`directory` | `file` | `symlink`), `SkillTreeEntry { path, kind, mode, digest }`.
   - `SkillContentDigest`: `file { hash }` (SHA-256 of the bytes) or
     `directory { hash, entries }` (the tree hash and the sorted entries it covers).
   - `SkillTrackedPublication { kind, state, owner, target, staging, partial,
     backup, preimage, staged, filesystem }`. `preimage` is none for a target that
     was absent at intent; `filesystem` is the `modelsExchangeIdentityKey` of the
     target filesystem when the publication exchanges.
   - `SkillLegacyPublication`, the union `SkillPublication`, and
     `SkillPublicationJournal { id, publication }`, whose `publication` decodes to
     `legacy` when the key is missing (schema default).
   - `SkillRecoveryScope` (`pending` | `retry`), `SkillRecoveryReport`,
     `SkillPublicationRefusal` (`exchange-unsupported`, `exchange-probe-failed`,
     `drift`, `owner-alive`, `lock-unavailable` plus the four recovery refusals), `SkillPublicationFile`.
   - `SkillPublicationError` (`Skills.errors.ts`) carries the optional typed
     `reason`, `target` and `journal`.
2. **Contract** (`SkillsPublication.service.ts`): `SkillPublisher` with
   `publishFile(root, target, content)`, `publishDirectory(root, target, files)`
   and `recover(root, scope)`. Journals live in
   `<root>/.beep/skills-backups/journals/<id>.json`; backups stay where they were
   (`<root>/.beep/skills-backups/<name>.<suffix>`). The capability is
   `modelsAtomicExchangeOrLive`, so `ModelsAtomicExchange.qualify(target)` remains
   the only capability gate. `skills update` (write mode) runs `recover(root,
   "pending")` before planning; `beep skills recover` (a new subcommand of the
   existing group) runs `recover(root, "retry")`, which also revisits refusals.
3. **Implementation**: one `publish` drives every publication through the ledger;
   one `settle` decides recovery from the content on disk; one `closeOut` records
   `recovering` and the terminal state, used by recovery and by a competitor
   detected after the exchange. Recovery runs under the shared per-journal lock and
   re-reads the journal under it. A failure before the exchange drops its own stage
   and partial stage and records `abandoned { from, detail }`.

## Tree-hash definition

A directory is walked without following symlinks. Every entry, the root included as
`.`, is `SkillTreeEntry { path, kind, mode, digest }`: `path` is relative with `/`
separators, `mode` is `stat.mode & 0o7777` (symlinks record `0o777`, the value Linux
reports), and `digest` is the SHA-256 of a file's bytes or of a symlink's target
text, empty for a directory. Entries are sorted by path; the tree hash is the
SHA-256 of their concatenation, each rendered as `kind NUL octal-mode NUL path NUL
digest LF`. Any other entry type (socket, FIFO, device) makes the tree foreign. A
directory publication writes every directory `0755` and every file `0644`, so the
staged tree hash is fixed by the planned files before anything is written, and the
stage is verified against it after writing. When a directory matches neither
recorded tree, recovery names the differing entries (`skillTreeDifferences`).

## State and crash-point tables

Each state is written with the shared ledger before the step it guards.

| State | File (existing) | File (absent) | Directory (existing) | Directory (absent) |
| --- | --- | --- | --- | --- |
| `intent` | after `qualify`; before the backup | before the stage | after `qualify`; before the backup | before the stage |
| `backed-up` | `<name>.<suffix>` written and fsynced | — | tree copied with `fs.copy` | — |
| `staged` | `<file>.tmp-<suffix>` written, fsynced, chmodded to the target mode, verified, drift-checked | same, mode `0644` | tree assembled in `.<name>.stage-<suffix>.partial`, fsynced, renamed to `.<name>.stage-<suffix>`, verified against the tree hash, drift-checked | same |
| `exchanged` | after `renameat2(RENAME_EXCHANGE)` | after an exclusive `link(stage, target)` | after the exchange | after `rename(stage, target)` |
| `verified` | the stage holds the preimage, the target the staged bytes | the target holds the staged bytes | the stage holds the preimage tree, the target the staged tree | the target holds the staged tree |
| `completed` | stage removed | stage name removed | stage tree removed | — |

| Crash point (latest state) | Live target | Recovery (automatic or `skills recover`) |
| --- | --- | --- |
| `intent`, `backed-up`, `staged` | preimage (or absent) | drop the stage and the partial stage → `recovered`/`preimage`; the backup is kept |
| exchange returned, `exchanged`, `verified` | staged content | the stage holds the preimage: drop it → `recovered`/`intended` |
| `completed` | staged content | no-op |
| `recovering` (recovery crashed) | either | reconciled again from the content on disk |
| a pre-exchange failure (I/O, drift) | preimage or a competitor | the writer drops its stage and partial stage and records terminal `abandoned`; the backup is kept; recovery skips it |

## Replacing-writer rule

Recovery never overwrites another writer. The target must hold the preimage
fingerprint, the staged fingerprint, or nothing for a create; anything else (other
bytes, another tree, a symlink, a file where a directory was) is `refused` with
`competing-writer` and every artifact is kept: the stage, the partial stage and the
backup. A stage holding foreign content is `foreign-artifact`, and a recorded path
that is not this journal's own (stage beside the target with its prefix, partial
`<stage>.partial`, backup in the resolved backup directory, target inside the
repository root) is `foreign-artifact`. When the target holds the staged content but
the stage holds foreign content, the exchange displaced a competing writer:
recovery re-qualifies the target, refuses with `filesystem-changed` if its identity
key differs from the one recorded at intent, and otherwise exchanges the competitor
back to the live path and refuses with `competing-writer`. The same rule runs
in-process when publication sees a displaced competitor after its own exchange. A
refusal is terminal for `skills update`; `skills recover` retries it and refuses
again while the competitor is there. One recoverer per journal: the shared lock
`<id>.recovering` is an fsynced owner stamp published by `link`. Only `EEXIST` means
held (`skipped`/`lock-held`); any other failure is `lock-unavailable` and nothing
is touched. A stamp naming a dead owner is reclaimed; a stamp that does not decode
holds the lock for a ten-minute grace window (against a fresh file's mtime) and is
reclaimed after it. Under the lock the journal is re-read; a publication another
recoverer already settled is `skipped`/`settled`. A pending publication whose owner
is alive is skipped (`owner-alive`). Removal of every artifact is idempotent.

## Matrix results

`packages/tooling/tool/cli/test/skills-publication-recovery.test.ts`, 37 tests under
`@effect/vitest` `layer(...)`, on scoped temporary trees only. The SIGKILL tests spawn
`test/fixtures/skills/publication-crash-writer.ts` with `bun`: a real
`SkillPublisherLive` over #1879's `makeModelsTestExchangeSystem` (spread from the
base system, so every primitive carries through). Its `FileSystem` wrapper halts
after the journal link or rename that publishes the named state; its exchange
wrapper halts after the publication exchange returns. The parent reads
`HALTED <point>`, sends SIGKILL, reaps the child and recovers.

| Case | Result |
| --- | --- |
| file and directory, SIGKILL at `intent`, `backed-up`, `staged` → `recover` | preimage byte-exact (SHA-256 / tree hash); stage, partial and partial journals gone; backup kept from `backed-up` on; second run `[]`, identical listing |
| file and directory, SIGKILL at exchange returned, `exchanged`, `verified` → `recover` | intended byte-exact; displaced preimage removed; second run `[]` |
| file and directory, SIGKILL at `completed` | no-op |
| file and directory created where none existed, SIGKILL at `staged` / `exchanged` | target absent / intended byte-exact; no stage left |
| SIGKILL at `staged`, then a native writer replaces the target | `refused`/`competing-writer` (directory detail names `SKILL.md`); target keeps the competitor; stage and backup kept; `pending` again `[]`; `retry` refuses again, unchanged |
| a writer replaces the target just before the publication exchange (in-process) | publication fails `competing-writer` naming the journal; competitor returned to the live path; stage holds the staged content; journal `refused` |
| SIGKILL at `exchanged`, then SIGKILL of `recover` at `recovering` | reconciled again to intended byte-exact; idempotent |
| unsupported filesystem (exchange refuses `einval`) | `exchange-unsupported` before any `.beep` directory, backup or journal; target unchanged |
| pre-exchange failure (the stage rename fails) | journal terminal `abandoned` from `backed-up`; stage and partial stage gone; backup kept; `pending` and `retry` both `[]` |
| drift found before the exchange (another writer rewrites the target during staging) | `drift`; the writer's bytes stay; journal `abandoned`; stage gone; backup holds the preimage |
| a live process holds `<id>.recovering` | `skipped`/`lock-held`; journal still `staged`; the lock is kept |
| an unreadable lock stamp | `lock-held` inside the grace window; after it the lock is reclaimed and the publication `recovered`/`preimage`; no lock left |
| the lock cannot be published for a reason other than EEXIST (link fails `NotFound`) | `SkillPublicationError` `lock-unavailable`, `Cannot create the recovery lock (NotFound)`; journal untouched; no stamp left |
| live owner | `skipped`/`owner-alive` |
| legacy journal (no `publication` key) | `skipped`/`legacy` under both scopes; journal, target and an old stage untouched |
| `skillTreeDifferences` | names added, removed and mode-changed entries |
| repeat projection (`skills update` twice) through a symlinked `.codex/config.toml` with unknown fields, a disabled native row and a native table | the second run leaves the repository tree hash identical (every entry, backups and journals included); the link, unknown fields, disabled row and table are kept; every journal `completed` |
| next projection after SIGKILL of a skill directory publication at `exchanged` | `skills update` prints `recovery recovered <id> (intended)`, then updates the skill; no stage left |
| `beep skills recover` after a refused publication | prints the count and `- refused … (competing-writer)`, exits non-zero; a clean repository succeeds |

All 32 existing `skills-command.test.ts` tests (canonical containment, symlinked
targets, canonical backups, mode preservation, projection drift, publish and cleanup
failures, unknown fields and disabled rows) and every #1879/#1880 models test are
unchanged and green, with the live exchange primitive for the skills tests.

## What was lifted or shared from Models

- `internal/publication/PublicationLedger.ts` holds the primitives #1880 and #1970
  kept as private closures in `makeApply`: `writeDurable`, `syncFile`,
  `syncDirectory`, `publishRecord` (fsynced partial, exclusive link or rename,
  directory fsync), `currentOwner` and `ownerAlive` (`parsePublicationProcessStat`),
  the idempotent `discard`, and #1970's `recoveryLock` (stamp, link, EEXIST-only
  held, `PublicationLockUnavailable`, unreadable-stamp grace, compare-and-reclaim),
  plus `publicationSuffix`, `publicationTerminalState`, `readPublicationRecord` and
  `dropStalePublicationPartials`. `Models.apply.service.ts` builds its
  `writeDurable`, `publishJournal`, owner liveness, suffix, `discard` and
  `recoveryLock` from it (the lock error maps onto `ModelsLocatorError`
  `lock-unavailable` with the same message); its `reconcile`, `settle`, `atomic`,
  restore and abandonment logic are unchanged, and every #1879/#1880/#1970 test is
  unchanged and green.
- `modelsAtomicExchangeOrLive` (exported from `Models.apply.service.ts`) is the one
  way both writers obtain the capability.
- The live exchange primitive passes `--no-target-directory`, so two directories are
  exchanged rather than one moved into the other. When the host `mv` predates
  `--exchange` (`modelsExchangeOptionMissing`: GNU coreutils before 9.5, which is
  what Ubuntu 24.04 and Amazon Linux 2023 ship), it answers through the glibc
  `renameat2(RENAME_EXCHANGE)` wrapper in `python3`; the probe still decides
  support, and refusals classify the same way.
- Not shared: the Models schemas stay where they are and are imported. One
  divergence is parameterized, not unified: an abandoned Models publication drops
  the backup of its untouched target, while an abandoned skill publication keeps it,
  because skill backups are a kept contract (acceptance item 4, and the unchanged
  `skills-command.test.ts` publish-failure case asserts the backup survives).

## R3-GROK-03 disposition

Closed. File and directory skill publication of an existing target is a qualified
atomic exchange verified on both occupants, and a new target is created with an
exclusive link (file) or a rename (directory). The documented POSIX rename window is
gone for every existing destination. One residual is documented on `SkillPublisher`:
a directory created where none existed is renamed into place, and a rename can
replace an empty directory another writer created after planning (never a file or a
non-empty directory).

## Verification

Branch head `5f25292ef4` (rebuilt on `main` `ab606411ed`) plus the uncommitted
follow-up, one heavy command at a time through `beep-heavy` with `</dev/null`.

| Check | Result |
| --- | --- |
| skills tests (6 files + qa-judge-skill) and models tests (9 files), Bun `bunx --bun vitest run` | 328 passed (37 in the recovery matrix) |
| same, Node `bunx vitest run` | 328 passed |
| the five lock and `abandoned` tests | failed first against the pre-change writer (5 failed), then passed |
| `tsc-rs -p tsconfig.check.json`, `-p test/tsconfig.json`; crash-writer fixture through a temporary overlay | 0 errors |
| `bun run beep quality effect-diagnostics --filter repo-cli` | check and scripts overlays 0; test overlay 4 `preferEffectArray` errors, all in `test/laws-schema-tag-idioms.test.ts` (inherited from #1969 `da36bcb37e`, untouched here) |
| `bun run beep lint effect-vitest` | `introduced=0` |
| `bun run beep lint schema-first` | parity ratchet ok, `introduced=0` |
| oxlint and biome on the changed source and test files | clean |
| `bun run beep quality fallow audit --base origin/main --check` | exit 0, verdict pass, 0 introduced |
| `bun run jsdoc:inventory:check` + `bun run jsdoc:ratchet:check` | `increased=0`, zero-legacy ok |
| `bun run beep observability catalog --write`; `bun run beep lint schema-catalog --write` | regenerated |
| `bun run beep laws retired-effect-paths` | findings=0 |
| coverage | the full ratchet cannot report while the inherited `test/architecture-operation-plan.test.ts` (#1941) fails; scoped run over the skills and models tests, every changed file at or above its baseline: `Models.apply.service.ts` 95.24/93.41/88.59/88.95 (baseline 93.52/90.4/83.06/85.07), `Skills.command.ts` 92.83/92.83/80.68/89.2 (91.13/91.2/77.04/87.71), `Skills.errors.ts` 92.85/92.85/75/71.42 (92.3/92.3/75/66.66), `Skills.render.ts` 67.74/67.16/40/64.51 (66.66/66.12/40/62.96); new `SkillsPublication.service.ts` 95.44 lines, `PublicationLedger.ts` 95.28 lines |
| package-verify, goals doctor | see the lane report `.beep/residue-skill-publication-report.md` |

No baseline, inventory or exception rows are added (S31). The package is private,
so no changeset. No test or crash-writer process outlived a run.

## Review round 1 (#1984)

Lane head `43e1ade0b5`. Three threads; fixed in schema, contract, implementation order.

1. **Creating a new target treated every move failure as a competing writer**
   (PRRT_kwDOPbO_N86u2EdT, PRRT_kwDOPbO_N86u2ECr). When the target was absent at
   planning, any `link` (file) or `rename` (directory) failure became
   `competing-writer` and the `PlatformError` was dropped. The move runs after
   `prepare`, so `abandon` never ran: the journal stayed `staged` with the stage beside
   the target, and `skills recover` refused `competing-writer` on every run.
   - Schema: `SkillRecoveryResult` (`SkillsPublication.schemas.ts`) is the shared
     `recovered`/`refused`/`skipped` cases plus `abandoned { detail }`;
     `SkillRecoveryReport.result` uses it.
   - Contract: `createTarget` reports `competing-writer` only for `AlreadyExists`
     (EEXIST) or when an entry is actually observed at the target afterwards, matched
     on the platform error code. Every other failure is a `SkillPublicationError`
     without a refusal reason, naming the code and carrying the `PlatformError` as
     its `cause`. Either way the writer drops its stage and partial stage and records
     terminal `abandoned` from `staged`; no backup exists for a create. The outer
     journal mapping now copies `reason`, `target` and `cause` explicitly.
   - Recovery: `settle` closes a create (no preimage) whose recorded step precedes
     the move (`intent`, `backed-up`, `staged`) as `abandoned` when another writer's
     entry is live and the stage holds only the planned content (or is gone): the
     stage is dropped, the other writer's entry kept, and `skills recover` exits 0.
     Existing targets keep the refusal rule.
   - Tests (each failed first, then passed): EEXIST from a real competitor →
     `competing-writer`, `abandoned`, no stage, the competitor's bytes intact, two
     `skills recover` runs exit 0; injected `PermissionDenied` and `Unknown` (EPERM,
     EMLINK and filesystems without hard links map there) link failures → typed
     non-competing error with its cause, `abandoned`, no stage, target still absent,
     `skills recover` exits 0 and a retry is `[]`; a SIGKILLed create at `staged`
     whose target another writer then created → `skills recover` reports
     `abandoned`, exits 0, the stage is gone, the competitor intact, a second recover
     is a no-op.
2. **Runbook named the wrong error** (PRRT_kwDOPbO_N86u2ECi). `docs/runbooks/agent-pools.md`
   now names `ModelsLocatorError` for `beep models` and `SkillPublicationError`
   (`exchange-unsupported` or `exchange-probe-failed`) for `beep skills`.

Results, one heavy command at a time through `beep-heavy` with `</dev/null`:

| Check | Result |
| --- | --- |
| skills (7 files) plus models (9 files) tests, Bun | 333 passed (42 in the recovery matrix) |
| same, Node | 333 passed |
| effect-vitest / schema-first | exit 0, `introduced=0` / exit 0, parity ok |
| effect-diagnostics `--filter repo-cli` | 0 in the check and scripts overlays and in every changed file; 4 inherited `preferEffectArray` in `test/laws-schema-tag-idioms.test.ts` (#1969) |
| oxlint and biome on the changed files; fallow `--base origin/main --check` | clean; pass, 0 introduced |
| jsdoc inventory and ratchet; observability and schema catalogs `--write` | `increased=0`, zero-legacy ok; regenerated |

## Route and model evidence

Worked by a Claude Code Agent-tool child pinned to `claude-opus-5-5` (S39/S41 Claude
chain, step 1). No fallback was taken; no other provider ran in this lane.

## Reversal

Revert the PR. `skills update` then goes back to backup, stage and rename. Journals
under `.beep/skills-backups/journals` are inert to the previous code and can be
deleted; backups are unchanged in name and content. The Models change is a
behavior-preserving extraction (ledger, lock, discard) plus `--no-target-directory`
and the `python3` fallback, each with its own Decision Log row; reverting the
fallback returns hosts without `mv --exchange` to refusing.
