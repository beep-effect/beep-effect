# CLI Option.some comparison migration

## Scope and assertion preservation

This batch takes 198 comparisons across 31 files from the existing open CLI
EV006 inventory. It uses public `assertSome` for 197 comparisons, preserving
each subject and expected payload. The installed rc.118 helper uses Node's
deep strict comparison with `Option.some(expected)`: 112 original strict
comparisons retain strict comparison, while 85 ordinary `toEqual` comparisons
adopt the canonical strict helper.

One additional comparison in the root lint policy step test has an
`expect.objectContaining` payload. That matcher is preserved: the draft binds
the subject and matcher once, checks the Some predicate with public
`assertTrue`, then applies the original matcher to the unwrapped value. Passing
an asymmetric matcher to Node's deep strict comparison would not preserve the
test's partial-object matching behavior.

Fifteen optional indexed subjects are bound once alongside their expected
values, in the original evaluation order, then checked with `assertDefined`
and `assertSome`. An undefined subject still fails. Three numeric expected
literals use the existing `NonNegativeInt` constructor to supply their required
brands without changing their values or using casts. Two now-unused Option
namespace imports are removed. No test registrations, property settings,
timeouts or native boundaries change.

Draft validation checks import provenance, shadowing, parse validity, unique
bindings, subject text and payload text. Structural comparisons verify the
planned statements, including the three subsequent branded-literal repairs.
The final generated Effect diagnostic artifact reports exit zero with empty
output; wrapper exit alone was not accepted as proof.

## Inventory reconciliation

Actual final-source detector output removes exactly 198 EV006 findings and
preserves every other group's multiplicity and traversal order. Only occurrence
and evidence fields on 63 changed enclosing-statement anchors are reconciled.
No baseline exception or new debt is added.

The private ledger plan matches 181 historical rows by exact occurrence and
one remaining row by unique identical file/rule/class/symbol/evidence after
all other duplicate copies are assigned. Sixteen captured findings have no
remaining historical row to assign; some repeat evidence whose older copies
already map uniquely to other current findings. They now have separate fixed
records. All 198 records reference source commit
`484ab21b075e36bad965961ff196ffa74615ebfd`, preserving existing identities.

## Proof status

Before-change Node and Bun runs pass all 1,444 tests, with identical file/title
registration multiplicities, no failures/skips and stable source hashes. Node
takes 173.066257897 seconds; Bun takes 124.440106621 seconds. Runtime versions,
process limits, workstation load and CPU/memory/I/O pressure are recorded.
Concurrent workstation activity means these timings do not establish causality.

The reconciled ratchet passes: 3,881 findings, zero introduced and 1,136
resolved baseline findings, with 1,217 files scanned in 9.83 seconds. Final-source
after-runs and full CLI package audit/docgen are active; their results are not
yet claimed. Private receipts use
`cli-option-some-equality-*`, including proposal, optional/asymmetric handling,
diagnostic repairs, statement comparisons, detector control, ledger plan,
timing reports and actual typecheck artifacts. This batch does not close the
broader inventory or goal.
