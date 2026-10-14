# MCP Kit Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify pinned `effect/ai` internals (SPEC Constraints baseline) and the repo's new-package wiring checklist. | Verified facts recorded ([`history/2026-07-01-p0-verification.md`](./history/2026-07-01-p0-verification.md)); no decision-invalidating drift found. |
| P1 Implement | complete | Scaffold `packages/foundation/capability/mcp-kit` and build the seven SPEC deliverables with fixture/proof tests. | Acceptance criteria are met (seven deliverables, 12 tests, curated barrel, consumer-plan README). |
| P2 Verify | complete | Run required checks and capture evidence. | `bun run beep yeet verify` green on all lanes except (a) `changeset-status`, red only while the changeset is uncommitted, and (b) a pre-existing `@beep/schema` identifier-rendering test regression, attributed unrelated and recorded in [`history/2026-07-01-unrelated-failures.md`](./history/2026-07-01-unrelated-failures.md). |
| P3 Yeet: PR to mergeable | complete | Drive the PR to mergeable via `/yeet`. | [PR #288](https://github.com/beep-effect/beep-effect/pull/288) open and `MERGEABLE`; hosted checks green except three inherited-from-main baseline reds (Build And Test, Lint Policy, Test Unit — all failing on main before this branch; Test Unit's only failure is the recorded pre-existing `@beep/schema` regression). Branch turned Lint, Repo Sanity, and Fallow Advisory Envelopes green relative to main. All 12 bot-review threads fixed or answered. |
| P4 Close | complete | Closeout reflection + packet status updates. | [`history/reflections/2026-07-01-claude.md`](./history/reflections/2026-07-01-claude.md); `bun run beep lint reflection-artifacts` → blocking_findings=0. |

## P3/P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo tooling,
   the implementation, and the goal/prompt. Frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. If the kit landed before its consumer goals, confirm the package README's
   consumer list still reflects reality (SPEC Exception Ledger).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes; if an
  `effect/ai` drift invalidates a resolved decision, stop — the
  decision reopens in the source exploration.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/mcp-kit/GOAL.md)" -le 4000
jq . goals/mcp-kit/ops/manifest.json
rg -n "mcp-kit|GOAL.md|agentLaunchers|packetAnchorDocument" goals/mcp-kit
git diff --check -- goals/mcp-kit
bun run beep lint reflection-artifacts
```
