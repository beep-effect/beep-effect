# MCP Write Wall Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm `@beep/mcp-kit`'s shipped `TierGate`/`SanitizedSpan`/`ToolAnnotations` surface matches this goal's expected call shape; re-verify the four stateful `NlpToolkit` tools' current annotation state and exact file locations; confirm the right site for the mechanical remaining-tool annotations (per-tool files vs `NlpToolkit.ts` assembly); confirm the dispatch-interception seam (`SanitizedSpan.ts:206-223`) still holds. | Kit surface confirmed compatible; tool inventory and annotation-site decision recorded; any drift from `SPEC.md`'s cited `file:line`s corrected here, not silently absorbed. |
| P1 Implement | pending | Annotate `NlpToolkit`'s four stateful tools (judgment) and remaining tools (mechanical); compose `TierGate` at the dispatch seam (extending `sanitizedToolkit` or adding a sibling `@beep/mcp-kit` combinator, per `SPEC.md` Deliverable #2); define the `TierGatePolicy` for `nlp-mcp`; wire log-only audit output. | Acceptance criteria met per `SPEC.md`. |
| P2 Verify | pending | Run required checks and capture evidence. | `bunx tsgo -b`, `biome check`, `bun run beep docgen local` (mcp-kit + nlp-mcp + nlp-processing), and `TURBO_FORCE=1 bunx turbo run check test lint --filter=@beep/mcp-kit --filter=@beep/nlp-mcp --filter=@beep/nlp-processing` all green. New fixture tests (approved + refused paths) pass; existing `nlp-mcp` suites pass unchanged. |
| P3 Yeet: PR to mergeable | pending | Drive to mergeable via `/yeet` (`bun run beep yeet`: repair → verify → publish → monitor), per `goals/README.md`'s completion gate. | PR open and mergeable, or the actual shipping path is recorded honestly if it deviates (see sibling packets' closeout precedent). |
| P4 Close | pending | Write the closeout reflection and final readiness. | Packet status and evidence are updated; a closeout reflection exists; `bun run beep lint reflection-artifacts` passes. |

## P3/P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo tooling,
   the implementation, and the goal/prompt. Frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. Record whether Deliverable #5 (untrusted-context description suffix) was
   folded in or deferred as a named follow-up.
5. Record the actual shipping mechanism honestly if it deviates from the
   declared `completionGate` (see `goals/uspto-mcp/PLAN.md` and
   `goals/mcp-host-retrofit/PLAN.md` for the precedent shape:
   `completionGate.actualOutcome` in the manifest plus a "Closeout deviation
   record" note here).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- P0 must re-verify, not assume, the exact tool file line numbers cited in
  `SPEC.md` and `README.md` — they were captured by a research pass on
  2026-07-02 and may have shifted.
- The four-tool annotation judgment call and the `TierGatePolicy` approval
  decisions are the highest-risk part of this goal — document the actual
  per-tool reasoning in `history/`, not only the resulting code.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/mcp-write-wall/GOAL.md)" -le 4000
jq . goals/mcp-write-wall/ops/manifest.json
rg -n "mcp-write-wall|GOAL.md|agentLaunchers|packetAnchorDocument" goals/mcp-write-wall
git diff --check -- goals/mcp-write-wall
bun run beep yeet verify
```
