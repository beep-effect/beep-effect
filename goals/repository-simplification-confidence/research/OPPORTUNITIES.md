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

## 2026-10-09: heavy admission needs the user-session bus environment

- Doing: running retained-script fixtures through `beep-heavy`.
- Evidence: wrapper exited 1 before admission: `XDG_RUNTIME_DIR` and
  `DBUS_SESSION_BUS_ADDRESS` were not defined. No test ran.
- Would have prevented it: documenting the user-session environment in lane
  launchers. Retry sets the runtime directory and user bus address explicitly;
  the admission wrapper and shared slot queue remain in use.

## 2026-10-09: C inherited knowledge census red crosses another owner's boundary

- Doing: running `bun run beep knowledge refs --check` before committing C's ports.
- Evidence: HEAD's census reports two live gated observations: the public packet's
  absolute-home policy example and the separately owned build-pipeline RESEARCH
  document's home-relative admission-wrapper invocation.
- Attribution: inherited at the imported packet head; no C source introduced either.
  C rewords its packet example without changing the policy. The build-pipeline
  document remains with its owner and is reported to the orchestrator.
- Would have prevented it: stage-1 packet census validation and owner-qualified
  prose that names the admission wrapper without a workstation location.


## 2026-10-09: C crash recovery found terminal reds behind pending handoff

- Doing: recovering C's operational-script wave after the workstation crash.
- Evidence: committed handoff still said queued; local package audit/docgen had
  terminal introduced schema and curried-error failures. Focused fixtures also
  exposed Effect temporary-file parent-path reporting and a lexical-order mismatch.
- Repair: inspect every lane result before trusting pending prose; fix source
  contracts and preserve terminal passes rather than rerunning everything.
- Would have prevented it: a gate runner that writes each exit/result immediately
  into a compact lane index and updates the handoff before launching another gate.


## 2026-10-09: packet squash creates add/add conflicts in pre-merge lanes

- Doing: C's required merge of origin/main after the stage-1 packet squash.
- Evidence: fourteen packet files conflict add/add despite importing the packet
  branch earlier. Structural three-way resolution against the original packet
  commit resolved every file cleanly and retained both sides' updates.
- Would have prevented it: document the original packet-base SHA in each launch
  brief so lanes can resolve squash-induced conflicts without re-deriving it.


## 2026-10-09: shared heavy queue delays C's final qualification

- Doing: queueing the final package audit rerun and draft publication after
  repairing and checking all reported C regressions.
- Evidence: both runner logs report all three slots busy; lock inventory confirms
  other admitted jobs hold the slots. C keeps its 12 GB cap and at most two units.
  The wrapper's slot files are empty because waiters open/truncate them before
  acquiring a lock, so those files cannot establish owner identity.
- Would have prevented it: FIFO admission and non-truncating owner metadata,
  plus terminal status files that distinguish queue wait from active proof.
- Boundary: no other owner's job, live lock, or workstation wrapper was changed.


### C queue stopping boundary

The two pending final-audit/publication units were verified still pre-admission
and cancelled at the blocked handoff. No other owner's unit or lock was touched.
Resume those commands after the cross-lane coordination and admission capacity
are available. Cancellation is not a proof failure or a package pass.


## 2026-10-09: relative checkout normalization escaped absolute-only fixtures

- Doing: independent C script-port review before publication.
- Evidence: Cache joined a relative checkout with `.env`, then the contained-file
  guard resolved that joined path against the checkout again. Intended reads,
  backups and writes could disagree. Absolute fixture roots hid the defect.
- Repair: resolve the checkout once at the service boundary; add a relative-root
  regression covering the intended edit, original backup and duplicate refusal.
- Would have prevented it: exercise supported relative CLI paths alongside
  absolute fixture paths before package qualification. The in-flight old audit
  was stopped and resubmitted so its proof cannot precede the repair.


## 2026-10-09: qualified C wave waits for publication admission

- Doing: publish the qualified C wave as a draft for E workflow review and run
  the unfinished local changed-scope policy check.
- Evidence: `beep-heavy` reports all three slots busy; publication has waited
  over 15 minutes before its command starts. A read-only `lslocks` check confirms
  all three heavy-slot files remain held. No publish log, push or PR exists.
- Boundary: full package verification already passes (audit 777.6s, docgen
  25.2s), and the independent review has zero actionable findings. The delay
  is admission, not a failed source proof. No other lane's process is stopped.
- Would have prevented it: a serialized publication window or admission with
  an observable fair queue and a bounded waiting receipt.


## 2026-10-09: full policy proof exposes exception-admission gap

- Doing: root-input changed-scope policy proof after package audit/docgen passed.
- Evidence: medium policy reports 17 new Effect Vitest occurrences, two lossless
  StructWithRest schema findings, one property advisory and four JSDoc spacing
  warnings. The state phase also catches 12 inline schema compilation errors.
- Repairs: canonical assertions/imports and hook timeouts, compiled schema hoists,
  JSDoc spacing, and schema-derived synthetic identity/extension property coverage.
- Boundary: Accounts must preserve arbitrary future wire fields; OS symlink,
  permission, external process and installed-Graft fixtures require real runtime
  boundaries. Existing reviewed exceptions establish the precedent. Both scanner
  owner commands preserve existing exceptions but offer no operation to admit
  newly reviewed reasons. Generated inventories cannot be hand-authored here.
- Would have prevented it: reviewed-exception admission with exact current
  occurrence identities and evidence, owned by B/V; root policy before relying
  on package audit as comprehensive lint evidence.
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


## 2026-10-09: C CI port qualification catches pinned/reference API drift

- Doing: move the hosted operational CI group to Effect and preserve thin bootstrap adapters.
- Evidence: typed proof rejects non-finite counter decoding, uncaptured Git-process dependencies,
  JSON imports without attributes and the reference checkout's callable Crypto UUID API.
  The installed Effect pin exposes UUID generation as an Effect value instead.
- Repair: validate both the reference design and the installed pin, use finite codecs,
  capture platform context inside the live layer, and preserve schema-owned JSON inputs.
- Prevention: a reference-version compatibility receipt next to the provisioned checkout,
  plus a focused compiled service contract before broad qualification.

## 2026-10-09: independent C review catches signal and sampling evidence regressions

- Doing: source review of the typed runner-resource port before publication.
- Evidence: periodic sampler failure could be hidden by a recovered final sample;
  Effect's child exitCode fails on signal termination rather than yielding shell status.
- Repair: retain a failure flag and suppress resource evidence after a sampler failure;
  use a tiny shell wait boundary around the measured command to preserve 128+signal.
  Synthetic regressions cover recovered sampling failure and TERM/INT/KILL child status.
- Prevention: make lost-sample and child-signal cases part of the initial port fixtures.

- C Run 4 full package gate: 5,796 tests pass, three profile fixtures fail
  with `Cannot find package 'desktop'`; `bunx --bun` substitutes Bun for Node
  and eval argv indexing differs. The pre-runtime pattern reader now uses
  scoped file/key environment inputs, which preserve the Node/Bun contract.
  Docgen also rejects JSON import attributes with TS2823 under its CommonJS
  example compiler; plain JSON imports retain the same owner data and compile
  on both paths. An early dual-runtime shim fixture and docgen module-mode
  compatibility check would have caught both before the 816.5s package audit.

- C Run 4 follow-up: plain JSON imports pass CommonJS docgen but package
  NodeNext emits TS1543. The compiler contracts conflict on import attributes.
  Typed import assignments preserve the shared declarative owner and permit
  each compiler to emit its own loader; both modes are now explicit gates
  before the next full package audit. A package/docgen module-mode matrix
  would have prevented the second failed preflight.
