# PR 1323 readiness and interruption repairs

The earlier monitor reported PR 1312 ready while optional heavy checks were
pending or failing. A control invoking the actual readiness function reproduced
that result with synthetic current-head snapshots. PR 1323 repairs both status
and watch readiness with one shared per-check policy. Failed and pending checks
block regardless of the optional label. The existing required-check census
remains a gate, and count-only failures cannot obtain an exemption.

Both collectors now retain GitHub check descriptions. The only exemption is an
optional Vercel deployment whose description explicitly reports deployment rate
limiting and a retry interval. Ordinary deployment failures, missing descriptions,
other check providers, pending deployments and required failures remain blocking.
The observed GitHub description was `Deployment rate limited — retry in 24 hours.`
The serialized criterion name remains unchanged for compatibility.

Seven focused suites passed 371 tests on each runtime before the two newly added
watch cases were converted to canonical `it.layer`. Those two suites then passed
all 100 tests on Node and Bun. The layer hook budget is explicitly 10 seconds,
matching the ordinary shared hook ceiling; existing test-body budgets are intact.
The final ratchet passes with 4,490 findings, zero introduced and 526 resolved.
Full CLI package verification is still running.

The PGlite review regression shares its permission bracket with the ordinary
unreadable-directory test. A Deferred barrier proves the populated directory is
mode 0 before interruption. The child scope observes mode 0700 before deleting
the root, and the parent verifies that the root is gone after interruption.
All ten integration tests pass on the final source under Node (7.88 seconds)
and Bun (8.53 seconds). Full Desktop package verification passes: audit 16.9
seconds and docgen 13.7 seconds.
Removing the shared restoration finalizer makes the regression fail with mode
0 instead of 448. The mutation run selects that one test, intentionally filtering
nine others; it is a negative control, not suite proof. The test's cleanup guard
prevents residue even under that mutation, and the original source was restored.

The two narrow PGlite detector exceptions preserve these observable lifetimes:
the permission bracket ends before its caller's postconditions, and the child's
scope must close before the parent can assert cleanup. Moving either lifetime to
the whole test would change the behavior being proved. Both exceptions carry
this rationale in the baseline and the Desktop detector ledger.

Private receipts include `optional-heavy-readiness-control.json`,
`pr1323-readiness-{node,bun}.log`,
`pr1323-readiness-canonical-{node,bun}.log`,
`pr1323-pglite-interruption-fixed-{node,bun}.log`, and
`pr1323-pglite-interruption-fixed-mutant.log`. The dropped-finalizer control is distinct
from the whole-file positive runs. Full package proofs and hosted closeout are
required before merge readiness is established.
