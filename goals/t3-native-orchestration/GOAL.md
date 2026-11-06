# GOAL: T3-Native Orchestration

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Make T3 Code the only cross-session messaging route: delete beep's agent-to-agent stack and its packets, and rewrite the orchestrator, handoff, remote-worker and closeout guidance around T3's MCP tools.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/t3-native-orchestration/README.md`
- `goals/t3-native-orchestration/SPEC.md`
- `goals/t3-native-orchestration/PLAN.md`
- `goals/t3-native-orchestration/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: Delete beep's agent-to-agent stack (`beep agent-message`, the `@beep/ai-provider-cli` session half, `@beep/t3-code`, unused ai-metrics observation-launch modules), retire its packets, and rewrite orchestrate/operator-handoff/remote-development-agents/closeout plus runbooks around T3 MCP tools. Removal map: explorations/t3code-fleet-driver/research/removal-map.md.
- Out: Host installs, Linked environments, harness MCP registration, spill routing, the T3 fork itself, `goals/yeet-pr-events`.

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
test "$(wc -m < goals/t3-native-orchestration/GOAL.md)" -le 4000
jq . goals/t3-native-orchestration/ops/manifest.json
git diff --check -- goals/t3-native-orchestration
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug t3-native-orchestration`,
then adopt with `bun run beep goals set-status t3-native-orchestration <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/t3-native-orchestration/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
