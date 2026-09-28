# Epistemic Config remediation proof

The standing production-repair authorization covers the saved malformed-loopback
finding. The old audience classifier catches URL parse failure and returns raw
trimmed text as a hostname. Six bare loopback inputs therefore receive the
weaker local audience despite the documented fail-closed contract.

The classifier now uses the existing URL schema's Option decoder. The local
branch requires a successful parse and a hostname in the unchanged loopback
list. SinkDestination is not narrowed, so malformed destinations remain accepted
inputs that receive the stricter external audience. Eight malformed-input cases
cover bare localhost, case/whitespace variants, IPv4/IPv6, an omitted scheme and
an invalid bracket. Six fail with assertion errors against the original source;
all eight pass after the repair. Two valid parser controls preserve surrounding
whitespace/case handling and a non-HTTP local URL. All original local/external
cases and the original not-a-url assertion remain.

Three successful configuration fixtures use public scoped layers with explicit
10-second hook budgets. The local Layer.build/context-provision helper is removed.
The two malformed configurations deliberately acquire inside Effect.exit through
the canonical shared scoped helper: suite-hook acquisition would fail before the
typed-failure and absence-of-defects assertions could run. This is the sole
remaining current detector judgment, with an explicit failure-boundary reason.

All 14 original assertions, ten static registrations, configuration input domains,
valid classification arrays, grant reconstruction and frozen digest expectations
are preserved. Four Boolean assertions use public helpers. The instrumented
runner passes trace-disabled and trace-enabled deliberate-failure probes, which
are removed. Generated references and Fallow edges reflect the runner and shared
helper dependencies. Cache review covers 13 owned nodes and eight dependency
lists, adding both upstream edges while preserving commands, configuration,
qualification state and unrelated nodes.

Full package verification passes (audit 5.4 seconds, docgen 2.7 seconds), as do all
six root policy checks. The package has no generated property law to replace;
its concrete grant digest and allowlist contracts remain intact. Node and Bun
both pass ten baseline and 20 final cases with zero skips and stable source
hashes. Whole-command times were Node 4.674 to 5.474 seconds and Bun 1.967 to
1.366 seconds. Load and pressure are recorded; these are observations under
different case counts, not causal speedup claims. No network request or live
credential is involved.

The seven saved actions are reconciled against source commit
`631f4e9c0ebb7b92c8f4c167b4cd5e1c24be796d`. The single current scoped-provision
exception retains its explicit failure-boundary reason. Historical IDs, including
root-only records, are preserved. Strict validation passes for 5,250 root IDs and
14,948 ledger IDs with no invalid rows or duplicates. All 683 unrelated ledger
hashes and unrelated raw root/census objects are preserved. Four public timing
artifacts contain the measured results and context. The saved queue now contains
seven packages and 553 actions. This package closeout is not consolidated PR or
goal acceptance.
