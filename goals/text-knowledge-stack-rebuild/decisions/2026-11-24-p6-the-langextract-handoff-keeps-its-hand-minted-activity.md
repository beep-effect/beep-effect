---
title: "P6: the langextract handoff keeps its hand-minted Extract activity; the flow records it as an ActivityRecord"
date: 2026-11-24
lane: "p6"
reversal: "Wrap the langextract extract call in withActivity with operation:Extract and remove the hand-minted ExtractionActivity from the handoff, re-pinning semantica's artifact hash"
---

Which runs P6 wraps in withActivity is open (map O question O12). The langextract handoff mints its own operation:Extract activity at start (langextract/src/Handoff/Handoff.behavior.ts:69) and carries it inside the handoff value, and semantica pins the service output through HOSTED_EXTRACTION_ARTIFACT_HASH (apps/labs/semantica/src/layers/ExtractorLive.ts:244). Wrapping it would mint a second activity for the same run or move the id out of the handoff and break that pin. P6 therefore wraps the office-action law steps (MapToLaw, ProposeClaim) and the claim_propose handler, and the flow records the handoff's activity as an ActivityRecord built from handoff.activity (id, start), the annotation ids it generated and an ended read when extract returns, clamped to be no earlier than any generation time. Assessment is a pure update of an owner record and is not an activity. Answers O12.

Amended after independent review. `recordedExtract` generates the annotation and occurrence ids from the capture it uses, so MapToLaw and ProposeClaim chain on those ids (decision `2026-11-24-p6-flow-steps-generate-and-use-content-ids-so-attribution-chains`), and the handoff composes with the downstream steps through `composeLogged`. Whether the handoff output already exposes occurrence ids is measured in its row before the step is wrapped.
