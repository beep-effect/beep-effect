# Cache baseline review: hold-ledger sweep slice (2026-11-01)

Slice 3 of `goals/hold-ledger` changes two root inputs and nothing else in the
root task graph:

- the root `package.json` `deps:update` script becomes
  `bun run beep holds update && bunx syncpack update --target=latest --dependency-types=catalog`;
- the comment above the held group in `syncpack.config.ts` points to
  `beep holds why` and `docs/runbooks/hold-ledger.md`.

`deps:update` is not a Turbo task. The root computations below drift only
because the shared root input bytes changed. Their commands, inputs, outputs,
environment, dependency edges and cache flags are unchanged. No qualification
scope, profile, epoch or qualification state changes, no computation becomes
cached, and there are no new computations.

This reviews the declared configuration change only. It is not evidence that
any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `20b56a6dab73e6c929d2b676e55cf8f73e8e8144d2dcdf064c130d923bc08293`.

Drifted computations (subject `//`, root input bytes only):

- `//#config-sync:check`
- `//#goals:index-check`
- `//#jsdoc:inventory:check`
- `//#jsdoc:ratchet:check`
- `//#lint:allowlist`
- `//#lint:circular`
- `//#lint:ecosystem-polarity`
- `//#lint:effect-imports`
- `//#lint:effect-imports-markdown`
- `//#lint:effect-vitest`
- `//#lint:identity-registry`
- `//#lint:jsdoc:root`
- `//#lint:judge-rubric`
- `//#lint:native-runtime:roots`
- `//#lint:opaque-roundtrips`
- `//#lint:package-scripts`
- `//#lint:package-test-typecheck`
- `//#lint:policy-fingerprint`
- `//#lint:policy-fingerprint:goals`
- `//#lint:policy-fingerprint:goals-doctor`
- `//#lint:policy-fingerprint:goals-index`
- `//#lint:policy-fingerprint:holds`
- `//#lint:policy-fingerprint:knowledge`
- `//#lint:policy-fingerprint:laws`
- `//#lint:policy-fingerprint:lint`
- `//#lint:policy-fingerprint:lint-circular`
- `//#lint:policy-fingerprint:lint-deprecated-apis`
- `//#lint:policy-fingerprint:lint-ecosystem-polarity`
- `//#lint:policy-fingerprint:lint-effect-vitest`
- `//#lint:policy-fingerprint:lint-identity-registry`
- `//#lint:policy-fingerprint:lint-jsdoc`
- `//#lint:policy-fingerprint:lint-judge-rubric`
- `//#lint:policy-fingerprint:lint-laws`
- `//#lint:policy-fingerprint:lint-opaque-roundtrips`
- `//#lint:policy-fingerprint:lint-package-scripts`
- `//#lint:policy-fingerprint:lint-package-test-typecheck`
- `//#lint:policy-fingerprint:lint-reflection-artifacts`
- `//#lint:policy-fingerprint:lint-roadmap-refs`
- `//#lint:policy-fingerprint:lint-schema-first`
- `//#lint:policy-fingerprint:lint-tsconfig-overlay`
- `//#lint:policy-fingerprint:quality`
- `//#lint:policy-fingerprint:quality-bun-audit`
- `//#lint:policy-fingerprint:quality-changeset-graph`
- `//#lint:policy-fingerprint:quality-changeset-status`
- `//#lint:policy-fingerprint:quality-fallow`
- `//#lint:policy-fingerprint:quality-jsdoc-inventory`
- `//#lint:policy-fingerprint:quality-jsdoc-module-tags`
- `//#lint:policy-fingerprint:quality-jsdoc-ratchet`
- `//#lint:policy-fingerprint:quality-tsgo-rules`
- `//#lint:policy-fingerprint:shared`
- `//#lint:policy-fingerprint:topo-sort`
- `//#lint:policy-fingerprint:tsconfig-sync`
- `//#lint:policy-fingerprint:version-sync`
- `//#lint:reflection-artifacts`
- `//#lint:roadmap-refs`
- `//#lint:schema-first`
- `//#lint:tsconfig-overlay`
- `//#lint:tsgo-rules`
- `//#repo-sanity:changeset-graph`
- `//#repo-sanity:sherif`
- `//#repo-sanity:syncpack`
- `//#repo-sanity:versions`
- `//#topo-sort`
