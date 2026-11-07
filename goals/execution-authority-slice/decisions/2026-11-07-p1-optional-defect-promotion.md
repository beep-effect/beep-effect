---
title: "Promote optionalDefect to @beep/schema SchemaUtils instead of copying it"
date: 2026-11-07
lane: "feat/execution-authority-slice"
reversal: "Restore packages/epistemic/use-cases/src/internal/OptionalDefect.ts and an internal copy in @beep/execution-authority-use-cases, then drop SchemaUtils.optionalDefect"
---

Search result (2026-11-07): no foundation helper combines `S.Defect` with `SchemaUtils.alwaysEquivalent` and `Effect.succeedNone`. The only equivalent is `law-practice/use-cases/src/internal/DefectCause.ts`, which another slice cannot import. A first copy into `@beep/execution-authority-use-cases` tripped the Fallow audit duplication gate (introduced clone `dup:f67f335a`, 6 lines). Following this decision's recorded reversal, the helper moves to `@beep/schema/SchemaUtils/optionalDefect`, and the epistemic internal copy is deleted. Its two consumers, `EdgeAuthority.errors.ts` and `ExecutionLedger.errors.ts`, import that subpath directly. The helper is deliberately left out of the `SchemaUtils` barrel: re-exporting it there made `@beep/storybook`'s stories typecheck lose `TaskList.make` and `TaskItem.make` on `@beep/md` (6 errors, reproduced deterministically; clean main and the subpath-only form both have 0). The law-practice `DefectCause` takes no description argument and stays out of scope.
