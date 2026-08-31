# Inline Schema Compiler Hard Error — Sources and Provenance

## Origin

This packet is the mandatory successor required by the ratified
`schema-utils-selective-codec-statics` goal. It was compiled from the
repository's `standard-delivery` bootstrap archetype on 2026-08-30.

## Opening Evidence

| Source | Evidence | Disposition |
| --- | --- | --- |
| `goals/schema-utils-selective-codec-statics/research/closing-census.json` | 2,931 remaining findings; opening predecessor count 2,935; no findings on predecessor-touched lines | Reproduce, classify, and reduce to zero |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts` | Defines compiler-call detection and diagnostic | Preserve detection, extend tests, promote severity after zero |
| `.repos/effect` | Pinned Effect reference checkout required by repository law | Validate helper construction and signatures here |
| Installed `effect` package | Runtime and type behavior used by the checkout | Exercise with focused tests |

## Baseline Contract

- Opening baseline: 2,931 findings as of 2026-08-30.
- Target: zero findings.
- Ratchet: no family may grow while migrations proceed.
- Severity: warning until zero; error only after zero and focused tests pass.

## External Sources

None required. Use the current repository, pinned Effect reference checkout,
and installed dependency as the authoritative corpus.
