### sol-1-1
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:4592
- class: effect-idiom   severity: required
- standard: `standards/effect-first-development.md` EF-5 prohibits direct native string helpers in domain logic; its review checklist item 6 repeats that requirement. D5 requires the full beep-native idiom bar, and D11 makes a cited Effect-idiom violation required.   evidence: The hand-authored `decodeRow` implementation calls `row.split(",")`. The green native-runtime gate misses this site because `NoNativeRuntime.ts:467` checks string methods only when `inHotspotScope` is true, and the patterns in `NoNativeRuntimeHotspots.ts` do not include `scratchpad/effected/schema-org/**`. Neither the module’s port notes nor its ledger row records an exception.
- failure: Vocabulary row decoding retains a native string operation in domain logic despite the binding Effect-first requirement. This is a gate coverage gap; the read-only oracle comparison passed all 7,934 checks and demonstrated no runtime divergence.
- fix: Import `effect/String` as `Str` and replace `row.split(",")` with `Str.split(row, ",")`, retaining the existing empty/undefined guard and numeric conversion.

REQUIRED: 1
BACKLOG: 0