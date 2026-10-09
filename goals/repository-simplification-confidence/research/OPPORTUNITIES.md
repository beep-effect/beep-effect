# Friction receipts

## 2026-10-09: `goals doctor` flags a freshly bootstrapped packet as `stale-active`

- Doing: validating the materialized `repository-simplification-confidence`
  packet in its lane before the orchestrator commits it.
- Evidence: `bun run beep goals doctor` →
  `repository-simplification-confidence [stale-active] active packet untouched
  for 21+ days with no blockedBy/statusNote.` The packet was created minutes
  earlier; the advisory reads "touched" from recent git history, so an
  uncommitted packet counts as untouched. Non-blocking (`blocking_new=0`).
- Would have prevented it: the staleness check treating a packet with no
  commits at all (or a manifest `initiative.created` inside the window) as
  fresh, so a new packet is not told it is 21 days old.

## 2026-10-09: host-path hygiene of live packet docs cannot be proven before commit

- Doing: keeping gated host paths out of `README.md`, `SPEC.md`, `PLAN.md`,
  and `GOAL.md` while working as a non-committing worker.
- Evidence: `bun run beep knowledge refs --help` → `--tree string  Commit-ish
  whose tracked tree is censused`; the census only reads committed trees, so
  the working-tree text could only be checked by reading the classifier
  (`Knowledge.refs.ts`, gated classes `actionable-host-path` and
  `external-mirror-reference`) and avoiding those spellings by hand.
- Would have prevented it: a `--worktree` (or `--paths <file>...`) mode that
  classifies uncommitted files with the same rules.

## 2026-10-09: verbatim copy of the brief tripped the whitespace gate

- Doing: copying the operator brief byte-for-byte into
  `research/BRIEF-2026-10-09.md`.
- Evidence: the source ends with a blank line, which
  `git diff --check` reports as a new blank line at end of file. The copy
  drops that one trailing newline and its provenance header says so.
- Would have prevented it: none needed beyond the note; recorded so a later
  byte comparison against the scratch file expects the one-byte difference.

## 2026-10-09: interactive `zsh -ic` wrapper prints prompt-plugin errors on every call

- Doing: running `bun run beep ...` through `zsh -ic` because `mise` is not on
  the tool shell's PATH.
- Evidence: each call prints `can't change option: zle`, `gitstatus failed to
  initialize`, and direnv load lines before the command output. Harmless, but
  it buries short validator output and forces filtering.
- Would have prevented it: a non-interactive entry point that activates
  `mise` without loading the interactive prompt (for example
  `zsh -c 'eval "$(mise activate zsh)"; ...'` documented as the agent form).

## 2026-10-09: bootstrap completionGate statement predates push-first publish

- Doing: materializing `ops/manifest.json` from the bootstrap plan.
- Evidence: the generated `completionGate.statement` reads
  `repair -> verify -> publish --pr -> monitor`, while brief section 5 and
  AGENTS.md ("`yeet verify` is on-demand") use push-first publish. The
  generator-owned statement is left unchanged; PLAN.md "Publication
  Mechanics" says that section governs where they differ.
- Would have prevented it: the bootstrap template emitting the current
  `repair -> publish -> ready -> monitor` chain.

## 2026-10-09: integration task restated a superseded Knip reconciliation

- Doing: folding the Knip reconciliation into
  `research/knip-findings-2026-10-09.md`.
- Evidence: the integration task asked for "36 reproduced, 5 disappeared",
  while the reconciliation file it pointed at had been corrected to 41
  reproduced, 0 disappeared (a normalizer had skipped `.issues[].files[]`).
  `diff` of `knip-fresh-rows-e62411d63f.tsv` against the baseline rows is
  empty, so the packet records 41/0/0 and notes the earlier defect.
- Would have prevented it: deriving task text from the reconciliation file
  at dispatch time, or a typed reconciliation record (counts plus row TSV
  digest) that tasks cite instead of copied numbers.

## 2026-10-09: sweep follow-ups were filed by number, not by gap key

- Doing: placing 19 gap follow-up sweeps under the workstream they answer.
- Evidence: the follow-ups were written as `gap-<n>.md` (several note that
  the named `<key>.md` target did not exist), so the gap-to-key mapping had
  to be rebuilt by matching each file's heading against the INDEX.md gap
  list. INDEX.md gap lines are also truncated mid-sentence.
- Would have prevented it: dispatching each follow-up with its final
  `<key>.md` file name and a one-line headline field.

## 2026-10-09: sanitizing research copies for a public repository is manual

- Doing: copying repository-facing sweeps into `research/sweeps/2026-10-09/`.
- Evidence: home paths, session-scratchpad paths with a session UUID, and a
  host name had to be rewritten by a one-off script; `knowledge refs --check`
  reads committed trees only, so the result cannot be gated before commit
  (see the earlier host-path entry).
- Would have prevented it: a shared `beep` sanitizer for research receipts
  (home paths to `~`, session ids and host names to placeholders, credential
  and e-mail patterns redacted) with a `--check` mode for working-tree files.

## 2026-10-09: packet-prose review did not converge on wording

- Doing: three-lens review loop over the packet prose before commit.
- Evidence: 10 rounds (16, 14, 12, 8, then 15, 17, 11, 6, 8, 5 findings).
  The last round's five P3 findings, all applied: the `rsc-h1-catalog` scope
  lacked the inert `@opentelemetry/propagator-jaeger` override removal, the
  `unused-catalog-entries` detection gap, and the hold register (plus a
  matching Decision Log row); the baseline Grok effort cell stated `medium`
  as brief-approved; PLAN Program Stages omitted the brief section 5 opening
  paragraph; the Staged Acceptance Checklist exit conditions dropped "Shared
  files remain serialized." and "explicitly"; the SPEC path rule allowed `~`
  only in research receipts while the packet names home files elsewhere.
- Rule adopted (SPEC Decision Log, packet-prose review convergence): the
  verbatim brief is the authority; packet prose is gated by material defects
  and validator failures; wording and verbatim-copy findings against prose
  that already cites the brief are advisory and are recorded here.
- Would have prevented it: a review-lens contract that separates material
  defects from wording findings up front, and a mechanical verbatim-section
  checker against the brief so copy drift is caught by a validator.

### Lane V: missing Stage 1 prerequisite (2026-10-09)

Step 0 fetched and merged `origin/main`, then fast-forwarded the packet branch to `3dbf109066`. The required `history/receipts/stage-1-ownership.md` is absent: `git ls-tree` shows only history placeholder files and the exact file-existence test exits 1. The lane brief requires stopping before preservation in this state. Landing the Stage 1 receipt before launching V would prevent the blocked start. See `history/handoffs/rsc-v-vitest-canon-2026-10-09.md`.

## Lane V admission environment (2026-10-09)

- While formatting the reconciled CLI cohort, `beep-heavy` refused to start: `DBUS_SESSION_BUS_ADDRESS and XDG_RUNTIME_DIR not defined`. No heavy work started outside admission.
- Repair: supply the existing user-session bus (`/run/user/1000/bus`) and runtime directory to the wrapper. A wrapper preflight that reports these missing variables before systemd invocation would prevent the failed launch.

## Lane V heavy admission wait (2026-10-09)

- Selected Node/Bun proof and the first inventory scan report `all 3 slots busy, waiting`. `lslocks` confirms all three heavy-slot locks are held by live processes; one holder is the fleet gate-loop shell. No lock or peer process was reaped, stopped or modified.
- Cheap per-file formatting does not require a heavy slot; its own queued service was cancelled and formatting ran directly. All tests, scanners, compiler and package proof still use `beep-heavy`.
- A FIFO admission queue and releasing the gate-loop's slot between heavy commands would avoid starving short qualifying work behind a long-lived shell. This lane records the symptom without changing workstation admission policy or another session's process.

## Lane V selected-cohort invocation (2026-10-09)

- The first admitted Node run exited 1 with `No test files found`: passing the package config from the repository root kept Vitest's root at the repo, while its include is `test/**/*.test.{ts,tsx}`. No test ran.
- Correct invocation: change into the CLI package and pass package-relative cohort paths to the existing Vitest config. The retry remains behind `beep-heavy`; a reusable package-local cohort launcher would prevent the wrong-root attempt.

## Lane V fixture import rewrite repaired (2026-10-09)

- The first selected Node cohort ended with 4 failed files, 8 failed cases and 1,183 passed cases. Attribution: the lane's overly broad import rewrite also touched detector fixture strings, deleting their explicit `it`/assertion imports and invalidating the subjects; another overbroad deduplication removed multiline import openings. These are introduced repair-script defects, not scanner regressions.
- Reconstructed every CLI source file by three-way comparison of the original base, current main and continuation, then applied the original detector WIP. Canonicalization now parses only real top-level import declarations before the first body declaration. Fixture source strings remain exact. Formatting and runtime proof are rerun; the failed attempt remains unqualified.
- Prevention: constrain import edits to syntax nodes or a proven declaration-only header, and validate detector fixture text after any import codemod.

### Lane V crash recovery: missing terminal package result

The admitted repo-cli package gate survived the Desktop crash without a
terminal result and stayed in nested test execution for over 40 minutes.
Stopped only its owned service and retained its log under `.beep/rsc-v/`.
A bounded outer timeout with a durable exit/duration row would make this
recovery deterministic. The partial log is not package qualification.

### Packet squash creates add/add conflicts after the authorized early merge

`git merge origin/main` after #1560 produced add/add conflicts in thirteen
packet documents. Resolve with the saved pre-squash packet tree as the
three-way base: retain main's updates, then retain the lane-specific status,
decision and friction deltas. A documented packet-squash reconciliation
command would prevent this predictable recovery cost. No code or preservation
export was discarded.
