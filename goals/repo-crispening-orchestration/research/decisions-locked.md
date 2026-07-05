# Locked Decisions — repo-crispening-orchestration

Date locked: 2026-07-05. These decisions were settled during packet grounding
(authoring spec §0–§8 + Appendix A) and a follow-up grill. They are **locked —
do not reopen** during packet execution. Amendments require a new entry in
`standards/architecture/DECISIONS.md` superseding the consolidated crispening
entry.

## Pre-settled decisions (spec §1)

| # | Decision | Ruling |
|---|----------|--------|
| D1 | Relationship to prior schema-first work | **Orchestrate + add novel.** Reuse the existing SFV4-* rule cards; cross-link (never supersede) the sibling packets `schema-first-v4-capabilities`, `schema-first-zero-actionables`, `effect-native-migration`, `beep-schema-topology`. |
| D2 | Agent topology | **Specialists find / package-agents fix.** Five read-only per-topic discovery specialists (S1–S5); exactly one writer agent per package during remediation waves. |
| D3 | Sequencing | **Enforce-first, then bounded waves.** P0 enforce → P1 baseline → P1.5 mechanize → P2 waves → P3 catalog → P4 close. No remediation before enforcement + baseline exist. |
| D4 | Specialist domains | **Five domains S1–S5** (see table below). |
| D5 | Doctrine before sweep | **Amend effect-first Law 20 & Law 47** (and mirrors) *before* the `R.getSomes` → `O.getSomesStruct` sweep runs. |

## Grill outcomes

| # | Question | Ruling |
|---|----------|--------|
| G1 | Slug | `repo-crispening-orchestration` (verified: no collision among existing `goals/` slugs). |
| G2 | Wave order | Foundation → drivers → tooling → apps/slices, ROI-front-loaded. **Pilot = one foundation/modeling exemplar package** (e.g. `@beep/md` or `@beep/lexical`); the first wave doubles as the pilot. |
| G3 | Novel lint cards | **All four ship as real AST detectors in P0:** `SFV4-fn-schema`, `SFV4-getsomes-struct`, `SFV4-normalization`, `SFV4-null-return`. `SFV4-type-alias` is **dropped** — redundant with existing `detectInterfaceReason` / `detectTypeAliasReason` / `detectStructReason` (`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:447/460/508`). |
| G4 | Ratchet mechanism | **Per-owner blocking policy, built in P0.** Verified reality: advisory inventory entries already hard-fail repo-wide (`schemaFirstLintHasFailures`, `SchemaFirst.ts:1464-1477`, counts `activeAdvisories`); no per-path severity exists today. P0 adds `standards/schema-crispening.policy.jsonc` (owner/family → blocking flag) and extends `schemaFirstLintHasFailures` to consult it. New cards land non-blocking; each family flips to blocking after its wave goes green. |
| G5 | Codemod-vs-agent threshold | **0.9/0.6 two-tier.** Confidence ≥ 0.9 → pure codemod; 0.6–0.9 → codemod proposes + agent reviews each diff; < 0.6 → judgment-only. Encoded in the inventory record (`confidence`, `mechanization`) and the codemod triage table. |
| G6 | Doctrine sanction | **One consolidated entry in `standards/architecture/DECISIONS.md`** (authored in P0, from the packet). Sanctions three things: (a) family-scoped waves vs the cleanup-on-touch bucket rule (`standards/architecture/README.md:48-52`); (b) the per-owner blocking policy; (c) the Law 20/47 amendment — prefer `O.getSomesStruct` for heterogeneous struct-spreads; keep `R.getSomes` for homogeneous dictionaries. ADR format: `## YYYY-MM-DD: Title` / Status / Decision / Rationale. |
| G7 | Catalog path | `standards/schema-catalog.generated.jsonc` — tracked in git (`docs/generated/` is gitignored, so the catalog cannot live there). |

## Specialist domains S1–S5

| Id | Domain | Novel-card authoring duty |
|----|--------|---------------------------|
| S1 | Schema-as-truth (invariants into schemas; helper/decode walls; fn contracts) | `SFV4-fn-schema` |
| S2 | Defaults, normalization, Option (no `*Defaults` spreads; nullish → Option; normalization in codecs) | `SFV4-normalization`, `SFV4-null-return` |
| S3 | Discrimination & exhaustiveness (tagged unions, `Match.tagsExhaustive`, literal kits) | `SFV4-getsomes-struct` |
| S4 | Colocation & pipeability (statics on the data, `withCodecStatics`, dual arity, flow) | — (reuses existing cards) |
| S5 | Precision, testing, annotations (brands, `S.toArbitrary` laws, `$I.annote*`) | — (reuses `SFV4-precision-audit`, `SFV4-arbitrary-tests`, `SFV4-equivalence`) |

## §2 Verified-API-correction table

Training-data priors are Effect v3; this repo is Effect v4 (`.repos/effect-v4`
is the source of truth). Every drafting and discovery agent embeds this table
and re-verifies symbols with `rg` before citing them.

| Claim your training data makes | Verified v4 / repo reality |
|--------------------------------|----------------------------|
| `EffectSchema` is a value/schema | **`EffectSchema` is a FACTORY** — call it to build the schema. |
| `PromiseSchema` is a factory | **`PromiseSchema` is a VALUE.** |
| `.implement` returns a plain function | Use the split: **`.implementSync`** (sync fn), **`.implement`**, **`.implementEffect`** (Effect-returning) — check the signature at the definition, do not assume. |
| LiteralKit and MappedLiteralKit share an API | **API split:** `LiteralKit([...])` → `.Options`/`.Enum`/`.is`/`.$match`/`.toTaggedUnion`; `MappedLiteralKit` → `.From.Enum`/`.To.Enum` reversible code map. Numeric/boolean literal keys are stringified (`.Enum.number1`). |
| `Option.getSomes` exists on `effect/Option` | **It does not.** The struct form is repo-added: `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102` (re-exported via `@beep/utils` aliases; already used in `drivers/acp` + `drivers/firecrawl`). `R.getSomes` (from `effect/Record`) is the homogeneous-dictionary form. |
| `S.TaggedUnion` / `S.toTaggedUnion` interchangeable | **Distinct:** `S.TaggedUnion` constructs; `.toTaggedUnion` derives from a kit. Verify per call site. |
| `annotations` always present on AST nodes | **`annotations` needs `?.`** — optional access. |
| v3 combinators (`Effect.catchAll`, `Schema.decode`, …) | v3 tells. Use v4 forms (`S.decodeUnknownEffect` / `S.decodeEffect`, current error-handling combinators). Any of these surviving in packet prose or prompts is a review-blocking defect. |

## Execution disciplines (spec §5, binding on all waves)

1. **§5.1 Definition of Done** — zero actionable S1–S5 findings per family, or a
   documented exception; novel cards live and blocking on crispened families via
   the policy; Law 20/47 amendment merged; catalog generated.
2. **§5.3 Behavior-parity proof** — encoded/wire snapshot byte-identical before
   vs after (SQL row shape for persisted models); at least one
   `S.toArbitrary` round-trip law per absorbed invariant.
3. **§5.4 Ripple protocol** — any public-form change ships the consumer sweep in
   the same PR (breaking-change ripple sweep, no deferred call-site fixes).
4. **§5.5 Inventory record shape** — every discovery finding is
   `{ ruleId, file, line, symbol, smell, proposedTarget, confidence (0–1), mechanization ("codemod"|"assisted"|"judgment"), roiRank, exception? }`.

## §6 Fences (Non-Goals, verbatim in SPEC.md)

1. Service-contract/interface carve-out: service shapes and port interfaces stay
   interfaces; crispening does not schema-ify service contracts.
2. SQL absence encodes `null`: persisted-model columns keep `null` at the wire;
   Option lives at the domain boundary, not in the row codec.
3. No error-tag merging: distinct tagged errors stay distinct.
4. No trust-boundary weakening: escaping, sanitization, URL/injection guards
   stay explicit and property-tested.
5. No `declare namespace` recursion blocks touched: `Type`/`Encoded` namespace
   blocks required for `S.suspend` mutual recursion are load-bearing.
6. No `Graph`/`MutableHash*` schema-ification.
7. No native-collection migration — that is `effect-native-migration`'s seam.
8. Touch-scoped waves: each wave edits only its family's packages.
9. No public-form change without the same-PR consumer sweep (§5.4).
