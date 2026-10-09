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
| Pre-runtime change-profile adapter | Workflow lane decisions precede Bun/dependencies. | Ci schema owner supplies the shared pattern JSON; typed-vs-shim fixtures cover empty, goals-only, mixed and non-PR diffs. Runtime proof is pending in Run 4. | E co-signs the CI ordering. Retire only when every caller has a runtime or consumes admission outputs. |
| Runner-resource shutdown adapter | Stable heavy.yml older-checkout path and explicit 130/143 shutdown/status boundary. | Effect Ci owns measurements; synthetic cases cover TERM/INT/KILL, stdin and recovered periodic failure. Independent review has zero source findings at f0d88dd5bd. | Retire only when the caller runtime owns equivalent signal/stdin behavior; keep older-checkout fallback. |
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

### Run 3 independent review

Pinned independent Codex review returned terminal zero actionable findings at
`c43d86e953177c0fae7a10ec7329ca499490d370`, after the initial P2 was repaired.
It covers the implementation review at `dc4bb81597` plus the relative-path
repair and fixture. Read-only review did not run tests or mutate files.
Test-tsgo passed all 334 selected files after the path repair; the first runtime
fixture invocation selected no tests because its cwd was wrong. That invocation
is recorded as a command failure, with the corrected package-cwd rerun pending.

### Run 3 draft publication submission

The corrected Cache runtime regression passes all 8 cases (15 seconds), including
relative-checkout backup and duplicate refusal. The refreshed removed-name census
has zero live caller matches for all 9 removed script paths, recorded in
`.beep/rsc-c-run3-removed-callers.txt`. Full package verification is running,
not yet a pass. Draft publication is submitted through beep-heavy under S12
so E can review the workflow hunks; C is not declaring content-final or merging.

### Run 3 full package qualification

`beep quality package-verify @beep/repo-cli` has a terminal pass: audit 777.6
seconds and docgen 25.2 seconds (`.beep/rsc-c-run3-package-final-result.txt`: 0).
It includes the repaired Cache source and runtime fixture. The earlier interrupted
Run 3 audit has no verdict and is superseded by this explicit rerun.

Draft publication and the unfinished `beep lint policy --base origin/main` are
queued through beep-heavy; no PR exists yet. E's workflow review and Ci co-sign
remain external dependencies. The caller census, root-input inventory and
terminal independent review stay preserved. No running unit is abandoned.

### Run 3 policy findings and owner boundary

The local changed-scope policy proof exposes introduced findings despite the
full package audit/docgen pass: 17 test-policy occurrences, two lossless wire
schema candidates, a property-test advisory, four JSDoc spacing warnings and
12 inline schema compilation errors. The direct fixes are canonical assertion
imports, explicit layer timeouts, failure-on-missing backup unwrapping, schema
codec hoists, spacing and schema-derived synthetic metadata/identity coverage.
Post-fix qualification remains required.

Reviewed boundary exceptions remain a B/V inventory-owner dependency. Accounts'
StructWithRest preserves unknown item/field metadata and cannot become a closed
Class without violating the lossless contract (existing Lexical wire exceptions
are the precedent). Real filesystem, symlink, subprocess and installed-Graft
fixtures require occurrence-specific reasons. `lint schema-first --write` and
`lint effect-vitest --write` preserve old exceptions but cannot accept new
reviewed reasons. No unexplained baseline capture or hand-authored generated
inventory was made. The orchestrator should route explicit admission capability
or an authorable-exception-metadata ruling to B/V. Row emission is queued.

State policy separately reports 40 introduced broken tracked-path observations
for the removed names, including the locked routing table and explicitly
historical packet references; zero live gated reference observations still
passes. This is a semantic-delta/history contract gap requiring disposition;
none is silently waived. The old live-caller census excludes packet history and
therefore does not establish a semantic-delta pass.

Publication was stopped while still waiting for admission (over 20 minutes),
before a publish command, push or PR existed, to keep the wave fully addressed.
The policy proof is still running its final phase; no terminal pass is claimed.

### Run 3 blocked closeout

Implementation head `aa278b7be26d83be8b98ca357018f27ba7853fc1` includes
source-policy repairs at `cff2e5826d` and the missed live Graft skill provisioning
reference repair at `aa278b7be2`. The pinned independent reviewer reports zero
actionable source defects through `cff2e5826d`, incorporating the previous
implementation and relative-Cache-path reviews. Commit hooks pass Biome,
JSDoc, typos, secret scanning and commitlint for those repairs.

The full package audit/docgen pass precedes these latest codec/test edits. It
remains valid historical proof, not exact-head qualification. The post-repair
fixture/test-tsgo/package-quick batch was submitted through admission and
cancelled before it started because this lane is blocked on B/V's reviewed
exception admission mechanism. Its result receipt explicitly records that
cancellation. No runtime/type/package pass is claimed for the final repair head.
The diagnostic row-emission job was likewise cancelled before admission. The
pre-repair full policy run recorded failing light/medium/state phases and was
stopped during the silent deprecated-API phase; it has no complete verdict.
All own heavy units are stopped or terminal before handoff.

Remaining work, in order:

1. B/V supplies the owner-command path or an explicit authorable-exception
   metadata ruling for AccountsSecretField/AccountsSecretsItem lossless wire
   schemas and genuine platform fixtures. Emit exact test-policy rows, repair
   any remaining avoidable fixture-layer/lifetime findings, and admit only
   individually reviewed exceptions. No broad census acceptance is authorized.
2. Finish introduced semantic-delta attribution: the pre-repair scan found 40
   new broken paths. The live Graft remedy is fixed; locked routing tables and
   historical packet facts need an explicit history-contract disposition.
   Knowledge refs check's zero live gated observations does not prove this gate.
3. Run the saved post-repair batch, then remaining exact-head hosted-parity
   gates. Existing full package proof and scoped coverage reads are retained;
   no floors were lowered and no new coverage pass is claimed.
4. Publish the addressed wave through Yeet for E's workflow review. No push,
   draft PR, readiness job or hosted checks were created in this run. E owns
   the coordinated Ci wave and ordering co-sign; merge E's main once when the
   orchestrator directs it, regenerate owners, and never merge from C.

The PLAN, README and Decision Log now record this blocked qualification
boundary. No acceptance row is closed. Graft root-query savings in this run:
approximately 58,600 tokens across two meaningful queries.

lane: rsc-c-scripts · head: aa278b7be26d83be8b98ca357018f27ba7853fc1
(implementation head; report-only commit follows) · PR: none (wave 1 unpublished;
wave 2 Ci pending E) · package-verify: @beep/repo-cli pass before latest repairs;
exact-head requalification pending(owner-admission blocker) · hosted-parity:
test-tsgo pass before latest repairs; docgen local pass; jsdoc-ratchet pass;
knowledge refs --check pass(0 live gated); fallow audit+health pass from retained
Run 2 receipts; coverage read complete, no floors changed; complete lint policy
not passed · handoff: history/handoffs/rsc-c-scripts-2026-10-09.md · open: B/V
exception admission, exact occurrence classification, semantic-delta history
contract, post-repair verification, E workflow co-sign/Ci wave, publication and
hosted proof.


## Run 4 (after crash)

Resume ruling 3 is applied. Required fetch/merge brought main into this lane at
`c5787ba017`. The conflict resolution preserves both lanes' append-only friction
receipts and main's Accounts TUI plus C's secrets-layout command. Shared owner
regeneration reports 152 manifests, zero drift and zero writes; cache profile
adds no tracked diff. The Fallow-input change regenerates the policy fingerprint
through its owner. The earlier terminal passes remain revision-bound evidence.

The whole Ci operational group now moves together: typed change-profile,
job-env and runner-resources, a schema-owned shared pattern JSON, pre-runtime
profile shim, resource shutdown adapter, coordinated install/export/restore
ordering, and the retired job-env Fallow exemption. heavy.yml keeps its older-
checkout resource fallback. No secret expression moves into policy tooling.
E's co-sign remains a PR-review dependency and does not block draft publication.

The independent pinned reviewer found two actionable resource-port defects:
periodic sampler failure could disappear when a final sample recovered; Effect
child signal termination mapped to exit 1. Repairs retain measurement-failure
state and use a tiny shell wait boundary to preserve 128+signal. Synthetic
fixtures add TERM/INT/KILL and recovered sampler failure, plus shared-profile
parity for empty/goals/mixed/non-PR diffs. Review follow-up remains required.

Admitted Run 4 parity initially catches introduced type/API errors and the
expected root-input docgen full-required plan. Those source errors are repaired;
post-repair test-tsgo and explicitly package-scoped docgen must settle before
claiming current proof. Result/log files are `.beep/rsc-c-run4-*`. No passed old
gate is rerun merely for a new report. At most two C-owned heavy commands run.

### Reviewed-exception candidates

Exact occurrence table will be appended from the post-repair scanner output.
AccountsSecretField and AccountsSecretsItem retain lossless StructWithRest wire
schemas (unknown item/field metadata survives identity verification), pending B
admission. Real filesystem, symlink, subprocess and installed-Graft fixtures are
judgment candidates; C does not write inventory/allowlist entries. Every candidate
will name a source line, class and reason. S11 allows the attributed judgment red
at publish and the orchestrator merge gate; this is not a blanket census waiver.


### Run 4 occurrence-specific B admission table

Scanner: `beep lint effect-vitest --rows`, exit 0; rows are diagnostic identities, not admissions. Only the following open C-owned candidates are submitted. Existing admitted rows remain untouched.

| File:line | Rule / review class | Justification |
| --- | --- | --- |
| `packages/tooling/tool/cli/src/commands/Accounts/AccountsSecretsLayout.schemas.ts:31` | schema-first / object-struct-schema | AccountsSecretField is a lossless external wire object; arbitrary future metadata participates in identity. |
| `packages/tooling/tool/cli/src/commands/Accounts/AccountsSecretsLayout.schemas.ts:68` | schema-first / object-struct-schema | AccountsSecretsItem must preserve unknown vault-item metadata across decode/encode. |
| `packages/tooling/tool/cli/test/setup-effect-ref.test.ts:75` | EV002 / unresolved-layer-provide | Per-invocation fake Git/PATH/config and reference root require a freshly captured fixture context. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:145` | EV004 / shorter-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:207` | EV004 / shorter-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:267` | EV004 / shorter-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:326` | EV004 / shorter-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:379` | EV004 / shorter-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/setup-effect-ref.test.ts:80` | EV004 / inner-helper-scope-lifetime-review | End each subprocess/resource helper scope before examining files or beginning the next invocation. |
| `packages/tooling/tool/cli/test/accounts-secrets-layout.test.ts:3` | EV010 / platform-resource-provenance-review | Real platform boundary verifies subprocess, symlink, permissions and physical-file behavior; memory cannot model this subject. |
| `packages/tooling/tool/cli/test/cache-remote-reads.test.ts:8` | EV010 / platform-resource-provenance-review | Real platform boundary verifies subprocess, symlink, permissions and physical-file behavior; memory cannot model this subject. |
| `packages/tooling/tool/cli/test/knowledge-refs-rewrite.test.ts:7` | EV010 / platform-resource-provenance-review | Real platform boundary verifies subprocess, symlink, permissions and physical-file behavior; memory cannot model this subject. |
| `packages/tooling/tool/cli/test/regenerate-merge-driver.test.ts:4` | EV010 / platform-resource-provenance-review | Real platform boundary verifies subprocess, symlink, permissions and physical-file behavior; memory cannot model this subject. |
| `packages/tooling/tool/cli/test/retained-script-adapters.test.ts:2` | EV010 / platform-resource-provenance-review | Real platform boundary verifies subprocess, symlink, permissions and physical-file behavior; memory cannot model this subject. |


### Run 4 qualification attribution and review

Committed source `f0d88dd5bd998fed7505e01117ef4d131aceda6e` has terminal zero
independent actionable source findings. The reviewer accepted all three resource
repairs and confirmed unchanged event/credential policy. No native source dirt
followed that review; only packet receipts changed.

The initial fixture batch's two failures were introduced test-invocation errors:
Vitest runs on Node, so process.execPath cannot launch a Bun-only CLI. The explicit
`bun` invocation is repaired. Initial full package audit rejected the composite
JSON input missing from the package's hand-owned include; it now explicitly includes
`src/**/*.json`, and tsconfig-sync confirms the generated fields are in sync.
Docgen rejected missing companion-type descriptions; all three companions now carry
the required documentation. Their P0 inbox rows have fix-sha acknowledgments.

Initial Fallow audit/health found introduced environment-selection complexity.
The implementation now uses schema-backed selections and Match, preserving the
mode labels and redacted entries; the scoped rerun remains queued. Fallow also
reports the known unused root ONNX declaration after deleting its duplicate test
consumer. Resume ruling 2 assigns that declaration to H1 and explicitly forbids
C removing it; the declaration, owner dependency, exact override, patch and regression
remain unchanged. The adjacent renderTurboSummary complexity body is unchanged
from main and is inherited-adjacent. Neither attributed row justifies a new ignore.

JSDoc ratchet and CI=true knowledge refs --check pass in Run 4. The latter has
zero live gated observations. Post-repair type proof passes 334 selected files;
the later environment simplification requires the refreshed type/fixture gate.
Full package verification and explicit package-scoped docgen are running, not
claimed passes. Two C-owned admitted/queued commands remain under beep-heavy.

### Run 4 owner regeneration, caller census and coverage read

Final fetch/merge confirms origin/main is already integrated. Owner commands
`lint package-scripts --write`, `cache profile --write`, `goals index --write`
and `tsconfig-sync --filter @beep/repo-cli` complete with no tracked generation
diff; package scripts report 152 manifests, zero drift and zero writes.
The refreshed sweep-exclusion census has zero live caller matches for all ten
removed script paths, including `scripts/ci-job-env.mjs`; receipt
`.beep/rsc-c-run4-removed-callers.txt`. Archived packet/research observations
and the locked routing table remain historical under resume ruling 3.

The Ci additions extend the earlier scoped coverage read. Existing baseline
percentages (lines/statements/branches/functions) are Ci.command.ts
83.33/84.78/51.35/80.76 and internal/cli/TurboCache.ts 100/100/100/100.
HeavyAdmission.ts and the new CiOperational files have no existing baseline
row. This is a baseline read, not a new coverage result; no floor is lowered.

Graft usage in this run reports approximately 33,668 tokens saved across the
two C-owned queries (1,085 + 32,583); independent reviewer usage is separate.

### Run 4 compatibility qualification wave

The full package gate reports audit failure (816.5s) with 5,796 passing tests
and three profile-shim failures; docgen fails (30.0s) with TS2823 on JSON import
attributes. These are introduced compatibility defects, repaired in
`93f78873b87f6a8452774c0527280a60fbaa9c7e`: command-scoped pattern file/key
environment inputs remove Node/Bun eval argv differences; plain JSON imports
retain the same schema-owned data under the CommonJS docgen example compiler.
Both package P0 rows carry fix-sha acknowledgments. The independent reviewer
reports terminal zero actionable findings on that exact source commit.

The refreshed set has terminal ci-fixtures=0 (24 tests), test-tsgo=0,
fallow-audit=0 and fallow-health=0. Health has zero findings. Audit retains
two attributed observations: the H1-owned root ONNX declaration and unchanged
renderTurboSummary complexity. Exit 0 does not mean those observations vanish.
No inventory/allowlist edit or floor reduction is made. Receipts:
`.beep/rsc-c-run4-refresh-result.txt` and the matching logs.

The compatibility-qualified sequence is queued through beep-heavy: explicit
package-scoped docgen, CI fixtures under bunx --bun (the actual package audit
runtime), then full package verification. It is a rerun, not yet a pass.
Publication proceeds through the normal cheap-gate path while that proof
settles; E's co-sign and hosted proof remain open.

The compatible qualification sequence is admitted: package-scoped docgen
passes, and all 24 CI fixtures pass under bunx --bun (39.21s). That directly
exercises the previously failing pre-runtime profile shim in the package
audit runtime. Full package verification is now running; terminal receipt
`.beep/rsc-c-run4-compatible-result.txt` records the two completed passes.

The full package compatibility rerun fails fast at NodeNext TS1543: plain JSON
imports require attributes in that mode. `a381e32a3187c1df4edfc293d6868e7d30500c4e`
uses typed import assignments for the same JSON owner, compatible with each
compiler's generated loader. The package audit P0 has that fix-sha acknowledgment.
A dual-module docgen/type/Fallow/full-package sequence is queued. The prior
24-fixture Bun-runtime pass remains valid for the unchanged bootstrap repair.

The normal publish attempt is admitted but exits before gates because newly
written receipt edits are unstaged. No push or PR occurs. Main advanced by
#1567 (evidence-policy documentation only); it is merged cleanly. Shared owner
regeneration and a receipt commit make the retry a clean reviewed wave.
Independent review is terminal zero findings on source `a381e32a31`; the main
merge does not change that source.

### Run 4 compiler-boundary correction

The typed-import experiment fails docgen TS1202/TS1294. Inspection of the
actual canonical configuration corrects the earlier CommonJS inference:
examples use ES2022/bundler with erasableSyntaxOnly; package builds use
NodeNext. C does not alter that centrally generated compiler policy.

Source `dec7e854a06c62b1da5979c3587aeff97d454cb7` instead makes the schema module
the sole pattern owner and generates the unchanged pre-runtime JSON via
`beep ci patterns --write`. `beep ci patterns` checks freshness. Both commands
pass, the JSON has no byte diff, and a CI fixture protects the projection.
Typed guards and Heavy admission use the same schema-owned instance; the
no-longer-needed JSON tsconfig include is removed. Independent review reports
terminal zero actionable findings on this exact source commit.

The new admitted/queued qualification sequence is
`.beep/rsc-c-run4-projection.sh`: owner freshness, scoped docgen, test-tsgo,
Bun-runtime CI fixtures, Fallow audit/health and full package verification.
The earlier docgen experiments are failed/superseded evidence, not passes
on this revision. The normal clean publish retry remains queued.

C-owned Graft queries now total approximately 73,791 tokens saved
(33,668 prior + 40,123 ownership query); reviewer queries are not included.

### Run 4 current qualified wave and D integration

The schema-codec source and final typed fixture repair have terminal zero
independent findings on `e51f6ff5c3b39149e6c1fbb241e2085ef7ec89fa`. Docgen
passes on the unchanged runtime source; the test-only typed decoder repair
retains that pass. Current admitted qualification records owner freshness=0,
test-tsgo=0, CI fixtures=0 and Fallow audit/health=0 in
`.beep/rsc-c-run4-qualified-result.txt`. Full package verification is running.

The publish waiter is restarted only after proving it had not admitted any
command; it reloads the owner's current shared slot floor (four). C changes no
cap. The admitted retry stops before push at the stale-base fence, because D's
#1566 landed during the wait. Main is merged at `17a04eb0e5`; both append-only
friction histories are preserved and the canonical privacy wording is retained.
D's manifest-aware release policy now applies: C removes its private package
changeset note instead of introducing a post-baseline private note. Shared
package-scripts, cache profile, goals index, tsconfig and fingerprint owners
regenerate with no tracked diff. Publication will retry from this clean base.
