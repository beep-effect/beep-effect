# Instance

- id: `explore-atlas-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Explore/Atlas.ts:739`
- symbol: `explore atlas flags`
- members: `write`, `check`
- evidence: E2 at `Explore/Atlas.ts:766-791` — after rejecting combined
  flags, the handler dispatches write, check, or print and never treats
  combined-true as a fourth mode.

# Current shape

Effect CLI parses two booleans. The handler rejects both, then repeats a
write/check/print conditional chain around the deterministic Atlas projection.

# Cardinality gap

Four pairs are representable. Three modes are legal: `print`, `write`, and
`check`; combined write and check is rejected.

# Target schema

Reuse the `PrintWriteCheckMode` LiteralKit and the exclusive CLI-boundary
resolver introduced by the repo-CLI family migration. Keep parser booleans only
at `Command.make`, preserve the command-specific conflict error, and pass one
literal to an exhaustive Atlas runner.

# Migration inventory

- `Explore/Atlas.ts:739-746` — retain the public CLI spellings and defaults.
- `Explore/Atlas.ts:763-795` — collapse flags at the adapter, delete boolean
  carry, and exhaustively dispatch the existing write/check/print bodies.
- `Quality/internal/GithubChecks.ts:524` — the existing `--check` lane argv is
  unchanged.
- Targeted source/barrel search found no second Atlas mode owner; reuse the
  repo-CLI family domain rather than adding one.
- Add focused CLI cases for print, write, check, and the exact conflict.

# Guard-deletion accounting

Delete the local `check && write` application guard and the two sequential
boolean branches. Boundary resolution retains the same typed reported-exit
message before constructing the literal.

# Encoded-side impact

None. CLI arguments, messages, generated `explorations/ATLAS.md`, and generated
README status-region bytes remain unchanged.

# Test impact

Exercise all three modes and the combined conflict, retain deterministic Atlas
projection tests, and run full `@beep/repo-cli` package verification.

# Risk and sequencing

Land in Tier 1E after the shared `PrintWriteCheckMode` helper exists. Preserve
the write loop and check-time drift ordering exactly.
