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
