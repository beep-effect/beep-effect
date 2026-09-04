# Instance

- id: `codex-findings-ingest-command-force-refresh`
- file:line: `packages/tooling/tool/cli/src/commands/Codex/Findings.command.ts:102`
- symbol: `CodexFindingsIngestCommandOptions`
- members: `refresh`, `force`
- evidence: E2 at `Findings.command.ts:406-460` and
  `Findings.refresh.ts:243-252` — command options carry the same illegal
  both-selected pair into the application validator.

# Current shape

`CodexFindingsIngestCommandOptions` copies `refresh` and `force` from the raw
CLI handler and carries them through prepare, write, and print.

# Cardinality gap

The pair represents four combinations; only `none`, `refresh`, and `force`
are legal.

# Target schema

Replace the command-options pair with the same
`CodexFindingsExistingPacketMode` owned by `Findings.schemas.ts`; see the full
shared design in
[codex-findings-ingest-modes.md](./codex-findings-ingest-modes.md). Keep raw
flags only in the Effect CLI handler, preserve the typed conflict, then pass one
literal to the application. Remove the plain command-options type if its sole
purpose disappears; do not add a compatibility alias.

# Migration inventory

Migrate prepare, write, print, provenance, examples, handler construction, and
all tests.

# Guard-deletion accounting

Delete application calls to
`validateCodexFindingsIngestModes` and paired reads; retain only boundary
validation and the distinct low-level write force parameter.

# Encoded-side impact

none (internal). CLI spellings, exact error, dry-run/JSON behavior, packet
output, and ledger identity stay stable.

# Test impact

Test all three modes and the conflict through the public command seam, then run
full repo-CLI verification.

# Risk and sequencing

Land atomically in Tier 1E with the sibling schema and original validator
records; destructive packet replacement semantics must remain unchanged.
