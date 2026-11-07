---
title: "Mint opaque destination ids"
date: 2026-11-07
lane: "goals/vault-sync-domain"
pullRequest: 2886
reversal: "Widen DestinationId in Values.ts back to a branded NonEmptyString and drop mintDestinationId and makeDestinationId"
---

PII audit F3: DestinationId is the SyncDestination aggregate id, View key, URL segment and saga key, and accepted any non-empty string such as a destination name. It is now the fixed prefix documents_sync_destination_ plus a CUID (the PublicEntityId format), checked by a template-literal pattern, so decode rejects names. mintDestinationId draws a fresh CUID; makeDestinationId wraps an existing one. The id lives in Values.ts without the frozen entity kit, since a destination has no SQL row id. The cutover genesis in PR 3b2 must mint one id per destination and never derive it from a name or path.
