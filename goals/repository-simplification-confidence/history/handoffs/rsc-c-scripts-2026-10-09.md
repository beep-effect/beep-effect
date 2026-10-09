# rsc-c-scripts handoff — 2026-10-09

Status: wave 1 implemented; verification queued/running; no PR yet. Not final.
This file is the lane's coordination channel and is updated as evidence settles.

## Implemented wave

Refs provisioning, Cache remote-read configuration, Knowledge exact-count rewrite,
Worktree merge-driver setup and Accounts secret-layout administration now belong
to existing Effect command families. Dead/superseded root entry points are removed
and operational callers retargeted. ONNX dispatch uses the existing seven-case
face-detection installer suite before OSV. Retained apt/compiler adapters have
synthetic fixtures. Graft old patches retire and its two Node tests relocate.
Systemd sources adopt the current installed budget without installing/reloading.

Root `knowledge:refs-rewrite` was retargeted directly; no matching `//#` task
existed. Root cache review is content-addressed by
`history/receipts/rsc-c-root-script-review-2026-10-09.md`; owner regeneration kept
151 previous reviews, qualification scope, profile and epoch. Cache audit changed
from zero blocking findings to 27 configuration-drift findings after the edit,
then back to zero after baseline regeneration (1325 unassessed nodes remain).
No qualification was granted. No lockfile or compiler patch changed.

## Orchestrator coordination needed

- R24: supply the live owner of `cloud-agent-readiness`, or the fleet-role owner
  of record after the required session/lease audit. C has only marked the retired
  bootstrap checks historical; lifecycle is preserved. The owner-name Decision
  Log row must precede final. Do not infer ownership from an old ledger row.
- R23: E reviews the two `check.yml` hunks (ONNX and merge-driver install).
  A owns ONNX fail-unpatched/pass-patched evidence and the Retained patches row.
- R27: C proposes a thin pre-runtime change-profile shim; preserve existing eval
  output and avoid admission-job latency on independent checks. Install before
  typed job-env export, restore Turbo after export. Secrets remain explicit
  trusted-caller workflow expressions. E must agree/review the Ci-group PR.
  The three Ci operational scripts, workflows and Fallow exemptions remain intact;
  this group is deliberately not partially migrated.
- S6: serialize the shared root command, cache baseline, AGENTS and workflow edits
  with the fleet's other waves at the merge gate. This worker does not merge.
- Knowledge census: separately owned
  `explorations/build-pipeline-simplification/RESEARCH.md` invocation of the
  external heavy wrapper is an inherited blocking finding. Route to that owner;
  C preserves its ownership boundary. C reworded the packet's workstation-home
  example, the other inherited finding, without weakening the privacy policy.

## Evidence

- Required initial fetch/merge of origin/main completed; packet missing on main
  required and received the fallback packet-branch merge. A later merge took
  origin/main at `42720cfb66`; latest fetch/merge reported already up to date.
- Original and new Knowledge rewrite dry-run: exit 0, 3 applied,
  225 already-applied. Rules 0–2 remain pending skill rewrites. Rule 34's ignored
  target is present here; a missing target remains a failure in other checkouts.
- Refs provisioning: 2 tests passed, including all eleven manifest entries,
  idempotence, dirty existing `.git` directory/file preservation, HOME expansion,
  stale links and directory ownership refusal.
- Retained adapter + Quality dispatch: 11 tests passed (2 files). Compiler
  originals remain; numbered rotations and patched copies are pruned; no-op and
  warning paths covered. Apt fixture preserves Ubuntu, symlink targets, nested
  entries and unrelated files; only direct third-party source entries are removed.
- Worktree setup and Refs refresh: 23 tests passed in the broader initial run.
  Cache/Knowledge failures in that run were introduced use of an unavailable
  Effect helper, since fixed. The new follow-up tests must settle before a pass
  is claimed: Cache 7, Knowledge 4, Accounts 2 cases.
- Owning ONNX suite: 7 tests passed. No edits to the face-detection package were
  needed because its existing suite is the superset; A still owns patch reversal.
- `bash -n` retained cloud/apt/merge/Graft adapters and `node --check` compiler /
  changelog adapters passed. `systemd-analyze --user verify` source passed with
  the inherited obsolete CPUAccounting warning. No live unit was installed.
- Each removed operational path has zero live caller matches using the sweep's
  hidden-file exclusions; packet/history matches retain provenance. Exact local
  census is `.beep/rsc-c-removed-callers.txt`.
- `beep lint package-scripts --write`: 152 manifests, 0 drifting, 0 written.
  `beep cache profile --write` completed through the owner with no new profile diff.
- Full CLI package verify, test-tsgo, bounded docgen, jsdoc-ratchet, Fallow audit /
  health and Graft relocated Node tests are queued through the 3-slot heavy
  wrapper. Lint policy is running. Terminal results and commit parity remain open.
- Knowledge refs check at imported HEAD: 2 inherited blockers (see attribution
  above). `CI=true` committed-head rerun remains required.

## Coverage floors read

Values below are existing baseline percentages, in lines / statements / branches /
functions order. They are not new coverage results. No floor was lowered.

| Touched source | Baseline floor |
| --- | --- |
| Cache.schemas | 100 / 100 / 100 / 100 |
| Cache.service | 45.81 / 42.72 / 19.1 / 41.66 |
| Cache.command | 80.76 / 79.91 / 72.52 / 70.32 |
| Knowledge.command | 78.88 / 76.59 / 70 / 76.31 |
| Knowledge.service | 90.27 / 90.78 / 84.84 / 88.63 |
| Knowledge.schemas | 100 / 100 / 50 / 100 |
| Refs.service | 95.87 / 93.36 / 79.38 / 90.74 |
| Refs.command | 16.21 / 15.78 / 0 / 0 |
| Worktree.service | 92.97 / 92.95 / 90.9 / 84.25 |
| Worktree.command | 66.66 / 65.3 / 64.2 / 50.73 |
| Lint.errors | 62.06 / 61.29 / 100 / 40 |
| Lint/internal/EffectSchemaInventorySource | 100 / 100 / 100 / 100 |
| Quality.command | 57.65 / 57.34 / 54.41 / 54.64 |
| Accounts.command | 96.36 / 92.06 / 100 / 84.37 |

New Accounts layout sources have no old baseline floor. Scoped read is the
brief's requested acceptance evidence; eventual package/hosted coverage still
must not regress. Root-input accounting for all 21 routing entries plus Graft:
`history/receipts/stage-5-acceptance.md#script-ports`.

## surviving-capabilities rows

A is the sole register writer; transcribe these rows with this handoff citation.

| Capability | Why retained | Current proof | Follow-up / removal condition |
| --- | --- | --- | --- |
| Compiler-backup pruning install adapter | Prepare cannot require an installed CLI; compiler `.original` is intentional patch provenance. | Synthetic fixtures pass: original retained, numbered/patch rotations pruned, repeat and missing-root no-op, malformed manifest warns; Node syntax passes. | A can run compiler provenance now. Retire only when the compiler owner's install contract no longer needs pruning. |
| Pre-runtime apt-source adapter | Ubuntu acquisition happens before a repository runtime exists. | Synthetic seam tests pass, preserving ubuntu.sources, unrelated files, nested entries and symlink targets; shell syntax passes; no live apt deletion. | Typed delegation may be added after runtime, but preserve the minimal pre-runtime boundary. |
| Git regeneration merge adapter | Git may invoke it in an incomplete merge tree with no usable CLI. | Repeated local setup and fail-closed fixture passes; shell syntax passes; adapter path unchanged. | Worktree new/prepare owns installation; clone beep-effect16's absolute setter remains valid. Read-only linked-worktree config.worktree census found no additional regenerate setters. |
| Graft workstation patch kit | Installed external tool needs its sanctioned dist-patch/bootstrap adapter. | Current 0.21.1 retained; 0.16/0.18/0.19 retired; two Node suites relocated to CLI fixtures with fake transports, terminal rerun pending. | Retire old patches only; no fresh install, deep build or model endpoint call. |
| Declarative agent-runs systemd sources | Source of record for the existing heavy-work budget. | Adopted effective 48G MemoryHigh, 60G MemoryMax, 8G MemorySwapMax and 50% pressure limit from unowned heavy-budget drift; source verify passes with inherited CPUAccounting warning. | Operator re-sync/installation is a separate follow-up. This lane makes no host unit change. |

## Recovery

Revert the wave's PR to restore removed implementations and callers. Root cache
baseline must be regenerated against the restored root scripts. Cache owned-field
writes make a private backup first; restore it to reverse a real invocation.
No workstation state changed by this implementation or its synthetic fixtures.
Keep the Git adapter path stable for existing absolute configurations.

## Report

lane: rsc-c-scripts · head: b52ef56a08183b4d97e38e0789e620e407337390 (implementation dirty)
· PR: none (wave 1 not published)
· package-verify: @beep/repo-cli pending (heavy admission)
· hosted-parity: test-tsgo pending; docgen local pending; jsdoc-ratchet pending;
knowledge refs --check fail (inherited findings; committed recheck pending);
fallow audit+health pending; coverage read complete (existing floors only)
· handoff: history/handoffs/rsc-c-scripts-2026-10-09.md
· open: final Ci group / E ordering and workflow review; R24 cloud owner audit/name;
terminal heavy proofs; introduced-helper fixture rerun; pinned independent review;
committed-head parity; publication and orchestrator merge gate.


## Run 2 (after crash)

Recovered implementation commit `17105ac97b` with a clean worktree. Required
fetch and merge of origin/main reported already up to date. All lane-local
`.beep` result files and the Yeet attempt journal were inspected. The interrupted
publish has a started attempt and no terminal verdict; no push or PR exists.

Terminal recovered evidence: JSDoc ratchet passed (tracked 21, increased 0,
zero legacy findings); relocated Graft suites passed all 17 cases. Lint-policy
log has no final verdict. Package audit and docgen failed with introduced port
errors; test-tsgo failed for the same errors. Fallow audit/health failed with
Cache/Knowledge complexity findings and the root ONNX dependency becoming
unused. Automatic docgen-local correctly refused global root-input changes.
These failures are not crash-only and are not waived.

Repairs: use typed schema decoders, the Option-compatible section selection,
Accounts' existing test facade for compilable documentation, correct curried
Worktree error construction, and map repo-discovery errors at the Knowledge
service boundary. Cache backup output now includes the parent directory created
by the Effect temporary-file API. Accounts fixture order now matches the original
jq lexical sort (`DEV_Z` precedes `GITHUB_TOKEN` within DEV). Cache key processing
and Knowledge per-file rewriting have smaller independent control-flow scopes.
No secret operation or host install ran.

Repaired focused suite passed 13 tests across Accounts, Cache, Knowledge. Commands
and terminal output: `.beep/rsc-c-run2-parity.log`. Package verification and
test-tsgo are running through beep-heavy with a 12 GB cap; terminal results
remain required. Package-script regeneration reports 152 manifests, zero drift
and zero writes. Existing coverage-floor read is retained without claiming new
coverage.

Coordination blockers remain R24 cloud packet owner audit, E's workflow review
and Ci ordering agreement, plus the orchestrator's inherited knowledge-census
repair on main. The Ci group remains intact for a coordinated follow-up wave.
This is a recovery progress report, not final content or merge readiness.


### Run 2 settled and integration evidence

- `a85684d18a` repairs the initial source/docgen causes; both initial P0 inbox
  rows are acknowledged with this fix SHA. Inbox reports zero unacknowledged.
- Broadened focused fixtures: 16/16 pass across Accounts, Cache, Knowledge and
  retained adapters. Fallow audit and health exit 0; audit still reports a
  nonblocking introduced unused root ONNX development declaration. Shared owner
  should reconcile that declaration/lockfile with H1; C did not add an exemption
  or a artificial consumer. Details: `.beep/rsc-c-run2-results.txt` and logs.
- Test-tsgo exposed additional new-fixture diagnostics after runtime tests passed.
  Repairs use Accounts' test facade, compose Cache/FsUtils at the suite boundary,
  preserve the lossless item return type, annotate the optional boolean parameter,
  and use typed codecs, pipeable streams and Effect.fn service stubs. Final rerun
  remains pending in `.beep/rsc-c-run2-tsgo-final.log`.
- Required fetch/merge now includes main's packet squash `83d8967a03`. The
  add/add packet conflicts were resolved structurally with `3dbf109066` as the
  original packet base, retaining main's stage-1 receipt/status updates and C's
  Decision Log/status/evidence. Merge commit: `b98d568561`.
- CI=true knowledge refs check still fails with exactly one inherited live
  observation in the separately owned build-pipeline RESEARCH document. The
  orchestrator's repair must land on main; C preserves this ownership boundary.
- Automatic docgen-local's full-required result is a planning refusal caused by
  the root command change. The explicit package-scoped edit loop is now running;
  it does not substitute for hosted full-repo docgen.


### Run 2 regression closure

Package verification settled: docgen passed in 26.7 seconds; audit failed only
on two integration assertions (5,778 passing, 2 failing across 294 files).
The failures were introduced by C's added Accounts subcommand and required
merge-driver setup, not environmental. `9457ec5f23` updates the Accounts command
inventory and the synthetic worktree's tracked adapter / Git-config capability.
The new audit inbox row is acknowledged with that fix SHA. Regression rerun
passes 66/66 tests across Accounts usage/layout and Worktree fleet. Test-tsgo now
passes all 334 selected test files. Terminal statuses:
`.beep/rsc-c-run2-audit-fixes-results.txt`.

Main repairs #1564 and #1565 were merged through `29a38b8dee`; the packet stage-1
merge remains preserved. Package-script owner regeneration again reports 152
manifests, zero drift, zero writes. Cache profile owner regeneration produces
no worktree diff; cache audit has zero blocking findings. No C-authored lockfile
change was introduced; main's lockfile and CLI dependencies were integrated.

The additional scoped docgen attempt has no terminal proof and must not be
claimed passed from its typechecking progress alone. The default package docgen
has a terminal pass. Full package audit needs its final post-fixture rerun;
focused regression success is reported separately. Draft publication is queued
through the heavy wrapper. This wave is still not content-final for the program:
R24 owner audit and E's workflow review/Ci ordering remain open.


### Run 2 stopping boundary and resume

Status: blocked handoff; not content-final, not merge-ready. All three P0 rows
are acknowledged with the source/fixture repair commits. No waiver or inherited
red copy was introduced. After importing main's fixes, CI=true knowledge refs
reports zero live gated observations.

Both pending units were verified to still be in beep-heavy's pre-admission
wrapper, then cancelled before admission. Neither final package rerun nor
publication started. All units launched in Run 2 have settled or stopped;
no C-owned heavy unit is left running. No PR exists and nothing was pushed.
The explicit scoped-docgen attempt stopped without a terminal result and cannot
be counted as a pass. Retain the terminal package-docgen pass and recovered
JSDoc/Graft passes; rerun unfinished/failing gates only.

Orchestrator resume actions:

1. Provide R24's owner/lease audit result and route E's review of the existing
   ONNX and merge-driver workflow hunks plus C's proposed Ci ordering. E's
   co-sign is still required; the three original Ci operational scripts and
   workflow/Fallow contracts remain intact for their one coordinated PR.
2. Route the root unused ONNX development declaration to the shared dependency
   owner with H1. Do not remove the owning package dependency, exact override,
   installer patch or its regression. A can use C's already-passing compiler
   adapter fixtures and surviving-capabilities rows now.
3. Resume C under the same 12 GB wrapper cap and at most two heavy commands:
   full package-verify, unfinished scoped docgen, owner regeneration after
   merging any newer main; then pinned independent review and Yeet publication.
   Keep the known 16-case and 66-case focused results, test-tsgo 334-file pass,
   Fallow exit-0 results, zero-observation knowledge check and coverage-floor read
   as their recorded local evidence, without claiming exact-head hosted proof.

## Run 2 final report

lane: rsc-c-scripts · head: 422895778cf1ba3abbbcaedc8faf2148bac74205 (work head; report-only commit follows)
· PR: none (wave 1 unpublished; queued publish cancelled before admission)
· package-verify: @beep/repo-cli fail(introduced integration fixtures; repaired in
9457ec5f23; 66-case regression rerun pass; final full audit rerun not executed)
· hosted-parity: local test-tsgo pass (334 files); package docgen pass (26.7s),
automatic docgen local full-required and explicit scoped retry unfinished;
jsdoc-ratchet recovered pass; CI=true knowledge refs --check pass (0 live gated
observations); fallow audit+health exit 0 (root ONNX unused declaration still
reported); coverage read complete (existing floors, no lowered baseline).
Hosted checks not started.
· handoff: history/handoffs/rsc-c-scripts-2026-10-09.md
· open: BLOCKED on E's workflow review and Ci ordering co-sign, and R24's
orchestrator owner/lease audit; shared ONNX declaration reconciliation;
final full audit and scoped-docgen proof; independent pinned review;
Yeet draft publication/ready/hosted checks; final Ci-group wave.


## Run 3 (after crash)

Resume ruling 2 resolves R24: program orchestrator (fleet role), owner of record;
no live owner at 2026-10-09T17:24:18Z. The SPEC Decision Log now records that
owner and preserves cloud-agent-readiness lifecycle. E reviews wave 1's ONNX
and merge-driver workflow hunks on the draft PR; the proposed Ci ordering above
remains the requested co-sign. The root ONNX development declaration remains
untouched under H1 ownership. The Ci group remains intact until its coordinated
follow-up wave.

Required fetch and merge reported already up to date. Terminal Run 2 evidence
is retained; unfinished full package verification and explicit scoped docgen
were submitted through beep-heavy with BEEP_HEAVY_MEM=24G under S12, at most two
C-owned heavy commands. Their logs/result files are `.beep/rsc-c-run3-*`.
Independent read-only review uses the pinned Codex route under standing S10.
Publication, E review and content-final status remain open at this entry.

### Run 3 review repair

The independent Codex review at `dc4bb81597` found one P2: relative Cache checkout
paths were joined and then resolved a second time by contained-file guards. The
service now resolves the checkout once, and the regression checks the intended
`.env`, its original private backup, absence of nested directories and duplicate
refusal. No secret value is logged. The old package unit was stopped before a
terminal verdict; qualification was resubmitted after the repair.

Explicit scoped docgen has a terminal pass (27.2 seconds, 2,324 examples) before
this one-line path repair. Owner commands report 152 manifests, zero drift and
zero writes; cache profile regeneration produced no tracked changes. CI=true
knowledge refs at `dc4bb81597` exits 0 with zero live gated observations.
