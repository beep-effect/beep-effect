# CI fixture hook budget proof

Seven existing fixture layer registrations now declare a ten-second acquisition
and teardown budget, matching neighboring fixtures. Five are Storybook cases;
two exercise automatic Docgen dispatch. Their fake process handles complete
immediately. The fixture layers compose Crypto, noop filesystem/path services,
FsUtils and TestConsole. Test-body timeouts are unchanged.

After formatting, removing precisely the seven new option arguments restores
the original whole-file syntax tree. This establishes preservation of all test
registrations, assertions, fixture bodies and other existing options.

Node and Bun each pass all 74 tests with CI enabled. Durations were 4.17 and
2.17 seconds, compared with baseline 4.76 and 3.43 seconds. These are shared
workstation observations, not controlled performance measurements. The actual
package test-typecheck artifact reports exitCode zero and empty diagnostics.

The root ratchet scans 1,217 files with 2,871 findings, zero introduced and
2,160 resolved against the existing baseline. Targeted detection falls from
22 to fifteen findings, removing the seven missing-hook-budget observations.
The remaining provider, wrapper and filesystem findings remain open.

Package verification in quick mode passes: lint 3.6 seconds, check 6.4 seconds.
Quick mode is appropriate to these seven test-only option additions, backed by
full-suite runtime parity and whole-file syntax preservation. The immediately
preceding shared-internals migration passed full audit and docgen separately.

Prepared ledger reconciliation identifies six existing findings and one newly
captured finding. Four match by rule and occurrence. Two retain their original
IDs through the doctestCiLayer to ciExecutionLayer fixture rename in commit
`e08b24b004`; the named tests and their assertions establish continuity.

The initial signed commit attempts failed because the configured 1Password Git
signer could not connect to its socket. After a metadata-only check confirmed
that the SSH-agent socket accepted a connection, the retry succeeded without
changing signing or authentication settings.

Source commit: `6665e3dc33c5c84fd8e2d50f1f91e9b3c25a4180`.
Ledger reconciliation closes six historical IDs and adds one captured timeout
finding as fixed. No unrelated row is changed. Hosted readiness and the broader
goal remain open.
