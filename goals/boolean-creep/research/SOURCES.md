# SOURCES — Boolean-Creep Eradication

Provenance ledger for the campaign's inputs.

## Origin

- Ratified operator prompt: WebStorm scratch `COMMON_CODE_SMELL.md`
  (2026-08-17), produced by the boolean-creep grill session. Its qualifier,
  taxonomy, gates, and pre-confirmed exemplars are mirrored into
  [`../DECISIONS.md`](../DECISIONS.md) and [`../SPEC.md`](../SPEC.md); the
  scratch file is the historical source, the packet is now canonical.
- Three-lane sample session (2026-08-17): ~80 raw clusters sampled; dominant
  mass D1/D2 config/wire; expected confirmed inventory 15–30. Produced the 10
  pre-confirmed exemplars and 4 disqualified calibration records seeded into
  [`../data/inventory.jsonl`](../data/inventory.jsonl) (line numbers
  re-verified at bootstrap, 2026-08-17).

## In-repo bricks

- `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts` —
  `YeetMergeReadyCoherenceCheck` (S.makeFilter): the canonical example of a
  runtime guard standing in for a sum type, and the legacy-normalizer
  precedent for Tier 2 encoded-compat proofs.
- `@beep/schema` `LiteralKit` — repo-law literal-union carrier; target shape
  for payload-free exclusive variants.
- `goals/jsdoc-carrier-migration/` — precedent packet for schema-validated
  JSONL campaign state.
- Skills: `schema-first-development`, `crispen` (guard-deletion doctrine),
  `yeet`.

## Method references

- Scanner net / evidence gate (E1–E4, D1–D2): defined in the operator prompt,
  ratified 2026-08-17; recorded in `DECISIONS.md`.
- Grok lane laws (output contract pinned per lane, transcript as recovery
  layer): hard-won in prior grok fan-out campaigns; see
  `DECISIONS.md` note on venue.
