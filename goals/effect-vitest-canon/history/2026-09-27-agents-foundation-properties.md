# Agents foundation native property phase

Three domain registrations now use the native adapter. AgentMode uses
it.effect.prop with its existing arbitrary, decode/encode assertions and
fcRuns(25). The five-schema and three-schema round-trip groups each use one
it.prop registration with named generator fields and fcRuns(10). Every original
schema runs on every trial; the original Equal-or-schema-equivalence oracle is
unchanged. Keeping each group in one registration preserves its original total
case deadline and concurrency contract. No schema is filtered or narrowed.

The table converter's native property was already migrated upstream. Its full
ProviderInstance equivalence, Result guards, null/Option conversions and fcRuns(50)
remain; it receives upstream credit during reconciliation.

Configured Node and Bun pass all 22 domain cases. Whole-command observations are
8.193910 and 2.676149 seconds with stable source hashes. Domain package audit
(21.2 seconds) and docgen (13.8 seconds) pass. At BEEP_FC_NUM_RUNS=400 and
BEEP_FC_SEED=20260708, all three domain property registrations and the existing
table converter property pass. Other cases were deliberately outside that focused
property invocation; the full configured suites passed separately.

A temporary oracle inversion produces one expected native property failure with
all three named schema inputs, a shrunk input and replay information containing
the configured seed. Source is restored exactly. The proof checker initially
looked for generic seed/counterexample labels; rc.117 labels these Replay and
Shrunk input. The receipt was corrected against the retained output without
rerunning or selecting a different counterexample. AST comparison confirms no
unreviewed body change. These timings do not establish a speedup.
