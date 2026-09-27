# UI native properties and schema-consumer finding

The original grouped codec property now uses native it.effect.prop. All seven
schema domains, codec pairs, equality predicates, and the 50-run floor remain.
The only schema change is the independently reproduced consumer defect below.
An AST preservation check retains 143 original assertions and 45 statically
named registrations across ten files; parameterized cases remain unchanged.
Twenty-six Boolean/Option assertions use public Effect Vitest utilities.

Additional generated laws cover UTC instants from 2020 through 2030 across UTC,
London, New York, Kolkata and Sydney, asserting the intended token and unchanged
instant through zone conversion and back. The existing winter London example,
getters/setters, inclusive year range, invalid values and meridiem cases remain.

The viewer law constructs valid half-open ranges and checks visibility and the
exact UTF-16 slice against a native interval oracle. Explicit touching and empty
ranges supplement the original emoji and page-spanning fixtures. React's server
renderer is used only to escape the expected text. These are SSR assertions,
not browser scrolling or gesture evidence.

## Finding: accepted precision exceeds the consumer contract

The saved L-PROP-01 row for schema-parity.test.ts identified SpinParams precision
101 as a candidate. Executing SpinParams.make({ precision: 101, step: 1 }) on the
baseline succeeded, while both numberToString and resolveBlurInterfaceValue
threw RangeError. Precision 100 succeeded. The packet section 4 expressly allows
schema sharpening demanded by property findings, with a finding row and PR-body
callout; this repair uses that allowance.

NonNegativePrecision now includes the built-in upper bound 100, alongside the
existing finite integer and nonnegative constraints. Defaults and consumers are
unchanged. This is a production schema repair, not a test-generator filter.
Generated SpinParams values reach both consumers, including each blur clamping
branch. A fixed boundary regression accepts 100 and rejects 101 through the
schema; removing the bound makes that regression fail.

The package audit and docgen passed after the property migration with a 400-case
floor and seed 20260708. Seven independent inverted codec predicates and the two
new interval/instant predicates all fail with native replay and shrunk inputs.
Control receipts are retained privately with exact restoration hashes.
