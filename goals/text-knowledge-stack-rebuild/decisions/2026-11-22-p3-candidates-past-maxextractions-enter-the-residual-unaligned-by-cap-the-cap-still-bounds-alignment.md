---
title: "P3: candidates past maxExtractions enter the residual unaligned-by-cap; the cap still bounds alignment"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Align every parsed candidate and drop the cap from alignment, by a superseding decision"
---

Design section 4 requires every parsed candidate in the handoff, but alignCandidates bounds its work by maxExtractions and returns only that prefix. By orchestrator ruling, handoff accepts optional overCap: ReadonlyArray<ExtractionCandidate>, defaulting to empty for its non-schema input. The service passes the unattempted raw tail without manufacturing GroundedExtraction values. The handoff appends those candidates with reason over-extraction-cap, alignment unaligned meaning no aligned proof, and no anchor. The reason distinguishes alignment not attempted from attempted and failed. Text, attributes and confidence survive. candidateCount is attempted input length plus overCap length, equal to the parsed count; diagnostics remain as before and maxExtractions still bounds alignment work. No residual-specific alignment domain is added and IrToLawExtractionError keeps its wire. The existing two-parsed, cap-one service test pins the distinction. This is an explicit amendment of design sections 4.2 and 4.3.
