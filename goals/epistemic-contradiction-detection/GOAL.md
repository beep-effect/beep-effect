# GOAL: Ship deterministic contradiction detection

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a pure, model-free detector that turns one belief-view snapshot into
`ContradictionCandidate` records for typed direct conflicts, produced against
the contract `goals/epistemic-contradiction-triage` already ships. Detection
proposes; triage disposes.

This is a compact `/goal` launcher. Read these first:

- `goals/epistemic-contradiction-detection/README.md`
- `goals/epistemic-contradiction-detection/SPEC.md`
- `goals/epistemic-contradiction-detection/PLAN.md`
- `goals/epistemic-contradiction-detection/ops/manifest.json`
- `goals/epistemic-contradiction-detection/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, the exploration back-links named by
`SPEC.md`, and governing standards. Use the required Effect-first,
schema-first, service, and symbol-discovery skills. Higher priority repo
standards outrank packet prose when they conflict.

Scope:

- In: `@beep/epistemic-domain` NET-NEW detection values (conflict-class
  `LiteralKit`, snapshot input, per-class confidence constants);
  `@beep/epistemic-use-cases` detection `Context.Service` + pure
  implementation; fixtures and the golden-vector lane.
- Out: any edit to `packages/epistemic/domain/src/{values,entities}/Contradiction/`;
  tables, migrations, server, or UI; ML, tuned thresholds, similarity scores,
  embeddings, model calls; auto-resolution; modality-taxonomy authorship; any
  detection work inside the triage packet; donor or Chronocept numbers;
  verbatim ports.

Workflow:

1. P0: re-verify every `file:line` in `SPEC.md` against the live tree (triage
   is mid-flight), then answer `SPEC.md`'s **Open Contract Question** — where
   conflict class rides on the shipped contract — on the record before writing
   any schema. v1 proceeds on the no-contract-change option regardless.
2. P1: follow the design order — schema, then `Context.Service` contract, then
   implementation. `LiteralKit` for literal unions; `effect/HashMap`/`HashSet`
   over native `Map`/`Set`; `Effect.fn`/`Effect.fnUntraced` for generators.
3. Keep detection pure: no clock, environment, network, or model on the
   detection path; emitted ordering is total and content-derived; confidence is
   a documented per-class constant, never a tuned score.
4. Modality is optional input defaulting to `comparable` when absent; the
   resulting false positives are bounded by human triage. Cite Ning et al. 2018
   (MATRES), never Chronocept.
5. P2: golden vectors (positive and negative) land in the same PR as any
   determinism claim. Prove purity by running one snapshot twice with the clock
   advanced between runs.
6. Keep `PLAN.md`, manifest phase state, and evidence current. At P4 Close use
   `/reflect` and pass reflection lint.

Appetite: small — one short PR ladder; if it sprawls, cut to the first slice
(exact negation alone) rather than extending scope.

Acceptance:

- [ ] Every criterion and stop condition in `SPEC.md` is honored.
- [ ] Required verification is green or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors, formatting churn, or forbidden scope expansion.

Packet verification:

```sh
test "$(wc -m < goals/epistemic-contradiction-detection/GOAL.md)" -le 4000
jq . goals/epistemic-contradiction-detection/ops/manifest.json
git diff --check -- goals/epistemic-contradiction-detection
```

Stop and report before changing the `ContradictionCandidate` contract, any
shipped schema, migration, public API, dependency, or generated file. A tuned
threshold becoming necessary is itself a stop condition.

Completion gate: not achieved until this work ships as a PR driven to mergeable
via Yeet (`bun run beep yeet`: repair -> verify -> publish --pr -> monitor),
with the closeout reflection and the same-PR state flip.
