# Accept the identity test-kit dependency edges from the Effect Vitest wave

The effect-vitest-canon identity remediation wave (PR #1216) migrates the
`@beep/identity` test suite to the canonical Effect Vitest idioms. The manifest
gains two development dependencies: `@beep/fc-runs` supplies the shared
property-run floor for the new `it.prop` registrations, and `@beep/test-runner`
supplies the instrumented runner adopted across all twelve test files. The
identity-to-runner edge was proven acyclic in the #1188 extraction review.

The reviewed baseline recorded `@beep/identity` without those edges, so
`beep quality cache-policy` reports `configuration-drift` for its `build`,
`check`, `doctest`, `lint:deprecated-apis`, `test` and `test:property`
computations. No command, cache flag, output declaration or global
configuration changed; the drift is the two new workspace dependency edges,
which are exactly the inputs turbo must hash.

Accept the new dependency edges in the legacy configuration baseline. This
review grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
