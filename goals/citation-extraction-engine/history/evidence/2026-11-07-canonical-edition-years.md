# Original edition-year assertions against authenticated production data

The original FindTest.test_date_in_editions method has eight assertion events.
It calls Edition.includes_year on the first original edition and compares its
boolean result with the declared expectation. These are model-method assertions,
not raw-document extraction assertions. The target replay preserves that scope.

The new canonical test authenticates assertion-cases.json, checks all eight
successful original equality criteria and both boolean operands, and uses the
actual captured artifact reference and integer year for each call. The existing
frozen-edition loader and production owner authenticate the complete original
edition payloads. The existing makeCitationEditionInference.includesYear method
executes the comparison; the test implements no alternate date logic.

The captured source clockDate (2026-10-28) sets Effect TestClock and the captured
zone is UTC. The future-year observation therefore remains relative to the
original calendar, rather than the workstation's current date. Cases cover S.E. at 1886, 1887 and 1940; S.E.2d at 1940 and 2012;
and T.C.M. at 1950, 1940 and the captured future year 2027.

The final retained test passes in 6.08 seconds. Package lint/types and Fallow
new-only pass with zero introduced findings. The exact eight assertion IDs are
FindTest.test_date_in_editions at tests/test_FindTest.py:980:12:caseDeclaration,
ordinals 1 through 8. Each receives complete-case local proof for its original
model-method call. No parent model family or full extraction pipeline is promoted.

The existing 197-input extraction replay remains separately scheduled and
unqualified as a whole. All broader native-value/model protocols, alternate
paths, source/donor accounting, representation laws, safety/scaling and lifecycle
acceptance remain open. Passing these original eight cases does not substitute
for the existing broader date-boundary and live-clock controls.
