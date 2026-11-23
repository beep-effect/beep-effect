---
title: "P4: recheck nanopub publication identity on decode"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Version the native profile and identity preimage together; retain refused foreign data with original names."
---

Decode rechecks ClaimId and canonical publication metadata, re-mints nanopub/v1 NanopubId and compares the publication plus four derived graph IRIs exactly. Stale publication id after publisher/time edits and wrong derived graph IRI are integrity refusals with original input. Foreign graph/publication names may remain import metadata but are not accepted native-profile publications. Normalization runs only after integrity validation and sorts/deduplicates accepted quads; it cannot rename or repair failed identity. Add both fixtures to NanopubAdapter.test.ts. The exact TTL licensing hold is unchanged.
