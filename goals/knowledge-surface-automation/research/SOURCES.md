# Research sources — knowledge-surface-automation

## P0 deliverables (this packet)

- `research/prior-ritual-lessons.md` — archaeology over prior housekeeping/quality
  rituals (agent-effectiveness-loop, agent-pipeline-velocity, ai-metrics-stack,
  goals-doctor + baseline, ratchet packets, tools/skillopt, memory-architecture
  decision log).
- `research/surface-inventory.md` — quantified inventory: clone-agnosticism scan over
  tracked agent-facing files, skills-lock provenance + skill-tree drift, manifest
  schemaVersion/lifecycle distribution, INDEX drift, exploration graduation state,
  finding-class taxonomy.
- `research/cli-ground-truth.md` — exact existing CLI surface (Goals/Skills command
  families, manifest schema decode semantics, lint lanes, registration pattern) and the
  integration map for `beep knowledge`, `beep skills provenance|materialize`,
  `beep goals bootstrap|next|explain|scout|respec`, `beep explore graduate`.

Provenance: all three produced 2026-07-31 by delegated Codex (gpt-5.6-sol, xhigh)
read-only exploration jobs; outputs reviewed by the orchestrating session before
commit.

## P1 deliverables (phase-0 inputs)

- `research/p1-skill-upstream-resolution.md` — upstream repo + immutable commit +
  license resolved for every externally-derived skill (Workstream B's ratified early
  task); includes the recommended v2 lock-entry schema. Only `oracle`'s exact base
  revision is `inferred` (repo identity certain, no byte-exact commit match).
- `research/p1-knowledge-finding-schema-design.md` — `KnowledgeFinding` schema +
  Stage-1 semantic-delta scanner design: identity normalization algorithm,
  paired-archive semantics, golden fixture matrix, CLI/service placement, policy-step
  wiring, and grill questions.
- `research/p1-manifest-capability-extension-design.md` — additive `provides`/`requires`
  manifest extension: exact schema addition with decoding defaults, capability-slug
  constraint options (grill decides), decode-retention test plan, normalized projection
  rows, and the pure-TS differential fixtures.

Provenance: produced 2026-08-01 by delegated Codex (gpt-5.6-sol, xhigh) — one
network-enabled provenance job (GitHub API resolution), one repo-grounded design job;
outputs reviewed by the orchestrating session before commit.

## Repo prior art

- `goals/agent-effectiveness-loop/`, `goals/agent-pipeline-velocity/`,
  `goals/ai-metrics-stack/` — prior effectiveness/velocity rituals.
- `goals/goals-doctor/`, `goals/goals-doctor.baseline.jsonc` — doctor + sealed-baseline
  prior art.
- `goals/quality-gate-ratchets/`, `goals/fallow-advisory-ratchets/` — ratchet mechanics.
- `tools/skillopt/` — Python/uv skill-optimization tooling (vendor dir, configs).
- `packages/tooling/tool/cli/src/commands/Goals/`,
  `packages/tooling/tool/cli/src/commands/Skills/` — the CLI surfaces the workstreams
  extend.
- `standards/memory-architecture/` — knowledge/memory surface decisions.
