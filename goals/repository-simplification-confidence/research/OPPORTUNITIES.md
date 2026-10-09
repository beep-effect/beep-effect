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

### A admission environment (2026-10-09)

- Task: regenerate the schema catalog and refresh the FreshBooks dependency lock through `beep-heavy`.
- Evidence: wrapper exited 1 before executing either command: `Failed to connect to user scope bus`; runtime directory and session bus variables were absent in the worker shell.
- Prevention: worker launcher exports the existing user-manager environment. Retry uses `/run/user/1000` and its bus, preserving admission rather than bypassing it.

### A admission capacity receipt (2026-10-09)

- Task: post-transfer dependency refresh and catalog/JSDoc regeneration.
- Evidence: `beep-heavy: all 3 slots busy, waiting`; `lslocks` identified two finite proof commands and an orchestrator `gate.sh` polling loop holding a heavy slot for over two hours. Slot receipt files were empty while waiters were active.
- Prevention: finite proofs own heavy slots; a persistent polling daemon should release admission between heavy operations. The lane leaves the existing owner's daemon untouched and keeps its commands queued.

### A orphaned gate runner recovery (2026-10-09, run 2)

- Task: read the resumed lane's package results before launching any duplicate gate.
- Evidence: the package loop parent had exited; only the completed Box provisioning row remained in `package-results.tsv`. Its Box admission child and the schema writer were still queued. A background shell launched through the worker tool also exited while its user-manager child survived.
- Recovery: terminated only A's confirmed queued children, then placed the sequential runner in `rsc-a-run2-gates.service`. It logs each command and appends terminal exit codes to `.beep/rsc-a/run2-results.tsv`. No other lane's process was stopped.
- Prevention: launch the coordinator itself as a user service, not merely each admitted child. A polling coordinator takes no heavy slot; each finite command still uses `beep-heavy`.

## 2026-10-09: inventory writer spelling selected the broad lint pipeline

- Doing: regenerating the JSDoc inventory after narrowing private exports.
- Evidence: `beep lint jsdoc-documentation --write` ran `lint:policy` and
  failed with `Census subprocess failed or exceeded its 512 MiB capture bound`;
  the actual owner is `beep quality jsdoc-inventory`.
- Would have prevented it: rejecting unknown lint subcommands instead of
  forwarding them into the root lint battery. Run 3 uses the owner command.

## 2026-10-09: Knip retirement relocates shared lock hoisting

- Doing: owner-generated `bun install` after removing only Knip declarations.
- Evidence: 27 added / 128 removed lock lines; surviving `oxc-resolver` moves
  from 11.24.2 to 11.21.2, `strip-json-comments` from 5.0.3 to 2.0.1, and
  `@emnapi` package keys relocate. No other manifest version was changed.
  The lane handoff records every changed/added/removed package key.
- Would have prevented it: a lock regeneration receipt that separates
  deleted dependency closure from shared-hoisting relocation, allowing the
  orchestrator to approve the exact generated graph under S5 before push.
  Publication is held as resume ruling 2 requires.
