# P3A-SCORER Lane Summary

## Files touched

- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts`
- `packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalScorer.ts`
- `packages/tooling/tool/cli/test/agent-effectiveness-eval-scorer.test.ts`
- `packages/tooling/tool/cli/test/fixtures/agent-effectiveness/scorer-pass/task.json`
- `packages/tooling/tool/cli/test/fixtures/agent-effectiveness/scorer-pass/fixture/tsconfig.json`
- `packages/tooling/tool/cli/test/fixtures/agent-effectiveness/scorer-pass/fixture/src/Contact.ts`
- `.proofs-scorer/*`
- `.lane-summary.md`

Pre-existing tracked change observed and left untouched: `bun.lock`.

## CLI usage

```sh
bun run beep agent-effectiveness evals score \
  --dir packages/tooling/tool/cli/test/fixtures/agent-effectiveness/scorer-pass/fixture \
  --task packages/tooling/tool/cli/test/fixtures/agent-effectiveness/scorer-pass/task.json \
  --json
```

stdout:

```json
{"taskId":"scorer-pass","score":1,"breakdown":{"completion":1,"schemaFirst":1,"tsgo":1,"biome":1},"violations":[]}
```

`--help` exits 0; full output is in `.proofs-scorer/help.log`.

## Implementation notes

- Added `agent-effectiveness evals score` under the existing command family.
- Completion checks parse entrypoint exports with `ts-morph`; manifest regexes are applied over fixture TypeScript source text.
- Law scoring runs schema-first lint, tsgo, and biome against the fixture. Schema-first uses a scoped temporary mini-repo so the existing `beep lint schema-first` rule engine scans only fixture code.
- Law component mapping is documented in JSDoc: `component = 1 / (1 + violations)`; `law_frac` is the arithmetic mean of schema-first, tsgo, and biome; final score is `completion_frac * law_frac`.

## Proofs

- Typecheck: `.proofs-scorer/typecheck.log`
- Focused Node Vitest tests: `.proofs-scorer/vitest-node.log`
- Package lint sanity check: `.proofs-scorer/lint.log`
- CLI score stdout/stderr: `.proofs-scorer/score.stdout.json`, `.proofs-scorer/score.stderr.log`
- Determinism: `.proofs-scorer/determinism-a.json`, `.proofs-scorer/determinism-b.json`, `.proofs-scorer/determinism-cmp.log`
- `--record` smoke test: `.proofs-scorer/record.stdout.json`, `.proofs-scorer/record.stderr.log`

Determinism proof: `cmp -s .proofs-scorer/determinism-a.json .proofs-scorer/determinism-b.json` exited 0.

## Record status

`--record` is implemented without ai-metrics schema changes. It upserts a `BenchmarkCase` using `promptHash` plus `promptRef`, then writes a `BenchmarkRun` with sanitized score/breakdown note only. Smoke-tested with `--data-root <tmp-data-root>` to avoid creating repo-local database artifacts.

## Open risks

- `agent-effectiveness evals run` remains outside this lane; this lane wires `evals score`.
- Bun Vitest `--bun` failed before test import in this sandbox; the passing proof uses plain Node Vitest for the focused scorer test, matching the SPEC constraint for scorer verification.
