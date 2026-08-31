# Running opportunities ledger: practice-box-provisioning

Friction receipts captured while shipping, per the repository friction law.

## P1 implementation

1. **Package verification did not build a changed project reference.** `unowned`

   The first
   `bun run beep quality package-verify @beep/box-provisioning` run failed in
   `tsc -p tsconfig.json` because the new `$BoxProvisioningId` existed in
   `@beep/identity` source but not in its previously built declarations. The
   missing export caused a cascade of `never` errors in every annotated schema.
   `bun run beep quality package-verify @beep/identity`, followed by the same
   reconciler verification command, passed.

   **What would have prevented it:** package verification could build changed
   TypeScript project references before auditing the target package, or
   `create-package` could print the required dependency verification order when
   it registers a new package identity.

## P2 verification

1. **The full unit sweep observed transient repo-cli state.** `unowned`

   `bun run beep yeet repair` completed cheap gates, docgen, build, check,
   lint, and both touched-package test suites, then reported two failures in
   untouched `@beep/repo-cli` tests: one goals-index projection mismatch and
   one root-concurrency assertion. The implicated source and tests were
   byte-identical to `origin/main`; an immediate isolated Vitest rerun passed
   both files and all 195 tests.

   **What would have prevented it:** state-sensitive repo-cli tests could use
   immutable fixtures for goal projections and scheduler defaults, or the
   quality receipt could distinguish a failure that disappears on an isolated
   exact-tree rerun from a deterministic source failure.
