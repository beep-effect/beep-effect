# Review the new contacts app cache tasks

The generated service-app scripts add seven executable cached computations:
`build`, `check`, `lint`, `lint:deprecated-apis`, `lint:jsdoc`, `lint:laws` and
`test`. These use the same inherited task configuration as the existing private
practice service apps. Build/check retain workspace inputs, shared compiler
configuration and upstream builds. Lint retains shared policy inputs; the test
boundary retains test source, shared Vitest configuration and dependency transit.
The app package verification exercises the generated audit, including its tests.
Integration, coverage, generators and mutations remain uncached.

The app consumes explicit CSV inputs only at runtime; its unit tests use
synthetic files and fake Graph transport. No live mailbox result or credential
is a cached unit-test output. The seven-node expansion is reviewed for this
new workspace only. Existing subjects, scope, profile, epoch and qualification
ledger stay unchanged; this records configuration and grants no qualification.
Reversal: remove the app with its owner command and re-record its removal.
