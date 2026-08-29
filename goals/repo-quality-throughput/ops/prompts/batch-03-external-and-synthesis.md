# Batch 3 Prompt: External Prior Art And Synthesis

You are one of six agents for
this `beep-effect` checkout.

## Mission

Compare prior art and finish the ranked implementation inventory. All Batch 3
research agents are read-only and return reports in their final responses; the
orchestrator persists them to the assigned `research/batch-03-<lane>.md` paths.
The orchestrator owns any later synthesis writes to `tasks/tasks.jsonc` or task
briefs after all agent reports are collected.

Read first:

- `AGENTS.md`
- `goals/repo-quality-throughput/SPEC.md`
- `goals/repo-quality-throughput/tasks/tasks.jsonc`
- Batch 1 and Batch 2 reports.
- `goals/repo-quality-throughput/history/outputs/research-synthesis.md`.
- `.repos/effect-v4/packages/tools` for Effect v4 prior art.
- Official docs for any external tool being recommended.

## Lanes

Assign one lane per agent:

1. `effect-v4-tools`: inspect Effect v4 `packages/tools` for bundle, OXC,
   jsdocs, generator, and orchestration patterns that could transfer safely.
2. `tooling-candidates`: evaluate Rollup, Rspack, OXC, Bun, tsgo, Vitest,
   Turbo, and related tooling for drop-in or isolated performance wins.
3. `docgen-selectivity-shadow`: design package fingerprinting and
   symbol/example selectivity shadow mode with full-proof fallback.
4. `scoped-config-design`: design hybrid root/package config strategy for
   Turbo, Biome, and related tools with blast-radius proof.
5. `yeet-fast-monitor`: define Yeet fast-plus-monitor default, explicit full
   proof command, duplicated wait removal, and PR check monitoring.
6. `synthesis`: merge all findings into `tasks/tasks.jsonc`, preserving
   evidence, rank, proof, rollback, and deferred/rejected tasks.

## Report Shape

Non-synthesis agents return reports intended for `research/batch-03-<lane>.md`:

```md
# Batch 3: <Lane>

## Findings

## Evidence

## Recommended Tasks

| Rank | Task | Expected Impact | Risk | Proof | Rollback |
| --- | --- | --- | --- | --- | --- |

## Rejected Ideas

## Open Questions
```

The synthesis agent returns content intended for `research/batch-03-synthesis.md`
with:

```md
# Batch 3: Synthesis

## Ranking Method

## Selected Current-PR Tasks

## Deferred Tasks

## Rejected Tasks

## Before/After Proof Plan
```

Do not select a task for implementation unless it has a proof command and a
rollback plan. Do not keep a task selected unless it satisfies the substantial
benefit bar in `SPEC.md`. The orchestrator applies any task inventory edits
after reviewing all Batch 3 reports.

Use Turbo `--dry-run=json` without `--summarize` in read-only lanes unless the
orchestrator explicitly permits writing `.turbo/runs` artifacts.
