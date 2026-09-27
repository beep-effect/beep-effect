# Wink resource phase proof

Twenty-eight service-backed cases across nine files now acquire their real Wink
layers through native `it.layer` registrations. Every case has its own layer
registration, including successful custom-entity learning and invalid-pattern
learning. Mutable engine scenarios do not share an acquisition with other cases.
The two multi-call tokenization/graph cases retain their original inputs and
result flow while using one acquisition within each case.

Five private `provideScopedLayer` definitions and four shared-provider imports
are removed. Actual installed engine/model access, toolkit stream draining,
combined bundle lookup and facade/backend/graph behavior remain. Two nested
generators whose only boundary was the old provider are inlined after the
compiler identified them as redundant. No production implementation changes.

The conservation receipt compares normalized assertion expressions and test
titles against the pre-admission commit. All 107 original assertions across the
eleven executable files and all 47 registrations remain unchanged. Full package
verification passes: audit 7.2 s and docgen 3.3 s. This proves the resource phase;
property/oracle improvements, runner instrumentation and final saved-inventory
reconciliation remain outstanding.

Unchanged-source baseline observations passed 47 tests with zero skips on both
Node and Bun. Whole-command durations were 4.8710 s and 2.7183 s respectively,
with stable source hashes and recorded workstation load/pressure. These are
single contextual observations, not evidence of a causal performance change.
