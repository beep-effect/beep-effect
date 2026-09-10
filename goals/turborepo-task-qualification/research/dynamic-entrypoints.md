# Dynamic CI entrypoints and planner context

Observed 2026-09-09. This source review extends the first static planner
snapshot. It grants no task, lane-proof or hosted-status qualification.

## Reproducible planner snapshots

The v2 recipe uses the existing `QualityTaskStep` schema, retaining explicit
environment maps and execution options. The first snapshot's smaller step
schema omitted environment values, including the property-test seed and run
count. Both complete CI descriptors and the options supplied to each planner
are now retained.

Quality lanes also use the existing `GithubCheckLaneSpec` model. It preserves
dependency lists and optional ordering estimates. All 78 lane records in each
current context have empty dependency lists and no ordering estimate; the
snapshot does not invent runtime ordering data when the planner supplies none.

Run from the checkout root with automatic dotenv loading disabled:

```sh
env -i PATH="$PATH" HOME=/nonexistent \
  bun --no-env-file goals/turborepo-task-qualification/research/refresh-entrypoint-plans.ts
env -i PATH="$PATH" HOME=/nonexistent CI=true GITHUB_ACTIONS=true \
  bun --no-env-file goals/turborepo-task-qualification/research/refresh-entrypoint-plans.ts
```

The [local snapshot](./entrypoint-plans.json) and
[hosted-context snapshot](./entrypoint-plans-hosted.json) each contain 69 CI
plans, nine Quality mode plans, 15 partition argument plans, four local
dispatch shapes, four Docgen selector examples and three Doctest dispatch
examples. The hosted-context snapshot was generated locally. It is not a
GitHub execution or evidence of deployed credential posture.

The property lane's default environment is `BEEP_FC_NUM_RUNS=400` and
`BEEP_FC_SEED=20260708`. The explicit variant changes those to `250` and `12345`.
The affected variant also supplies `TURBO_SCM_BASE=origin/main`.
Default Check concurrency differs between the clean contexts: three locally,
two with `GITHUB_ACTIONS=true`. These values participate in the computation or
orchestration worksheet; an unchanged lane name cannot erase them.

## Branches reviewed in live source

| Branch | Selection and execution | Inputs, writes and authority |
| --- | --- | --- |
| Partitioned Lint and Test Unit | Select through Turbo `--only --dry-run=json`, optionally affected, then intersect with the committed partition. Execution uses explicit package-qualified task names, `--only`, package filters and concurrency two. | Current manifests, partition table, Turbo dry selection and Git base are inputs. Invalid partition assignments and a simultaneous `--filter` are rejected. Dry proof and an empty intersection execute no tasks. Snapshot package lists describe the table; the recipe does not execute the intersection proof. |
| Automatic Docgen | `git diff --name-only base...head` selects `none`, `affected` or `full`; global tool/config inputs force full. | Git range, changed paths and selector source affect scope. An inert change can select no work. The requested `auto` option must not be counted as the unresolved static planner's empty list. |
| Affected Doctest | Read changed and tracked source/manifest paths, recover deleted package names from the merge-base revision, expand dependents and retain existing sources containing `import.meta.vitest`. | Current and historical manifests, dependency edges, Git objects, file existence and source content affect selection. Failed historical manifest reads are reported and skipped. No marked files means no execution. The illustrative snapshot path is not a claim that the real file contains a doctest. |
| Fallow | Run every blocking and advisory sublane, record status and timing, verify nonempty blocking envelopes, optionally validate envelope schemas, then combine blocking exit codes. | Writes `.beep/fallow/status.md` and report/envelope files. Elapsed seconds are observed timing. Advisory exit codes do not become blocking failures. A generic list of planned commands omits these interpreter checks and writes. |
| Local CI dispatch | Build the dispatch argv from affected/full scope and whether the branch is `main`. | Pull-request-style repo-sanity includes changeset status; `main` omits it. Docgen and Doctest dispatch modes change with affected scope. A runtime-selected lane subset remains distinct from the all-lanes snapshot. |
| Heavy workflow | Its shell wrapper supplies event-dependent shape flags and runs lane commands in a separate process group, then reaps remaining group members. | Pull requests use base-relative affected scope, automatic Docgen and a gate-selected Doctest mode. Other events use full documentation modes. The wrapper owns lifecycle and cleanup behavior outside the cached task. |
| PR size labeling | Inline GitHub script paginates pull-request files and adds a size label. | Live GitHub input and a remote label mutation. Its descriptor has no local replay; it is not a missing package script or a cacheable quality verdict. |
| Dependency review | Read GitHub dependency-graph availability, then invoke the pinned dependency-review action when enabled. | A failed API command fails the gate. Explicitly disabled or unavailable status skips that action; OSV remains a separate step. Source inspection of this branch cannot assert that dependency review actually ran or that the live API returned enabled. |

These branches are implemented in `CiLane.ts`, `CiLanePartitions.ts`,
`check.yml` and `heavy.yml`. The companion
[source receipt](./dynamic-entrypoints-checkpoint.json) binds the inspected
files and both generated snapshots.

The checked-in parent workflow invokes `heavy.yml@main`. A local `heavy.yml`
snapshot cannot establish the reusable workflow SHA that a hosted run resolved.
Exact workflow-run provenance remains a required hosted boundary, with its
existing owner. No external workflow, cache endpoint or secret was accessed
for this review.

## Remaining census work

Integrate these branch records and the [Quality/Yeet review](./quality-yeet-entrypoints.md)
into the operational census, and inspect the remaining workflow shell/action boundaries.
Runtime observations must still establish reads, writes, capture safety and
external verdicts for a candidate. All reviewed branch descriptions remain
source evidence until the relevant interpreter and execution receipts exist.
