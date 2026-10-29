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
