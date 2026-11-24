---
title: "P6: chapter 16 pending-P6 agent-surface notes close as delivered or scoped; prompt bytes stay"
date: 2026-11-24
lane: "p6"
reversal: "Render the langextract prompt from schema annotations and re-pin semantica's HOSTED_EXTRACTION_ARTIFACT_HASH from a measured run"
---

Chapter 16 section 12 carries pending-P6 notes that are not map questions: prompts render from schema annotations, and an attorney-facing invariant. Prompt rendering stays out of P6: buildPrompt's bytes key semantica's hosted artifact hash (apps/labs/semantica/src/layers/ExtractorLive.ts:244) and every handoff's promptDigest (langextract/src/Handoff/Handoff.behavior.ts:78-84), so a change needs a measured re-pin, which is its own work with no P6 acceptance attached. The attorney-facing invariant is delivered as admission bound to the opened revision through LawAdmission, with the gate checked first; drafting invariants wait for a drafting surface. The exit row rewrites each pending note to the delivered state or this scope.
