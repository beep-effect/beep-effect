# Friction receipts

- 2026-10-29: PR #2333's native Windows workflow added two hosted jobs without
  inventory entries. The same inventory assertion failed both unit and property
  lanes; the unit failure also prevented its coverage artifact upload. Reproduced
  with the focused `ci-runner-security.test.ts` inventory test. A workflow addition
  checklist requiring inventory registration would have prevented this wave.

- 2026-10-28: Default CLI package proof remained pending beyond ten minutes
  without a package result. The package-scoped lint/check subset passed; the
  default was interrupted and proof moves to hosted CI under the repo rule.
- 2026-10-28: Copying a historical readiness job into another clone returned
  unknown because recovery validates original job path containment. Re-running
  the supported explicit provider in the owning clone verified the original
  evidence without rewriting it. A portable evidence export would prevent
  redundant historical closeout diagnosis.

- 2026-10-28: The new Windows job failed in checkout before tests on a
  historical colon-containing archive filename. Check out only the deployment
  scripts for this focused native test; retain Windows path protections and
  repository history. Evidence: PR #2333 Windows job checkout failure.
