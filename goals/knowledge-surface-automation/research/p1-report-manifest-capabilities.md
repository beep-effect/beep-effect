# P1 report — manifest capability decode census (Workstream D)

Phase-0 evidence for the FP-eyeball gate (execution decision E4). Produced from the
live tracked corpus by the production decoder after the capability schema slice; no
files were mutated by the census.

## Command under report

The evergreen census inside
`packages/tooling/tool/cli/test/goals-manifest-capabilities.test.ts`
(`npx vitest run test/goals-manifest-capabilities.test.ts` from
`packages/tooling/tool/cli/`), which discovers every tracked
`goals/*/ops/manifest.json` via `git ls-files` and decodes each with the production
`decodeGoalManifest`.

## Live-corpus results (2026-08-04)

| Measure | Value |
| --- | --- |
| Tracked manifests discovered | 112 (includes `goals/_template/ops/manifest.json`) |
| Parsed as JSONC | 112 |
| Decoded by production `decodeGoalManifest` | 112 |
| Decode failures | 0 |
| Manifests rewritten by the census | 0 |
| D6 self-cycle filter rejections on live corpus | 0 |
| Design-doc census snapshot (2026-07-31) | 109 (+3 packets landed since; evergreen discovery absorbed them) |

Every legacy manifest (no `provides`/`requires` keys on disk) decodes to present empty
arrays; the one packet with live capability data
(`goals/knowledge-surface-automation`, `provides: ["knowledge/doctor",
"skills/warehouse", "goals/graph", "goals/bootstrap"]`) retains all four slugs through
decode→encode→decode. All four conform to the ratified D1 grammar.

## False-positive annotations

A false positive here would be a legitimate tracked manifest that the extended schema
now rejects, or capability data it silently drops. Observed: **zero rejections and
zero drops across all 112 manifests.** The D1 grammar and D6 self-cycle filter fired
only on synthetic negative fixtures (malformed slugs, uppercase, multi-slash, >32-char
segments, provides∩requires overlap), never on live data.

## Suite summary

10/10 tests pass: evergreen census; legacy minimum; constructor defaults; retention;
decode→encode→decode; wrong-type + malformed-slug + self-cycle rejection; no-mutation;
doctor parity; index parity; order independence (production consumers). Deviation
recorded during implementation review: test-plan item 10's "normalized projection
rows / reference evaluator" surfaces do not exist in this slice (projection is later
Workstream D work), so order-independence is asserted against the existing production
doctor/index consumers instead.

## Eyeball ask

Confirm (a) zero-rejection on the live corpus matches expectation, (b) the defaulted
empty arrays appearing in normalized encoded output is acceptable (ratified in the
design's decided contract, item 4–5), and (c) nothing else should block unlocking the
Workstream D projection slice (P4 chain).
