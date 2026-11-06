# Scoped cache configuration review for citation integration

The hosted Check run 41412154021 reported configuration drift for nine
law-practice use-cases tasks. A current read-only cache-policy audit also reports
nine server tasks after the new integration routing and Bun coverage correction.
The reviewed baseline predates these package manifest changes.

Review scope is exactly `@beep/law-practice-server` and
`@beep/law-practice-use-cases`. Existing build/check/lint/docgen scripts retain
their implementations. The use-cases package adds portable citation evidence
checks and their source/test exports. The server adds integration routing for
the native Unicode history replay, excludes it from unit/coverage duplication,
and runs coverage with Bun so process.execPath selects the supported worker
runtime. Retired audit scripts remain removed following main integration.

Record these current package command/configuration fingerprints using the
canonical cache baseline writer. Preserve all other subjects, qualification
scope, profile, epoch and ledger. This review grants no cache qualification and
changes no cache-enable flags, receipt, acceptance gate or unsafe-reuse decision.
Hosted proof of the new integration remains pending; this configuration review
is not a test result or permission to reuse an unqualified result.
