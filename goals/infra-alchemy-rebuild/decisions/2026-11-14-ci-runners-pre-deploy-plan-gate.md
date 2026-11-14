---
title: "CI runners pre-deploy gate refuses every replace, delete, orphan and unreadable plan line"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Delete plan-check.ts and src/PlanCheck.ts and drop the gate step from the deploy workflow."
---

`plan-check.ts` (tested logic in `src/PlanCheck.ts`) is the pre-deploy gate the future deploy job runs between `alchemy plan` and `alchemy deploy`, mirroring the cost-controls `PlanCheck` but failing closed on reading as well as on content:

- It reads the plain plan output (the `[hh:mm:ss.mmm] LEVEL:` prefix and ANSI colours stripped). Lines before the single `Plan:` header are progress and skipped; every non-empty line after it must be a resource line `[fqn] <action>` (optionally with `(mode)` or `(renamed from ...)` notes), a binding line `[fqn/sid] <action|unbind>` directly after its resource, a task line `[fqn] run|drop [action]`, or an indented property line. Anything else is an `UnreadableLine`; zero or several headers is a `MissingPlan`.
- It refuses every `replace`, `delete` and `orphaned` on any resource (`DestructiveAction`), every root id outside the stack's declared roots (`ForeignResource`) and every action task (`ActionTask`). Only `ActionTask` alone does not escalate; every other refusal stops the job for the CI goals driver through the orchestrator.
- It lists each resource with its action, bindings and changed property names, never values.

Why no destructive allowlist: the network objects and the pools carry live runners and the webhook function URL is the App's delivery target, so a replace or delete is always an operator-reviewed deploy, not a push deploy. Cost-controls allows exactly one rollback delete; this stack has none to allow. Tests run the gate over the recorded personal-stage plan (66 creates, 9 bindings) and over synthetic replace, delete, orphan, unreadable, header and foreign-resource cases.
