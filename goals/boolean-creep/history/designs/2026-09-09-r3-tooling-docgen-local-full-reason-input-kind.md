# Instance

- id: `r3-tooling-docgen-local-full-reason-input-kind`
- file:line:
  `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:362`
- symbol: `fullReasonForFile.inputKind`
- members: `isExactFile`, `hasPrefix`
- evidence: E2 at `Local.ts:362-379` — `fullReasonForFile` dispatches exact
  global inputs before Docgen-tooling prefixes and has no combined-true arm.
  The exact table contains only repository-root filenames, while both prefixes
  begin with `packages/tooling/`, so the configured sets cannot overlap.

# Current shape

`fullReasonForFile` classifies one normalized changed path by evaluating the
generic exact-file and prefix predicates as separate booleans. Exact global
inputs select the `Global docgen or Turbo input changed.` reason, Docgen
tooling prefixes select `Docgen tooling changed.`, and every other path has no
full-proof reason. The surrounding helpers are generic and also serve the
independent package-local input policy.

# Cardinality gap

Four exact/prefix pairs are representable, while three configured path-policy
states are legal: `global-input`, `docgen-tooling`, and `other`. The current
root-file and `packages/tooling/` prefix tables exclude combined-true. This is
a private derived classification; it is not a claim that arbitrary caller
supplied exact and prefix tables are mutually exclusive.

# Target schema

Define a private annotated `DocgenLocalFullInputKind` `LiteralKit` with
`global-input`, `docgen-tooling`, and `other`, using the narrow
`@beep/schema/LiteralKit` import and the file's existing identity composer.
Add one classifier over the existing constant tables. It checks exact global
inputs first, then Docgen-tooling prefixes, and returns `other` otherwise.

`fullReasonForFile` computes the kind once and matches it exhaustively:
`global-input` constructs the existing global/Turbo reason,
`docgen-tooling` constructs the existing tooling reason, and `other` returns
`O.none()`. Do not add boolean projection helpers or export the private kind.

# Migration inventory

- `Local.ts:8-32` — add only the narrow `LiteralKit` import and reuse `$I` for
  the schema annotation.
- `Local.ts:68-91` — retain every full-input exact filename and prefix
  byte-for-byte and in its current order.
- `Local.ts:156-170` — retain `hasPrefix`, `hasExtension`, and `isExactFile`;
  they are shared generic policy helpers, not the finite domain being modeled.
- `Local.ts:361-379` — add the private classifier and replace the ordered
  boolean consumer branches with one exhaustive match on the literal kind.
- `Local.ts:474`, `812-838`, and `1238-1257` — preserve full-reason
  collection, rendering, and the exported testing surface unchanged.
- `packages/tooling/tool/cli/test/docgen.test.ts:728-741` — extend the focused
  full-input classification table without changing package-selection tests.

# Guard-deletion accounting

Delete the two separated boolean dispatch branches from `fullReasonForFile`.
One finite-domain classifier owns the precedence and mutual exclusion, and one
exhaustive match owns reason construction. Retain the generic predicate
helpers because package-local classification and other path policies still use
them; do not recreate `isGlobalInput` or `isToolingInput` boolean wrappers.

# Encoded-side impact

None. The kind is private derived state. `DocgenLocalFullReason`,
`DocgenLocalPlan`, JSON plan output, reason messages, reason ordering, path
normalization, command output, and public test exports remain byte-compatible.

# Test impact

Table-test every exact global filename, representative files under both
Docgen-tooling prefixes, slash-normalized equivalents, and near misses that
remain `other`. Assert the exact existing reason strings and input order.
Retain the scoped-package, full-plan, JSON-plan, and full-execution assertions.
Run the focused Docgen tests and full `@beep/repo-cli` package verification
with the required patch changeset.

# Risk and sequencing

Land in Tier 1E. The principal risk is broadening escalation through a prefix
or normalization change, so the implementation must not alter either policy
table or the existing `normalizedFilePath` boundary. No package dependency,
barrel, CLI flag, or public schema change is required.
