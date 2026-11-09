---
title: "Program shape: one packet, design first, layers bottom-up, folds by census"
date: 2026-11-08
lane: "goals/text-knowledge-stack-rebuild"
reversal: "Split any phase into a child packet whose requires names only independently completed capabilities (never this packet's own provides), or reorder phases by a checkpoint; nothing persisted depends on the order."
---

The operator read the reader audits and critic reviews behind the 2026-11-08 rebuild report and asked for a careful redesign and rewrite of the text-knowledge stack as a goal packet, rather than re-scoping the empty explorations/nlp-annotation-family packet. This packet is that program. Its shape follows the report's section 7 path, reordered against the dependency DAG: a design-and-grill phase that resolves the five open questions in SPEC.md, then the layers bottom-up (L0 identity, L1 text, L2 annotation, L4 claims, L3 and L6, L5 and L7), then a per-facet census that decides every fold and rename. The lossy boundaries (handoff, invented confidence, array-order ids, auditless projection) are repaired before any package is renamed, so the product keeps its evidence intact even if the census declines every fold. One packet per path step was considered and deferred to Open Question 5, decided by the three-PR rule in P0.


Amended 2026-11-09: the repair-before-rename sequencing and the late census in this decision are superseded by `2026-11-09-breaking-changes-accepted-the-best-core-outranks-compatibility.md` and `2026-11-09-open-questions-1-5-resolved-toward-the-clean-core-p0-confirms-or-reverses.md`; the program now rewrites the layers bottom-up and cuts consumers over as each lands, with the consumer census as P0's work list. The one-packet shape and the three-PR decomposition rule stand.
