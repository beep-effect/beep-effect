---
title: "P1 step 2, the scaffolder, is built"
date: 2026-11-18
kind: checkpoint
lane: "claude/model-first-standard-scaffolder"
reversal: "Revert the scaffolder pull request"
---

Step 1 merged as PR #3391. Step 2 adds @beep/contract-kit (Catalog.make, waitsOnProjection, Parity.groupShape) and `bun run beep architecture create context <context> <Module>`, which writes the contract, model and host packages through the create-package shell and registration, with exact exports and the project references the tsconfig sync writes, so apply then check reports no drift. The legacy seven-role commands are unchanged and labelled legacy. packages/tooling/tool/cli/test/architecture-model-first-context.test.ts generates a throwaway notes/Note context and runs each package's own beep:check (tsrs, zero diagnostics) and beep:test (story and parity on Domain.InMemory). Deviations from research/01-scaffolder-design.md: Parity.groupShape joins the kit; `plan` has no model-first default: a bare `plan` is the legacy lab plan, model-first needs --shape model-first or an explicit --slice and --concept, and --stage or --domain-kind imply legacy; apply and check take the shape from the plan's roles. Next: P1 step 3, the checkers.
