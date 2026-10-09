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

## 2026-10-09 — H1 admission wrapper requires the user-session bus

- Task: run the OSV wave parity commands through `beep-heavy`.
- Evidence: `beep-heavy bash .beep/rsc-h1/parity.sh` exited 1 before admission:
  `DBUS_SESSION_BUS_ADDRESS and XDG_RUNTIME_DIR not defined`.
- Resolution: supply the existing user's runtime directory and bus address to
  the wrapper; retain machine-wide admission. No fallback bypass.
- Prevention: have the wrapper resolve the current user's existing runtime bus
  when launched from an agent environment that omits those variables.

## 2026-10-09 — H1 publication succeeds before monitor submission fails

- Task: publish the OSV exception renewal wave through Yeet.
- Evidence: PR #1562 was created at `18fdc60e50`, but publication exited 1:
  `Detached proof jobs require an active systemd user manager`.
- Resolution: re-submit the monitor with the existing user-session bus
  environment, without republishing the already-pushed commit.
- Prevention: apply the same runtime-bus discovery to Yeet monitor submission
  as to the heavy admission wrapper.

## 2026-10-09 — H1 knowledge-reference parity inherits two host-path gates

- Task: run `CI=true bun run beep knowledge refs --check` in the admitted OSV wave.
- Evidence: exit 1, `check: 2 live gated observation(s)`:
  `explorations/build-pipeline-simplification/RESEARCH.md:194` (home-relative
  heavy-wrapper reference) and `SPEC.md:374` (home-absolute path fragment).
- Attribution: first line is present in `origin/main` at `d1e8350670`; second
  is present in the packet branch at `3dbf109066`. Neither line is edited by
  H1. The brief assigns knowledge-reference drift repair to lane C.
- Prevention: have the shared baseline/portability repair land once through
  its owning lane; H1 then merges main and reruns the failed check. Do not
  copy the repair into every lane or weaken the check.

## 2026-10-09 — H1 hosted policy delta compares imported packet against main

- Task: triage Heavy / Lint Policy on OSV PR #1562.
- Evidence: job 113904025701 fails knowledge refs and reports three introduced
  semantic-delta findings for PLAN's docs/generated/untracked SkillOpt venv
  references and SPEC's untracked SkillOpt venv provenance.
- Attribution: all those references are in packet base `3dbf109066`; the packet
  has not landed on main. H1 imports the packet as Mechanics step 0 requires.
- Routing: packet orchestrator/lane C repairs the shared knowledge baseline
  once; H1 merges and reruns. Inbox row acknowledged with that owner and
  evidence; the gate is retained, with no suppression or waiver.
- Prevention: prove the packet itself against the hosted knowledge lanes
  before it becomes the required starting point for every worker lane.

## 2026-10-09 — H1 crash-resume monitor and acknowledgement recovery

- Task: recover the OSV wave after workstation memory exhaustion.
- Evidence: proof job `f8d5ad78-1177-409e-b399-2baea41d1ddf` has terminal
  phase `terminated`, reason `timeout`, exit 130 at 16:38Z. Its 45-minute
  ceiling expired before the later crash; no passed parity result was lost.
- Recovery: read the terminal record and logs before acknowledging
  `proof-job-f8d5ad78-1177-409e-b399-2baea41d1ddf` with `--observed`. The
  bare job UUID is not the inbox row id and is rejected without mutation.
- Prevention: use the exact `inbox list` row id and bounded readiness jobs;
  distinguish a monitor timeout from a killed proof or a failed code gate.
- Hosted attribution: latest Lint Policy job 113919634320 still reports the
  same two host-path and three packet semantic findings; the shared repair
  remains with the orchestrator/lane C. No H1 suppression or duplicate fix.

## 2026-10-09 — H1 packet squash conflicts on final main merge

- Task: merge the landed packet #1560 before H1 publication.
- Evidence: main `83d8967a03` produced fourteen add/add packet conflicts;
  the imported packet had diverged after the shared original `3dbf109066`.
- Resolution: three-way merge against that original packet; preserve main's
  stage-1 closure and reviewer-routing updates and H1's OSV evidence/status.
  Only PLAN needed a manual combination of the status and main table.
- Prevention: a squash of a previously imported packet needs this explicit
  comparison base; identical-addition assumptions no longer hold after edits.

## 2026-10-09 — H1 nested heavy-wrapper memory limit

- Task: publish the addressed review wave after the crash-resume cap increase.
- Evidence: the admitted publish wrapper ended with `oom-kill` before push;
  its default MemoryMax was 16 GB even though the lane cap was 20 GB.
- Recovery: merge shared repair #1565, retry the same wave, and set the queued
  transient wrapper to MemoryMax=20G and MemoryHigh=16G; read back both values.
- Prevention: lane cap rulings must also set `BEEP_HEAVY_MEM=20G` so nested
  wrapper units carry the same limit. Preserve three-slot admission.

- Terminal retry evidence: at roughly 18 GB current memory, both policy
  scanner processes waited in `__mem_cgroup_handle_over_high`; CPU progressed
  about 1.3 seconds across two minutes, with zero hard-cap/OOM events. Stopped
  the lane-owned unit (publish exit 130); remote #1562 stayed at 8fe6d27057.
  A serial preflight or an orchestrator-approved throttle adjustment is needed.

## 2026-10-09 — H1 publish monitor ceiling flag

- Task: publish the addressed H1 review wave with a bounded monitor.
- Evidence: `yeet publish --job-max-runtime "3 minutes"` exits before any
  publication step with `--job-max-runtime requires --detach`; the help lists
  the flag on publish but its bound applies to detached command jobs.
- Recovery: remove the incompatible flag and publish the same staged wave;
  manage the submitted monitor through `yeet job` before the final handoff.
- Prevention: help should distinguish the publish job ceiling from the
  automatically submitted monitor's lifetime, or expose a monitor ceiling.

## G storage launch friction — 2026-10-09

- At source revision `9914e98a86`, `bun run beep cache census --json`
  emits `cache-executable-census/v1`, an executable-task census rather than
  storage bytes. The G brief names it as the storage census. Preserve it as
  task evidence and pair it with `du` and btrfs measurements; a documented
  storage-specific census command would prevent this mismatch.
- `beep-heavy true` initially could not connect to the user bus because
  the launch omitted `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS`.
  Command-local user-session variables restored admission; all three slots
  were occupied. The diagnostic queued unit was explicitly stopped, with
  no workload left running. Forwarding the user bus variables in the lane
  launcher would prevent this failure. No heavy proof bypassed admission.
- The Connect `op run --env-file=<lane-private-refs> -- true >/dev/null`
  failed with `Found 0 vaults with title` on the pre-existing read-only Turbo
  token reference. `op-doctor` ran once and found a service-account identity
  plus a user-bus environment limitation. No secret was printed and that
  path stopped. An agent-visible read-only reference is the prerequisite
  for the authenticated artifact probes; the write token is excluded.
- The worker instruction confines writes to its lane; G mechanics require
  a historical fixture in the sibling worktree root, a disposable second
  clone in the home cache, and home configuration changes. These dependent
  steps are deferred to the orchestrator with the scope conflict recorded.
  Passing a consistent explicit path allowlist at launch would prevent this
  contradiction.

## G resume friction — 2026-10-09

- The authorized default service-account retry failed with `"BEEP_CI" isn't a
  vault in this account.` The exact operation was `env -u OP_AGENT_BACKEND op
  run --env-file=<lane-private-refs> -- true >/dev/null`. `op-doctor` ran once;
  no credential values were emitted. The remote fixture remains an unsupported
  external condition under resume ruling 1. An agent-visible read-only reference
  would allow the authenticated HEAD and cold-read probes.
- Direct package `tsgo -p` produced missing dependency-output errors (`TS6305`)
  and cascading diagnostics. This invocation does not establish source parity;
  use the source-aware hosted-parity command and the admitted package verifier.
  The raw log remains private.

## G retention review and qualification — 2026-10-09

- The separate Opus 5.5 medium review identified 15 actionable findings in the
  first archive draft. Future-clock fixtures masked journal-directory writes
  renewing checkout liveness, and a self-asserted sidecar did not bind its
  terminal claim to tracked evidence. Fixes require real-clock regressions,
  tracked schema-equal owner rulings, complete citation matching, nested
  checkout protection, strict directory fsync, and recovery-row attribution.
  A crash/clock/citation checklist before implementation would prevent this.
- The first admitted package verifier reported introduced source diagnostics:
  missing ancestry import, a pinned FileSystem API without `noFollow`, an
  unavailable string join, lost function argument inference, and service
  dependency leakage. Its audit/docgen inbox rows were acknowledged against
  repair commit `4decfe96d3`; acknowledgement is not a successful rerun.
  Use the pinned installed Effect types alongside the reference checkout and
  capture service dependencies at construction. No suppression was added.

### G shared-admission queue and second review

The retention suite and package rerun remained queued for more than thirty
minutes behind the three-slot machine-wide budget. The worker preserved the
admission limit and used the wait for review fixes and synthetic configuration
checks. A fair queued admission policy with visible queue age would prevent
longer-running lanes from repeatedly winning slots while older jobs wait.

The second independent implementation review confirmed the prior fifteen
findings addressed, then found sibling mtime lockout, archive census growth,
foreign-owner fleet destinations, Unicode citation listing, mistyped recovery
side effects, loss of failure causes, and stale documentation. The corrective
wave adds regressions and limits fleet archive apply to the owning checkout.
The rerun and terminal review remain required; queued commands are not proof.

### G admitted test command and signal contract

The first admitted residue test command selected no tests because the package
Vitest config was used from the repository root. The package-relative rerun
executed 39 tests: 36 passed; one expected the old class domain, and two
SIGKILL fixtures assumed an integer exit code. The Effect process adapter
correctly represents signal termination as a typed error. The fixtures now
accept that error and verify persisted plan/intent checkpoint state before
recovery. Future test command guidance should give package cwd explicitly and
use the installed process adapter's signal contract.

The third review identified overwritten recovery proof, vendored operational
state in the safety walk, literal evidence path validation, nested clone linked
worktrees, foreign lock writes, directory-creation races, formatted draft
emptiness, ambiguous move outcomes and missing regression coverage. The
correction preserves immutable plan/outcome reports, writes separate recovery
receipts, prunes embedded/dependency trees, validates literal canonical evidence,
and adds nested/fence/sync/PID/symlink/recovery regression fixtures.

### G fourth-review correction

The fourth independent review found that opacity for sibling dependency trees
could hide protected state inside the candidate itself. Opacity is now limited
to siblings; candidate descendants receive the full capped safety scan. Resume
preserves fenced-live intents for explicit restore, citation indexing skips
non-regular tracked entries, and refusal reports retain typed skip causes.
Additional fixtures cover embedded proof, fenced-live resume, tracked links and
explicit foreign-owner classification. Earlier rounds are preserved privately;
terminal zero-findings is still a required independent result.
