# Labs ceremony scoping preparation

The existing CLI detector ledger has one open EV001 finding in
`labs-ceremony-scoping.test.ts`. Five tests are synchronous coverage-planning
assertions. The sixth starts an Effect runtime and supplies NodePath through
`provideScopedLayer` to test module-tag path selection.

An unapplied draft preserves the five synchronous tests and moves the sixth
to `it.effect` inside `it.layer(NodePath.layer)` with an explicit ten-second
hook timeout. It removes the runtime wrapper and scoped-provider helper.
The Effect callback only reads Path and checks the returned predicate; it
does not own filesystem resources or emit console output.

AST comparison preserves all six test names and all twelve assertion trees
without normalization or exclusions. Private preparation receipts retain the
source fingerprint, draft, and parity result. This is structural evidence
only: no source edit is applied, no runtime proof has run, and no inventory
row is closed.

After integrating the checkpoint into the follow-up branch, verify that the
source fingerprint still matches, obtain Node and Bun baseline results, then
apply and format the draft. Require runtime parity, test-type diagnostics,
detector lineage reconciliation, and package verification before closure.
