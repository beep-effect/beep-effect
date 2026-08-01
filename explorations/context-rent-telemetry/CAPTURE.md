# Capture

<!--
Stage 0. Append-only raw dump. New material goes under a new dated heading at
the bottom.
-->

## 2026-07-31

Spin-off ratified during the knowledge-surface-automation interview (see
`goals/knowledge-surface-automation/SPEC.md`, "Spin-off explorations"): captured here,
explicitly NOT a workstream of that initiative.

The idea: always-loaded guidance surfaces (CLAUDE.md, AGENTS.md, skill frontmatter,
settings) are the prompt-cache prefix — every line charges rent in every session of
every agent. Today pruning is done by taste ("keep it lean"). Instead: instrument which
lines actually change agent behavior, then prune empirically.

Raw ingredients:

- Harness telemetry already exists (harness-otel adoption; dankserver LGTM stack) — can
  sessions be segmented by guidance-variant to detect behavioral deltas?
- `goals/agent-effectiveness-loop` built a Phoenix-backed eval/annotation substrate;
  `goals/ai-metrics-stack` and `goals/agent-pipeline-velocity` are sibling prior art.
  A "guidance line -> behavior" experiment is close to its datasets/experiments shape.
- Knowledge-surface-automation Workstream C deliberately stops at "pruning proposals as
  a diff with token-weight estimates, never applied unilaterally". The empirical arm —
  measuring whether a line earns its rent — lives here.
- Candidate rent unit: token-weight x load frequency (cost side) vs measured behavioral
  lift (benefit side). A line with high cost and no measurable lift is a prune
  candidate; a cheap line that prevents a recurring failure class is load-bearing.
- Possible cheap first probe: A/B a single contested rule line across scheduled agent
  sessions doing a fixed task battery; diff outcome metrics.

Risks/unknowns: attribution is confounded (model drift, task mix); telemetry may not
capture "would have done X without the line"; ethics of degrading sessions on purpose.
