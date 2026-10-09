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

- Yeet's four-way cheap-gate wave also exceeded a 24 GiB unit cap while running
  the full-workspace Effect-import and schema-first Turbo lanes concurrently.
  Cache-policy itself passed after the evidence repair. Run the identical two
  task families at Turbo concurrency 1 to complete their task proofs, then retry
  the canonical publisher against those caches. This preserves every gate and
  needs no code/policy change. Resource-aware cheap-wave scheduling would
  prevent a second OOM.
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
### 2026-10-09 — H3 admission environment

- Work: admitted AI-metrics and CLI type checks.
- Evidence: `beep-heavy` initially returned `Failed to connect to user scope bus`.
- Cause: the worker shell lacked `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS`.
- Repair: supplied the existing user-manager environment and re-entered the queue.
- Prevention: export that environment in the lane launch contract; no queue bypass.

### 2026-10-09 — H3 direct type-check attribution

- Work: direct admitted `tsgo -p` checks before package verification.
- Evidence: CLI check produced TS6305 for workspace dependency declarations absent
  from the fresh worktree, followed by cascading unknown/any diagnostics.
- Attribution: environment-only precondition; the direct command does not build dependencies.
- Prevention: use the package verifier or canonical test-tsgo lane with dependency setup.

| 2026-10-09 | H3 telemetry qualification | A single package is accepted by `quality package-verify`, although its help suggests multiple package arguments. | Multi-package launch rejected before proof; each package now runs separately through admission. | Align help cardinality with the parser. |
| 2026-10-09 | H3 independent review | The pinned Claude read-only reviewer returned no output within both 120 s and 300 s bounds. | Bounded processes exited 124; no reviewer verdict exists. | Surface transport progress and bound review chunks without weakening the gate. |
| 2026-10-09 | H3 Cursor live workflow | The pinned Cursor Opus route rejected the model call with a usage-limit error. | SessionStart and SessionEnd hooks ran, but no tool workflow completed. | Re-run through the same authorized subscription after its quota resets; no paid top-up. |
| 2026-10-09 | H3 forwarder credential preflight | The documented `op run --env-file` route failed because its example vault is absent from the automation account. | Suppressed preflight failed; `op-doctor` confirmed the service-account backend is healthy. The archive-key operation was stopped. | Maintain current lane-scoped secret references beside the runbook, owned by F; never request raw values. |
| 2026-10-09 | H3 shared admission | Two admitted H3 commands remained queued while all three shared slots were occupied. | More than 20 minutes elapsed before execution; no slot bypass or other-lane cancellation. | Expose queue age and holder liveness without command environments. |

### H3 proof-driver immutability

Editing an executing proof driver shifted its shell read offset and emitted
`check: command not found`; a dedicated immutable post-review driver now repeats
the complete final gate sequence. Freeze a driver before admission and queue a
new one for later repair waves. Earlier individual results are retained as
intermediate evidence, not final-head proof.

### H3 additive row contract

Adding `sessionStartSource` exposed the writer conformance test's explicit field
allowlist. The package audit rejected the omission; the allowlist and raw codec
were aligned before the final proof. Schema-field additions should update the
conformance contract in the same commit.

### H3 final proof and bounded fingerprint collection

The admitted final package audits rejected `Effect.asNone` and a nonexistent
refusal decoder. The supported Option result and schema decoder now replace
those calls; all three package inbox rows reference the repair commit. Validate
new helper calls against the Effect reference and existing model surface before
starting long package proofs. Independent review also found ignored-tree errors
and stamp-deadline row loss: indexed candidates now avoid whole-tree traversal,
and the fingerprint has its own shorter deadline that retains an unstamped row.

### H3 conservative identity review

Independent final review found lexical-path reuse, multiple-primary ambiguity,
file symlink aliases, lost Bash `pipefail`, and Cursor disarm ordering. Current
transcript identity is now required for a forwarder stamp; ambiguous primaries
are excluded, observed positive touches are retained, aliases are deduplicated,
and registered Cursor event metadata avoids reading disarmed payloads. Earlier
proof output predates these fixes and is intermediate evidence only. A final
frozen-source package/parity repeat follows the admitted current run.

- Final documentation verification remained queued across heavy-slot holder
  turnovers (`beep-heavy: all 3 slots busy, waiting`). The wrapper polls locks
  rather than keeping an ordered ticket queue, so closeout admission has
  unpredictable wait time. A fair queue with observable position would prevent
  this delay; this lane does not alter the workstation wrapper or other jobs.

### H3 storage and hook namespace boundary

Final review found that a forwarder stamp join reused the storage salt instead
of the hook namespace. Join-side session and path hashes now resolve the hook
salt chain separately; storage pseudonyms remain unchanged. Nine isolated
integration cases cover storage and OTLP projection plus mixed, missing, reused,
late, mismatched, corrupt and unreadable evidence. The earlier private-schema
import error and sentinel Result-union error were repaired before the final
package run; CLI inbox rows reference their concrete repair commits.

### H3 admission pool refresh

A queued publisher retained the former three-slot pool while the machine's
configured floor moved to four slots. All current lock owners were live. The
owned publisher was stopped before it created a PR and re-submitted through the
unchanged wrapper, without changing caps or cancelling another lane. Queue
waiters should observe the current pool configuration or expose a refresh path.

- H3 publication cheap gates rejected introduced Effect Vitest instances and reconciliation duplication/complexity. The independent review also found that sibling directory aliases counted one dangling entry twice. Consolidated fail-closed reads, deduplicated failure identities by canonical containing directory, and adopted scoped test harnesses. A final gate run after every source review wave would have exposed these before publication admission.

- H3's admitted final proof exposed introduced codec fixture, Option callback, timestamp-filter and installed Effect Vitest API mismatches. Repaired the actual installed v4 contracts, supplied valid ordered timestamp generators, and kept every red attributed. The next independent review found unproven client filename ancestry, collection-gap stamp binding and transcript-subtree count inflation; repaired those before any push. Schema and source checks before the long admission queue would have shortened this repair cycle.

- H3's latest static review found whole-second refusal precision, empty/overridden disarm sentinel handling, late opening attribution, fallback enumeration errors and alias-dependent realpath failure identities. Padded refusal uncertainty to the full recorded second, bound openings to transcript prefixes, carried canonical failure identities through selection, and made both snapshot walkers fail on inspection errors. Updated regressions to retain all historical positive touches and seed actual selected hook paths; the previous fixture expectations no longer represented the repaired contract.

- H3 review friction: independent source review found corruption still allowed qualifying sessions, requested report samples could lower the shared 30-session floor, canonical alias dedup discarded known hooks, and trailing refusals could retain forwarder stamps on open sessions. Added fail-closed accounting, alias aggregation, durable-ending checks, and regression fixtures; reserving session-scope snapshot paths prevents budget starvation. Earlier acceptance fixtures covering partial and conflicting evidence would have prevented these gaps.
### E package proof and resource-policy proof differ

The full CLI package audit passed, but Yeet's Effect-Vitest scan still found a new platform import requiring provenance review and a resource layer without a timeout in the governance fixture. Reusing the existing bounded live-workflow security suite preserves the repository files as the subject and removes the duplicate resource boundary. No inventory or exception was refreshed. A focused resource-policy check alongside a new filesystem test would have exposed this before the full package rerun.

### E hosted policy and coverage expose gaps beyond package audit

PR #1568's Lint Policy log found four inline schema compilations and an unnamed workflow command generator. Hoisting the unchanged codecs and naming the Effect function repairs all five introduced errors; the landed packet path wording remains a shared inherited repair. The Coverage Regression log separately found the new fork admission branch uncovered (99.13% against its 100% branch floor). A real watch-stream fork approval transition test restores the missing branch without changing the floor. The local coverage read also omitted two touched CI files with baseline rows; the final read now includes all seven touched baseline files. Package audit and focused coverage success must not be reported as complete hosted-policy or full-suite floor acceptance.


### E main movement invalidates an active package handoff proof

Main advanced with D release-policy PR #1566 while the full CLI package audit was active, creating a PR base-conflict inbox row. Stopped only E's owned unit after checking its working directory, preserved both lanes' policy/census and friction evidence, merged main, acknowledged the actual merge SHA, and re-submitted proof through admission. The interrupted audit has no terminal pass. Serialized source windows and a final main integration before long package admission would avoid this repeated proof cost; E does not bypass the queue or freeze another lane.

### E addressed publication waits behind an unpositioned queue

The source-final review wave waited over twenty minutes with `beep-heavy: all 4 slots busy, waiting`; the integrated proof also remained queued. Both use installed defaults and the two-command E limit. The wrapper polls shared locks without an ordered ticket, so a waiting lane has no observable queue position. Preserve admission and other lanes' work; a fair ticket queue with wait/holder telemetry would make closeout timing predictable. No queued command is reported as executed proof or publication.

### E personal-token probe misses a job-token permission gap

Human review on PR #1568 identified that Repo Sanity's push-only hosted checks use GITHUB_TOKEN but the matrix job grants only contents read. Earlier successful personal-token reads did not establish the job-token contract. Move the live reads to the existing Security job with only Actions read added, preserve pure workflow lint in Repo Sanity, and exercise the job token on PRs before merge. A fixture pins permission scope, token source and ordering after dependency review; hosted execution remains the authority. A held-main failure on a PR is repository state to attribute, not an introduced credential failure.

### E: final review-state read exhausted GitHub GraphQL quota

While verifying the report push for #1568, both `gh pr view` and the complete review-thread query failed with `API rate limit already exceeded`. REST still verified the published head, ready state and existing comment history, but cannot establish thread-resolution state. Preserve unknown status and require a fresh complete GraphQL read at the orchestrator gate. A quota-aware final-read reservation would prevent publication verification from depending on an exhausted shared account budget.

- H3 further review friction: transcript-path coincidence did not establish hook session identity; group endings could precede child activity, and gap checks began at transcript time rather than verified hook opening. Repaired identity bindings, supported child layouts, alias-root keys and complete intervals. Also bounded Cursor stdin and propagated registered event metadata. The suggestion to classify supported Codex/Cursor hook adapters as unsupported because ancestry is unknown was rejected: the existing role-skip counter and receipt record that qualification limit, while unknown coverage remains unknown; native metrics support is reported separately.

- H3 admission drift: two queued jobs captured four slots while the operator raised the workstation floor to five. Verified both queued process command lines and lane working directories, stopped only their owned waiting units, and resubmitted through `beep-heavy` so they read the current floor. No other lane was stopped and no pool or memory limit was edited. A wrapper that refreshes operator admission settings while queued would prevent stale pool membership.
