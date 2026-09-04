# Instance

- id: `goals-migrate-conventions-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts:617`
- symbol: `MigrateConventionsCommandInput`
- members: `preview`, `apply`
- evidence: E2 at `Migration.command.ts:52-59,640-654` — the adapter
  requires exactly one flag and all downstream behavior branches on the one
  resolved mode.

# Current shape

Four flag pairs are representable; only exact `preview` and exact `apply` are
accepted. Timestamp and report path are independent payload.

# Cardinality gap

The pair has four representable combinations and only the two exact-one modes
are legal.

# Target schema

Reuse the named Goals migration mode introduced by
`goals-repair-fork-mode`. The CLI boundary validates the two old flags and
constructs `{ mode, at, report }`; application planning and reporting receive
only the literal. Remove the boolean-shaped command input after all consumers
migrate.

# Migration inventory

- `Migration.command.ts:617-666` — replace the input pair with the shared mode,
  keep `at` and `report`, and branch through the derived mode guard/match.
- `planConventionMigration` and examples — reuse the named mode type instead
  of the ad-hoc `"preview" | "apply"` union.
- CLI construction — preserve both flags and exact conflict/missing-selection
  messages before constructing the runtime options.
- `Migration.schemas.ts` report mode — reuse the same named building block.

# Guard-deletion accounting

Delete the stored pair, duplicate ad-hoc literal union, and downstream
`mode === "preview"` coherence prose where an exhaustive match owns it. Retain
only boundary validation for old CLI spellings.

# Encoded-side impact

none (internal); committed migration report encoding and CLI behavior remain
unchanged.

# Test impact

Prove all four raw flag pairs, deterministic timestamp behavior, preview
no-write, apply, rollback/post-apply preview, and report snapshots. Use package
aliases and full repo-CLI verification.

# Risk and sequencing

Land atomically with the sibling repair-fork record in Tier 1E so there is one
mode owner and no intermediate duplicate schema.
