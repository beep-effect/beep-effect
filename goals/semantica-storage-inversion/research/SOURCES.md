# Semantica Storage Inversion: Sources and Provenance

- **Source exploration:**
  [`explorations/semantica-lab`](../../../explorations/semantica-lab/README.md)
- **Primary ledger:**
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md)
  — this file is the goal-side mirror; when the two disagree, the exploration
  ledger wins and this copy is corrected.
- **Decision authority:**
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
  (Current law table; 2026-09-03 ratification grill R0.a, R1.a–R1.i).
- **Design source:**
  [`MAP.md` §S](../../../explorations/semantica-lab/MAP.md#s-semantica-storage-inversion--what-delete-and-compaction-must-mean)
  v1.1; adversarial review
  [`reviews/2026-09-03-sol-reentry-review.md`](../../../explorations/semantica-lab/research/reviews/2026-09-03-sol-reentry-review.md).
- **Carry-forward date:** 2026-09-03

The tables below reproduce the rows of the exploration's corpus this spike
composes. Machine-local paths are rendered as out-of-repo locations by name.

## 1. Mined source corpus

The D5 extraction IR (`scratchpad/semantica-ir`, 6,105 records, SHA-256
stamped; stats in
[`ir-extraction-report.md`](../../../explorations/semantica-lab/research/ir-extraction-report.md))
is not on this spike's path. Its determinism discipline is the model for the
probe digests.

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this spike takes |
| --- | --- | --- | --- |
| `semantica-agi/semantica` (out-of-repo workstation clone, `danklocal` branch at `add1c006`) | MIT (Hawksight AI, verified in its `LICENSE`) | port-with-attribution (ideas ported schema-first, not vendored code) | the shape being inverted: `ProvenanceEntry` invalidation fields + checksum chain, `change_management` snapshot/rollback ([`grounding-semantica-repo.md`](../../../explorations/semantica-lab/research/grounding-semantica-repo.md)) — reference only |
| `scratchpad/effect-ontology` (in-repo quarantined experiment) | in-repo; upstream was MIT per its ledger | borrow-shape / pattern only; non-importable | `ClaimWithRank` transactionTime split, `CurationAction`/`CurationEvent` command-vs-event split, `ConflictTransition` ([`effect-ontology-map.md`](../../../explorations/semantica-lab/research/effect-ontology-map.md) rows 102, 105, 148); its in-place `deprecateClaim` UPDATE is the anti-pattern (row 27) |

## 3. External research sources

Every URL below appears in the exploration ledger and was fetched there.

- S1 stop rule — Shape Up ch. 3 "Appetite" https://basecamp.com/shapeup/1.2-chapter-03 ;
  ch. 8 "The circuit breaker" https://basecamp.com/shapeup/2.2-chapter-08 ;
  ch. 14 "Decide When to Stop" https://basecamp.com/shapeup/3.5-chapter-14
- S4 lab shape — Tauri v2 process model https://v2.tauri.app/concept/process-model/
  (the app-data-shaped `dataDir` root P-S3 targets)
- Doyle 1979, "A Truth Maintenance System"
  https://doi.org/10.1016/0004-3702(79)90008-0 (support-set retraction over
  recorded premises, the P-S1 law)

## 4. In-repo capability references

| Brick | Path | Mark |
| --- | --- | --- |
| `Invalidated` tombstone | `apps/labs/semantica/src/schema/Provenance.ts` (`InvalidatedEventBody`, `ClaimId`; `EventKind` LiteralKit) | reuse; NET-NEW emission path in `LedgerLive.appendBatch` |
| Hash chain | `src/schema/Provenance.ts` (`prev`, `makeProvenanceEventId`), `contentDigestSync`, row `digest` | reuse; NET-NEW `Redacted`/`Compacted` bodies, `CompactedSnapshot`, chain validator |
| Ledger DDL + read path | `apps/labs/semantica/src/layers/LedgerLive.ts` (seven append-only PGlite tables, `ledgerRoot/runId/mode` layout; `Ledger.read` selects `batches`, `parse_outcomes`, `events` independently) | extend: nullable payload, `body_digest`, `prev` columns; chain-order read |
| Claim → statement bridge | `apps/labs/semantica/src/layers/RdfProjectionLive.ts` `claimQuads` (module-private) | expose to retraction; the rebuild consumes `batches` only |
| Rebuild identity witness | `src/schema/Projection.ts` `QuadDelta`; `src/schema/Reasoning.ts` `CrashProjectionInput`, `CrashIdentityWitness`; `test/helpers/CrashProbeChild.ts` | extend with removed statements and events |
| Recorded premises | `src/schema/Reasoning.ts` `ProofDag` nodes, `InferenceEvent.premises: NonEmptyArray<StatementId>` (`S.NonEmptyArray(StatementId)`) | reuse (S8: the only premises retraction may consult) |
| File-backed ledger | `packages/drivers/pglite/src/PgliteClient.service.ts` `makeLayer({ dataDir })` | reuse |
| Telemetry sidecar | `src/schema/Telemetry.ts` `EvalRunTelemetry` | extend: bytes before/after |
| PROV-O projection | `@beep/rdf` Prov `invalidatedAtTime` | reuse for the PROV projection of retraction |
| C2 evidence | `goals/semantica-canary/history/c2/` (`SHA256SUMS`, live/replay reports and telemetry, crash log) | the P-S0 target digest |
| Provider cache | lab `ProviderCache` (`SEMANTICA_PROVIDER_CACHE_DIR`, untracked workstation directory) | the regeneration fixture; NET-NEW reverse index for erasure |

**How these inform implementation:** everything above the DDL line is
composed; the NET-NEW surface is two event bodies, one snapshot schema, three
columns, the validator, the erasure closure with its reverse index, and size
accounting. Nothing is updated in place.

## 5. Cross-links and provenance

- Goal ↔ exploration: this packet is `links.goals[]` in
  [`explorations/semantica-lab/ops/manifest.json`](../../../explorations/semantica-lab/ops/manifest.json);
  `provenance.exploration` in [`ops/manifest.json`](../ops/manifest.json).
- Siblings: [`goals/semantica-canary`](../../semantica-canary/README.md)
  (C2 evidence, standing constraints);
  [`goals/semantica-reasoning-spike`](../../semantica-reasoning-spike/README.md)
  (inherits the tombstone law after P-S1);
  [`goals/semantica-atlas-sync`](../../semantica-atlas-sync/README.md)
  (writes any atlas row a storage verdict changes).
- Decision log: [`SPEC.md` §Decision Log](../SPEC.md#decision-log).
