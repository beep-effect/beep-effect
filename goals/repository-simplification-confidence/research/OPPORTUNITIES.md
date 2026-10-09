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

### 2026-10-09 — E admission wrapper needs user-session bus

- Work: run the heavy-admission regression through `beep-heavy`.
- Evidence: wrapper failed before the test with `DBUS_SESSION_BUS_ADDRESS and XDG_RUNTIME_DIR not defined`.
- Prevention: propagate the user-session bus environment to headless workers. Retry through the same wrapper with `XDG_RUNTIME_DIR=/run/user/1000` and `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus`; no queue bypass.

### 2026-10-09 — E shared main proof remains red

- Work: establish the trusted-main-writer safety gate before removing the repository cache writer token.
- Evidence: main Check run 37944257965, Heavy / Lint Policy job 113897913572, failed in `knowledge:refs-check` with existing `broken-target` references (including `explorations/ATLAS.md`).
- Attribution: inherited on `origin/main` before the E workflow wave. Route one shared knowledge-reference repair to the orchestrator; do not duplicate it in dependent lanes. Token deletion stays gated until a successful trusted writer proof.

### 2026-10-09 — E publication attribution and admission discipline

- Work: publish the workflow wave through Yeet, which created a local implementation commit but refused to push.
- Evidence: cheap-gates failed on an inherited disappearing temporary-directory Effect-import scan, two introduced Effect-Vitest findings, one introduced Fallow complexity finding, and the aggregate Fallow health threshold.
- Action: introduced test callbacks now use Effect and credential/artifact policy concerns are factored into focused checks. Their new proof remains queued. Shared traversal repair stays with its owning lane. No baseline, suppression or acceptance waiver was added.
- Mechanics correction: the first publication invocation was launched directly; its cheap tier included Turbo tasks. All subsequent publication/proof invocations use `beep-heavy`, including the automatic cheap tier. No publication succeeded from that invocation.
- Prevention: classify Yeet publish as an admission-wrapped operation whenever the lane brief requires all Turbo invocations to use the machine budget.


### E proof admission blocked at handoff

Package checks, CI fixtures/scoped typecheck and parity commands remained at `beep-heavy: all 3 slots busy, waiting`. The lane did not bypass admission. At blocked handoff only the four services verified to belong to this lane were stopped; other work was preserved. A queue-position or bounded admission receipt would make the next proof decision observable. Main successor Check 37944257965 completed/failure with inherited knowledge-reference diagnostics, so waiting alone cannot satisfy publication or R41. See the E handoff for resubmission and ownership.

## E crash-resume packet merge

The packet squash produced add/add conflicts when merging landed main. Recovered the pre-squash packet base `3dbf109066` and merged each packet file against that base, retaining the landed stage-1 status and routing plus E receipts and decisions. A recorded original-base ref would make squash integration routine.

## E user-bus launch precondition

After desktop crash, `beep-heavy` could not connect to the user scope bus because `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were absent. Both launches ended before admission. Supplying the existing user runtime and bus restored the canonical wrapper. A wrapper preflight naming this prerequisite would avoid ambiguous queued-proof recovery.

## E publication cgroup cap

Admitted Yeet publication reached the default wrapper cap during concurrent cheap gates. The unit journal reports `oom-kill`, signal 9, and a 16 GiB peak; no terminal verdict or push was produced. Retry remains under admission with a per-command 24 GiB cap, after checking available memory. This is a bounded unit override, reversed when the unit exits; no other session is stopped. Cheap-tier peak measurement should inform the wrapper default or gate fan-out.

### E publication cap and fan-out follow-up

The admitted retry also ended in `oom-kill` at its 24 GiB cap; no terminal cheap-gate verdict or push was produced. The orchestrator's S12 amendment supplies a 32 GiB wrapper floor and default Turbo concurrency of two for subsequent jobs. E uses that centrally owned configuration without changing caps or bypassing admission. A wrapper peak/fan-out preflight would have prevented two failed publication attempts.

### E hosted-parity inherited knowledge-reference red

`CI=true beep knowledge refs --check` flags SPEC line 374's instruction against absolute home paths as one `external-mirror-reference` host-path observation. Git blame attributes that wording to the landed packet (`d46092262f`), not the E recovery edits. The orchestrator owns the single main repair; E records the exact failure and does not duplicate it. A paired fixture distinguishing a policy's prohibited-path example from a live path reference would prevent this false positive.

### E admission wait visibility

The final CLI package check remains queued for more than fifteen minutes while other lanes occupy all three wrapper slots. Read-only lock-holder inspection confirms active work in V and H2; no holder is stopped or bypassed. The polling wrapper provides no ticket order or wait estimate, and a newer E fixture sequence acquired a slot ahead of the older package request. FIFO admission receipts with queue position and holder age would make delayed handoffs predictable without changing the shared budget.
