---
title: "Measure engine construction by building one more identical engine in the probe"
date: 2026-11-13
lane: "perf/citation-hoist-installs"
reversal: "Drop the construction row and the construct effect from the replay fixture."
---

The probe needs the replay's observed spawner, which exists only after the first engine is built. makeCitationCanonicalExtractionReplay therefore exposes construct, which builds a second identical default engine in the same layer scope, and prepareCitationCanonicalFullSpanReplay measures it. The row is asserted by its own Bun test (citationCanonicalFullSpanConstruction): 16 metadata-operation installs, 10 detaches, 1 tokenizer build, 26 regex evaluator installs, 0 evaluations and 0 child processes. The design estimated 12 evaluators; each parent installs its own helper chain (for example both CaseMetadata and ReferenceTokenExtraction install a case-name selection), which is once per call site and operation.
