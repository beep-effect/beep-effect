# Instance

- id: `corpus-legacy-word-terminal`
- exact source SHA: `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
- corpus source SHA: `52fcc8d1353db9481ef9edb6cc9619500f95568d`
- file:line: `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts:3283`
- symbol: `LegacyWordTerminal`
- members: `passed`, `unapproved`
- evidence: E1 at `RestorationTransformations.ts:1141-1142,1357,2120,3837-3919`
  — writers produce only pass, approved exception, or unapproved exception;
  `passed && unapproved` is never written.

# Current shape

The terminal carries byte counts plus `passed` and `unapproved`. Four bit
combinations are representable.

# Cardinality gap

Three combinations are legal and have distinct counter and
stop behavior: `passed`, `approved-exception`, and `unapproved-exception`.

# Target schema

Add one named, annotated `CorpusFamilyTerminalOutcome` LiteralKit with
`passed`, `approved-exception`, and `unapproved-exception`; replace the flags
with `outcome`. Retain `inputBytes` and `outputBytes` as independent payload.
The file already uses `LegacyWordTerminal` as the common return carrier for
mail/PST and legacy-Word paths, so keep that carrier shared even though its
historical name is narrower than its consumers. The paired
`corpus-pst-terminal` design must use this exact kit and carrier; do not create
a PST copy of the literals.

# Migration inventory

- `RestorationTransformations.ts:8-50` — import `$RepoCliId` and `LiteralKit`,
  create the local identity composer, and define the single shared outcome kit.
- `RestorationTransformations.ts:304-319` — make `addFamilyTerminal` accept the
  common terminal outcome and match it once to increment exception, pass, and
  unapproved counters.
- `RestorationTransformations.ts:1141-1142` — as required by the paired PST
  design, migrate the
  `pstFailureTerminal` exception writer by mapping its live `approved` input to
  `approved-exception` and `!approved` to `unapproved-exception`; this is not a
  success writer. Preserve byte counts and retained-output/failure details.
- `RestorationTransformations.ts:1238-1239` — migrate `failPstAttempt` to
  `unapproved-exception`, preserving byte counts and failure details.
- `RestorationTransformations.ts:1357`, `:1368`, `:1375`, `:1395`, and
  `:1408` — migrate the PST success at `:1357` to `passed`, update the named
  return shape at `:1368`, and migrate every anonymous
  `processPstCandidate` return; none may retain the boolean pair through an
  inferred object type.
- `RestorationTransformations.ts:2090` and `:2120` — migrate both
  `processMailCandidate` terminal producers.
- `RestorationTransformations.ts:3837-3919` and `:3952` — migrate every
  legacy-Word conversion branch and the enclosing `processLegacyWordTerminal`
  producer, preserving byte counts and existing ledger writes/errors.
- `RestorationTransformations.ts:2036-2050` — stop the family loop only for the
  `unapproved-exception` outcome.
- `RestorationTransformations.ts:3283-3289` — replace the two booleans with the
  shared named literal type while retaining the common carrier.
- `packages/tooling/tool/cli/test/restoration-transformations-coverage.test.ts:245,252,1389-1418,1563-1564,2016,2127,2149,2191,2213,2252-2267` — migrate every live `passed`/`unapproved` fixture, mock return, and assertion, including the `fidelityFailure` pair at 1563-1564, to the terminal outcome while preserving the same three behavioral cases and ledger expectations.
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

Land in Tier 1E atomically with `corpus-pst-terminal`. This large file has
multiple producers; an exact member search and table-driven tests are mandatory
so an omitted writer cannot silently map an exception to a pass. Preserve the
newly forwarded `systemdRunPath` on PST export attempts; it is unrelated to the
terminal outcome.
