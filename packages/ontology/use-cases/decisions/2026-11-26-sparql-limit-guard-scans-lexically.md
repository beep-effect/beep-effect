---
title: The SPARQL LIMIT safeguard finds the query's own top-level LIMIT with a one-pass lexical scan
date: 2026-11-26
reversal: Replace topLevelLimit with a regex over the query text, or with a full SPARQL parser.
governs:
  - src/aggregates/Session/Session.sparql.ts#topLevelLimit
  - src/aggregates/Session/Session.sparql.ts#truncateResult
  - src/aggregates/Session/Session.sparql.ts#runOntologySparql
enforcedBy: []
---

`topLevelLimit` is a safety guard, not a formatter: a false "already limited" lets the engine materialize an unbounded result set before `truncateResult` runs, which can exhaust the sidecar. The scan tracks lexical state: `#` comments run to end of line, quoted and triple-quoted literals and `<…>` IRIs are opaque, and only a standalone `LIMIT` keyword at brace depth 0 counts.
It returns the LIMIT value, not a flag. `effectiveLimit` reports the bound actually in force: the query's own LIMIT, or the safeguard default only when it was injected. A `LIMIT` with no number is not a bound the engine honours, so it counts as absent and the default is injected.
An ASK returns one boolean, so it is neither limited nor truncated: no LIMIT is appended to the user's query.
Rejected: a regex, which reported a LIMIT inside a comment or a subquery as a bound; a multi-pass parser, whose cost grows with the input (the fallow-ignore exit names a real SPARQL parser as the replacement).
