# P0 — blocker and contract audit (2026-08-25)

Both textual blockers in `ops/manifest.json` (`blockedBy`) required landed-content
evidence because the semantic-web PR2/PR3 cleanups never had goal packets. This
file is that evidence, taken from live `main` at `4764cdb4ba`.

## Blocker 1 — semantic-web PR2 (SHACL topology move): LANDED

- Merge: `6706b95a75 refactor(epistemic): move the bounded shacl validator into epistemic-server (#695)`.
- Live source: `packages/foundation/capability/semantic-web/src/` contains no
  `adapters/` directory and no `shacl-engine` module; the bounded validator now
  lives at `packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts`
  (re-exported by `packages/epistemic/server/src/ShaclValidation/index.ts`).
- The SHACL contract stayed in semantic-web, as PR2 specified.

## Blocker 2 — semantic-web PR3 (dead-surface delete): LANDED

- Merge: `a6ffc516e1 refactor(semantic-web): drop unconsumed jsonld and provenance service surface (#687)`.
- Follow-ups: `93e403dac2 (#711)` removed every compat shim; `631fba70df (#715)`
  refreshed the dead-surface cleanup.
- Live source: `rg -i 'jsonld|provenance|shacl-engine' packages/foundation/capability/semantic-web/src`
  returns no files. The package `src/` is exactly `index.ts` plus
  `services/{canonicalization,shacl-validation,sparql-query}.ts`.

## Post-move SHACL contract layer (identified)

`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts`:
`ShaclPropertyShape`, `ShaclNodeShape`, `ShaclValidationRequest`,
`ShaclValidationResult`, `ShaclValidationViolation`, `ShaclValidationError`, and the
`ShaclValidationService` `Context.Service` tag (`validate(request)`). The bounded
subset covers `targetClass`, `targetNode`, `minCount`, `maxCount`, `datatype`,
`class`, `hasValue`. This is the projection target for P1.

## Contract corrections discovered during the audit

- `JSDocTagDefinition.make` lives in `@beep/repo-utils`
  (`packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts`),
  not `@beep/schema` as the SPEC target-surface list said. `@beep/repo-utils`
  already depends on `@beep/identity`, so the migration direction is unchanged.
  SPEC updated in this PR.
- `@beep/identity` depends on `effect` only (package.json), so `Fibered` and the
  `IdentityRegistry` contract must be effect-only: `S.Literals` instead of
  `LiteralKit`, plain `S.TaggedError`, `effect/HashMap` indexes.
- `scratchpad/identity/` (the MAP's donor path) no longer exists in the working
  tree; the fibered slice has no scratchpad donor and is authored fresh against
  the handoff §6 design and the live `make` implementation.
- Effect pinned at `4.0.0-rc.111` (root catalog); `S.Literals` exposes
  `.literals` and `.mapMembers`; `S.Json`, `S.HashMap`, `S.tag`, `S.TaggedError`
  exist in `.repos/effect/packages/effect/src/Schema.ts`.

## Verdict

Both stop conditions tied to the blockers are cleared with live-source evidence;
the post-move SHACL contract layer is identified. P1 may begin. The P1 design is
recorded in `research/2026-08-25-p1-design.md`.
