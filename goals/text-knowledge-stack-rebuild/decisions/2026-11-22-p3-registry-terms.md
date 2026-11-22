---
title: "P3: the annotation, operation, instance and office-action namespaces and the semantica lab terms are declared at a minor release"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Drop a shard and its read sites by a decision file before P3 merges; after the merge a published term leaves only with a deprecation record"
---

Kind IRIs enter every `annotation/v1` preimage and the OA export, so they leave the process and must be declared terms (decision `p1-registry-first-fold-terms-declared`); no shard declares them on this base. New shards: `annotation` (`https://beep-effect.com/ns/annotation/`) with the ten kinds `Section`, `Paragraph`, `Title`, `Figure`, `Sentence`, `Word`, `Mention`, `Chunk`, `RelationCandidate`, `CorefCandidate`; `operation` (`https://beep-effect.com/ns/operation/`) with `Extract`; `instance` (`https://beep-effect.com/ns/instance/`) with no terms, the namespace content-addressed instance IRIs are minted under; `office-action` (`https://beep-effect.com/ns/office-action/`) with the four extraction labels `office_action`, `claim`, `rejection_reference` and `distinction` as locals, product vocabulary owned by law-practice.

The existing empty `semantica` shard gains its entity types (`person`, `organization`, `method`), its structure roles (`title`, `abstract`, `section`, `reference`), `relation-endpoint` and its six relation predicates as one-segment locals (`affiliatedWith`, `authoredBy`, `locatedIn`, `reEvaluatesClaimDueTo`, `selected`, `shows`); semantica keeps a label-to-term table for the strings its fixtures hold. The design generators' `annotation/class/*` and `annotation/predicate/relatedTo` IRIs, which have two-segment locals, are replaced by these terms.

Additions need no deprecation record; the snapshot release is the minor bump the writer computes against the base (2.0.0 to 2.1.0 if nothing else lands first). Production reads every one of these IRIs through `@beep/identity/Registry`.

The existing empty `lejeune` shard (`https://beep-effect.com/ns/lejeune/ontology/`) gains `project`, `delivery_date` and `finish`, the three targets of the lejeune provider smoke.
