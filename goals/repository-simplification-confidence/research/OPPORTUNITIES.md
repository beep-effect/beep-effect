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

### Heavy wrapper queue has no durable queue position

Lane V's two 12 GB admitted collectors waited while all three heavy slots
were occupied by peer lanes. `beep-heavy` reports only "all 3 slots busy";
its repeated open-before-flock loop truncates the slot metadata even when
acquisition fails, so metadata files cannot identify holders during contention.
`lslocks` provides read-only holder evidence. A FIFO ticket and atomic
post-acquisition metadata publication would make queue progress and crash
recovery observable. This lane does not change the workstation wrapper or
stop peer jobs; qualification stays queued.

### Inherited SPEC prefix still blocks full knowledge references

After #1565 was merged, the full `CI=true beep knowledge refs --check`
completed red with one `external-mirror-reference` in this packet's
`SPEC.md:374` (a home-absolute prefix example). The same example exists on
main; #1565 fixed only the build-pipeline observation. V reports the remaining
row to the orchestrator's packet lane for one main repair, then will merge
main and rerun that gate. A full-corpus local check on the coordinating
packet before its stage-1 publication would have caught this second row.

## 2026-10-09 — V publication admission stalled after qualification

V completed full repo-cli verification (757.718 s) and final source parity,
then queued canonical Yeet publication. For more than 45 minutes all three
slots remained occupied; newly arriving peer work obtained freed slots while
V waited. The wrapper uses nonblocking flock polling at five-second intervals,
not a FIFO queue. It starts the capped user service before admission, so an
active unit alone is not evidence that the command started. V stopped only its
two unadmitted services before the blocked handoff; no peer job was stopped.
A fair admission order and separate queued/admitted state in the wrapper would
have prevented starvation and the misleading liveness check.

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

### G fifth-review correction and effective-path inventory

The fifth review left four low findings: embedded ancestor opacity, Git probe
index refreshes, a fixture that followed its dangling link during backdating,
and report vocabulary/shape cleanup. Embedded ancestors are now protected,
Git probes disable optional locks, fixture backdating uses no-follow touch,
and recovery mode is explicit. Source-only review is not runtime proof.

A read-only `turbo config` inventory at 262 known checkout roots, using the
same G-inherited process environment and executable, succeeded at 261 roots;
all successful probes observed `~/.cache/beep/turbo`. One root returned an
error. This verifies that route only; other harness child environments and
workstation-wide read-only remote posture remain separate acceptance claims.

### G sixth-review correction

The sixth independent source review confirmed prior safety fixes and left two
low findings in outcome classification and documentation/style. Apply now maps
writer fences to lock-held and identity refusals to path-changed, matching
recovery. Opaque-leaf membership uses Effect HashSet rather than linear array
lookups, failed ancestor probes name stat-failed, and restore/report wording
names the actual operation. The next source review and admitted runtime gates
remain required before final.

### G publish-before-proof admission correction

The package rerun waited almost fifty minutes in admission without starting
its command (no result log, approximately one MiB unit memory). It was stopped
before execution and replaced by Yeet publication under the same two-owned-job
limit. The expanded test remains admitted. This follows the canonical rule
that a queued full local proof must not hold publication; package verification
and parity remain required before final handoff. No other lane unit was stopped.

- 2026-10-09 G runtime/gate friction: source-only review missed the installed Effect comparison export and canonical-parent fsync path. The admitted retention suite reported 19 failures; Yeet cheap gates also reported the missing schema-derived property test, six complex functions, one duplicate parser and 27 new test-policy rows. Fixed the API/path/property errors at `d881c6e2e0`; ordered a diagnostic export and split traversal/recovery stages instead of suppressing findings. Preventive improvement: an admitted focused runtime gate before declaring source review closure. Proof remains pending until rerun.

- 2026-10-09 G admission friction: corrected focused retention tests and the test-policy row export waited more than 14 minutes without starting after a prior package verification had waited almost 50 minutes. The installed wrapper tries nonblocking slot locks every five seconds, with no FIFO admission order. Preserve the machine-wide cap; a ticketed admission queue with queue age and bounded short-job service would make runtime qualification predictable. No other lane job was stopped and no budget was raised.

- 2026-10-09 G ninth source review: the resource-wrapper migration left interruption cases outside the OS layer and briefly introduced a v3-only `it.scoped` name. Verified installed v4 declarations: `it.effect` already provides Scope, property options are `arbitrary`, and `Arbitrary.schema` is present. Corrected provider/API usage, census-error visibility, missing-parent recovery messages, and sync-fault phase assertions; added fixtures for each source contract. Preventive improvement: validate every changed harness API against installed declarations before requesting review.

- 2026-10-09 G runtime friction: scoped coverage started and then held an idle worker for more than ten minutes without a completed test result (about 18 seconds aggregate CPU). Terminated only the verified owned Vitest processes so the admitted batch could continue census/cache work; coverage remains unproven. A verbose 30-second focused rerun is admitted through the wrapper. Preventive improvement: per-case progress and a native wall-clock watchdog even during the five-minute coverage timeout and layer teardown.
- Final documentation verification remained queued across heavy-slot holder
  turnovers (`beep-heavy: all 3 slots busy, waiting`). The wrapper polls locks
  rather than keeping an ordered ticket queue, so closeout admission has
  unpredictable wait time. A fair queue with observable position would prevent
  this delay; this lane does not alter the workstation wrapper or other jobs.

- 2026-10-09 G focused runtime diagnosed the coverage stall: 53 of 55 cases passed, while both SIGKILL recovery cases timed out at the journal retry. Acquisition uses a timed retry after reclaiming the dead writer generation; the fixture test clock never advanced. Use `TestClock.withLive` on these OS interruption fixtures. The earlier source-only zero did not detect this runtime behavior. Preventive improvement: run a bounded verbose interruption fixture before full coverage, with per-case progress.

- 2026-10-09T20:27Z G admission remains queued. Read-only `lslocks` and process cwd/cgroup checks found four live slot holders: two in `agent-runs.slice` and two in `app.slice` (including a shell with cwd `/tmp`). The slice cap therefore does not cover every live holder of the slot protocol. Foreign live holders were retained; no wrapper/cap change was made. Preventive improvement: bind admission receipts to live units and show queue order, holder age and whether each holder belongs to the budgeted slice. Raw process/unit identifiers stay private.

- 2026-10-09T20:38Z G's `gh pr view` failed with "GraphQL: API rate limit already exceeded". A REST PR read remains available; its separate rate endpoint reports quota remaining. The lane treats review-thread state as unknown until an actual GraphQL read succeeds, rather than inferring it from the rate endpoint. Preventive improvement: make routing/quota provenance explicit and budget read-only readiness polling across simultaneous lanes. No credentials or account identifiers are recorded here.
### V Run 4 schema-property gate after preserved source qualification

Direct capped Yeet publication completed cheap gates but refused the push:
`yeet-command-wiring.test.ts` has three Schema codec assertions without a
schema-derived property. The integration did not previously run this full
cheap tier. Added a generated run-plan print/decode property preserving
context and ordered command data. Running the cheap tier before freezing the
review snapshot would have caught the missing obligation earlier.

The first schema-property repair used direct `Arbitrary.checkEffect`, which
passed schema-first but introduced EV007 in effect-vitest. Converted it to
`it.effect.prop` with the same generated plan, 25 runs and callback. The
admitted collector's Node/Bun/typecheck passes remain recorded for the direct
variant; its running package stage was stopped without a terminal result before
changing source. A canonical-property example in the schema-first repair
message would have prevented the cross-detector round trip.

### V private release note missed by cheap publication gates

Hosted Repo Sanity job 113997596244 rejects V's pre-D repo-cli changeset:
`private workspaces must not accumulate release notes`. Main's D policy had
landed, but cheap `changeset-status` only skipped the private workspace and
passed; graph validation runs separately in hosted Repo Sanity. Archived the
exact old note and removed the `.changeset` file. Including the cheap graph
validation alongside status would prevent this introduced hosted failure.

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

- 2026-10-09 G admitted compiler/docgen proof still found `unknown[]` in nested filter/flatMap refusal-warning collection, despite source-only review and an explicit RecoveryRow array. Replaced the nested expression with one typed-input flatMap; no schema, runtime warning order or refusal semantics changed. Preventive improvement: finish the actual compiler check before treating contextual inference repairs as complete.
- 2026-10-09 G changed-input build returned success but restored only 23 rather than 28 outputs. Removing `dist` alone retained `node_modules/.tmp/tsconfig.tsbuildinfo`, so incremental compilation skipped unchanged declarations and the public index. Correct the owned clean-output fixture by resetting its incremental file too; compare a fresh cold build with the cached manifest. The inherited generated build-script/output coupling is a shared-owner follow-up, not a new cache-hit claim.

- 2026-10-09T21:15Z G final publication did not start: the noninteractive shell
  lacked the user-manager bus environment (`$DBUS_SESSION_BUS_ADDRESS and
  $XDG_RUNTIME_DIR not defined`). The wrapper returned before admission or
  cheap gates. Supply the canonical UID-1000 runtime directory and user bus
  address only to the retry; no persistent configuration or caps change.
  Preventive improvement: the admission wrapper should resolve the local
  user-manager transport explicitly for noninteractive sessions.
### V Run 5 packet-check admission

The merge-only refresh for #1575 needs knowledge-reference and packet checks,
but its `beep-heavy` request reports `all 4 slots busy, waiting` before the
payload starts. The wrapper supplies no queue position or admission estimate;
this repeats the admission visibility friction already recorded by V and E.
An ordered queue and an observable queued/admitted result would make this
bounded refresh predictable. The worker waits without bypassing admission or
stopping peer jobs; source qualification is reused under the 20:50Z ruling.

After sixteen minutes, a read-only lock check showed a fifth shared slot while
V's existing request still scanned only four. The wrapper captures its slot
floor at launch. The operator-owned configuration now grants five slots, so V
stopped only its unadmitted request and requeued the same checks through the
unchanged wrapper to observe the live budget. Dynamic configuration refresh
while queued would prevent this stale-admission window. No running payload or
peer service was stopped, and the worker changed no admission setting.
