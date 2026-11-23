---
title: "P4: bind stateless arrows to owner codecs"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Replace the binding factories with explicit codec arguments while migrating callers and retaining the versioned encoded preimages."
---

Schema factories return annotated ingredients for caller-owned Opaque wrappers. Bind the checked Effect.fn arrows once to the actual core or coordinate codecs through makeClaimArrows and makeAssessmentArrows; this captures no mutable state and creates no foundation service. Infer the core codec directly rather than through a whole generic factory return type, and reuse makeClaimRecords so encoded and constructor input types remain caller-owned. Refusal values preserve the original input record reference; schema decoding alone grants no checked identity or authority.
