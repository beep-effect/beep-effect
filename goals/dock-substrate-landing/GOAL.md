# GOAL: Land the dock substrate — @beep/dock, @beep/dock-react, desktop shell

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the scratchpad dock system ships as `@beep/dock` +
`@beep/dock-react` under `packages/foundation/ui-system/`, and the dock
workspace is the root shell of `apps/professional-desktop`, QA'd to green.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/dock-substrate-landing/README.md`
- `goals/dock-substrate-landing/SPEC.md`
- `goals/dock-substrate-landing/PLAN.md`
- `goals/dock-substrate-landing/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/foundation/ui-system/dock`,
  `packages/foundation/ui-system/dock-react`,
  `packages/foundation/modeling/identity/src/packages.ts` (composer entries),
  `standards/ARCHITECTURE.md` + `standards/architecture/{DECISIONS,GLOSSARY,07-non-slice-families}.md`
  (the ratified ui-system→drivers edits only), `scratchpad/dockview*`
  (rewire demo; delete kernel/adapter modules at M2),
  `apps/professional-desktop` (M3 shell revamp), `apps/storybook`
  (dep + story discovery), generated registration files
  (root tsconfigs, fallow boundaries, jsdoc/schema inventories, goals INDEX),
  `explorations/computable-workspace-geometry` (Trail/MAP/manifest),
  this packet.
- Out: new kernel features (drop indicators, tab overflow, popouts, max
  constraints, LayoutPriority, snap-to-collapse, a11y — stay in residue);
  `goals/professional-desktop-adversarial-qa` (separate packet); chat surface
  internals beyond panel hosting; any server/sidecar behavior.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md` for the active milestone.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status as milestones land.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied for each milestone.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/dock-substrate-landing/GOAL.md)" -le 4000
jq . goals/dock-substrate-landing/ops/manifest.json
git diff --check -- goals/dock-substrate-landing
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
