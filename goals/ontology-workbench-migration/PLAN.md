# Ontology Workbench Migration Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Open | complete | Grill-locked SPEC, research capture, packet frame. | SPEC/README/manifest/GOAL/SOURCES exist; grill decisions recorded. |
| P1 M1 dock capabilities | in-progress | Per-panel min/max constraints (kernel); tab-overflow dropdown + drop-indicator quadrants (adapter); Storybook interaction proofs. | Both dock suites + stories green; pre-M1 snapshot fixture decodes; live-browser gesture pass done; PR mergeable via yeet. |
| P2 M2 workbench decomposition | pending | Zero-behavior split of `Session.workbench.tsx` into nine region components; Add-Triple atoms relocate to `Session.atoms.ts`; StrictMode-safe tree host if component-shaped. | ontology-ui + ontology-client suites pass unchanged; `OntologyWorkbench` is composition-only; PR mergeable. |
| P3 M3 shell integration | pending | Nine panel renderers; Document panel; nav-rail panel menu; core-cluster default layout; `desktop:dock-workspace:v2` bump + v1 cleanup; `SurfaceRetry` disposition. | App suite green under `bunx --bun vitest`; default-layout + v2-boot tests pass; PR mergeable. |
| P4 M4 QA + close | pending | Browser QA loop to zero required findings; QA-loop skill graduation; closeout reflection + packet flips. | QA exit criteria met; reflection validates; same-PR state flip lands; PR mergeable. |

## Execution model (locked decision 8)

- codex (gpt-5.6-sol, medium effort) drafts M1 capability code and M2's
  mechanical extraction via codex-companion background lanes; one write-lane
  at a time.
- Fable plans, reviews all drafts, and hand-builds M3's user-facing UI
  (launcher menu, Document panel, default layout).
- M4: playwright capture harness → codex high-effort vision inventory →
  Fable fix rounds → hands-on Chrome verification (see
  `codex-browser-automation` memory for the extension-bridge recipe).
- Live-browser law: any pointer-gesture change gets a live Chrome pass before
  review sign-off (jsdom green ≠ click-works green; respect the
  `pressStartsOnButton` guard pattern in `DropCompiler.ts`).

## P3 Closeout Checklist

Before marking the packet closed (`status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`; regen goals INDEX; add the
   workspace-substrate §7 note and exploration Trail entry — same PR as the
   final work.

## Execution Notes

- Milestone PRs branch off fresh `origin/main`; publish through yeet
  (`repair → verify → publish --message → monitor`), closeout gate
  `--require-greptile-score 5/5 --require-greptile-issues 0
  --require-review-comments 0`; the user calls merge.
- Preserve unrelated worktree changes; keep `SPEC.md` normative.
- Defer goals INDEX regen until after PR #427 (predecessor closeout) merges
  to avoid an INDEX conflict; regen rides in the M1 publish.

## Verification Commands

```sh
test "$(wc -m < goals/ontology-workbench-migration/GOAL.md)" -le 4000
jq . goals/ontology-workbench-migration/ops/manifest.json
rg -n "ontology-workbench-migration|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-workbench-migration
git diff --check -- goals/ontology-workbench-migration
```
