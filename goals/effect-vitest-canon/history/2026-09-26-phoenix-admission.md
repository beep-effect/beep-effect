# Phoenix admission

Admitted the two existing Phoenix census files after checking open-PR ownership
and package dependencies. The service test differs from the frozen census only
by the upstream Arbitrary import move; the equivalence file is byte-identical.
No new broad census was taken. Phoenix.makeLayerWithSdk is a pure Layer.succeed
around the injected SDK. These tests acquire no live Phoenix service, credentials
or network subject. Intentional Promise rejection is transport-error input.

Both configured Node and Bun baseline runs pass all nine cases with stable source
hashes. Package audit/docgen pass in 7.2/2.9 seconds. Timing receipts record host
load/pressure; no normalization or speedup is claimed. Preserve all 22 schema
domains and encoded-decode-reencoded oracles, fcRuns(5), exact transport/config
errors, and declared-field equivalence. Scope, assertion, property, flake and
runner phases follow in order. The empty-selector guard still needs an
independent zero-SDK-call witness in the property phase.
