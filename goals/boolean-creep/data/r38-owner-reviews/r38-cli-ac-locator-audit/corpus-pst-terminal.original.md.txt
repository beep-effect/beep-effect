# Instance

- id: `corpus-pst-terminal`
- file:line: `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts:1368`
- symbol: `processPstCandidate`
- members: `passed`, `unapproved`
- evidence: E1 at `RestorationTransformations.ts:1120-1143,1222-1240,1314-1433`
  — PST writers produce only pass, approved exception, or unapproved exception.

Audited at checkout `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
against main corpus `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Replacement P3 review remains pending.

# Current shape and cardinality

`processPstCandidate` repeats the boolean payload shape already named
`LegacyWordTerminal`. Success writes true/false; missing preservation evidence,
budget exhaustion, disk shortage, validation failure, and forced failure write
false/true. The caught engine failure writes false/`!approved`, where approval
is limited by the existing mail-scope/error classification. Four pairs are
representable and three are legal.

# Cardinality gap

The two flags represent four pairs. PST and shared mail terminal writers use
three: pass, approved exception, and unapproved exception; pass plus unapproved
is absent from the complete producer graph.

# Target schema

Reuse the same `CorpusFamilyTerminalOutcome` LiteralKit specified by
`corpus-legacy-word-terminal`: `passed | approved-exception |
unapproved-exception`. Keep one shared `LegacyWordTerminal` carrier for the
mail/PST and legacy-Word pipelines, replacing its flags with `outcome` while
retaining `inputBytes` and `outputBytes`.

Change `processPstCandidate`'s anonymous return type to the named shared
carrier. Every terminal constructor uses the shared kit enum. The
`pstFailureTerminal` catch maps its existing `approved` result to approved or
unapproved exception without changing classification or ledger records.

# Migration inventory

- `RestorationTransformations.ts:8-50` — add `$RepoCliId` and `LiteralKit` for
  the one shared internal outcome owner.
- `RestorationTransformations.ts:304-318` — match the shared outcome once for
  exception, pass, and unapproved counter deltas. The parameter object changes
  only because every terminal producer now supplies the outcome.
- `RestorationTransformations.ts:1120-1143` — map the caught PST exception's
  live approval result; preserve retained-output digest and bytes.
- `RestorationTransformations.ts:1222-1240,1314-1358` — migrate forced failure
  and pass returns without changing any preceding side effect.
- `RestorationTransformations.ts:1360-1433` — use the named terminal return;
  migrate missing-pass, budget, disk, validation, finish, and catch paths.
- `RestorationTransformations.ts:2033-2121` — use the outcome for loop stop,
  mail budget exhaustion, PST delegation, and approved deferred families.
- `restoration-transformations-coverage.test.ts:245-252,1389-1418,2016,2127-2267`
  — migrate fixtures and exact returns while retaining ledger assertions.

# Guard-deletion accounting

Delete every PST/mail paired boolean writer, the repeated anonymous return
shape, counter ternaries, and `terminal.unapproved` loop guard. Match one shared
outcome. Approval calculation and family ceilings remain unchanged.

# Encoded-side impact

None. Terminals are in-process aggregation values. Transformation JSONL,
attempt/pass/exception records, approval values, retained-output hashes, byte
counts, error text, and acceptance artifacts remain byte-compatible.

# Test impact

Cover PST pass, approved classified exception, unapproved classified exception,
missing pass, total budget, available bytes, validation failure, source drift,
and retained output. Assert the shared outcome drives exact counters and stops
the family only for unapproved exception. Preserve `systemdRunPath`, sandbox
arguments, and all ledger snapshots.

# Risk and sequencing

Land atomically with `corpus-legacy-word-terminal`; both records intentionally
share one kit and carrier. Do not duplicate the three literals or alter mail
exception approval policy.
