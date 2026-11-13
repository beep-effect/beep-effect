---
title: "Keep direct invocation fixtures scoped to each request"
date: 2026-11-13
reversal: "Replace the fixture wrappers with a test Layer when the harness can preserve per-call admission, budget, deadline and cleanup semantics."
---

Effect/Vitest EV003 reports 108 unresolved-resource-wrapper judgments at the shared invocation fixture calls (95 withCitationTestInvocation and 13 withCitationTestTextBudget). Each opens request-scoped admission, a fresh budget and cleanup; it.layer sharing would turn independent method calls into one request and change queue, deadline and ledger assertions. These two reviewed wrapper families receive explicit owned inventory exceptions, without changing detector policy. The existing it.layer platform services remain shared.
