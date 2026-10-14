# GOAL: Skill Contract Gate Certificates

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Skill Contract Gate Certificates (graduated from explorations/typed-agent-skill-contracts).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/skill-contract-gate-certificates/README.md`
- `goals/skill-contract-gate-certificates/SPEC.md`
- `goals/skill-contract-gate-certificates/PLAN.md`
- `goals/skill-contract-gate-certificates/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/foundation/modeling/skill-contract` (a new certificate version of the
  `@beep/skill-contract` kernel), the QA judge settlement in
  `packages/tooling/tool/cli/src/commands/Qa/` (first certificate producer), their
  tests, and this packet.
- Out: signing and external verification of certificates; changing the closed
  `skill-contract-kernel` goal; Yeet and bounded recovery (candidate 3);
  `packet-convention-migration`; any other gate consumer beyond the QA judge.

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
test "$(wc -m < goals/skill-contract-gate-certificates/GOAL.md)" -le 4000
jq . goals/skill-contract-gate-certificates/ops/manifest.json
git diff --check -- goals/skill-contract-gate-certificates
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
