# T3 post-integration gate attribution

The post-integration cheap gate on merge head `5868dc8218` completed with
14 passing lanes and two failing lanes. The inherited golden-test EV015 failure
is fixed by integrated main. These remaining failures are attributable to shared
main changes, not the attached T3 implementation.

| Lane | Finding and provenance | Ownership |
| --- | --- | --- |
| `lint:schema-first` | `packages/tooling/tool/cli/src/commands/Accounts/AccountsSecretsLayout.schemas.ts`: exported `AccountsSecretField` and `AccountsSecretsItem` use object Struct schemas. Source is identical to main `6513e85d2c`, introduced by [PR #1583](https://github.com/beep-effect/beep-effect/pull/1583). This lane's schema inventory delta contains only ten managed-Claude fixture lines. | Shared standards lane `rsc-b-standards` / `rsc-burndown` |
| `lint:effect-vitest` | `packages/law-practice/server/test/PracticeKg.projections.test.ts`: EV002 `provideScopedLayer` fingerprint at line 2169, callsite `16#1`, changed through [PR #1593](https://github.com/beep-effect/beep-effect/pull/1593). Current/baseline counts are 36/36, with one introduced and one resolved fingerprint; all 36 inventory rows are main-identical. | PracticeKg D21 owner in `rsc-b-standards` / `rsc-burndown` |

The owner attribution was verified by the implementation lane. No fix or
baseline waiver is duplicated here. The packet remains active and hosted
readiness is unproved.

## Publication decision

The operator requested resolving PR #1571 conflicts; pushing the resolved branch
makes that resolution reviewable. Attempt
canonical Yeet publication first. If its publication gate refuses solely these
two attributed inherited lanes, use the inherited-fence publication fallback,
preserving the red receipts, exact source attribution and owning-lane routing.
That fallback publishes reviewable work; it does not waive required hosted
checks, unresolved reviews, the review window or the merge gate. If a different
or introduced failure appears, attribute and repair it before proceeding.

Reversal uses a normal revert while retaining the feature branch and inherited
failure receipts; the PR stays draft during this publication wave. Do not merge until
required exact-head checks and review gates pass. The earlier complete hardened
live proof and two held reverse refactor claims retain their separate scopes.
