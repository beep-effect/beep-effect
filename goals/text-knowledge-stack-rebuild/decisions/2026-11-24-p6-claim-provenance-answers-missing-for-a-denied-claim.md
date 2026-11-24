---
title: "P6: claim_provenance answers Missing for a claim the principal may not traverse, the same value an absent id gets"
date: 2026-11-24
lane: "p6"
reversal: "Return Denied for a denied claim and Missing for an absent one"
---

Independent review of the P6 design. Path 1 deliberately hides a scope's existence behind scope-unavailable, but the first draft's claim_provenance returned Denied for an existing B claim and Missing for an absent id, and claim ids appear in span attributes, so a principal staffed only on A could test whether a B claim exists. ProvenanceResult is Found { provenance } or Missing; ProvenanceTraversal folds a denial into Missing at the use-case boundary, and the tool's failure schema has only Missing. The denial reason is kept in the span (as an access kind and reason attribute, never the scope text). An activity or capture reached through used that the principal may not traverse is omitted from the provenance. Path 7 of the two-matter test expects Missing for a B claim under pA, identical to the response for a non-existent id. Amends the traversal half of 2026-11-24-p6-draft-assembly-and-provenance-traversal-under-the-wall.
