# @beep/epistemic-tables Agent Guide

Epistemic persistence boundary: metadata-only table projections from
`@beep/epistemic-domain` entity schemas, including the `usage_record`
projection backing the real UsageRecord sink.

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Entities`, `DbSchema` | package entry point |
| `src/entities/UsageRecord/` | `Table`, `toUsageRecordInsert`, `fromUsageRecordRow` | UsageRecord table metadata and row converters |

Tables-role contract: `packages/shared/AGENTS.md`.
