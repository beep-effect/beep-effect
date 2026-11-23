---
title: "P3: extraction result and checked wire codecs live in acyclic module leaves"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Move the result and codec back into the existing model leaves using lazy schema composition"
---

LangExtractResult lives in Extraction.result.ts so its dependency on Handoff.model does not cycle through Extraction.model. The Extraction public barrel still exports the result. Handoff.codec.ts owns the checked wire decode and canonical encode path, keeping Handoff.model available to the result and producer without a codec cycle.
