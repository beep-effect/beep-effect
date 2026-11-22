---
title: "P3: the OA residual keeps every quad a rejected annotation reaches, even when an accepted one carries it"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Subtract only the quads no accepted annotation consumes, by a decision file edited with the L2-6 row"
---

A call the P3 design does not settle, taken in the fix commit after commit 6. Decision `p3-oa-rejections-go-to-the-residual` sends a rejected annotation's triples to the residual. Two third-party annotations can share a target node, and through it its selectors, or an activity node. Commit 6 removed from the residual every quad an accepted annotation consumed, so a rejected annotation that shared a target with an accepted one kept its `oa:hasTarget` link in the residual while the target and selector quads it points at left it, and a shared `prov:Activity` typing quad went the same way.

The residual now keeps every quad a rejected annotation reaches through the profile: the quads about the annotation, its targets, their selectors and the runs that specialize it, and the `rdf:type prov:Activity` quad of each activity it or one of its runs names. Where an accepted annotation shares those nodes, the same input quads are both carried by the document and kept in the residual; the residual is therefore not disjoint from what the document carries. `L2-6` states it two ways over generated input that now draws shared target nodes: each rejected annotation's reached quads, read by an independent walk in the test, are in the residual, and decoding the residual alone gives the same rejections. A fixture shares a target and an activity between an accepted `Word` and an `unknown-kind` `Section`.
