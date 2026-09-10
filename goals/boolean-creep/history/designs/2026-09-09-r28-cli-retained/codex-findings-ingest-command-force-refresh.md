# Instance

- id: `codex-findings-ingest-command-force-refresh`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Codex/Findings.command.ts:102`
- symbol: `CodexFindingsIngestCommandOptions`
- members: `refresh`, `force`
- evidence: E2 at `Findings.command.ts:406-460` and
  `Findings.refresh.ts:243-252` — command options carry the same illegal
  both-selected pair into the application validator.

# Current shape

`CodexFindingsIngestCommandOptions` copies `refresh` and `force` from the raw
CLI handler and carries them through prepare, write, and print. It is the named
application options object accepted by the exported `runCodexFindingsIngest`,
while `Command.make` builds the same shape from parsed flags at lines 436-460.
It is therefore a qualifying structured command carrier, distinct from the
excluded anonymous validator parameter.

# Cardinality gap

The pair represents four combinations; only `none`, `refresh`, and `force`
are legal.

# Target schema

Replace the command-options pair with the
`CodexFindingsExistingPacketMode` owned by the sibling schema design. Keep raw
flags only in the Effect CLI handler, preserve the typed conflict, then pass one
literal to the application. Retain a named command-options type for the
remaining payload because it is the public application input; change its
decoded TypeScript mode field atomically and update every repository caller.

# Migration inventory

- `Findings.command.ts:102-112` — replace the pair in the named carrier with
  `existingPacketMode`; preserve all other fields and Option payloads.
- `Findings.command.ts:195-213` — load refresh provenance only for exact
  refresh; none and force retain the current prior-id path.
- `Findings.command.ts:255-279` — refresh still routes by prepared refresh
  source; pass a derived boolean only at the distinct `writePacket.force`
  function boundary for exact force.
- `Findings.command.ts:406-413` — remove application validation only after the
  carrier is unrepresentable-invalid. Preserve validation before
  `prepareCodexFindingsIngest`, which begins repository/capture I/O.
- `Findings.command.ts:431-460` — keep both CLI flags/defaults and resolve once
  with the exact `mode-conflict` reason and message before calling the
  application.
- Migrate refresh/normalize command fixtures; leave low-level writePacket force
  tests unchanged.

# Guard-deletion accounting

Delete application calls to
`validateCodexFindingsIngestModes` and paired reads; retain only boundary
validation and the distinct low-level write force parameter.

# Encoded-side impact

none for this named in-process carrier. CLI spellings, exact error, dry-run/JSON behavior, packet
output, and ledger identity stay stable.

# Test impact

Test all three modes and all four raw pairs through the public command seam.
Assert the conflict occurs before repository lookup/export read and preserves
its exact typed reason/message. Retain refresh provenance, force replacement,
none-mode prior identifiers, dry-run/JSON output, and result printing.

# Risk and sequencing

Land in Tier 1E before the sibling Tier 2 schema compatibility codec. Introduce
the shared `CodexFindingsExistingPacketMode` in the existing schema module and
migrate only this named command/application carrier. Preserve the exported
`CodexFindingsIngestOptions` legacy fields and decoder until its later singleton
PR; the command does not call that decoder at the frozen source. The later
codec reuses the mode owner without changing command behavior.

The original validator record is withdrawn as parameter-only; destructive
packet replacement semantics and the lower write function remain unchanged.
