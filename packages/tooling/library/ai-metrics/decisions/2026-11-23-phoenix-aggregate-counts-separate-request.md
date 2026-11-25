---
title: Phoenix per-project aggregate counts run as their own short, bounded request
date: 2026-11-23
reversal: Fold hasTraces, recordCount and traceCount back into the inventory GraphQL query and drop the separate timeout.
governs:
  - src/agent-effectiveness.ts#phoenixProjectStatsQuery
  - src/agent-effectiveness.ts#phoenixProjectStatsTimeoutSeconds
  - src/agent-effectiveness.ts#queryPhoenixProjectStats
  - src/agent-effectiveness.ts#probePhoenix
enforcedBy: []
---

The doctor's Phoenix probe asks for project identity in the inventory query and for the span-table aggregates (`hasTraces`, `recordCount`, `traceCount`) in a second request with a 10 s ceiling. Against a 20 GiB phoenix.db the aggregates exceeded 55 s while the identity-only query answered in about 7 ms; in one document, that one slow field marked the whole Phoenix section `unavailable`.

Every failure of the aggregate request (encode, transport, non-2xx, decode, timeout) degrades only the counts to unmeasured, and each carries its own reason, because a single "timed out" label sends an operator after store size when Phoenix rejected the query or was unreachable. The ceiling is short because the counts are advisory: fast and partial beats slow and complete.

Rejected: one inventory query carrying the aggregates; one generic timeout reason for every aggregate failure.
