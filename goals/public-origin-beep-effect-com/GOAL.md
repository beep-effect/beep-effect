# GOAL: Single public origin beep-effect.com

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Move the identity authority to the beep-effect.com/ns/ root, reserve
the apex route table in `@beep/public-site`, and gate the retired hosts. Write
retired hosts defanged outside `history/` (SPEC I7).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/public-origin-beep-effect-com/README.md`
- `goals/public-origin-beep-effect-com/SPEC.md`
- `goals/public-origin-beep-effect-com/PLAN.md`
- `goals/public-origin-beep-effect-com/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `@beep/identity` authority, new `@beep/public-site`, drift folding,
  seeds and every retired-host literal outside `**/history/**` and the root
  `research/` tree, the `retired-iri-authorities` law and lane, and the
  doctrine entries listed in `SPEC.md`.
- Out: deployment, Cloudflare and DNS config, CI deploy workflows, the
  `oip.law` practice authority, wiring `hostedUrl` consumers, changesets
  (I8).

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
test "$(wc -m < goals/public-origin-beep-effect-com/GOAL.md)" -le 4000
jq . goals/public-origin-beep-effect-com/ops/manifest.json
git diff --check -- goals/public-origin-beep-effect-com
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug public-origin-beep-effect-com`,
then adopt with `bun run beep goals set-status public-origin-beep-effect-com <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/public-origin-beep-effect-com/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
