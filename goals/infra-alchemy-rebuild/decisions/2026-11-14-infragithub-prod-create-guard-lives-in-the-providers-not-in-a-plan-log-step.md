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

Kinds with no `read` (environments, variables, labels) are refused only when they reach
the create path, after earlier allowed writes in the same deploy may have gone out. For
those kinds the plan-time control is the package test, which runs first in the deploy job.
It plans the committed stack declarations, not a copy of the list, and fails unless the
`create` set equals `productionCreateAllowList` exactly. It also requires every listed id
to be a converge-by-name kind (repository, environment, variable, label), so a kind whose
create path makes a second object cannot be admitted by adding it to both the stack and the
list.

Accepted limit: a removed declaration plans `orphaned`, its deploy sends no mutating
request (tested), and the guard does not refuse it. A removed declaration leaves the live
object in place and unmanaged: removing a live object is a deliberate, attended act outside
the deploy job. Refusing the orphan itself would need the plan-log check above.
