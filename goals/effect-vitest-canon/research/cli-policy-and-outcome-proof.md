# Test-policy repairs and piped outcome detection

## Attribution and repair

The frozen PR #1323 publisher failed its full lint-policy lane after passing
build, doctest, docgen, integration and ordinary lint. The separate Effect
test-typecheck artifact exposed 138 diagnostics in this follow-up's source: 134
nested predicate assertions, two reusable generators, one short console provider
and one typed decoder. The repair uses the equivalent piped assertion form,
Effect.fn for the two helpers, the existing provideScopedLayer helper for the
cheap console, and a hoisted decodeEffect for historical Yeet check records.
The exact subjects, predicates, truth polarity, test titles and explicit
budgets remain unchanged.

The actual package-test-typecheck result artifact now has exit code zero and
empty diagnostic output. Its wrapper's zero exit alone is not accepted as
proof. The focused five-file CI-mode suite passes all 108 tests on Node and Bun.

Three adversarial path strings in knowledge-semantic-delta tests are moved
unchanged into named fixtures. This preserves every input byte and redaction
assertion while removing apparent private home paths from generated inventory
excerpts. The 64-test suite passes on Node and Bun. The refs gate reads HEAD,
so its pre-commit retry still reported the historical snippets. The check
passes after the implementation commit with zero live gated observations.

## Detector regression

EV005 failed to recognize imported assertTrue/assertFalse as the terminal
stage of a pipe. Six existing findings disappeared after a behavior-preserving
style correction. A regression failed on the original detector; its negative
control passed. The syntax-only repair recognizes proven public assertion
references and follows local result bindings in method receivers as well as
call arguments. It covers method pipes, functional pipes, inline results,
lexical shadows, unrelated bindings and non-assertion consumers.

The detector/store/contract suites pass 246 tests on Node. Those suites plus
knowledge-semantic-delta pass 310 tests on Bun. All six previously hidden
findings remain visible. The 46-file before/after detector comparison preserves
every finding group's multiplicity; 88 enclosing anchors/evidence snippets are
reconciled narrowly. One existing short-console exception is updated to its
shared-helper form. No old finding is waived.

## Newly exposed native filesystem expectations

The repaired detector exposed nine previously unrecognized EV005 findings:
eight in PathSafety and one in DocumentIntake. They assert only that an operation
returns a typed failure. Replacing those Result/predicate combinations with
yielded Effect.flip preserves the failure expectation: unexpected success fails
the test, expected typed failure continues it, and defects still fail it.
All surrounding filesystem safety and cleanup assertions are unchanged. A
result used for further error-field assertions in DocumentIntake is retained.

| Suite | Tests per run | Node before / after | Bun before / after |
| --- | ---: | ---: | ---: |
| PathSafety | 9 | 4.021 s / 3.069 s | 2.319 s / 1.366 s |
| DocumentIntake | 6 | 4.922 s / 5.724 s | 2.818 s / 1.667 s |

All four runs per suite have identical registrations, zero skips/failures and
stable source during each run. Three unused PathSafety imports were removed
after the comparison; final package proof includes that cleanup. Host load and
pressure are recorded; timing differences are not causal performance claims.
Full package proofs pass: file-processing audit 7.8 s/docgen 3.4 s and
documents-server audit 14.5 s/docgen 6.1 s. The new full CLI package proof passes: audit 681.2 seconds and docgen
24.8 seconds. The test-typecheck artifacts for both native filesystem packages
also report exit code zero with empty diagnostics.

The final ratchet passes with 4,391 findings, zero introduced and 626 resolved
baseline findings. The nine newly exposed findings are repaired without
expanding the baseline. One changed shared-layer anchor in PathSafety is
reconciled from actual before/after detector output. Their nine new resource-ledger rows reference implementation commit
`13cad3e1fa`; all three affected resource ledgers pass strict schema and
unique-identity validation. The goal remains incomplete.

Private receipts use the `console-followup-policy-*`,
`console-followup-detector-*`, `console-followup-new-outcomes-*` and
`console-followup-*-verify` prefixes.
