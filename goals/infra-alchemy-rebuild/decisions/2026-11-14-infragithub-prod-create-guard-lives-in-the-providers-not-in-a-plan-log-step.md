---
title: "InfraGithub prod create guard lives in the providers, not in a plan-log step"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p3-github-plan-guard"
reversal: "Drop prodGitHubProviders from alchemy.run.ts and return guardedRulesetProvider(capture) for prod again; delete src/ProdWriteGuard.ts, productionCreateAllowList and test/ProdWriteGuard.test.ts."
---

The packet gate asked what refuses an unexpected `create` on `prod`. Nothing did: the
shipped `GitHub.Ruleset` create path POSTs a new ruleset when its name-based read misses,
and the write guard re-read 10240248 and then handed off to that path.

Decision: the guard wraps the `prod` providers (`src/ProdWriteGuard.ts`) and uses an
explicit allow-list (`productionCreateAllowList`, 36 logical ids). `MainRuleset` is not on
it. Off-list creates, any `replace`, a repository create path with no live repository,
`precreate` and `delete` fail with `ProdChangeRefused`. Where the provider has a `read` or
the change is a `replace`, the refusal comes at plan time. Otherwise it comes at the
resource's create path, before its request. The ruleset write guard also refuses a write
not aimed at the captured id.

Why not a plan-log check (cost-controls' `PlanCheck`): `alchemy deploy` plans again
internally and offers no hook between that plan and apply. A check of the separate
`alchemy plan` log would bind a different plan from the one the deploy applies, and it
needs `deploy-infra-github.yml` to save the log, which means asking the operator to approve
the workflow again. The provider guard binds the deploy's own plan and leaves the workflow
byte-identical.

Gap: a retained removal plans `orphaned`. It writes nothing live and the provider guard
does not see it. Refusing it needs the plan-log check above.
