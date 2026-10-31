# Cache baseline review: per-task policy fingerprint seals (G4, 2026-10-31)

Reviewer: Claude Opus 5.5 (G4 lane, `claude/policy-fingerprint-per-task-225ace`).

## What changed

Only fingerprint dependency edges and the tasks that carry them
(`research/g4-task-fingerprint.md`):

- Every policy task's `dependsOn` entry `//#lint:policy-fingerprint` is
  rewritten to one generated seal, `//#lint:policy-fingerprint:<key>`. No other
  `dependsOn` entry, input, output, `env` or `cache` flag of those tasks moved.
- 34 new cached root tasks: the seals, each with `cache: true`, `outputs: []`,
  a `dependsOn` on its parent seal (or none for `shared`), its generated
  inputs, and a root script `lint:policy-fingerprint:<key>` that runs `true`.
- `//#lint:policy-fingerprint` keeps its script, `cache: true` and
  `outputs: []`; its inputs become every workspace a seal reaches, the policy
  task manifests and `turbo.json`. Nothing depends on it any more.
- The root manifest (a Turbo global input) gains the 34 seal scripts.

## Drifted tasks

`configuration-drift` (dependency edge rewritten to a seal):

- Package subjects (187): `lint:laws`, `lint:jsdoc` and
  `lint:deprecated-apis` in every workspace that defines them.
- Root subject `//`: `//#config-sync:check`, `//#goals:index-check`, `//#jsdoc:inventory:check`, `//#jsdoc:ratchet:check`, `//#lint:allowlist`, `//#lint:circular`, `//#lint:ecosystem-polarity`, `//#lint:effect-imports`, `//#lint:effect-imports-markdown`, `//#lint:effect-vitest`, `//#lint:identity-registry`, `//#lint:jsdoc:root`, `//#lint:judge-rubric`, `//#lint:native-runtime:roots`, `//#lint:opaque-roundtrips`, `//#lint:package-scripts`, `//#lint:package-test-typecheck`, `//#lint:policy-fingerprint`, `//#lint:reflection-artifacts`, `//#lint:roadmap-refs`, `//#lint:schema-first`, `//#lint:tsconfig-overlay`, `//#lint:tsgo-rules`, `//#repo-sanity:changeset-graph`, `//#repo-sanity:sherif`, `//#repo-sanity:syncpack`, `//#repo-sanity:versions`, `//#topo-sort`.

`unreviewed-expansion` (new cached seal tasks under `//`): `//#lint:policy-fingerprint:goals`, `//#lint:policy-fingerprint:goals-doctor`, `//#lint:policy-fingerprint:goals-index`, `//#lint:policy-fingerprint:knowledge`, `//#lint:policy-fingerprint:laws`, `//#lint:policy-fingerprint:lint`, `//#lint:policy-fingerprint:lint-circular`, `//#lint:policy-fingerprint:lint-deprecated-apis`, `//#lint:policy-fingerprint:lint-ecosystem-polarity`, `//#lint:policy-fingerprint:lint-effect-vitest`, `//#lint:policy-fingerprint:lint-identity-registry`, `//#lint:policy-fingerprint:lint-jsdoc`, `//#lint:policy-fingerprint:lint-judge-rubric`, `//#lint:policy-fingerprint:lint-laws`, `//#lint:policy-fingerprint:lint-opaque-roundtrips`, `//#lint:policy-fingerprint:lint-package-scripts`, `//#lint:policy-fingerprint:lint-package-test-typecheck`, `//#lint:policy-fingerprint:lint-reflection-artifacts`, `//#lint:policy-fingerprint:lint-roadmap-refs`, `//#lint:policy-fingerprint:lint-schema-first`, `//#lint:policy-fingerprint:lint-tsconfig-overlay`, `//#lint:policy-fingerprint:quality`, `//#lint:policy-fingerprint:quality-bun-audit`, `//#lint:policy-fingerprint:quality-changeset-graph`, `//#lint:policy-fingerprint:quality-changeset-status`, `//#lint:policy-fingerprint:quality-fallow`, `//#lint:policy-fingerprint:quality-jsdoc-inventory`, `//#lint:policy-fingerprint:quality-jsdoc-module-tags`, `//#lint:policy-fingerprint:quality-jsdoc-ratchet`, `//#lint:policy-fingerprint:quality-tsgo-rules`, `//#lint:policy-fingerprint:shared`, `//#lint:policy-fingerprint:topo-sort`, `//#lint:policy-fingerprint:tsconfig-sync`, `//#lint:policy-fingerprint:version-sync`.

## Why this grants no qualification

A seal does no work and produces nothing; its only role is to carry a hash of
its inputs into its dependents. Each policy task's own inputs, outputs and
cache flag are unchanged, and the seals it now depends on together declare a
superset of that task's command closure (0 gaps and 0 stale-green replays over
400 commits, `research/g4-task-fingerprint-replay.json`). The change narrows
what invalidates each task; it does not widen what may be replayed. This
review re-records the legacy posture of the drifted subjects and adds no
exception rows.
