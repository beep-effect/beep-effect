# env — round-3 merged inventory

Read all three seat reports: `grok.md` (grok-3-1, grok-3-2), `sol.md` (sol-3-1 through sol-3-3), and `fable.md` (NO FINDINGS; separate grok-4.7 medium fallback seat). Read both adjacent briefs, `BRIEF.md` and `BRIEF.grok3.md`; there are no part-N reports. Counts: **Required 3; Backlog 2; Handled by the deviation codemod 0; Rejected 0; Groups 3.** All five reported findings describe distinct contracts or test gaps; none deduplicate.

The briefs review `3ad7b305790c7f0903f6d55766c55186745ba2d1`. The live checkout is `@lab/effected-2` at `952ef7ef10f258b491f2df654bd72239f0ae9536`, rather than the requested `@lab/effected`; source and tests for env have no committed difference from the brief's commit and no tracked working-tree edits. No branch change or gate rerun was performed. Brief claims about green gates are seat context, not fresh verification. The full operator revision block, D1–D20, §12.5 and §14 govern this merge; the current instruction defers documentation, coverage and vitest-canon findings irrespective of the briefs' S2/S3 claims.

`standards/effect-laws.allowlist.jsonc` contains **zero entries for `scratchpad/effected/env/**`**. There are therefore no `allow-<n>` findings. The three required schema omissions are not mechanically enforced by the cited green gates; their concrete source evidence establishes the missed requirement. None alleges an unforced lab change requiring restoration. Round-2 inventory and commit `7edba488e0` were checked: its AudienceShape conversion and StreamEnv number-domain repair do not close these three enclosing options interfaces.

Write groups are disjoint: `g1` owns Audience.ts and Audience.test.ts; `g2` owns RuntimeEnv.ts and RuntimeEnv.test.ts; `g3` owns TerminalEnv.ts and TerminalEnv.test.ts. Each owns one source file. The tests carry focused checks of the new schema contracts and retained layer behavior; the deferred D10 properties are not required assignments. Keep `index.ts` type-only exports as they stand. Recording law-forced added schema exports belongs to the central deviation codemod, not these groups; no group owns README Port notes, PORT_LEDGER.json or repository configuration. Later test runs must use `bunx --no-install vitest run --maxWorkers=2`, one vitest at a time; module-wide coverage requires `beep-heavy --slot-only`.

## Required

### sol-3-1 — AudienceOptions configuration lacks schema ownership

- file: scratchpad/effected/env/Audience.ts:114
- class: schema   severity: required
- standard: D5/D11; standards/ARCHITECTURE.md §5, Schemas Are Executable Contracts; standards/schema-first-development-prompt.md, Schema owns pure data; standards/effect-first-development.md EF-33.
- evidence: The live export at :114–117 is a handwritten interface containing only `readonly envVar?: string`; Audience.layer consumes it at :177–184. It is a pure configuration payload with no operations, overloads or type-level machinery requiring the interface carve-out. Round-2 env-r2-5 converted AudienceShape, a different contract. The green gates do not enforce schema ownership of this options interface.
- failure: The audience configuration has no executable schema from which its runtime contract, field metadata, guard or codec can be derived.
- fix: Define identity-annotated AudienceOptions = S.Struct({ envVar: S.optionalKey(S.String) }), annotate the field, and derive the same-name type from typeof AudienceOptions.Type. Preserve plain option objects, omitted-key semantics, every accepted string and Audience.layer behavior; retain the type-only barrel export. Add focused schema acceptance and existing layer-compatibility checks in scratchpad/test/env/Audience.test.ts without rewriting upstream assertions. Defer D10 properties and S2 conversion; added-export bookkeeping is central.
- seats: sol-3-1

### sol-3-2 — RuntimeEnvOverrides configuration lacks schema ownership

- file: scratchpad/effected/env/RuntimeEnv.ts:122
- class: schema   severity: required
- standard: D5/D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, Schema owns pure data; standards/effect-first-development.md EF-33.
- evidence: The live interface at :122–129 independently declares optional agent, ci and terminal Option values. S.String, CiName and DetectedTerminal already provide their component schemas. Deriving the nested terminal type from DetectedTerminal.Type does not schema-own the outer payload; CurrentRuntimeEnv.layerTest at :254–262 still consumes the interface. The round-2 inventory does not cover this outer ownership requirement, and green gates miss it.
- failure: The overrides configuration lacks a schema-derived runtime contract and metadata for its three fields, despite all components being representable.
- fix: Define an identity-annotated RuntimeEnvOverrides S.Struct with optional keys containing S.Option(S.String), S.Option(CiName) and S.Option(DetectedTerminal); annotate fields and derive its same-name type. Preserve plain objects, absent keys, explicit None overrides, accepted terminal values and layerTest defaults; retain the type-only barrel export. Add focused acceptance and layerTest compatibility checks in scratchpad/test/env/RuntimeEnv.test.ts, including omitted fields and explicit None, without weakening upstream assertions. Defer D10 properties and S2 conversion; added-export bookkeeping is central.
- seats: sol-3-2

### sol-3-3 — TerminalEnvTestOptions configuration lacks schema ownership

- file: scratchpad/effected/env/TerminalEnv.ts:96
- class: schema   severity: required
- standard: D5/D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, Schema owns pure data; standards/effect-first-development.md EF-33; Effect SCHEMA.md, Mapping all fields at once.
- evidence: The live interface at :96–103 contains an optional boolean and two optional Partial<StreamEnv> snapshots, all pure data. StreamEnv already owns the component schemas; local Effect SCHEMA.md:1334–1354 documents mapFields(Struct.map(S.optionalKey)) for optional-field derivation. This differs from the effect-bearing TerminalEnvOptions and the method-bearing TerminalEnvShape service contract. Round-2 env-r2-2 repairs StreamEnv.columns, not this outer configuration; green gates do not enforce its ownership.
- failure: The terminal test configuration has no executable schema contract; its independently declared outer fields cannot derive runtime metadata or validation from the existing stream schema.
- fix: Derive an annotated partial stream schema from StreamEnv's fields, then define identity-annotated TerminalEnvTestOptions as S.Struct with optional stdinIsTerminal, stdout and stderr keys. Annotate fields and derive the same-name type. Preserve plain partial objects, omitted fields, quiet defaults and non-finite column values; retain the type-only barrel export. Reuse StreamEnv's full number domain and its reasoned schemaNumber exception from 7edba488e0; do not narrow columns to S.Finite. Add focused optional-field, non-finite acceptance and layerTest compatibility checks in scratchpad/test/env/TerminalEnv.test.ts without weakening existing assertions. Defer D10 properties and S2 conversion; added-export bookkeeping is central.
- seats: sol-3-3

## Backlog

### grok-3-1 — AudienceShape lacks its generated round-trip property

- file: scratchpad/effected/env/Audience.ts:86
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL.md §11.4; current merge instruction deferring S3 property and coverage work.
- evidence: scratchpad/test/env/Audience.property.test.ts generates AudienceKind and AudienceSource round-trips, but does not reference AudienceShape. Round-2 env-r2-5 added this schema and explicitly deferred its new property; the source conversion appears in 7edba488e0. Coverage alone does not establish generated encode/decode identity.
- failure: The new audience snapshot schema has no generated decode(encode(x)) equivalence and re-encode stability check. No runtime schema defect is demonstrated.
- fix: During S3, add it.effect.prop over Arbitrary.schema(AudienceShape) in scratchpad/test/env/Audience.property.test.ts, using S.encodeEffect, S.decodeEffect, S.toEquivalence, re-encode equality and fcRuns. Reason: deferred S3 property work, not a required round-3 implementation fix.
- seats: grok-3-1

### grok-3-2 — Osc8Info and Osc8Override lack generated round-trip properties

- file: scratchpad/effected/env/internal/osc8/detect.ts:92
- class: test   severity: backlog
- standard: D10; EFFECTED_PORT_GOAL.md §11.4; current merge instruction deferring S3 property and coverage work.
- evidence: scratchpad/test/env/internal/osc8/detect.property.test.ts round-trips Osc8Reason and Osc8Detection but references neither Osc8Info nor Osc8Override. Both schemas were added by round-2 env-r2-1, which explicitly deferred their properties. Osc8Override is defined at detect.ts:65 and Osc8Info at :92. The already-recorded ProcessSnapshot property gap is not repeated.
- failure: These new schemas lack generated encode/decode identity checks. The suggested risk of detector values being rejected is not demonstrated as an actual bug.
- fix: During S3, add Arbitrary.schema round-trips for Osc8Info and Osc8Override in scratchpad/test/env/internal/osc8/detect.property.test.ts, using S.encodeEffect, S.decodeEffect, S.toEquivalence, re-encode equality and fcRuns. Reason: deferred S3 property work, not a required round-3 implementation fix.
- seats: grok-3-2

## Handled by the deviation codemod

None of the round-3 seat findings asks only to record a law-forced change. Bookkeeping implied by the three required schema additions remains central and does not create a separate finding or write assignment.

## Rejected

None. All five seat findings supply concrete evidence and fixes; no finding contradicts an operator ruling or merely repeats a requirement already enforced by a green gate. The fable fallback seat reports NO FINDINGS and contributes no finding record.

REQUIRED: 3  BACKLOG: 2  CODEMOD: 0  REJECTED: 0  GROUPS: 3
