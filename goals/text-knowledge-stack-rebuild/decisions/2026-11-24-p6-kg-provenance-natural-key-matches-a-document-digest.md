---
title: "P6: kg_provenance by natural_key also matches document nodes by digest"
date: 2026-11-24
lane: "p6"
reversal: "Match kg_provenance natural_key against kg_node.natural_key only"
---

After documents key as digest@docket, a caller that passes a bare digest as natural_key would match only an unfiled document. The provenance query also matches kind = 'document' rows whose provenance_ref equals the value, under the same granted-family filter, so the answer is each granted matter's document node for those bytes and never another matter's. The digest parameter keeps reading the DuckDB documents rows.
