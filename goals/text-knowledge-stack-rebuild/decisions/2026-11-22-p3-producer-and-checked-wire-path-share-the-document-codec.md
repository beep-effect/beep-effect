---
title: "P3: producer and checked wire path share the document codec"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Make each leaf own a private module-scoped document codec"
---

The producer and checked handoff wire path use the same exported module-scoped extractionDocumentCodec from Handoff.model. This preserves identical document verification and avoids constructing a schema or compiling a codec inside a call. The codec is configured for the extraction annotation document once at module scope.
