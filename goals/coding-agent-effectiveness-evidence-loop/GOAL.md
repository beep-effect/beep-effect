# GOAL: Build the coding-agent effectiveness evidence loop

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: trustworthy schema-first agent telemetry (flight records + coverage
attestation), legible Yeet verdicts (exhibit-required failure, mistrial,
durable per-lane proofs), a causal assessment/eval system, and at least one
dominant agent wait measurably reduced behind guardrails.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/coding-agent-effectiveness-evidence-loop/README.md`
- `goals/coding-agent-effectiveness-evidence-loop/SPEC.md`
- `goals/coding-agent-effectiveness-evidence-loop/PLAN.md`
- `goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: `packages/tooling/library/ai-metrics`, Yeet internals under
  `packages/tooling/tool/cli/src/commands/Yeet/`, `.claude/settings.json`
  hooks + hook scripts, a codex exec wrapper, `${XDG_STATE_HOME}/beep/`
  operational state, this packet's docs.
- Out: product-agent runtime (`packages/agents/*`), completed packets,
  `goal-portfolio-driver` queue, ai-metrics-stack P7f in-flight work, the
  rejected traps listed in `SPEC.md` Non-Goals.

Workflow:

1. Inspect referenced files and current repo state; work the active `PLAN.md`
   phase only.
2. Schema → service contract → implementation, per repo law. Instrument
   before treating: verify each measurement instrument before trusting or
   acting on its numbers.
3. Honor the five evidence-integrity laws in `SPEC.md` (refuse-don't-guess
   attribution, weakest-link tier propagation, privacy by unrepresentability,
   instrument-class tagging, OIP taint). Never let telemetry hold prompt,
   command, tool-argument, or OIP-corpus content.
4. Preserve unrelated user/worktree changes; one mutating actor per worktree.
5. Keep decisions tied to evidence from files, tests, docs, or command
   output; update packet evidence/status as readiness changes.
6. At P8 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect` (see
   `PLAN.md` P8 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied for the active phase.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/coding-agent-effectiveness-evidence-loop/GOAL.md)" -le 4000
jq . goals/coding-agent-effectiveness-evidence-loop/ops/manifest.json
git diff --check -- goals/coding-agent-effectiveness-evidence-loop
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. The 19GB store
migration and any hook/settings rollout beyond a scratch clone require the
sequencing written in `PLAN.md` — never improvise them.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
