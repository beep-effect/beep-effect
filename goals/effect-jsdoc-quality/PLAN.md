# Effect-level JSDoc Quality Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Orient on SPEC + exploration packet; verify the cited baselines still hold (inventory rule chassis, docgen harvest points, pattern-doc line numbers). | Facts confirmed or drift recorded; no re-mining of Effect. |
| P1 Law + skill | pending | Rewrite `.patterns/jsdoc-documentation.md` (sections, carrier, kind-split, described-@see, @remarks retirement, tag-order rework) + `jsdoc-annotation-specialist` skill; hygiene fixes (tsdoc.json, line-848 bug, stale skill paths). | Law and skill teach the new grammar with worked exemplars; hygiene landed. |
| P2 Tooling | pending | New inventory rules (section shape, When-to-use prefix, titled unique single-fence Examples, loose-fence ban, described-@see, no-@remarks-in-new-work, kind-aware Example presence) + docgen section-fence harvesting feeding the tsc gate; fold new codes into the regression baseline. | `bun run beep quality jsdoc-inventory` + docgen green with new rules active and baselined. |
| P3 Pilot | pending | Convert `foundation/modeling/schema` + one tooling package + one law-practice values slice to full section style; capture before/after WebStorm hover screenshots to `history/outputs/`. | Pilot green across inventory/docgen/check battery; screenshots recorded; SPEC acceptance boxes checked. |
| P4 Close | pending | Yeet PR(s) to mergeable, closeout reflection, packet status flip. | Packet status and evidence updated; a closeout reflection exists. |

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` / `complete`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Decisions are fixed (exploration `DECISIONS.md` 2026-07-30); do not reopen
  carrier/enforcement/kind-split questions — implement them.
- P1 and P2 may land as separate PRs or one; P3 should be its own PR so pilot
  churn reviews independently of tooling.
- Fence-aware parsing: reuse/extend docgen's `extractFencedCodeBlocks` rather
  than writing a second fence parser in the inventory (single source of truth
  for "what is a fence").
- The user edits the tree in parallel: stage explicit paths only.
- Preserve unrelated worktree changes; archive run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/effect-jsdoc-quality/GOAL.md)" -le 4000
jq . goals/effect-jsdoc-quality/ops/manifest.json
rg -n "effect-jsdoc-quality|GOAL.md|agentLaunchers|packetAnchorDocument" goals/effect-jsdoc-quality
git diff --check -- goals/effect-jsdoc-quality
bun run beep lint reflection-artifacts
```
