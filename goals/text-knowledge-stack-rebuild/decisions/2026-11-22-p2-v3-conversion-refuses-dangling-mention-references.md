---
title: "P2: the v3 conversion refuses a dangling mention reference itself and leaves dangling authority, group and list references to the live coherence check"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Check every authority, group and list reference against the converted receipt inside convertDocumentV3 and refuse with its own issue message."
---

Step 5 of the read transform rewrites every reference through the old-to-new maps and refuses a dangling one. A mention reference has to be refused in the conversion: an id the mention map does not hold has no cm2 image, so there is nothing to write. Authority, group and list ids are kept unless the case-occurrence step re-keyed them, so a reference that names no node passes through unchanged, and the live CitationDocumentReceipt decode that ends the conversion refuses it with its relationship coherence check (unique ids, closed references, one resolution per mention). Checking those again in the conversion would duplicate the domain filter. The case-occurrence v2 key over a new mention id comes from makeCaseOccurrenceAuthorityId, exported from AuthorityIdentity.ts and shared with makeCitationAuthorityId, so the conversion cannot drift from the live key. Tests: a dangling warning and a dangling member list entry are refused by the conversion, an unknown authority by the coherence check.
