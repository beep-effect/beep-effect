---
title: "CI runners pre-deploy gate refuses every replace, delete, orphan and unreadable plan line"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Replace the workflow's plan and deploy steps with plain alchemy plan and alchemy deploy, then delete src/CheckedDeploy.ts, plan-check.ts and src/PlanCheck.ts."
---

`plan-check.ts` (tested logic in `src/PlanCheck.ts`) is the pre-deploy gate the future deploy job runs between `alchemy plan` and `alchemy deploy`, mirroring the cost-controls `PlanCheck` but failing closed on reading as well as on content:

- It reads the plain plan output (the `[hh:mm:ss.mmm] LEVEL:` prefix and ANSI colours stripped). Lines before the single `Plan:` header are progress and skipped; every non-empty line after it must be a resource line `[fqn] <action>` (optionally with `(mode)` or `(renamed from ...)` notes), a binding line `[fqn/sid] <action|unbind>` directly after its resource, a task line `[fqn] run|drop [action]`, or an indented property line. Anything else is an `UnreadableLine`; zero or several headers is a `MissingPlan`.
- It refuses every `replace`, `delete` and `orphaned` on any resource (`DestructiveAction`), every binding `replace`, `unbind` or `delete` (`DestructiveBinding`, added 2026-11-18), every root id outside the stack's declared roots (`ForeignResource`) and every action task (`ActionTask`). Only `ActionTask` alone does not escalate; every other refusal stops the job for the CI goals driver through the orchestrator.
- It lists each resource with its action, bindings and changed property names, never values.

Amended 2026-11-18 (#3386 review): the gate no longer sits between `alchemy plan` and `alchemy deploy` over a log, because a deploy that re-plans after the check could apply a change set nobody checked. The workflow now runs the checked deploy. `plan-check.ts plan` plans the stage through the Alchemist API, runs these rules on the structured plan and saves the checked plan (per resource: action, binding actions and a SHA-256 of the redacted declared properties; plus stack actions). `plan-check.ts deploy` re-plans under the stage lease, re-checks, and applies that same plan object only when it equals the saved plan; otherwise it fails with `PlanDrift` and writes nothing (`applyIfUnchanged`, `src/CheckedDeploy.ts`). The saved plan also carries, per resource, a SHA-256 of each binding's payload, an HMAC-SHA256 fingerprint of the declared secret values under a random per-plan salt (a changed secret drifts while no secret is stored), and whether an update would finish a pending replacement (refused as `PendingReplacement`). It also carries the cutover expectation (`routine`, `bootstrap`, `default-security-group`), which refuses any change the step does not allow (`UnexpectedChange`). The log reader refuses a log whose rows do not account for the summary counts (`IncompletePlan`), and it reads an indented line only as a property or a continuation inside one (amended 2026-11-18). The log reader stays for personal-stage rehearsals as `plan-check.ts log <file>`. Cutover decision, condition (d).


Secret fingerprint (amended 2026-11-18, #3386 driver review). The saved plan carries the random salt and the HMAC-SHA256 fingerprints together, so anyone holding the plan can test guesses offline. That is acceptable only because the production credential loader (`appCredentials` in `src/Credentials.ts`) refuses low-entropy secrets before any plan is computed. Both `plan-check.ts plan` and `plan-check.ts deploy` decode through that one loader, so neither can fingerprint an unchecked value. Its checks:

- The webhook secret has at least 32 characters (`minimumWebhookSecretLength`) from the hex, base64 and base64url alphabet, with at least 10 distinct characters, and does not contain the placeholder. The assumed alphabet is hex, the narrowest the check admits (16 symbols, 4 bits each), so 32 characters carry at least 128 bits; base64 secrets of the same length carry 192. A run of one character, a padded or repeated placeholder, and a value with spaces are refused.
- The App key must decode from base64 to a PEM private-key block of at least 1,000 characters; a 2048-bit RSA key is about 1,700.
- The App id must be a number.

A failure is a `ConfigError` whose message says only "webhook secret too short" or "App key is not a PEM private key", never the value or its length.

The App id is low-entropy, so no resource is fingerprinted by it alone. Each resource's HMAC message carries the plan's whole sorted secret material before its own entries, so guessing the App id parameter's fingerprint also needs the App key and the webhook secret. A test over the planned `prod` resources changes only the webhook secret and shows that every fingerprint moves, `Runners/AppId` included.

Residual (a): a `Redacted` value inside a class instance or an Output expression is not fingerprinted (`redactedEntries` walks plain records and arrays only). No secret enters the stack that way today: the App credentials reach the composite as plain `Redacted` props.

Why no destructive allowlist: the network objects and the pools carry live runners and the webhook function URL is the App's delivery target, so a replace or delete is always an operator-reviewed deploy, not a push deploy. Cost-controls allows exactly one rollback delete; this stack has none to allow. Tests run the gate over the recorded personal-stage plan (66 creates, 9 bindings) and over synthetic replace, delete, orphan, unreadable, header and foreign-resource cases.
