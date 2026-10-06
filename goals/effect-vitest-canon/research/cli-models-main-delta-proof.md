# Models command main-delta repair — 2026-10-06

Main commit `5603a6c63e` added model-command tests after the frozen P1
inventory. Its test files arrived with runner-redundant `Effect.scoped` calls
and two unbounded `it.layer` registrations. Main also carried a
`@beep/schema/PatternOntology` tsconfig path that was absent from
`vitest.aliases.generated.json`. On #1445, the latter made hosted
`Heavy / Lint Policy` fail its `lint:tsgo-rules` step. After integrating main,
Yeet cheap gates identified six new Effect/Vitest findings in the model tests.

Source fix: `74f3b6dece8394bd4f4177a4b70ff9b6fdfda031`. The repair deletes
the nested scopes, adds 30-second layer setup timeouts, and projects the one
missing alias. It leaves the Node-backed command boundary and fresh
TestConsole behavior in place. The two model files and the previously migrated
changeset-status suite pass together on Node and Bun: 36 tests each. The
`lint:tsgo-rules` check passes. The detector reports zero introduced findings
and seven resolved existing baseline rows; refreshing the baseline removes
exactly those seven (1,933 to 1,926).
The generated inventory also refreshes 36 retained findings' line coordinates
after the merged main changes; comparison by file, rule, occurrence, class, and
evidence shows no added or otherwise removed findings.

Nine current-main detector rows from the prior baseline are appended to the
repo-cli ledger without changing their IDs or source evidence: five EV004 and
two EV014 rows are fixed at the source SHA above; two EV010 platform-provenance
rows remain open for the full current-main lens review. This is a bounded
repair receipt, not a claim that P1's new-main delta or every human lens is
complete. The pre-#1444 combined CLI source passed full `@beep/repo-cli` package
verification (audit 821.8 seconds, docgen 28.5 seconds). The exact current
base includes #1444 and is under a new package proof; hosted checks remain
a separate gate.
