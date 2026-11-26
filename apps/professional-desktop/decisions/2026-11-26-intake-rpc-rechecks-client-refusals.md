---
title: The document intake RPC re-checks the size and emptiness refusals the renderer already applies
date: 2026-11-26
reversal: Trust the renderer's intakeRefusal and file whatever payload reaches IntakeDroppedFile.
governs:
  - src/intake/DocumentIntakeOrchestrator.ts#DocumentIntakeHandlersLive
  - src/intake/DocumentIntakeOrchestrator.ts#MAX_INTAKE_CONTENT_BYTES
enforcedBy: []
---

The renderer refuses oversized and empty files before reading them, but the renderer is not the boundary: a payload can be posted straight at the sidecar RPC. The handler refuses both where they land.
An oversized payload arrives base64-expanded and is held in memory through extraction and filing, so it could exhaust the sidecar. A zero-byte payload would write a content-free object to the vault and ask the model to invent a rationale for a document that does not exist.
Rejected: relying on the renderer's refusal alone.
