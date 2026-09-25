# effect-vitest-inspect-context-phase

Proposed Tier 1 design. Audited source: `ea3ac40867e4f292b7f0708b156231f0462ddcd9`.
The two owning source files are hash-identical at current main
`220d9426dad4b708807b6297cb71d75449288749`. No implementation or independent
P3 approval is claimed.

## Current shape

`inspectContext` in EffectVitestDetectors.ts681-717 returns twelve properties.
It stores `test`, the optional enclosing callback and mode, alongside three
Boolean derivatives: `inTest`, `effectTest`, and `testClockMode`. The complete
owner also contains independent `publicProvider` and `localProvider` facts,
compiler nodes, member names, definition lookup and reachable-helper context.
These remain supported. The returned context is private and inferred through
`ReturnType<typeof inspectContext>`; it is not an encoded request or report.

`EffectVitestHarnessIndex.enclosingTest` at EffectVitestSyntax.ts637-639
already returns Option of callback plus plain/effect/live mode. Its cached
implementation1149-1152 excludes the layer case; the standalone helper743-765
preserves nearest enclosing registration. The existing test payload is the
source of truth and must be retained, including its exact callback identity.

## Cardinality gap

The minimal Boolean projection has eight representable tuples and four
produced tuples, in `(inTest,effectTest,testClockMode)` order:

| Existing test | Tuple |
| --- | --- |
| None | false,false,false |
| Some plain | true,false,false |
| Some live | true,true,false |
| Some effect | true,true,true |

The source derives the three fields at685-687. Clock mode implies effect mode,
and effect mode implies test presence. The raw report's32/16 projection
multiplies independent provider facts; retain those facts but record8/4 for the
minimal correlated subset. This finite projection does not count callback,
compiler-node or helper payload values, and is not a count of concrete objects.

## Target schema and reuse

Reuse the existing `test` Option and its existing mode alternatives. Remove
all three stored Boolean derivatives from the returned context and remove
their local declarations685-687. Do not introduce a second phase literal,
compatibility bag, schema containing opaque compiler nodes, or new service.
Option's absent/present variants and the existing mode already represent the
four legal alternatives with the callback payload attached where applicable.
This is elimination of redundant derived state, not creation of a parallel
pure-data domain. The existing operational harness/callback types stay intact.

At presence-only consumers use Option matching/presence helpers directly on
`test`. Where effect/live is needed, use the existing mode inside an Option
match or `O.exists`; effect-only clock eligibility uses that same payload.
Do not recreate a helper returning all three bits. An immediate Boolean
argument to the existing `effectRegistrationBody` function can be derived
from test at the call boundary; that excluded function parameter is not
another stored context model or independent census owner.

## Migration inventory

All locations below are in EffectVitestDetectors.ts.

1.681-717: compute test once as before. Replace helper's `!inTest` at689 with
   test absence, preserving short-circuit order and the existing provenance
   calls. Remove three fields708-710; keep every other returned field.
2.719-743: runtime boundary detection uses test presence or helper presence.
   Keep shared-helper judgment and finding payload/order unchanged.
3.768-782: derive effect/live eligibility from test for
   effectRegistrationBody777. Preserve publicProvider/localProvider,
   provenance checks and registration-body fallback semantics.
4.834-859: scope lifetime detection uses test's effect/live mode OR the
   helper's independent effect fact. Retain the whole-body callback test845,
   scope classification and judgment behavior.
5.861-875: result assertions use test presence.986-1015 and1033-1052:
   expectation/Boolean data-shape detection retains its early returns and
   argument inspection after replacing the presence read.
6.1067-1089: property assertions use test/helper presence; native/legacy
   discrimination and shared-helper judgment remain unchanged. This consumer
   must not be missed merely because it destructures context inside its body.
7.1191-1209: test-clock eligibility comes only from Some(effect). Keep the
   separate reachableHelper call1197 limited to test absence; do not use the
   context helper as a substitute because it was queried under different
   provenance gates. Keep liveClockFor early exclusion and all finding data.
8.792-818: resource-wrapper detection already uses test.callback directly;
   preserve it. Remaining consumers1211-1265 use other context fields and
   require no behavioral change. inspectCall1429-1442 constructs one context
   and calls detectors in exactly the existing order.

No change to EffectVitestSyntax's enclosing-test classification, cache,
nearest-scope traversal, registration recognition, aliases, imports or helper
reachability is necessary. Do not broaden this migration into the nested
reachableHelper flags; that is a separate complete owner with separate proof.

## Guard-deletion accounting

Delete the three derivative declarations685-687 and returned fields708-710.
Delete their reads/destructuring at689,720/726,769/777,835/841,862/868,
987/991,1034/1039,1068/1070 and1192/1198. Replace each with a projection from
the authoritative Option/mode; membership/presence checks still express real
detector eligibility and are not falsely credited as disappearing decisions.
There is no runtime coherence validator to delete. Preserve helper lookup,
provider detection, callback scope, import provenance and live-clock checks.
The state-space reduction comes from no longer being able to store three
inconsistent derivatives beside test, not from moving a guard to a new file.

## Encoded-side impact

None. The private context has no wire codec, persisted writer or public
constructor. Public findings, diagnostics, ordering, source positions,
mechanization/judgment labels and report JSON must remain identical.
Keep node/callback references, mutable findings array use and synchronous
inspection behavior. No new decoding, normalization, default or error path.

## Test impact

Use the existing effect-vitest-detectors.test.ts harness rather than exporting
inspectContext. Its table80-124 covers runtime/scope/clock rules;305-306
separates live mode from test-clock eligibility;528 onward covers withLive,
helper-clock and classification handling;719 onward covers lexical helper
reachability;770-802 distinguishes setup/plain/effect/shared helpers;
1182-1208 covers helper clock behavior;1781 onward covers scoped function
pipelines and live-mode providers. The public scanner's complete findings
are the regression observable, not a private enum or property count.

At implementation compare pre/post complete ordered findings for each of the
four existing test states with representative runtime, scope, result, data,
property and clock calls. Include outside-test unreachable/reachable helpers,
plain/live/effect callbacks, public and local providers, both provider facts
where source permits, live-clock exemptions, mixed helper reachability and
callback resource wrappers. Preserve existing alias/shadowing cases. Do not
fabricate compiler contexts with impossible combinations solely for tests.

Run the focused detector suite and CLI typecheck/package verification, then
the campaign Yeet gates. No implementation tests were run for this design.
The supplied truth table is algebraic qualification evidence only.

## Risk and sequencing

Principal risks are forgetting detectPropertyAssertion, accidentally merging
the clock-specific helper lookup with the context helper, narrowing live mode
out of effect eligibility, and replacing callback identity with just a label.
The explicit consumer inventory and complete-finding comparisons address them.
Land the context producer and all consumers atomically after independent
review and packet ratification; Benjamin merges. No new exports or role files.
