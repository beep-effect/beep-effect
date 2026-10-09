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

## 2026-10-09: cache-baseline review request rejected its subject selection

- Doing: re-recording cache posture after Knip retirement and FreshBooks transfer.
- Evidence: `beep cache baseline --request` returned `Unreviewed: @beep/freshbooks. Unknown: .` for the request naming `//`.
- Resolution: use the owner's documented changed-subject mode and include FreshBooks in the review basis; inspect the stamped subjects and resulting diff before publication.
- Prevention: validate review subject selection against the current census when constructing the request, and keep its basis content-addressed.

## 2026-10-09: retirement cheap gates exposed dependent artifacts

- Doing: wave-1 Yeet draft publication.
- Evidence: `config-sync:check` found two FreshBooks project-reference changes and Fallow boundary drift; `lint:effect-vitest` found three callback occurrences after fixture edits; Fallow audit/dead-code found only the Knip-only `smol-toml` override. Nothing was pushed.
- Resolution: owner `tsconfig-sync`; shared `it.layer` for touched gate-order tests and removal of a redundant per-test layer in the already layered publish-gate test; retire the orphan override under the cleared Knip lock notice. Preserve the Effect Vitest inventory for V.
- Prevention: include project-reference regeneration, override-consumer review and callback-fingerprint ratchets in dependency-removal preparation.

## 2026-10-09: focused retirement repair waits behind shared heavy work

- Doing: FreshBooks generated-reference check and current gate-order snapshot owner regeneration after the full CLI audit exposed stale retirement assertions.
- Evidence: lane logs repeatedly contain `beep-heavy: all 3 slots busy, waiting`; FreshBooks has waited more than ten minutes without executing. The completed full audit ran 711.31 seconds and reported five precise fixture/assertion failures.
- Prevention: an admission receipt with queue age and FIFO position would make focused repair scheduling observable. Keep the three-slot limit and other owners' proofs intact. This lane records the delay and waits; it does not bypass admission.

## 2026-10-09: reference check missed before a String helper call

- Doing: preserving the historical status byte fixture while projecting out its retired Knip gate.
- Evidence: the focused assertion received a function as its expected value. `effect/String.replace` in the Effect v4 reference is curried-only: `replace(search, replacement)(self)`.
- Resolution: corrected the call against `.repos/effect/packages/effect/src/String.ts` and reran the failed fixture group. The normalized historical placeholders are comparison text and are not decoded as a live DTO.
- Prevention: inspect the current reference signature before writing each newly used Effect helper call; the data-first form cannot be assumed.
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
