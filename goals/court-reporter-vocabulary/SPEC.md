# Court Reporter Vocabulary Spec

## Objective

Deliver one versioned court-and-reporter identity substrate from pinned
courts-db and reporters-db commits. Add public `SyncDataToTs` targets that use
HTTP and SHA-256 only; deterministically render package-private artifacts under
`@beep/data` `generated/`; and expose stable public IDs, canonical vocabulary,
lookups, provenance, and a machine-readable artifact compatibility contract
from law-practice domain values.

Each artifact records source identity, pinned commit, retrieval date, checksum,
refresh command, record/ID counts, and artifact version. Refresh detects and
reports drift for review; it never silently mutates runtime data. The shared
root [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) carries the full
BSD-2 notice/disclaimer, Free Law Project copyright, upstream repositories,
pinned commits, and affected material.

## Non-Goals

- Court-string resolver behavior; that is queued goal 2.
- Fuzzy matching or ranking and SKOS projection.
- Hosted CourtListener access or CourtListener taxonomy as decode authority.
- Citation extraction, grouping, orchestration, or resolution.
- Abstract court/jurisdiction knowledge-graph nodes.
- Redesigning the sync engine, publishing raw generated tables, or runtime data mutation.

## Source Hierarchy

1. The ratified 2026-07-14 graduation objective and
   [`BRIEF.md`](../../explorations/court-vocabulary-resolver/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. Exploration [`DECISIONS.md`](../../explorations/court-vocabulary-resolver/DECISIONS.md),
   [`MAP.md`](../../explorations/court-vocabulary-resolver/MAP.md), and research.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/` for two public targets.
- `packages/foundation/primitive/data/src/generated/` for package-private artifacts and sidecars.
- `packages/law-practice/domain/src/values/` for IDs, vocabulary, lifecycle/compatibility schemas, and lookups.
- Root `THIRD_PARTY_NOTICES.md`, focused fixtures/tests, and packet evidence.

## Constraints

1. Acquisition is pinned-commit HTTP plus SHA-256 only: no secrets, mutable refs,
   runtime fetches, or ambient capabilities.
2. P0 must identify authoritative templated inputs versus rendered releases,
   render deterministically, and prove source-record and stable-ID counts. Never
   freeze the artifact schema from stale historical counts.
3. Raw artifacts remain package-private. Cross-package consumers use named
   law-practice values/lookups only.
4. Public identities include stable `CourtId` and `ReporterId`. Court vocabulary
   preserves courts-db jurisdiction/system/type/level source-faithfully with
   collision-free names such as `CourtHierarchyLevel`; existing
   `CourtInference`, `CourtLevel`, and `CourtJurisdiction` remain a lossy derived
   projection, not canonical names.
5. reporters-db string `cite_type` is canonical. CourtListener composite/integer
   enums are optional, pinned, tested derived interoperability only and never
   decode authority; no AGPL expression may be transcribed.
6. Issued IDs are never reassigned or removed from the compatibility surface.
   Deletions become tombstones; renames/mergers retain aliases and canonical
   successors; reused abbreviations are contextual aliases; date-split rows get
   distinct IDs and explicit effective ranges.
7. Refresh reports additions, deletions, alias changes, mergers, abbreviation
   reuse, date splits, and compatibility classification in a reviewable artifact.
8. Publish one court/reporter artifact version ID and machine-readable contract.
   Added rows/aliases are compatible. ID reassignment, semantic reuse, removal
   without tombstone, or incompatible schema/projection changes require a new
   incompatible version.
9. Any regex compatibility observations in this lane are evidence shared with
   the resolver/engine safety work; they do not add resolver behavior here.
10. Root BSD attribution is canonical; sidecars link provenance but do not
    duplicate notices. P0 verifies the scaffolded pins before derived material
    lands and records any ratified pin change in the notice and evidence.

## Acceptance Criteria

- [ ] Both pinned public targets acquire by HTTP, verify SHA-256, and regenerate
      byte-identical artifacts and sidecars on two identical runs.
- [ ] Evidence records source identities, pins, retrieval dates, checksums,
      refresh command, source-record counts, emitted-record counts, stable-ID
      counts, and a no-diff second run.
- [ ] Package-private artifacts cannot become a consumer contract; stable IDs,
      canonical vocabulary, provenance, lookups, artifact version, and
      compatibility classification are public domain surfaces.
- [ ] Tombstone, alias/successor, reused-abbreviation, and date-split fixtures
      prove the ratified lifecycle, with a reviewable refresh report.
- [ ] The machine-readable compatibility contract distinguishes additive-
      compatible changes from incompatible identity/schema/projection changes.
- [ ] `citation-extraction-engine` can record/check the public artifact version
      and resolve stable court/reporter IDs without reading raw generated files.
- [ ] The root notice contains the full BSD-2 text/disclaimer, Free Law Project
      copyright, both upstream repos, final pinned commits, and affected material.
- [ ] Focused package tests, repo gates, reflection lint, and Yeet PR-to-mergeable proof pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher | `test "$(wc -m < goals/court-reporter-vocabulary/GOAL.md)" -le 4000` | Pass |
| Manifest | `jq . goals/court-reporter-vocabulary/ops/manifest.json` | Pass |
| Determinism/counts | P0/P2 generation evidence | Two runs byte-identical; all counts recorded |
| Drift/lifecycle | Focused refresh fixtures | Every ratified change class reported correctly |
| Consumer contract | Focused law-practice tests | Version/stable IDs work without raw imports |
| Attribution | Notice/provenance review | Pins and affected material complete |
| Repo quality | `bun run beep yeet verify` | Green |

## Stop Conditions

- P0 cannot identify authoritative source assembly or deterministic counts.
- Stable-ID fixtures expose reassignment, silent removal, or ambiguous succession.
- Implementation requires public raw files, runtime mutation/network, AGPL
  transcription, or sync-engine redesign.
- Required sources conflict materially or verification requires unnamed authority.

## Decision Log

- Ratified appetite, source acquisition, package ownership, taxonomy authority,
  stable-ID lifecycle, compatibility contract, and attribution are in the
  exploration [`DECISIONS.md`](../../explorations/court-vocabulary-resolver/DECISIONS.md).
- Resolver regex selection, CourtListener crosswalk, lossy inference migration,
  fuzzy calibration, and SKOS remain deferred exactly as recorded there.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
