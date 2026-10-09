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

## H2: heavy proof entrypoint and read-only command cycle (2026-10-09)

- Work: qualify structured goal completion in `rsc-h2-completion`.
- Evidence: initial `beep-heavy bunx tsgo --noEmit -p packages/tooling/tool/cli/tsconfig.json`
  could not connect to the user bus; setting the real user-session runtime/bus variables
  restored admission. The direct package config then reported TS6305 for unbuilt
  workspace declarations. Use package-verify's owning build/config path for proof.
- Evidence: the first doctor smoke reported `Cannot access GOALS_DOCTOR_BASELINE_PATH
  before initialization` after its completion adapter imported Yeet readers. Doctor
  now loads the IO adapter at execution; normalization remains in goal schemas.
- Prevention: document the bus environment at the admission entrypoint and retain a
  CLI smoke fixture for command-family import cycles. No gate bypass or baseline write.

## 2026-10-09: H2 historical coverage log is incomplete

- Doing: comparing #1429 non-required coverage failures with the nearest completed
  main ancestor before its merge-base, walking past cancelled runs.
- Evidence: main run `37385597353`, job `112020340159`, completed at
  `2026-10-06T00:05:53Z`; its fetched log ends during tests at `23:44:18Z`
  and contains no terminal coverage-ratchet rows.
- Disposition: full-lane coverage attribution is unknown; the new PatternOntology
  row can be identified independently, but missing baseline rows cannot prove equality.
- Would have prevented it: retained complete job logs or a separate immutable
  coverage-row artifact linked to the job.

## 2026-10-09: source qualification does not cover test Effect diagnostics

- Doing: qualifying H2 completion fixtures after the source compiler passed.
- Evidence: `beep quality test-tsgo` found 11 introduced test diagnostics:
  `preferTypedSchemaDecoder`, `effectFnOpportunity`, and `missedPipeableOpportunity`.
- Disposition: use typed decoders for typed fixture input and reusable Effect.fn
  helpers; repeat the test compiler before publication. No suppression was added.
- Would have prevented it: running the dedicated test compiler immediately after
  authoring fixtures, alongside their runtime assertions.

## 2026-10-09: H2 parity exposes static graph and packet-literal failures

- Doing: the required Fallow audit/health and CI knowledge-reference qualification.
- Evidence: Fallow identifies a six-file cycle from Completion through MergeGate,
  Handler, Status and GateStaleness back to Doctor, plus eight introduced complexity
  findings. Runtime lazy import avoided initialization failure but retained the
  static cycle. The existing shared check-run schema is moved into a schema-only
  role, preserving its identifier and re-export. Observation and refresh boundaries
  are separated without suppressions.
- Additional evidence: knowledge refs reports the inherited literal home-directory
  prefix in SPEC's path-policy sentence (line 374), identical on origin/main.
  It is a statement about prohibited paths, not a client location. Main owns its
  single repair; H2 records the inherited red rather than copying a lane-local fix.
- Would have prevented it: early static graph qualification after adding cross-command
  schema reuse, and audit-pattern classification for path-policy literals.

## 2026-10-09: H2 requalification waits behind the program's heavy admissions

- Doing: repeating Fallow and the stable-head qualification bundle after remediation.
- Evidence: both wrapper logs remain at `beep-heavy: all 3 slots busy, waiting`
  for more than ten minutes. The lane respects its two-admission limit and does
  not stop another lane's work.
- Would have prevented it: program scheduling that reserves a short remediation
  slot, or shared immutable proof reuse where the command's inputs match. The
  admission cap itself is retained; no bypass is used.
