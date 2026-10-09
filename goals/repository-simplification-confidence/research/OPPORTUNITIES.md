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

## 2026-10-09 — D release census and admission

- Census consumer scan encountered a non-object `package.json` in the broader
  corpus (`AttributeError: list has no attribute get`); corrected the scan to
  validate the manifest object shape. A maintained read-only census command
  with shape validation would prevent this one-off script failure.
- First `beep-heavy` test launch failed before admission because user-session
  bus variables were absent. Supplying `XDG_RUNTIME_DIR=/run/user/1000` and the
  standard user bus address reached the queue; all three slots were busy.
  An environment-aware admission wrapper would prevent this startup friction.

- D focused tests caught an introduced Effect v4 API mismatch: `Array.filterMap`
  expects Result, not Option, and the graph's workspace count became zero.
  Replaced it with `Array.getSomes` over mapped Options after reading the
  reference API. Checking every reused helper signature before implementation
  would prevent this regression. The initial focused Vitest launch also used
  the root cwd against a package-relative include glob and found no tests;
  corrected to the package cwd before proof.

- D parity `CI=true beep knowledge refs --check` failed on two host-path rows:
  inherited `explorations/build-pipeline-simplification/RESEARCH.md:194`
  (`external-mirror-reference`, user-local beep-heavy path) and packet-inherited
  `SPEC.md:374` (a literal absolute-home prefix used as a prohibition example).
  The SPEC example was reworded without weakening the rule. The build-pipeline
  row is unchanged on origin/main; its owner/orchestrator must fix it once on
  main, then D merges main. A literal-path-aware prohibition rule and a
  portable command lookup in the inherited runbook would prevent these reds.

- D expanded coverage cohort found one old Yeet assertion still expecting the
  all-package patch remedy (315/316 passed). Updated the assertion to the new
  publish-enabled/private-exempt policy and queued the same cohort again.
  Searching the old user-facing remedy string in tests at edit time would
  prevent this stale contract assertion.

## 2026-10-09 — D crash resumption

- Required main merge produced packet add/add conflicts because the original
  packet branch was squash-merged. Three-way reconciliation against packet
  decision commit `3dbf109066` preserved both the D records and stage-1 closure.
  Keeping a packet merge-base receipt would prevent manual reconstruction.
- Heavy admission initially failed before launching commands: `Failed to connect
  to user scope bus`, because user-session variables were absent. Supplying the
  existing user runtime and bus fixed admission; no queue bypass. A wrapper that
  discovers the existing session bus would prevent this environment-only failure.

- Run 2 scoped coverage failed before tests at Vitest startup: `ENOTEMPTY`
  removing the package `.vitest-cache` while package-verify was auditing the
  same workspace. This is a concurrent verification-cache collision, not a
  source-test failure. Serialize the scoped rerun after package verification;
  separate per-command cache directories would prevent this collision.

- Yeet cheap gates found an introduced retirement dependency: four cache-baseline
  reviews referenced `.changeset/design-figure-drivers.md`. Preserved its exact
  bytes as `history/receipts/d-cache-review-evidence.md` and moved just those
  review references through `beep cache baseline --request`; all non-review
  baseline fields are unchanged. A pre-retirement reference inventory would
  prevent retiring evidence that an independent gate still requires.
- The publication proof unit hit its 16 GiB cgroup limit and terminated with
  `oom-kill` before Yeet could persist the latest verdict. The retry stays in
  beep-heavy admission with a 24 GiB cap; no slot bypass or machine-wide limit
  change. Memory-aware sizing of the parallel cheap tier would prevent this.
