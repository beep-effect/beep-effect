# P2 live dry-run and attended apply

Date: 2026-09-03

Sanitized receipt. No tenant id, folder name, principal, credential, or full
digest appears here; the private plan, receipt, journal, and intent stay in the
ignored operator directory with mode 0600.

## Preconditions cleared

- 1Password: agents now resolve `op://` references through the PATH shim and a
  BEEP_SECRETS-scoped service account (no desktop prompt; `op-doctor` 16/16).
- Private intent: the three placeholders were filled with a pilot client
  folder, a pilot matter folder, and the attorney's managed-user login
  (looked up from the tenant, never displayed); the collaboration is declared
  `internal` because the attorney is a managed user of the same enterprise.

## Live dry-run

The first live dry-run failed before planning: the Box Sign request listing
returned 403 on this tenant and the inventory raised it as a hard driver
error. Sign discovery now uses the same permission-blocked classification as
metadata and retention (regression test added; PR #959). The corrected
dry-run, run twice in one process:

```text
repeatedPlanIdentical: true
actions: Create=33 (32 folders, 1 collaboration), Blocked=2
blockers: metadata BlockedByEntitlement (Business), retention BlockedByEntitlement (Business)
destructiveCount: 0, declaredExternalCollaboratorCount: 0, foreignResourceCount: 0
```

`foreignResourceCount` is 0 because the tree is anchored at the service
account's own root folder, which is empty; the 2026-07 staging drop lives under
the admin user's root and is therefore outside this reconciler's scope rather
than adopted or pruned.

## Attended apply

The first apply attempt stopped before any mutation with
`BoxProvisioningSchemaError`: the private runner passed the already-decoded
intent to `applyReviewedPlan`, which expects the raw document (the dry-run path
was correct). The runner now passes the raw input. The retry, with the operator
present and the reviewed digest confirmed:

```text
mode: apply
adoptionCount: 32, entitlementBlockerCount: 2
receiptOutcomeCount: 35 (Applied=33: folder=32, collaboration=1; Blocked=2)
journal: Started=33, Applied=33, Failed=0
post-apply verdict: strict all-Noop plus the two entitlement blockers (runner exit 0)
```

The 32 created folder identities were persisted as `adoptions` in the private
intent. A fresh-process dry-run afterwards, run twice:

```text
repeatedPlanIdentical: true
actions: Noop=33, Blocked=2, destructiveCount: 0, foreignResourceCount: 0
```

## Acceptance mapping

- Driver surface in budget, SDK provenance repaired: P1 evidence.
- Dry-run plan artifact against the live tenant with `BlockedByEntitlement`
  rows and repeat-run identity: recorded above.
- Operator-attended apply under the service identity with the attorney
  collaborated at client-folder level, immediate re-plan all-`Noop`: recorded
  above; the receipt is the private `receipt.json`.
- Package verifies: `@beep/box-provisioning` audit and docgen green on the fix.
