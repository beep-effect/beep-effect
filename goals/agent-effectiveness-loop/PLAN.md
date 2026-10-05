# Agent Effectiveness Loop Plan

## Status

Status: `complete`

All phases closed. This plan is retained as the execution ledger; it is not an
active plan and must not be resumed inside this packet.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Run four artifact-producing research lanes (Phoenix capability map, live Phoenix state audit, repo eval/metrics surface audit, opportunity map) and synthesize a ranked execution plan. | Five artifacts under `research/`; synthesis selected one first slice (2026-05-16). |
| P1 Implement | complete | Ship the local, no-mutation doctor and annotation plan/check loop, then the guarded Phoenix bundle and sync plumbing (Phase 1B). | Seven `beep agent-effectiveness` subcommands in `@beep/repo-cli`, report schemas and privacy checks in `@beep/repo-ai-metrics`. |
| P2 Verify | complete | Prove the loop live and read-only, with privacy checks and CI. | [`history/outputs/phase1-live-proof.md`](./history/outputs/phase1-live-proof.md); annotation privacy checks pass; hosted CI green. |
| P3 Yeet: PR to mergeable | complete | Publish and drive the PRs to mergeable with review threads resolved. | PR #167 and PR #168 merged 2026-05-20; stale #167 threads verified against #168 and resolved. |
| P4 Close | complete | Record the closeout, write the reflection, flip packet state, route deferred tranches to successors. | [`history/outputs/phase1-closeout.md`](./history/outputs/phase1-closeout.md); [`history/reflections/2026-08-29-codex.md`](./history/reflections/2026-08-29-codex.md); status `completed-retained`. |

Phase ids match `ops/manifest.json` `phases[]`.

## Deferred Tranches

The original plan carried Phase 2 (Phoenix-native enrichment) and Phase 3
(repo workflow integration). On 2026-05-20 they were split into
`goals/agent-effectiveness-phoenix-enrichment` and
`goals/agent-effectiveness-workflow-integration`; both were superseded by
`goals/agent-pipeline-velocity` (2026-07-05) and deleted in PR #401
(2026-07-14). The candidate areas, kept here only as the record of what was
deferred:

- datasets and experiments for repo-specific agent tasks;
- evals on traces and deterministic code evaluators;
- prompt/config experiment comparison;
- annotations and failure-mode labels written to Phoenix;
- Phoenix CLI/MCP usage where it improves operator workflows;
- operator workflow, CI/report, runbook, and agent-handoff integration.

Any revival of these must be a new packet (or an amendment to
`coding-agent-effectiveness-evidence-loop`) that preserves the confirmation
gate on Phoenix writes.

## P4 Closeout Checklist

1. [x] Closeout reflection written to
       `history/reflections/2026-08-29-codex.md` (on-demand trigger; frontmatter
       validates against `ReflectionFrontmatter`).
2. [x] `bun run beep lint reflection-artifacts` passes
       (`reflectionRequired: true`).
3. [x] `README.md` status and evidence, and `ops/manifest.json` phase statuses
       and `initiative.status`, updated (last refreshed 2026-10-05).

## Execution Notes

- Every implementation phase named the repo command producing its evidence,
  the Phoenix project or derived report receiving sanitized output, the privacy
  checks proving no raw transcript or private path leakage, the repo quality
  commands for touched packages, and the no-op behavior when Phoenix is
  unavailable.
- Phase 1 completion did not require a live Phoenix mutation; sync stayed
  dry-run by default with an explicit confirmation token for writes.
- Local docgen was skipped during the follow-up loop; hosted CI docgen on the
  final PR #168 head supplied that proof.
- Preserve unrelated worktree changes; keep `SPEC.md` normative.

## Verification Commands

```sh
jq . goals/agent-effectiveness-loop/ops/manifest.json
rg -n "agent-effectiveness-loop|packetAnchorDocument|executionCapable" goals/agent-effectiveness-loop
git diff --check -- goals/agent-effectiveness-loop
bun run beep lint reflection-artifacts
bun run beep goals doctor
```
