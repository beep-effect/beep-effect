---
title: "P2: the party TextSpan case is deleted and replaced by a TextOccurrence case over Anchored; the party OccurrenceId becomes ArtifactOccurrenceId"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p2-text"
reversal: "Restore TextSpan and the old name from git; no row and no producer holds either."
---

TextSpan has no producer and no stored row; its one use is a negative decode test. It cannot be minted into an OccurrenceId (no extractor, no normalization version, no prefixed digests, no unit). The union keeps the ability to point at text: TextOccurrence { occurrence: ArtifactOccurrenceId, anchored: Anchored }, where Anchored is the @beep/text receipt. A bare OccurrenceId would name a place without saying where it is, since party has no anchors table, and the SPEC sentence that TextSpan becomes a text occurrence is met with the id derivable from the receipt. The case tag changes, so old TextSpan JSON is refused. HeaderField, MetadataTag and RecordRow are unchanged: they are not text selectors and no fragment specification IRI is invented for them. The party identifier that identifies a record occurrence is renamed ArtifactOccurrenceId, after the ArtifactOccurrence entity it keys; the party-occ prefix and every value stay. The party ActivityId and Digest and the private cli Codex OccurrenceId const share a word with a stack name and no reserved name; P4 decides ActivityId with the claims layer, and the cli const is module-private and stays.
