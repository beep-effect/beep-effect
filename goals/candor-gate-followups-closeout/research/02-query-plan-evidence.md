# Candor filing-read query-plan evidence

Date: 2026-08-13

## Query shape

All three repositories execute the production predicate and ordering:

```sql
WHERE org_id = $1 AND citing_application = $2::jsonb
ORDER BY id ASC
```

The focused PGlite proof seeds 10,001 rows per table, arranged as 100 generated
rows per tenant plus the seed row, runs `ANALYZE`, and captures
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

## Observed plans

| Table | Access node | Index | Actual rows | Rows removed by JSONB filter |
| --- | --- | --- | ---: | ---: |
| `law_practice_candor_disposition` | Index Scan | `law_practice_candor_disposition_org_id_btree_idx` | 1 | 99 |
| `law_practice_ids_submission_fact` | Index Scan | `law_practice_ids_submission_fact_org_id_btree_idx` | 1 | 99 |
| `law_practice_patent_citation_event` | Index Scan | `law_practice_patent_citation_event_org_id_btree_idx` | 1 | 99 |

The committed regression test asserts the tenant index name, one returned row,
and fewer than 100 rows removed by the filing filter for every table. It does
not assert timing, which would be machine-dependent.

## Physical-design disposition

No generated column, expression index, or JSONB index is added. At the measured
representative cardinality the existing tenant index bounds work to one
tenant's 100 rows before exact filing equality. A new index would add write and
storage cost to append-only evidence tables without solving an observed planner
problem.
