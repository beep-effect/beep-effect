---
title: "NLP same-schemas is stated over the stack types the tools expose"
date: 2026-11-24
lane: "p6"
reversal: "Export every NLP tool's parameter and success schema and compare each tool against them in a table."
---

The NLP tools declare their parameters and success shapes as module-private schemas, so the np case of property (e) is stated over the stack types they expose: every JSON Schema definition a tool publishes is either local to that tool (its own module or nlp-processing internals) or equal to the definition its stack type (the _schemas exports, Position, UnitInterval, BM25Norm, MarkRange) publishes on its own; the tools that expose spans are exactly those that publish Position. Exporting 45 tool-local schemas only for a test would add public API with no consumer.
