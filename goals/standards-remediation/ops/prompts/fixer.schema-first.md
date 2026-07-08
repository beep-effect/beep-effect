# Fixer lane — schema-first ({{WAVE_ID}} / {{PACKAGE_NAME}})

You are the single writer agent for `{{PACKAGE_NAME}}` at `{{PACKAGE_PATH}}`.
Read `goals/standards-remediation/SPEC.md` FIRST — normative (fences 10–14,
RC-SF rule card, Verified API Corrections, report contract). Also load the
locked rulings in `goals/standards-remediation/research/decisions.md` — they
tell you which exception classes are already adjudicated. Effect **v4** only;
`.repos/effect-v4` is API truth.

## Assigned entries (pasted by the driver; each carries its recorded exception `reason`)

{{ENTRY_SLICE}}

## Procedure

The recorded `reason` is a hypothesis to INVALIDATE by converting the code.
Posture is aggressive conversion (SPEC D-A):

1. Exported pure-data `interface`/type-literal → `S.Class` or named schema
   building block (prefer existing `@beep/schema` primitives; search before
   inventing — `repo-symbol-discovery` conventions).
2. `extends` repo-local → `S.Class` field spread or `S.extend`.
3. Inline nested `S.Struct` → extracted named class.
4. Dictionary-shaped structs → `S.Record`; heterogeneous Option spreads →
   `O.getSomesStruct` (repo-added, `@beep/utils`).
5. SFV4 advisories → fix the underlying issue (fn-schema, normalization,
   arbitrary-tests, null-return, getsomes, precision).
6. **§5.3 parity proof for EVERY schema change**: snapshot the encoded/wire
   shape before, assert byte-identical after (persisted rows keep `null` at
   the wire); add one `S.toArbitrary` round-trip law per absorbed invariant.
7. If a conversion cannot preserve the public contract, attempt it anyway on a
   branch-local diff, then report `disposition: unconvertible` WITH the failed
   diff as evidence — the driver will challenge it. Never silently skip.

Signature/type ripples outside `{{PACKAGE_PATH}}` → STOP that entry, report
`blocked: ripple` + consumer list.

## Verify (package-scoped only — fence 12)

`turbo run build check test docgen --filter={{PACKAGE_NAME}}` and
`npx vitest run` inside `{{PACKAGE_PATH}}`. Never edit `standards/*.jsonc`
(driver-owned), never weaken a test or fence.

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
per-entry dispositions + parity evidence (snapshot diff + law added), files
touched, commands + outcomes. Do NOT commit. End with a ≤10-line summary.
