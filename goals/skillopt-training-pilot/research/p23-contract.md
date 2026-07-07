# P2/P3 Cross-Lane Contract

Fixed by the orchestrator 2026-07-06 so the corpus (P2), scorer (P3a), and
env-adapter (P3b) lanes can build against each other without coordination.
Lanes may extend, never change, the shapes below; gaps go in the lane's
`.lane-summary.md` as findings.

## Corpus layout (P2 owns)

```text
goals/skillopt-training-pilot/corpus/
  tasks/<task-id>.json          # one task manifest per task (schema below)
  fixtures/<task-id>/           # self-contained fixture dir (tsconfig + src stub)
  splits/train/items.json       # SkillOpt items (beeplaw env; see item schema)
  splits/val/items.json
  splits/test/items.json        # may be []
  benchmark-cases.json          # ai-metrics BenchmarkCase-shaped seed rows
  DERIVATION.md                 # which inventory entries/rules each task came from
```

## Task manifest schema (`tasks/<id>.json`)

```json
{
  "id": "sfv4-fn-schema-001",
  "ruleIds": ["SFV4-fn-schema"],
  "derivedFrom": ["apps/oip-web/src/components/HeroVideo.tsx:292 @ schema-first.inventory 2026-07-06"],
  "prompt": "Task instruction shown to the rollout agent. Repo-relative fixture paths only.",
  "fixture": "goals/skillopt-training-pilot/corpus/fixtures/sfv4-fn-schema-001",
  "entrypoint": "src/Contact.ts",
  "completion": {
    "requiredExports": ["ContactPayload"],
    "requiredPatterns": ["\\bS\\.Class\\b"],
    "forbiddenPatterns": ["\\binterface ContactPayload\\b"]
  },
  "weights": { "completion": 0.5, "law": 0.5 }
}
```

- `completion` checks are declarative and deterministic: exports checked
  against the entrypoint's exported symbol names; patterns are RE2-safe
  regexes over fixture source text.
- Tasks must be **baseline-failing but patchable**: the un-trained
  `schema-first-development` skill should NOT already yield 1.0 (else no
  gradient), and the failure must be the kind a skill rule could fix
  (P1 finding: the analyst declines unpatchable failures).

## SkillOpt item schema (`splits/*/items.json`, beeplaw env)

```json
{ "id": "sfv4-fn-schema-001",
  "task_path": "goals/skillopt-training-pilot/corpus/tasks/sfv4-fn-schema-001.json" }
```

The beeplaw adapter resolves everything else from the task manifest.

## Scorer CLI (P3a owns)

```sh
bun run beep agent-effectiveness evals score \
  --dir <fixture-copy-dir> --task <task-manifest-path> --json
```

- stdout (with `--json`) exactly one JSON object:

```json
{
  "taskId": "sfv4-fn-schema-001",
  "score": 0.83,
  "breakdown": { "completion": 1.0, "schemaFirst": 0.9, "tsgo": 1.0, "biome": 0.66 },
  "violations": [
    { "source": "schema-first" | "tsgo" | "biome" | "completion",
      "ruleId": "SFV4-fn-schema", "file": "src/Contact.ts", "line": 12,
      "message": "..." }
  ]
}
```

- `score = completion_frac * law_frac` (anti-gaming: both required);
  `law_frac` aggregates schema-first lint + tsgo diagnostics + biome over
  the fixture dir. All components in [0,1]. Deterministic: same dir + task
  → byte-identical JSON (test this).
- Exit 0 whenever scoring completed (even score=0); nonzero only for
  operational failure (bad args, missing fixture, tool crash).
- `--record` (optional flag) additionally writes a BenchmarkRun row via
  @beep/repo-ai-metrics (prompt-by-hash; no raw transcript bodies).

## beeplaw EnvAdapter (P3b owns)

- Python package `beep_skillopt` inside `tools/skillopt/` (uv project turns
  packaging on); console script `beep-skillopt-train` registers
  `beeplaw` into `scripts.train._ENV_REGISTRY` then delegates to
  `scripts.train:main` (registry injection survives `_register_builtins`;
  see history/p1-gate/FINDINGS.md finding 3).
- Rollout per item: copy fixture dir to a scratch dir under `out_root`,
  inject candidate skill, spawn codex exec with cwd=scratch
  (`--skip-git-repo-check -s workspace-write`, approval never, model
  default), prompt = task manifest `prompt`.
- Reward per item: shell out to the P3a scorer CLI from the repo root over
  the scratch dir; `soft = score`, `hard = 1.0 if score >= 0.999 else 0.0`.
  Scorer subprocess runs OUTSIDE any codex sandbox.
- `--stub-scorer` escape hatch (env or config flag) that fakes the scorer
  with pattern-presence checks, so the adapter can be smoke-tested before
  P3a merges.
- Durable prompt fix: vendor the SkillOpt 0.2.0 prompt `.md` files under
  `tools/skillopt/vendor/prompts/` and make `beep-skillopt-train` materialize
  them into the installed package (or point the loader at them) when absent
  — the 0.2.0 wheel ships none (history/p1-spike/FINDINGS.md).

## Shared constraints

- Repo is PUBLIC: no client data, no `.env` values, no sealed ai-metrics
  transcript bodies anywhere in corpus/fixtures/artifacts.
- Fixtures are NOT workspace packages: no package.json registration in the
  bun workspace; each fixture carries its own tsconfig extending the repo
  base so `tsgo -p <fixture>/tsconfig.json` typechecks standalone (module
  resolution reaches the root node_modules by directory walk-up).
- Repo gates must stay green with the corpus committed: nothing under
  `goals/**` may enter lint/typecheck/test lanes.
