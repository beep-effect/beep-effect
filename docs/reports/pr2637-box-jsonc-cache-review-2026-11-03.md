# Box canonical JSON dependency cache review

PR #2637 adds the existing `@beep/jsonc` canonicalizer to Box provisioning to
remove a duplicated implementation reported by Fallow. The generated workspace
references and lockfile record that runtime dependency.

Comparison of `beep cache census --json` with the previous baseline shows only
seven dependency-list changes:

- `@beep/box-provisioning#build` adds `@beep/jsonc#build`.
- `@beep/box-provisioning#check` adds `@beep/jsonc#build`.
- `@beep/box-provisioning#coverage` adds `@beep/jsonc#build`.
- `@beep/box-provisioning#lint:deprecated-apis` adds `@beep/jsonc#transit`.
- `@beep/box-provisioning#package-test-typecheck` adds `@beep/jsonc#transit`.
- `@beep/box-provisioning#test` adds `@beep/jsonc#transit`.
- `@beep/box-provisioning#test:integration` adds `@beep/jsonc#build`.

No computation is added or removed. Commands, command digests, effective
configuration, global configuration and Turbo configuration sources are unchanged.
The added edges ensure upstream JSON canonicalization changes invalidate these
Box tasks. The qualification scope, profile, epoch and ledger remain unchanged;
this records the dependency graph and grants no qualification.

Revert this review and its baseline refresh together to reverse the record.
