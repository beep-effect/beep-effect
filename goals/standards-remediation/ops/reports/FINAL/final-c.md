# FINAL-C — export-level jsdoc residue

Lane: FINAL-C, 4 packages, sequential, no commits, `standards/*.jsonc` never
hand-edited. Live re-audit found the tracked inventory stale in one spot and
found FINAL-B (shared tree) had already converted 3 of the 4 targets for an
unrelated schema-first reason, moving them back into `missing-schema-annotation`.

1. `@beep/schema` `Model/Model.variants.ts` (8 `BindingElement`s: `Class`,
   `Field`, `FieldExcept`, `FieldOnly`, `Struct`, `Union`, `extract`,
   `fieldEvolve`) — **skipped per team-lead directive; not touched**. My own
   live re-audit independently reached the same conclusion the team lead's
   background probe did: this is a structural detector gap (`BindingElement`
   is excluded from ts-morph's `isJSDocable`), not a doc gap — docs already
   exist at lines 16-51 and were never readable by the old detector regardless
   of placement. Team lead is fixing the detector directly (ruling R24, reads
   `BindingElement` leading-comment ranges) so all 8 clear at regen.
2. `@beep/identity` `Id.ts` (`IdentityInterpolationError`,
   `IdentitySegmentCountError`) + `Vocab.ts` (`VocabEntry`) — **fixed**. Real
   detector rule requires a literal `.annotate(`/`$I.annote(` call in the
   declaration text, not just an identifier/title/description object (FINAL-B
   had just converted these to bare-fields-plus-raw-object form for
   schema-first, which removed the `.annotate(` these previously had).
   `Id.ts` predates `make` in the same file (circular), so added a small local
   bootstrap `$I.annote` shim (adds a real `schemaId` symbol too); `Vocab.ts`
   has no such cycle, so it now imports `make` from `./Id.ts` and uses a real
   `$IdentityId.create("Vocab")` composer. Verified `hasAnnotation` regex
   passes via the same reproduction technique.
3. `@beep/file-processing` `Extraction/index.ts` `TextSpan` type alias —
   **fixed**, added compiling `@example`.
4. `@beep/lint-rules` `index.ts` `RuleRegistrySchema` — **fixed (self-caught
   bug, then corrected)**. Added `@beep/identity` devDependency,
   `make("lint-rules")` composer, and an `.annote(...)` call in place of the
   raw annotation object (same FINAL-B interaction as #2) — but my first pass
   destructured `$LintRulesId` and called `$LintRulesId.annote(...)` directly,
   never aliasing it to `$I`. The detector's fallback regex is
   `/\$I\.annote(?:Schema)?\s*\(/` — it requires the literal receiver name
   `$I`, not any composer name, so `$LintRulesId.annote(` doesn't match
   (confirmed 0/3 regex branches matched via a live ts-morph reproduction
   against the compiled class text). Root-caused after team-lead flagged the
   inventory still showing this one finding; fixed by adding
   `const $I = $LintRulesId;` and calling `$I.annote(...)`, matching the
   `$DuckdbId`/`$I` aliasing convention used everywhere else in the repo.
   Re-verified via the same live regex reproduction: all 3 branches now
   correctly report `$I.annote(` present.

Verify per package (docgen, `tsgo -b`, `vitest run`, `biome check`): identity
159 examples/0 err, 58/58 tests, 17 files clean; file-processing 89
examples/0 err, 10/10 tests, 15 files clean; lint-rules (no docgen script —
`docgenCoverage.hasDocgenConfig: false`) 44/44 tests, 28 files clean. `bun.lock`
gained exactly one line (`@beep/identity` for lint-rules).

Files touched: `packages/foundation/modeling/identity/src/{Id.ts,Vocab.ts}`,
`packages/foundation/capability/file-processing/src/Extraction/index.ts`,
`packages/tooling/policy-pack/lint-rules/{package.json,src/index.ts}`.
