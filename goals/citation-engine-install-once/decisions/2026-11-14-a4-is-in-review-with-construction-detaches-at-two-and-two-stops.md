---
title: "A4 is in review with construction detaches at 2 and two stops"
date: 2026-11-14
kind: checkpoint
lane: "perf/citation-owned-configuration"
reversal: "Return A4 to in progress if review or hosted CI finds a result or accounting change."
---

A3 merged as #3282. A4 adds the CitationOwned brand and ownCitationConfiguration (one JSON-codec detach) at make, makeDefault and the extractor, and removes every nested detach and stage-level configuration decode: the four detachCitationMetadataConfiguration sites, the makeCitationMetadataStage decode, the decodeCitationMetadata*Configuration helpers, the copy steps and the tokenizer field-by-field copy. Per call the full-span probe is unchanged: 0 installs, 0 detaches, 0 tokenizer builds, 0 evaluator installs, 291 evaluations and 291 child processes over ten calls. Construction: 16 installs, 2 detaches (10 before), 1 tokenizer build, 26 evaluator installs. The target of 1 is not reached: the default engine owns its caller configuration and then its assembled configuration, because engine-loaded assets cannot be minted owned without exporting the brand (stop decision); pattern fingerprints and artifact hashes stay per installed call site (stop decision). The four per-request report snapshots and the 2026-11-07 mutation tests are unchanged and pass. Local proof is file by file (129 files); the full suite and coverage run on hosted CI.
