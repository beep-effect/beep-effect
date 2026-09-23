# Accept the `@beep/identity` dependency edge on the tables packages

The tsgo 0.45.0 ratchet (`schemaSync` at error) converts the table converters in
`@beep/agents-tables`, `@beep/documents-tables` and `@beep/workspace-tables` from
throwing `decodeSync`/`encodeSync` calls into `Result`-returning APIs with typed
converter errors. Those error classes carry `$I` identities, so each of the three
manifests gains a `@beep/identity` workspace dependency. `apps/labs/ciops` and
`packages/foundation/modeling/identity` show `configuration-source-drift` only
because their input file sets were re-hashed after the merge with main.

The reviewed baseline recorded the tables packages without that edge, so
`beep quality cache-policy` now reports `configuration-drift` for their
`build`, `check`, `lint:deprecated-apis`, `test` and `test:property`
computations. No command, cache flag, output declaration or global
configuration changed; the drift is one new workspace dependency edge per
package, which is exactly the input turbo must hash.

Accept the new dependency edges in the legacy configuration baseline. This
review grants no runtime qualification. Retain the identity/types scope,
`local-linux-x64-bun1.4.2` profile and `qualification-v2` epoch; the
qualification ledger is untouched.
