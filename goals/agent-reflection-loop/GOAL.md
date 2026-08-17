# GOAL: ship the schema-first agent reflection loop

Repo: this `beep-effect` checkout.

Outcome: goal packets carry schema-validated closeout reflections, enforced by
`bun run beep lint reflection-artifacts`, authored via the `/reflect` skill.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/agent-reflection-loop/README.md`
- `goals/agent-reflection-loop/SPEC.md`
- `goals/agent-reflection-loop/PLAN.md`
- `goals/agent-reflection-loop/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and
`research/reflection-frontier-report.md`. Higher-priority repo standards outrank
packet prose when they conflict.

Scope:

- In: `goals/_template/**`, `goals/README.md`, the CLI lint reflection rule +
  routing, `.claude/skills/reflect/**`, `standards/architecture/GLOSSARY.md`.
- Out: P2 Yeet self-healing reflection and P3 memory consolidation (designed,
  not built in P1).

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Keep the reflection lint rule **advisory for legacy goals** (only
   `reflectionRequired: true` packets are gated).
4. Tie decisions to evidence from files, tests, docs, or command output.
5. Update packet evidence/status as readiness changes.
6. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [x] `SPEC.md` acceptance criteria are satisfied.
- [x] `bun run beep lint reflection-artifacts` routes + runs (`blocking_findings=0`).
- [x] The focused reflection lint test passes.
- [x] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/agent-reflection-loop/GOAL.md)" -le 4000
jq . goals/agent-reflection-loop/ops/manifest.json
bun run beep lint reflection-artifacts
git diff --check -- goals/agent-reflection-loop
```

Stop and report before changing public API, schema wire formats, data migration,
auth, infra, security behavior, dependencies, lockfiles, or generated drivers
unless `SPEC.md` explicitly requires it. Keep the enforcement gate advisory for
pre-existing completed goals.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
