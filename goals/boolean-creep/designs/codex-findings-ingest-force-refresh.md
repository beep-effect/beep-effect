# Instance

- id: `codex-findings-ingest-force-refresh`
- file:line: `packages/tooling/tool/cli/src/commands/Codex/Findings.schemas.ts:381`
- symbol: `CodexFindingsIngestOptions`
- members: `refresh`, `force`
- evidence: E2 at `Findings.refresh.ts:243-252` — both true is rejected;
  neither, refresh, and force are the three existing-packet modes.

# Current shape

`CodexFindingsIngestOptions` currently stores independently defaulted
`refresh` and `force` booleans beside unrelated ingest options.

# Cardinality gap

The pair represents four combinations; `none`, `refresh`, and `force` are the
three legal states.

# Target schema

Use the single
`CodexFindingsExistingPacketMode` LiteralKit and complete migration inventory in
[codex-findings-ingest-modes.md](./codex-findings-ingest-modes.md). Replace the
two defaulted fields in this schema with one defaulted `none | refresh | force`
field. This is an atomic decoded TypeScript migration; packet/ledger encodings
do not change.

# Migration inventory

Migrate every decoder, example, command construction, prepare/write/read
consumer, and test.

# Guard-deletion accounting

Delete the schema-level parallel fields and application conflict validation;
retain the exact typed error at the raw CLI boundary.

# Encoded-side impact

none (internal options).

# Test impact

Prove default `none`, refresh, force, and raw conflict; retain destructive
force/refresh provenance and ledger identity tests. Run full repo-CLI
verification.

# Risk and sequencing

Land in Tier 1E with the original validator record and command-options record.
Do not broaden into `writePacket`'s distinct low-level force parameter.
