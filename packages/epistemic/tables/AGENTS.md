# @beep/epistemic-tables Agent Guide

Epistemic persistence boundary: metadata-only table projections from
`@beep/epistemic-domain` entity schemas, including the `usage_record`
projection backing the real UsageRecord sink and the bitemporal
`edge_version` projection.

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Entities`, `DbSchema` | package entry point |
| `src/entities/CandidateClaim/` | `Table`, `toCandidateClaimInsert`, `fromCandidateClaimRow` | CandidateClaim table metadata and row converters |
| `src/entities/ClaimDisposition/` | `Table`, `toClaimDispositionInsert`, `fromClaimDispositionRow` | ClaimDisposition table metadata and row converters |
| `src/entities/EdgeVersion/` | `Table`, `toEdgeVersionInsert`, `fromEdgeVersionRow` | Bitemporal EdgeVersion table metadata and row converters |
| `src/entities/Evidence/` | `Table`, `toEvidenceInsert`, `fromEvidenceRow` | Evidence table metadata and row converters |
| `src/entities/UsageRecord/` | `Table`, `toUsageRecordInsert`, `fromUsageRecordRow` | UsageRecord table metadata and row converters |

CHECK, EXCLUDE, and partial-index constraints on these tables are owned by the
raw-SQL db-admin migration, not by Drizzle metadata — Drizzle cannot express
them, so this package publishes columns only.

Tables-role contract: `packages/shared/AGENTS.md`.
