# Instance

- id: `corpus-legacy-word-terminal`
- file:line: `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts:3277`
- symbol: `LegacyWordTerminal`
- members: `passed`, `unapproved`
- evidence: E1 at `RestorationTransformations.ts:1135-1136,1351,2114,3831-3913`
  — writers produce only pass, approved exception, or unapproved exception;
  `passed && unapproved` is never written.

# Current shape

The terminal carries byte counts plus `passed` and `unapproved`. Four bit
combinations are representable.

# Cardinality gap

Three combinations are legal and have distinct counter and
stop behavior: `passed`, `approved-exception`, and `unapproved-exception`.

# Target schema

Add a named `LegacyWordTerminalOutcome` LiteralKit with those three values and
replace the flags with `outcome`. Retain `inputBytes` and `outputBytes` as
independent payload. Reuse this terminal type for the mail/PST and legacy-Word
family paths already sharing it; do not duplicate outcome literals.

# Migration inventory

- `RestorationTransformations.ts:298-313` — make `addFamilyTerminal` match the
  outcome once to increment exception, pass, and unapproved counters.
- `RestorationTransformations.ts:1135-1136` — migrate the
  `pstFailureTerminal` exception writer by mapping its live `approved` input to
  `approved-exception` and `!approved` to `unapproved-exception`; this is not a
  success writer. Preserve byte counts and retained-output/failure details.
- `RestorationTransformations.ts:1232-1233` — migrate `failPstAttempt` to
  `unapproved-exception`, preserving byte counts and failure details.
- `RestorationTransformations.ts:1351`, `:1362`, `:1369`, `:1389`, and
  `:1402` — migrate the PST success at `:1351` to `passed`, update the named
  return shape at `:1362`, and migrate every anonymous
  `processPstCandidate` return; none may retain the boolean pair through an
  inferred object type.
- `RestorationTransformations.ts:2084` and `:2114` — migrate both
  `processMailCandidate` terminal producers.
- `RestorationTransformations.ts:3831-3913` and `:3946` — migrate every
  legacy-Word conversion branch and the enclosing `processLegacyWordTerminal`
  producer, preserving byte counts and existing ledger writes/errors.
- `RestorationTransformations.ts:2030-2044` — stop the family loop only for the
  `unapproved-exception` outcome.
- `RestorationTransformations.ts:3277-3283` — replace the two booleans with the
  named literal schema/type.
- `packages/tooling/tool/cli/test/restoration-transformations-coverage.test.ts:243,250,1387-1416,1561-1562,2014,2125,2147,2189,2211,2250-2265` — migrate every live `passed`/`unapproved` fixture, mock return, and assertion, including the `fidelityFailure` pair at 1561-1562, to the terminal outcome while preserving the same three behavioral cases and ledger expectations.
- Repeat exact-source searches for both members before apply; migrate every
  anonymous return annotation and fixture in the same PR.

# Guard-deletion accounting

- Delete the two independent ternaries in `addFamilyTerminal` and the separate
  `terminal.unapproved` loop guard.
- Delete every paired `passed`/`unapproved` writer and its implicit exclusion
  invariant.
- Preserve family ceiling logic; its aggregate counters are independent facts.

# Encoded-side impact

none (internal repo-CLI execution value; ledger records are unchanged)

# Test impact

Add a three-row outcome table proving exact counter deltas and loop-stop
behavior. Retain mail/PST and legacy-Word success, approved-exception, and
unapproved-exception fixtures, plus all ledger/report snapshots. Run full
`@beep/repo-cli` verification and the Corpus-focused suites.

# Risk and sequencing

Land in Tier 1E. This large file has multiple producers; an exact member search
and table-driven tests are mandatory so an omitted writer cannot silently map
an exception to a pass. Preserve the newly forwarded `systemdRunPath` on PST
export attempts; it is unrelated to the terminal outcome.
