---
title: Agent-call rejected is a non-retryable model error
date: 2026-11-23
reversal: Treat a timeout, a defect, or an exhausted retry as rejected and drop the secretary's documents for those too.
governs:
  - src/DocketIntake/DocketIntake.agents.ts#AgentCallFailed
  - src/DocketIntake/DocketIntake.agents.ts#callAgent
  - src/DocketIntake/DocketIntake.agents.ts#askSecretary
enforcedBy: []
---

`rejected` is true only when the model error's `isRetryable` is false. A timeout, a defect, and a retryable failure that exhausted its tries set it false.

Reason: only a non-retryable model error is a case where sending less can help, so the secretary drops attached documents and asks once more only when `rejected` is true.

Rejected: treating a timeout, a defect, or an exhausted retry as a provider refusal and dropping the documents.

Accepted limit: a non-retryable model error is wider than a provider refusal. Quota and encode errors are included.
