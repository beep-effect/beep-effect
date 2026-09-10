# Entrypoint source review after main integration

This snapshot supersedes the earlier source attachment for the merged
checkout. It records source identity and illustrative planner decisions,
not executions, hosted verdicts, exhaustive interpreter coverage or cache
qualification. Earlier snapshots retain the bytes and claims they recorded.

The complete CI/Quality documents retain 69 lane plans, nine Quality modes,
15 partition plans, four local dispatch examples, four docgen selections and
three doctest selections in each context. The complete Yeet documents retain
30 illustrative plans and three example hardware profiles per context.
Both local and hosted-context recipes ran with explicit clean environments;
the hosted-context environment is planner input, not a hosted execution.

The workflow snapshot retains all nine workflows and the composite setup
action. There are 28 job definitions and 164 step definitions, compared with
171 steps in the historical snapshot. Complete shell bodies, expressions,
matrix definitions, permission declarations and action references remain in
the decoded documents. Remote action implementations and expanded runtime
matrix behavior retain their existing proof owners.

The manifest grouping now has 32 exact executable command groups and 72
implementation-wrapper groups. The population and script changes are
attributed in [the baseline review](./post-merge-baseline-review.md).
Identity's task is the generated `bun run beep:lint` wrapper, backed by the
quiet implementation; the new wrapper needs its own runtime qualification.

The attachment must verify every current census source, all referenced
planner/interpreter/recipe files, the six complete snapshot byte digests and
this review. Required JSON document families stay distinct. The source
attachment preserves unknown producer fields and existing unresolved
obligations. No source count becomes an execution, shadow or remote-hit count.

To reproduce, run the recipes through installed Bun 1.4.2 with a clean
environment (`HOME=/nonexistent`, `PATH` containing the selected runtime and
system tools, and no ambient environment). For hosted-context planner inputs,
add only `CI=true GITHUB_ACTIONS=true`. Use these output names:

- `refresh-entrypoint-plans.ts`: `entrypoint-plans-post-merge.json` and
  `entrypoint-plans-hosted-post-merge.json`.
- `refresh-yeet-plans.ts`: `yeet-plans-post-merge.json` and
  `yeet-plans-hosted-post-merge.json`.
- `refresh-workflow-sources.ts`: `workflow-sources-post-merge.json`.
- `refresh-command-groups.py <fresh-census-path> --output
  goals/turborepo-task-qualification/research/command-groups-post-merge.json`.

The workflow recipe now accepts an output name, and the attachment recipe
accepts a snapshot suffix, output request name and replacement authored review.
After creating a fresh census with `beep cache census --output <path>`, run:

```sh
mise exec bun@1.4.2 -- bun --no-env-file \
  goals/turborepo-task-qualification/research/refresh-entrypoint-review.ts \
  .beep/qualification-local-preflight/census-post-merge.json \
  post-merge post-merge-entrypoint-request.json post-merge-entrypoint-review.md
mise exec bun@1.4.2 -- bun run beep cache census \
  --entrypoint-review goals/turborepo-task-qualification/research/post-merge-entrypoint-request.json \
  --output .beep/qualification-local-preflight/census-post-merge-attached.json
```

These recipes produce no planned task executions. Candidate read/write sets,
log safety, signed comparisons, runtime shadow decisions and final hosted
acceptance remain separate required evidence.
