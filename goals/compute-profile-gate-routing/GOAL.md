# GOAL: Compute-Profile Gate Routing

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Compute-Profile Gate Routing (graduated from explorations/compute-profile-gate-routing).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/compute-profile-gate-routing/README.md`
- `goals/compute-profile-gate-routing/SPEC.md`
- `goals/compute-profile-gate-routing/PLAN.md`
- `goals/compute-profile-gate-routing/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/tooling/tool/cli/src/internal/repo-run/**`, `packages/tooling/tool/cli/src/commands/Yeet/**`, a NET-NEW profile probe subcommand of the repo CLI, `lefthook.yml`, `.github/workflows/catalog-regeneration.yml`, `AGENTS.md` Quality Operator, `docs/runbooks/agent-pools.md`, `.claude/skills/remote-development-agents/SKILL.md`, `.claude/skills/yeet/references/gates-and-proof.md`, Palantiri host-pressure.
- Out: the catalog writer internals (goal `catalog-writer-incremental`), hosted heavy admission, dankserver provisioning, workstation hook behavior.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/compute-profile-gate-routing/GOAL.md)" -le 4000
jq . goals/compute-profile-gate-routing/ops/manifest.json
git diff --check -- goals/compute-profile-gate-routing
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug compute-profile-gate-routing` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/compute-profile-gate-routing/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
