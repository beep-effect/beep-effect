# Turborepo quality cache adoption plan

## Status

Status: `active`
Lifecycle: `active`

Launched 2026-10-28 in the isolated `codex/turborepo-goals-completion` lane.
The current population and feature inventories are review queues, not
qualification grants. The retained signed pilot remains limited to its recorded
older private-loopback tuple. No acceptance criterion or representative window
is treated as complete by this launch.

## Phases

| Phase | Status | Work | Exit criteria |
| --- | --- | --- | --- |
| P0 Population, feature and value audit | in-progress | Refresh actual scripts/lanes/workflow definitions and relevant stable/canary features; consume lane-economics baseline. | Every population/feature has an owner and disposition; prioritized cohorts have explicit evidence gaps. |
| P1 Graph and pure boundaries | pending | Implement proof-backed task graph, input/output/env repairs and pure decomposition through qualification's contract. | Negative invalidation and output-ownership tests pass; no unreviewed enablement. |
| P2 Local and worktree adoption | pending | Qualify high-value cohorts and adopt local reuse inside proven profiles. | Fresh/replay/shadow equivalence and worktree portability evidence pass. |
| P3 Hosted cohorts and warming | pending | Consume production trust readiness; roll named hosted cohorts, archive transport fixes and demand-based warming. | Required jobs emit fresh statuses; resolved workflow identity, useful hits and bounded warm receipts are proven. |
| P4 Broader observation and final census | pending | Expand supported profiles, complete representative observation and reconcile every computation. | Eligible work is qualified/adopted, exclusions are justified, no unexplained or silently deferred entries remain. |
| P5 Yeet: PR to mergeable | pending | Publish through Yeet, verify exact-head hosted proof and resolve reviews. | Yeet monitor reports merge-ready: yes; no cache result substitutes for hosted acceptance. |
| P6 Close | pending | Land final value/disposition report, reflection and lifecycle in final implementation PR. | Whole-program acceptance and same-PR closeout evidence are complete. |

## First action

Refresh actual task/lane/workflow population and create the stable/canary feature and computation-disposition matrices using the existing owners' baselines.

### Current checkpoint: 2026-10-28

- `research/current-population.json` records 190 workspaces, 4,586 graph nodes,
  2,571 executable computations and 2,015 graph-only nodes. Its 1,621 configured
  cache-enabled computations are not thereby qualified. Every row retains an
  explicit current-review obligation and final-disposition gap.
- `research/current-feature-matrix.json` records 21 feature families and all 14
  future flags in the installed schema. Documented availability does not replace
  each feature's applicability and runtime regression evidence.
- `research/current-client-pins.json` pins installed stable 2.11.10 and published
  canary 2.11.9-canary.1 by native bytes. Both probes use `--skip-infer`, matching
  the existing pilot owner and preventing delegation to the installed stable.
- `research/current-completion-audit.json` retains all nine acceptance criteria
  and implementation-contract paragraphs as unfinished proof obligations.

## Dependency gates

P0 and feature/source inventory can start independently. P1 consumes the
qualification contract; broad promotion waits for its validated runner/pilot.
P3 requires passing protocol and current production trust readiness. Coordinate
cohort execution with trust's rollout rather than introducing a cycle between
whole-goal completion gates. Replacement cutover, if selected, stays in the
conditional migration goal; keep safe independent local improvements moving.

[SPEC.md](./SPEC.md) governs authority and the [program map](../../explorations/turborepo-quality-cache/MAP.md)
governs handoffs. A sibling's accepted milestone can unblock work before its
whole goal closes.

## Evidence to produce

full population and feature disposition matrices; per-cohort qualification
receipts; effective config/archive diffs; resolved workflow/required-status
receipts; baseline and before/after value; warming decisions; representative
observation, rollback and final Yeet proof.

Store compact receipts in research/history and large raw evidence in bounded
artifacts. Record source/tool/profile/epoch identity, command/case, result and
retention. Register new reports in the manifest. Record friction immediately
in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md). Missing evidence is unfinished
work, not an implied pass.

## Verification and attribution

Apply the SPEC matrix to actual changes. Package editors run package-verify
before handoff. Attribute failures as introduced, inherited, unrelated or
environment-only before repair. Preserve dirty work and use canonical
admission/worktree workflows for heavy experiments.

## P6 closeout checklist

P6 preparation can occur during P5 so final reflection/lifecycle land with the
final implementation. Acceptance still requires final Yeet proof. Do not defer
closeout to an unrelated state-only PR.

1. Confirm every SPEC criterion and applicable representative observation.
2. Use the reflect skill and copied reflection template to record tooling
   friction, implementation opportunities and prompt critique.
3. Run `bun run beep lint reflection-artifacts`.
4. Update phase evidence and use
   `bun run beep goals set-status turborepo-quality-cache-adoption completed-retained` only once
   completion conditions hold, in the final implementation PR.
5. Regenerate/check the goal index and preserve exploration links. Completion
   of this goal alone does not establish the whole cache program's completion.

## Rollback and resume

Use SPEC's rollback at the affected boundary. Record the failed gate, remaining
work and safe resume action. Retain paused state with explicit conditions when
external evidence/authority is missing; do not label that pause complete.


### Executed native input and restoration observations

A retained local-only driver verifies current stable/canary executable digests
and the actual pinned Bun executable, then runs eighteen isolated executions.
Sixteen invariant controls pass: exact restoration and benign/unrelated changes
reuse; declared input, semantic environment, global input and implementation
bytes invalidate. Both description-only changes cause MISS with a changed hash,
recorded as observations rather than a promised optimization. Output bytes
agree after every run. All owned fixtures are removed before the bounded report
is written. Seven matrix rows now link this partial evidence; all real
computation qualification and acceptance statuses remain pending. See
[the observations](research/native-input-controls.json) and
[their reproducible driver](research/native-input-controls.py).


### Actual current-runtime observation

The real collector initially refused the repository-pinned Bun1.4.4 because
its profile domain stopped at1.4.2. The current runtime is now observed with
actual binary, dependency-tree and startup-linker identities. A wrong declared
pin still fails, historical profile keys reject the new snapshot, and binary
changes alter its digest. Both focused runtimes pass45tests; removing the new
support produces the intended schema failure. The fresh430-source population
retains190workspaces/2571computations/1621configured flags. See
[the checkpoint](research/current-runtime-profile-checkpoint.json),
[physical observation](research/current-runtime-profile-observation.json) and
[retained control](research/current-runtime-profile-control.ts).
The frozen committed whole-package replay passes: audit1118.9seconds and
docgen36.4seconds, with source and both goal manifests unchanged. No task is
qualified or enabled by this observation support.


### Real computation input counterexample

The [retained dry observation](research/actual-ignored-input-observation.json)
and [control](research/actual-ignored-input-control.py) show that an ignored
non-workspace manifest changes identity lint's native hash on both pinned
clients. Cleanup restores each baseline. Inspect real wrapper reads, narrow
the metadata boundary where justified, and prove actual lint-output/verdict
equivalence before qualification. These dry plans prove no task result or
speed improvement; the candidate stays disabled.


### Integration after merged parent

PR2352 merged atddcf09b480 and its lane is retired with private proofs retained.
Nine unpublished commits were replayed onto that main revision. All fifteen
owned implementation files are byte-identical to the passing frozen source;
the conformance test also retains the parent's coverage controls. Node and Bun
each pass359tests in18files; quick lint/check pass. The canonical inventory
verifies431source digests and preserves all2571dispositions and130configuration
records. Historical source-bound checkpoints keep their original scope.
The operator clarified that the human credential helper has not yet run;
completion remains pending. Signing and all affected qualification/rollout
gates stay closed.


### Reviewed current-runtime baseline and public observation

The historical Bun 1.4.2 baseline correctly refused a Bun 1.4.4 fingerprint.
The canonical reviewed writer now records Bun 1.4.4 / qualification-v3, stamping
only the root subject and carrying all 188 package reviews. The effective
projection, four-computation scope, cache flags and qualification ledger are
unchanged. The real public fingerprint succeeds under its distinct current
tuple; a stale compare-and-swap request fails without changing baseline or
ledger. Cache audit reports zero blocking findings and 1,621 unassessed cached
computations. See the immutable review and current-runtime baseline checkpoint.
This is observation readiness; qualification and signed rollout remain open.


### Producer capture prerequisite

The [new component checkpoint](../turborepo-cache-trust-observability/research/producer-capture-checkpoint.json)
records native request capture and reviewed full-graph validation. The current
431-source census retains all 2,571 executable dispositions, 130 configuration
records and the unchanged qualification ledger. Input-count/digest observations
are refreshed for this checkout; no semantic review or cache flag is promoted.
Closed producer integration and actual current-computation qualification remain
required before adopting signed reuse.


### Current whole-command fixer review: 2026-10-29

The source-bound review in `research/mutating-fixer-disposition-review.json`
resolves 136 existing source-mutating fixer boundaries as keep-fresh, with
unchanged script-map digests and cache-disabled configuration. Each has a
separate read-only lint counterpart whose qualification/adoption stays open.
Six actual synthetic stable/canary native runs demonstrate the lost mutation
on a logs-only hit and the successful cache-disabled control. At that checkpoint, the other 2,435 population dispositions, current feature
review and all acceptance criteria remained incomplete. No cache flags or qualification ledger entries changed.


### Current persistent service review

`research/persistent-service-disposition-review.json` resolves the two directly
declared OIP Web/Todox development services as keep-fresh. Their app/dependency
builds remain separate unfinished computations. There are now 138 source-reviewed
whole-command keep-fresh dispositions and 2,433 remaining disposition gaps. No
service was launched; all feature/runtime qualification and full-goal acceptance
requirements remain open.


### Complete current lint-fixer source classification: 2026-10-29

The additional source-bound review in
`research/remaining-mutating-fixer-disposition-review.json` covers the 50
remaining `lint:fix` rows, including Storybook's cross-workspace source writes.
All 186 current lint-fixer commands remain fresh, as do the two already
reviewed persistent services. There are 2,383 final-disposition gaps; the 186
separate read-only lint computations remain unqualified. This is source
classification with unchanged configuration, not runtime or adoption proof.


### Complete current persistent-service classification: 2026-10-29

`research/remaining-persistent-service-disposition-review.json` reviews ten
more exact Portless commands: Bun watchers, Vite development, Storybook
development and Vite preview. All twelve configured persistent executable
computations now have source-bound keep-fresh dispositions. Finite build
counterparts remain unfinished. At that checkpoint the total was 198 reviewed fresh
boundaries with 2,373 final-disposition gaps; no service was launched.


### External verdict and generator boundary review

The current `repo-sanity:bun-audit` command reads current vulnerability data and
selects clock-expiring exceptions, so its whole-command verdict stays fresh.
The source-bound review changes one population row, bringing the reviewed fresh
boundaries to 199 with 2,372 final-disposition gaps. Its separate pure policy
prerequisite remains unqualified. The nine configured code generators now have
source-reviewed write behavior and explicit pure rendering/check candidates;
this grants no final exclusion or reuse. No generator was executed and no
cache flag, qualification state or production runtime changed. See
[the external review](research/external-verdict-source-review.json) and
[the generator review](research/generator-boundary-source-review.json).
### Go workspace feature disposition

The accepted-source census at dcca confirms zero Go files/modules/root workspace
and zero direct Go build/module invocations across 4,544 tracked manifest
scripts. This count includes fixtures and is not the computation census. Both
pinned native identities were rechecked; the stable schema defaults the Go flag
to false. The absent root setting remains unchanged.

Record one accepted-not-applicable feature with an explicit reopening trigger
in [the review](research/go-workspace-feature-review.json). The remaining 34
feature entries and all nine complete acceptance criteria remain unfinished.
No Cargo/Python exclusion, task qualification, cache enablement or speedup is
implied by this source review.


Both pinned native clients accept false and true for all 14 future flags in the
isolated dry-run profile. Two baseline and two unknown-key controls complete
the 60-case observation, with no sentinel command executed. The
[native availability report](research/native-future-flag-availability.json)
separates this parsing evidence from unresolved feature-specific semantics.
The one Go non-applicability disposition is unchanged; the remaining 34 reviews
are still pending. No repository task, cache setting or production flag changed.


### Reproducible native availability review repair, 2026-10-30

PR #2369 now retains the portable sixty-case driver, its exact source digest,
the raw-report digest and the reproduction command. A fresh replay preserves
the same native pins, fourteen flags, 58 accepted configurations and two
unknown-key refusals. The marker never executes and owned fixtures are removed.
This repairs evidence retention; all unfinished feature, computation,
qualification, adoption and production-window obligations remain unchanged.


### Revalidated older driver bindings, 2026-10-30

The evidence audit also found stale driver digests on the older native input
and real ignored-input reports. Replays from their retained files preserve all
eighteen synthetic outcomes and both real dry-only invalidation/restore results.
The current reports now bind the actual driver bytes. This repairs source
provenance; current feature acceptance, computation qualification and all
production obligations remain separately open.

### Replay binding repair, 2026-10-30

Both retained input drivers generate the path/digest binding in their reports.
Fresh output reproduces eighteen synthetic executions and six real dry plans;
tracked JSON is copied unchanged from that output. Current committed-head
publication, final proof and hosted acceptance remain required for this repair.

### Publication identity repair, 2026-10-30

The feature-report publication exposed an attribution gap between the initial
attempt head and the commit created during that run. The existing verdict now
has a separate optional publication identity. Both publication paths capture
the prepared commit before proof and check it around the push. Real local Git
fixtures and guard-removal controls verify successful publication, proof-time
head drift, push-time head drift, failed pushes and plans without Git pushes.
The prove-first route now has direct success and proof-time drift cases on the
same fixture. Moving its capture after proof fails the new regression case in
both runtimes; the source is restored exactly after each control. Current
focused proof has 195 passing cases per runtime. The prior source passed
complete package/final checks; current final/hosted acceptance and review remain
required after this test-seam repair. This component does not qualify or activate
any computation, cache epoch or producer profile.


### Task descriptions review, 2026-10-30

The [final current-tree review](research/task-descriptions-feature-review.json)
retains absent optional descriptions: the current canonical census finds none
in 101 explicit definitions across 22 config files and 190 workspaces. Both
pinned clients include raw `turbo.json` in task inputs while excluding this field
from the resolved task definition. The retained native driver now asserts 22
cases, including six add/edit/remove controls and exact restored-hash reuse.
A no-op edit control fails its intended assertion and optimized Python is refused.

This supersedes the older eighteen-case observation with current bound output;
the earlier report remains in Git history. There are two final feature decisions
and 33 pending reviews. No real computation is qualified or enabled, no semantic
input is dropped, and every full-goal acceptance remains unproven.

### Asserted native selection semantics, 2026-10-30

The retained [selection driver](research/native-selection-controls.py) passes
44 cases across stable/canary and strict false/true: 88 dry/execution calls,
with actual native summaries and output markers. Eight cases have a real
selected execution; sixteen zero exits do not. Twenty native refusals match
the intended task/package/path/selector error. Two driver-integrity controls
refuse optimized Python and catch removal of the strict toggle, then restore
the source exactly and replay every case.
The [checkpoint](research/selection-semantics-checkpoint.json) records source,
pins, scope and remaining real-consumer work. Feature dispositions stay at two
final and 33 pending; no task qualification or configuration change occurs.

### Nested Python integration review, 2026-10-30

The [source-backed review](research/python-workspace-feature-review.json)
retains absent root uv discovery while accounting for the existing nested
`beep-photo-face` project. Its lint/test commands already run in the Beep CLI
package audit. No root uv workspace exists, no new graph consumer is enabled,
and the retained four native flag cases establish syntax only.

There are now three final no-change feature decisions and 32 pending reviews.
Python computation decomposition and qualification remain open, with every
full-goal acceptance still unproven. No generated script or runtime setting
changed; final combined hosted proof remains required.

### External-security whole-task review, 2026-10-30

The [audit boundary review](research/external-security-disposition-review.json)
records one existing root task as keep-fresh: current advisory information and
expiry-sensitive OSV policy cannot reuse a tree-exact security result. Existing
Turbo cache exclusion and local proof exclusion stay in place. No audit was
executed and no security verdict or pure slice is qualified by this review.

There are now 199 source-reviewed whole-task keep-fresh dispositions and 2372
remaining final-disposition gaps. Three feature decisions are final and 32
remain pending. Every full-goal acceptance criterion remains unproven.
### Markdown coverage resource boundary, 2026-10-30

The new [source-bound checkpoint](research/markdown-coverage-isolation-checkpoint.json)
retains a root proof's missing default branches, the unchanged-source attribution,
standalone controls, the package's explicit test-file isolation and its measured
cost. Node and Bun each pass 4,501 existing tests with full parser coverage, and
default package verification passes. This is a verification-reliability component;
current final/hosted/review/merge proof and the full adoption goal remain open.

### Accepted feature evidence joined to producer work

`research/accepted-feature-merge-checkpoint.json` records the accepted feature
commit, both retained source-review paths and the unique-computation counter
check. All branch additions and prior SPEC provenance are retained; the same
external audit remains one computation. Current combined proof and every
qualification, rollout, observation and full-goal requirement remain unfinished.


### Cargo discovery disposition, 2026-10-31

The source-bound Cargo review retains the absent root discovery flag. Four
current-source exact-client contrasts preserve the ninety-node prerequisite
graph; eight synthetic graph cases and sixteen runtime controls pass. Both
drivers refuse optimized Python that would remove assertions. See
[the review](research/cargo-workspace-feature-review.json).

Four feature decisions are now final current-tree no-change decisions; the other
thirty-one feature reviews remain pending. The 199 fresh whole-command
dispositions and 2,372 gaps are retained from their existing source snapshot,
not refreshed or requalified here. No phase or whole-goal criterion is completed.


### Current signed-worker diagnostic, 2026-10-31

The trust owner's [worker observation](../turborepo-cache-trust-observability/research/normal-source-worker-observation.json)
retains a full stable-client matrix on accepted source without worker or native
launch changes. Its outer diagnostic caller differs from the ordinary CLI,
whose corrected attempts still failed. This narrows the investigation but
qualifies or adopts no computation. Current-canary CLI proof, protected R2
publication, all remaining feature/disposition work and real windows stay open.
The credential bootstrap is independently verified; do not repeat the older
pending human-credential request.
