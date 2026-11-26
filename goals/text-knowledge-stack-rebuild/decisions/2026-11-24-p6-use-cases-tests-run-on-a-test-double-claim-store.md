---
title: "Use-cases tests run on a test-double claim store"
date: 2026-11-24
lane: "p6"
reversal: "Move the memory store into use-cases src and have the server layer wrap it."
---

use-cases tests cannot import `@beep/law-practice-server`, so the office-action flow, two-claims and admission tests run on a small in-memory `LawClaimProposals`/`LawClaimAdmissions` double in `use-cases/test/fixtures/office-action-review/support.ts` (no partition permit; a Ref of entries and bindings). The server's `LawClaimStoreMemory` is the real memory layer, with a one-permit partition per scope, and has its own `server/test/ClaimStore.memory.test.ts`.
