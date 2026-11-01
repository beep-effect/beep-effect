# Cache baseline review: hold-ledger inventory slice (2026-10-31)

Slice 2 of `goals/hold-ledger` adds the root task `//#lint:holds`
(`bun run beep holds lint`), a cheap-gates lane and a medium policy task. It
checks that every hold-shaped config site has a live hold record and that the
syncpack held list matches the ledger.

`//#lint:holds` is uncached (`"cache": false`): it reads the root manifest,
`osv-scanner.toml`, `syncpack.config.ts`, `hold-ledger/**` and the workspace
manifests that hold records name. It has no outputs and no environment, and
`bun run beep lint policy-fingerprint --write` gave it the generated seal
`//#lint:policy-fingerprint:holds`.

The other root computations drift for one reason: the shared root inputs
changed bytes. The root `package.json` gains the `lint:holds` and
`lint:policy-fingerprint:holds` scripts, `turbo.json` gains the two task
declarations, `biome.jsonc` excludes the generated
`hold-ledger/syncpack-held.generated.json`, and `syncpack.config.ts` reads its
held list from that file. Their commands, outputs, environment, dependency edges
and cache flags are unchanged. No qualification scope, profile, epoch or
qualification state changes, and no computation becomes cached.

This reviews the declared configuration change only. It is not evidence that
any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `8394d5889a14c5d566de601d4ea5d15f5c505f9f0732c8d79d6892226809a1b1`.

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

New cached computation: `//#lint:policy-fingerprint:holds`, the generated seal
whose inputs are the modules `beep holds lint` reaches (the `Holds` command
group, `@beep/epistemics` and the shared CLI closure).

New uncached computation: `//#lint:holds`.
