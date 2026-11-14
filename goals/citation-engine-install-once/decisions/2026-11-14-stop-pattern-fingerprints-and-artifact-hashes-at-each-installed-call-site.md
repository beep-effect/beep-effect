---
title: "Stop pattern fingerprints and artifact hashes at each installed call site"
date: 2026-11-14
lane: "perf/citation-owned-configuration"
reversal: "Delete this stop when fingerprints move into the owned value; the per-call-site checks stay until then."
---

Stop rule, design section 2.1 (fingerprints, court table hash and vocabulary artifact hash run inside own once and live on the owned value). ownCitationConfiguration is generic over a schema and does not know which fields are fixed patterns or what each stage expects, so it cannot compute or check them. Carrying the results on the owned value needs the configuration's decoded type to hold them, for example a fingerprinted pattern schema whose decoded side is the storage plus its SHA-256. CitationEngineConfiguration and the stage configurations are exported schemas, so that changes public types and wants its own design pass.

What this slice does instead: every authentication stays (no guard removed). Each installed stage prepares and fingerprints its fixed patterns once per call site at engine construction (copyCitationMetadataPatterns, prepareCitationPublicationMetadata); the per-request reference-pattern builder still re-checks its fingerprints per request, CaseMetadata and PostCaseMetadata still hash the court table at install, and SemanticProjection still rebuilds the vocabulary (and its hash) at install. The schema decodes and descriptor copies that surrounded the fingerprints are gone. Proposed reshape: a fingerprinted pattern codec in the configuration schemas, computed during the boundary decode, and stage installers that compare the carried fingerprint with their expected constant.
