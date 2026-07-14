# Agent Reflection Loop Plan

## Status

Status: `completed-retained` — P1 complete; P2 and P3 descoped.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Survey the frontier of reflection in agentic coding. | Cited report in `research/`. |
| P1 Goal-closeout reflection system | complete | Topology + `ReflectionFrontmatter` schema + advisory/enforcement lint rule + `/reflect` skill. | Rule routes + runs (`blocking_findings=0`); template + README + skill landed; focused test green. |
| P2 Yeet self-healing reflection | won't-do | `failure→reflect→repair` bound to Yeet `closeout`/a `yeet reflect` step, grounded in `QualityIssue`s. | Reopen only after a packet closes without usable reflections. |
| P3 Memory consolidation | won't-do | Distill reflections into the current durable-memory architecture. | Reopen only after a packet closes without usable reflections. |

## P1 Checklist

- [x] `_template/history/reflections/{.gitkeep,_TEMPLATE.md}`.
- [x] `goals/README.md` File Roles row + `_template` PLAN/GOAL/manifest wiring (`reflectionRequired: true`).
- [x] `Lint/ReflectionArtifact.ts` — `ReflectionConfidence`/`ReflectionTrigger`/`ReflectionFindingCategory` (LiteralKit), `ReflectionFinding`/`ReflectionFrontmatter`, frontmatter decoder, runner.
- [x] Route the subcommand: `Lint.command.ts` + `Quality/Tasks.ts` (`LintPolicySubcommand` + composite step) + `bin-main.ts` (`LINT_POLICY_SUBCOMMANDS`).
- [x] `commands/Yeet/internal/QualityIssueIndex.ts` — `reflection-artifact-compliance` category + routing to the `reflect` skill.
- [x] `.claude/skills/reflect/SKILL.md`.
- [x] `test/reflection-lint.test.ts`.
- [x] `standards/architecture/GLOSSARY.md` reflection entry.
- [x] Dogfood: this packet's own `history/reflections/2026-06-09-claude.md`.

## P3 Closeout Checklist

See `_template/PLAN.md`. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
`/reflect`; `bun run beep lint reflection-artifacts` must pass (this packet is
`reflectionRequired: true`).

## Verification Commands

```sh
bunx tsgo -b packages/tooling/tool/cli/tsconfig.json
bun run beep lint reflection-artifacts
bunx vitest run packages/tooling/tool/cli/test/reflection-lint.test.ts
test "$(wc -m < goals/agent-reflection-loop/GOAL.md)" -le 4000
jq . goals/agent-reflection-loop/ops/manifest.json
```
