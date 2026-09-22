# Hosted workflow boundaries

Source-only review at `9480eaf486`. Reproduce the projection with
`python goals/turborepo-task-qualification/research/refresh-workflow-boundaries.py`.
The recipe first verifies every retained workflow/action source digest against
the checkout. It then projects references, job dependencies, conditions and
matrices from the previously parsed source snapshot. It does not evaluate
GitHub expressions, resolve remote source or execute jobs.

The ten workflow/action files declare 27 jobs, including five matrix jobs.
There are 77 `uses` occurrences and 21 distinct references: one local composite
action, nineteen commit-pinned remote references, and one mutable reusable
workflow reference. These counts include release and maintenance workflows;
they are not a count of required quality checks or executed matrix instances.
The exact membership is in `workflow-boundaries.json`.

## Authority boundaries

- `check.yml` calls `beep-effect/beep-effect/.github/workflows/heavy.yml@main`.
  The local `heavy.yml` file is useful source context, but its bytes cannot prove
  which revision a hosted run resolved. Acceptance needs the actual run's
  resolved workflow revision and result. No workflow pin is changed here.
- Other remote `uses` references carry commit hashes. Those pins identify
  source revisions; they do not inventory the actions' transitive subprocesses,
  downloaded tools or hosted side effects. Their execution and outputs retain
  their existing proof owners.
- Five matrix declarations and step conditions are retained as unevaluated
  source. Changed-file lane gates, event type, runner context and prior step
  outputs affect actual work. A skipped lane's successful wrapper is not an
  executed package computation.
- The `Lint` and `Test Unit` aggregate jobs run with `always()` and require the
  corresponding shard job result to equal `success`. Those aggregation verdicts
  depend on hosted job state and remain separate from individual task reuse.
- The local setup action distinguishes Bun dependency caching, local Turbo
  archive restoration/saving and configured remote-cache posture. Its local
  Turbo restore/save conditions inspect requested caching and missing remote
  credential fields. An actions/cache result is a different reuse layer from
  a verified Turbo task result and from required hosted proof.
- The reusable workflow passes inherited secrets. This review retains source
  declarations only and neither resolves secret values nor asserts deployed
  access or trust posture.

Remaining acceptance: resolve the actual hosted workflow/action executions,
attribute conditional selection and failures, and obtain required final-head
statuses through Yeet. This projection narrows the source inventory obligation;
it does not discharge runtime interpretation, remote action review, signature
or hosted-proof obligations. No task or workflow is qualified by it.
