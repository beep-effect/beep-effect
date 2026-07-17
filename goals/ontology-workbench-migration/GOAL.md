# GOAL: Migrate the Ontology workbench into fine-grained dock panels

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the Ontology surface ships as nine dock panels (Explorer, Document,
Graph, Source, Inspector, SPARQL, Validation, Change Log, Worker Metrics)
with a nav-rail panel launcher and a core-cluster default layout, and the
dock gains per-panel min/max constraints, a tab-overflow dropdown, and
drop-indicator split quadrants — each milestone landed as a mergeable PR.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/ontology-workbench-migration/README.md`
- `goals/ontology-workbench-migration/SPEC.md`
- `goals/ontology-workbench-migration/PLAN.md`
- `goals/ontology-workbench-migration/ops/manifest.json`
- `goals/ontology-workbench-migration/research/SOURCES.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the governing standards
named by `SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: `packages/foundation/ui-system/dock`,
  `packages/foundation/ui-system/dock-react` (M1);
  `packages/ontology/ui`, `packages/ontology/client` atom relocation only
  (M2); `apps/professional-desktop` shell/workspace (M3); QA artifacts,
  `.claude/skills/`, packet + product-doc state (M4).
- Out: popout windows, keyboard docking, context menus, feed consumers,
  `LayoutPriority`, snap-to-collapse, snapshot migration machinery, any
  semantic change during M2 extraction, weakening React StrictMode.

Workflow:

1. Inspect referenced files and current repo state; work only the milestone
   named by your operator prompt.
2. Make the smallest change that satisfies `SPEC.md` for that milestone.
3. M2 is zero-behavior: extraction only; a needed semantic change is a stop
   condition — report it.
4. Any pointer-gesture change requires a live-browser pass before review
   sign-off; respect the `pressStartsOnButton` guard pattern
   (`@beep/dock-react` `internal/DropCompiler.ts`).
5. Keep decisions tied to evidence from files, tests, docs, or command
   output; update packet evidence/status when readiness changes.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` milestone evidence plans are satisfied (each claim has its
      named proof: vitest case, Storybook interaction test, fixture decode,
      browser scenario).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ontology-workbench-migration/GOAL.md)" -le 4000
jq . goals/ontology-workbench-migration/ops/manifest.json
git diff --check -- goals/ontology-workbench-migration
```

Stop and report before changing public API beyond SPEC'd additions, schema,
data migration, auth, infra, security behavior, dependencies, lockfiles,
generated files, or destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
