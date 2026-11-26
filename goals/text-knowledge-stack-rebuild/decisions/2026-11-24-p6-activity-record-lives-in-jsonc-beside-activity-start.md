---
title: "P6: ActivityRecord lives in @beep/jsonc beside ActivityStart, with a nested start and a re-minting verifier"
date: 2026-11-24
lane: "p6"
reversal: "Move ActivityRecord into np/src/Activity.ts, spread the start fields as the sketch did, and drop verifyActivityRecord"
---

The finished activity needs a schema home. ActivityStart, ActivityPin and mintActivityId already live in @beep/jsonc (jsonc/src/ActivityStart.ts:50-258), and langextract's ExtractionActivity { id, start } (langextract/src/Handoff/Handoff.model.ts:117) and the party ClaimGeneration { claim, activity, ended } already split start from completion. ActivityRecord is therefore jsonc/src/ActivityRecord.ts: S.Opaque { id: ActivityId, start: ActivityStart, generated: CanonicalHashSet(ContentHash), ended: DateTime.Utc }, filtered on start.started <= ended. Nesting start keeps the preimage separate from the facts outside the id (generated and ended). verifyActivityRecord is Effect.fn("ActivityRecord.verify"), re-mints the id from start and fails with ActivityRecordInvalid { reason: id-mismatch }, as the party ledger checks (party/server/src/values/Ledger/Ledger.memory.ts:89-94). nlp-processing gains runtime edges to @beep/jsonc and @beep/text and none to annotation or epistemics, because facts functions live with the callers that know the ids. No stored row holds an ActivityRecord in P6. Answers O10 and F11.
