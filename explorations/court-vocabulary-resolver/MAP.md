# Court Vocabulary Resolver — Map

## Candidate Goal Packets

| Order | Slug | Mission | Depends on | Gate / status |
| --- | --- | --- | --- | --- |
| 1 | [`court-reporter-vocabulary`](../../goals/court-reporter-vocabulary/README.md) | Generate and publish one versioned courts-db + reporters-db identity substrate with stable IDs, provenance, drift reports, and public law-practice lookup APIs. | Existing `SyncDataToTs` mechanism | **GRADUATED 2026-07-14.** P0: pinned-source assembly + stable-ID lifecycle/compatibility spike. |
| 2 | `court-string-resolver` | Port pinned courts-db behavior into a pure, offline Effect resolver returning typed court-specific results. | `court-reporter-vocabulary` | Queued behind goal 1. P0: re2js full-corpus compatibility/parity/timing spike plus CourtListener crosswalk and `CourtInference` migration spike. |
| optional | `court-name-fuzzy-ranking` | Add evidence-calibrated alternative ranking without changing core resolver determinism. | `court-string-resolver` | Gated by representative calibration fixtures and a metric-specific acceptance threshold. |
| optional | `court-vocabulary-skos-projection` | Generate a SKOS view from the canonical vocabulary. | `court-reporter-vocabulary` | Gated by a named consumer; derived only, never a second taxonomy. |

`court-string-resolver` is the packet's re-entry point under the repository's
reopen-at-`decompose` convention. Reopen when
`court-reporter-vocabulary` proves the versioned artifact, stable-ID
lifecycle, and compatibility contract. Fuzzy ranking and SKOS remain gated
follow-on notes rather than independent reopen triggers.

## Sequencing

`court-reporter-vocabulary` is the first vertical slice because every resolver
result and downstream join needs stable IDs and an artifact compatibility
version. It versions court and reporter datasets together because live citation
models already carry reporters-db normalization. It also establishes the shared
BSD-2 notice and drift surface once.

`court-string-resolver` follows and consumes only the public vocabulary/lookup
surface. Its P0 spikes retire the two implementation unknowns before design is
fixed: regex-engine fidelity/safety and the exhaustive interop/lossy-inference
projection. Fuzzy ranking and SKOS are optional independent bets, not completion
criteria for either core goal.

## First Vertical Slice

Given pinned courts-db and reporters-db commits, an agent can run the existing
sync command to deterministically render both package-private artifacts, inspect
source URLs/retrieval dates/SHA-256 values and record/ID counts, and receive an
explicit drift report instead of silent mutation. Law-practice consumers can
decode stable court/reporter IDs and use named source-faithful lookups without
importing raw generated modules. A second identical run produces no diff.

P0 must additionally demonstrate one deletion/tombstone case, one alias or
merger case, one reused abbreviation case, and one date-split case against the
proposed lifecycle/version policy before that policy is accepted for graduation.

## Capability Check

| Component | Existing capability / exact path | Assessment |
| --- | --- | --- |
| Target registry and implementations | `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/index.ts`; `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/CldrTerritories.ts`; sibling targets in the same directory | Reuse the target mechanism; court and reporter targets are **NET-NEW**. |
| Target schemas and capability boundary | `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.schemas.ts` (`SyncDataSourceMetadata`, `SyncDataTargetProjection`, `SyncDataTarget`; live required `access: SyncDataTargetAccess` field; services are HTTP client + crypto) | Reuse. Both new targets are `access: "public"`; no secrets or ambient capabilities. |
| Package-private generated zone | `packages/foundation/primitive/data/src/generated/cldr-territories.ts`; `packages/foundation/primitive/data/src/generated/cldr-territories.data.json` | Reuse the generated-artifact family and directory; courts/reporters artifacts are **NET-NEW** and stay package-private. |
| Citation consumer contract | `packages/law-practice/domain/src/values/Citation/Citation.models.ts` | Existing consumer expects reporters-db normalization and `CourtInference`; artifact compatibility integration is **NET-NEW**. |
| Existing court inference values | `packages/law-practice/domain/src/values/CourtInference/CourtInference.model.ts` (`CourtInference`, `CourtLevel`, `CourtJurisdiction`) | Reuse only as a lossy derived projection; richer collision-free vocabulary and migration are **NET-NEW**. |
| Stable IDs and canonical vocabulary | `packages/law-practice/domain/src/values/` | Established value-object home/pattern; `CourtId`, `ReporterId`, source-faithful schemas, lifecycle rules, and public lookups are **NET-NEW**. |
| Pure resolver | `packages/law-practice/domain/` | Correct driver-neutral semantic home per `standards/architecture/03-driver-boundaries.md`; resolver/result schemas and parity suite are **NET-NEW**. |
| Hosted CourtListener wrapper | `@beep/courtlistener/`; `standards/architecture/03-driver-boundaries.md` | Future external boundary only; not used by either core goal. |
| Family routing | `standards/architecture/07-non-slice-families.md` | Confirms tooling owns repo automation, domain owns product meaning, and static datasets are not a service. |

**Honest net-new inventory:** two sync targets; deterministic courts-db source
assembly; court + reporter generated artifacts; stable-ID lifecycle and artifact
compatibility contracts; public domain vocabularies/lookups; typed resolver
result; parity/safety suite; pure resolver; lossy `CourtInference` projection;
and, only if admitted, the interop crosswalk, fuzzy tier, and SKOS projection.

## Cross-Packet References

| Packet / surface | Relationship | Dependency statement |
| --- | --- | --- |
| `citation-extraction-engine` | Consumer of reporter/court IDs, lookup APIs, and artifact version | May scaffold today with `blockedBy: court-reporter-vocabulary`; goal 1 removes the block. It continues to own tokenization, extraction, grouping, and citation resolution. |
| `ip-law-knowledge-graph` | Consumer of stable IDs | References canonical IDs; retains ownership of abstract court/jurisdiction KG nodes. |
| `drivers/courtlistener` | Future hosted adapter | May translate hosted CourtListener data at a boundary later; it does not own static artifacts, canonical vocabulary, or the pure resolver. |

## Open Risks Inherited From The Brief

- Full courts-db rendering inputs and record/ID-count invariants must be pinned
  before the artifact schema is frozen.
- The stable-ID lifecycle and artifact-version contracts were ratified at the
  2026-07-14 shape sign-off; implementation proof remains P0-gated.
- RE2 compatibility and adversarial timing must be measured over the entire
  pinned corpus, not inferred from samples.
- CourtListener interop is non-isomorphic and AGPL expression is off-limits;
  exhaustiveness must be proven from re-expressed facts.
- Existing `CourtInference` consumers may make migration wider than expected;
  P0 must bound it without creating a competing model.
- seal-rookery remains reference-only because its data license is unknown.
- Fuzzy thresholds are meaningful only for the selected metric and fixture set.
