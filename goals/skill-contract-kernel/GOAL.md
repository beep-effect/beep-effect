# GOAL: Ship the @beep/skill-contract kernel and its first live consumer

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `packages/foundation/modeling/skill-contract` exists (schemas-only),
the `qa-inventory/v1` judge gate runs as a `SkillContract` instance with
behavior parity, and the contract's SKILL.md projection renders via `@beep/md`
behind a re-extraction equality gate.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/skill-contract-kernel/README.md`
- `goals/skill-contract-kernel/SPEC.md`
- `goals/skill-contract-kernel/PLAN.md`
- `goals/skill-contract-kernel/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the standards named
by `SPEC.md` (notably `standards/architecture/07-non-slice-families.md` and
`09-errors-across-boundaries.md`). Higher-priority repo standards outrank
packet prose when they conflict.

Scope:

- In: `packages/foundation/modeling/skill-contract/**` (new);
  `packages/tooling/tool/cli/src/commands/Qa/**` (judge-gate retrofit only);
  packet files under `goals/skill-contract-kernel/`.
- Out: bounded-recovery service implementation; DSSE signing; yeet lanes;
  A2A/ActivityPub; `.claude/skills` migrations; any second retrofit consumer.

Workflow:

1. Inspect referenced files and current repo state; start from the first
   vertical slice in `PLAN.md` (one `JudgeCheck` rule as a typed gate).
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/skill-contract-kernel/GOAL.md)" -le 4000
jq . goals/skill-contract-kernel/ops/manifest.json
git diff --check -- goals/skill-contract-kernel
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
