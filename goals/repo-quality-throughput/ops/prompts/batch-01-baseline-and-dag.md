# Batch 1 Prompt: Baseline And Graph

You are one of six read-only agents for
this `beep-effect` checkout.

## Mission

Map the current End-to-End Green lane and collect source-backed baseline
evidence before any implementation. Do not edit files. Return the report in
your final response; the orchestrator will persist it to the assigned
`research/batch-01-<lane>.md` path. Do not run formatters, codegen, or full slow
quality commands unless your assigned lane cannot be answered otherwise.

Read first:

- `AGENTS.md`
- `goals/repo-quality-throughput/SPEC.md`
- `goals/repo-quality-throughput/research/known-findings.md`
- `goals/repo-quality-throughput/tasks/tasks.jsonc`
- `goals/repo-quality-acceleration/history/outputs/phase0-synthesis.md`

## Lanes

Assign one lane per agent:

1. `quality-command-map`: root scripts, repo-cli quality commands, Yeet, hooks,
   and CI command equivalence.
2. `timing-baseline`: local focused timing evidence plus recent GitHub Actions
   job/step timing.
3. `turbo-dag-cache`: Turbo tasks, cacheability, inputs, outputs,
   `--affected`, package configs, remote/local cache, hash blast radius.
4. `duplicate-proof-work`: repeated checks across Yeet, pre-commit,
   pre-push, push, PR, and local full proof.
5. `docgen-cost-model`: package docgen, examples typecheck, aggregation,
   affected/local/full modes, and worker/resource behavior.
6. `config-inventory`: every relevant config/tooling file and its possible
   effect on quality performance.

Every lane must call out whether it touches coverage, repo-sanity, build,
integration tests, security/Nix/SAST, hooks, release/data-sync side workflows,
or Turbo launcher overhead. If one of those is outside your lane, say which
later lane should own it.

Do not repeat known findings unless you verify current source has regressed or
you can convert the finding into a sharper implementation task.

## Report Shape

Return a report intended for `research/batch-01-<lane>.md` with:

```md
# Batch 1: <Lane>

## Measured Facts

## Source-Backed Observations

## Duplicate Or Stale Findings Avoided

## Candidate Tasks

| Rank | Task | Expected Impact | Risk | Proof |
| --- | --- | --- | --- | --- |

## Do Not Do

## Open Questions
```

Every candidate must name evidence, likely write scope, proof command, and
rollback posture.

Use Turbo `--dry-run=json` without `--summarize` in this read-only lane unless
the orchestrator explicitly permits writing `.turbo/runs` artifacts.
