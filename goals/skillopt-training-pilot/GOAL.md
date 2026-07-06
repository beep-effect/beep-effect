# GOAL: Run a SkillOpt training loop end-to-end on schema-first-development

Repo root: the current working directory — the `beep-effect` checkout you
are running in. All paths repo-relative.

Outcome: SkillOpt (pip, MIT) trains `.claude/skills/schema-first-development/SKILL.md`
against ≥10 repo-law-scored schema-authoring tasks via a worktree-per-rollout
codex-sdk runner; artifacts + a park-or-proceed verdict land in this packet's
history/. Loop-runs = success; lift = evidence; adoption = OUT of scope.

Contract files (read in order): `goals/skillopt-training-pilot/SPEC.md`
(normative), `PLAN.md`, `ops/manifest.json`, `research/SOURCES.md`;
provenance `explorations/skillopt-training-pilot/` (DECISIONS.md = 7 locked
decisions; BRIEF signed off 2026-07-06). Then `AGENTS.md`, `CLAUDE.md`.
Higher sources win.

Scope:

- In: flake.nix (python3+uv); NEW tools/skillopt/ (pyproject+uv.lock);
  `beep agent-effectiveness evals` subcommands + internals + tests
  (packages/tooling/tool/cli); ai-metrics schema EXTENSIONS only if needed
  (packages/tooling/library/ai-metrics); eval corpus (BenchmarkCase rows +
  fixtures, prompt-by-hash); packet history/ artifacts.
- Out: adopting the trained skill; vendoring SkillOpt; raw-transcript
  access; SkillOpt-Sleep; multi-skill; CI-hosted training; gate weakening;
  always-loaded-context growth.

Composition (reuse, don't rebuild): runner generalizes
`packages/tooling/tool/cli/src/commands/Docgen/internal/QualityWorkerEval.ts`
(codex-sdk, structured JSON, temp isolation) at sandboxMode workspace-write;
storage = ai-metrics BenchmarkCase/BenchmarkRun + DuckDB; scorer wraps
`bun run beep lint schema-first` + tsgo Effect diagnostics + biome (node
vitest path inside sandboxes); throwaway checkouts via `beep worktree`.

Workflow (PLAN phases): P0 provisioning+skeleton → P1 VERTICAL SLICE n=1
(one task end-to-end BEFORE generalizing) → P2 corpus (≥10 from schema-first
inventory history + crispening cards; completion criteria, not just law
compliance — anti-gaming) → P3 scorer determinism + runner hardening
(serial) → P4 one gated PR → P5 local training run (overnight-at-most;
full-log capture, no tail pipes) → P6 optional Phoenix stretch + /reflect.

Codex-lane conventions (from quality-gate-ratchets, binding): launch codex
with cwd INSIDE the worktree (verify `test -w .`); codex CANNOT git-commit
in worktrees and CANNOT call GitHub APIs — deliver uncommitted changes +
.lane-summary.md; orchestrator commits/pushes.

Acceptance (SPEC authoritative):

- [ ] `uv run --project tools/skillopt skillopt --help` green from clean checkout.
- [ ] n=1 slice transcript; ≥10-task corpus committed with derivation notes.
- [ ] Scorer deterministic on a fixed diff; evals commands tested.
- [ ] Training run artifacts in history/ incl. ≥1 validation-rejected edit;
      verdict recorded.
- [ ] Harness PR merged via the 17-check ruleset; yeet verify green.
- [ ] Reflection written; `bun run beep lint reflection-artifacts` passes.

Verification:

```sh
test "$(wc -m < goals/skillopt-training-pilot/GOAL.md)" -le 4000
jq . goals/skillopt-training-pilot/ops/manifest.json
uv run --project tools/skillopt skillopt --help
bun run beep yeet verify
```

Stop and report: harness integration infeasible within appetite (→ PARK
with findings — a legitimate verdict); BenchmarkCase would need forking;
unnamed credentials/cost/destructive effects; repeated blocker.

Done only when acceptance passes or a park verdict is recorded with
evidence.
