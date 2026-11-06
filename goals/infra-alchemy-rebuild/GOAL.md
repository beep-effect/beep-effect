# GOAL: Rebuild beep-effect infrastructure on Alchemy and distilled, Pulumi retired

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: every Pulumi program is replaced by an Alchemy stack (Effect code over alchemy, @alchemy.run/*, @distilled.cloud/*) rebuilt greenfield with one AWS S3 state store, then infra/ and Pulumi are deleted. Decisions D1-D16 in explorations/pulumi-to-alchemy/DECISIONS.md are binding; P0 research gates P1.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/infra-alchemy-rebuild/README.md`
- `goals/infra-alchemy-rebuild/SPEC.md`
- `goals/infra-alchemy-rebuild/PLAN.md`
- `goals/infra-alchemy-rebuild/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: packages/tooling/infra/*, packages/tooling/library/alchemy-*, apps/{oip-web,storybook,beep-effect-web}/alchemy.run.ts, .github/workflows deploy jobs, docs/runbooks, standards/architecture (tooling kind `infra`), root package.json catalog and workspaces, and the deletion of infra/ and scratchpad/turbo-cache-r2.
- Out: ./scripts and the Python ban (sibling packets scripts-to-beep-cli and python-free-repo), GitHub App minting, any hosting-platform or runner-economics change, in-place adoption of live Pulumi resources.

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
test "$(wc -m < goals/infra-alchemy-rebuild/GOAL.md)" -le 4000
jq . goals/infra-alchemy-rebuild/ops/manifest.json
git diff --check -- goals/infra-alchemy-rebuild
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug infra-alchemy-rebuild`,
then adopt with `bun run beep goals set-status infra-alchemy-rebuild <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/infra-alchemy-rebuild/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
