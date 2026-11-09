# Phase 2: per-area audits

Twelve areas, two independent seats each, briefed by [`BRIEF.md`](./BRIEF.md) (the operator's rulings, the
read-only rules, the per-lever deliverable and the ranking rule) and by the phase 1 inventory under
[`../phase1/`](../phase1/). Neither seat saw the other's output.

| Area | Opus 5.5 (medium) | GPT-6 Astra (high) |
| --- | --- | --- |
| A yeet pipeline | [opus/yeet-pipeline.md](./opus/yeet-pipeline.md) | [astra/yeet-pipeline.md](./astra/yeet-pipeline.md) |
| B coverage | [opus/coverage.md](./opus/coverage.md) | [astra/coverage.md](./astra/coverage.md) |
| C hosted CI | [opus/hosted-ci.md](./opus/hosted-ci.md) | [astra/hosted-ci.md](./astra/hosted-ci.md) |
| D Turbo | [opus/turbo.md](./opus/turbo.md) | [astra/turbo.md](./astra/turbo.md) |
| E lint, laws, knowledge | [opus/lint-laws-knowledge.md](./opus/lint-laws-knowledge.md) | [astra/lint-laws-knowledge.md](./astra/lint-laws-knowledge.md) |
| F tests | [opus/tests.md](./opus/tests.md) | [astra/tests.md](./astra/tests.md) |
| G scheduler | [opus/scheduler.md](./opus/scheduler.md) | [astra/scheduler.md](./astra/scheduler.md) |
| H deps and toolchain | [opus/deps-toolchain.md](./opus/deps-toolchain.md) | [astra/deps-toolchain.md](./astra/deps-toolchain.md) |
| I routing | [opus/routing.md](./opus/routing.md) | [astra/routing.md](./astra/routing.md) |
| J measurement | [opus/measurement.md](./opus/measurement.md) | [astra/measurement.md](./astra/measurement.md) |
| L1 peripheral hosted | [opus/peripheral-hosted.md](./opus/peripheral-hosted.md) | [astra/peripheral-hosted.md](./astra/peripheral-hosted.md) |
| L2 peripheral local | [opus/peripheral-local.md](./opus/peripheral-local.md) | [astra/peripheral-local.md](./astra/peripheral-local.md) |

The Opus reports are rendered from the auditors' structured output; the Astra reports are the seats' own
Markdown with home paths rewritten to `~` and session identifiers removed. The Astra seats' raw evidence
dumps (hosted job logs, dry-run JSON) stay out of the repository. The merged, refuted and ranked plan is
[`PLAN.md`](./PLAN.md) once phase 2b lands.
