# Architecture-lab property and orchestration phase

Replace the admitted native checkEffect/Passed-tag wrappers with native effect
properties. Preserve all ten Domain and fourteen Use Cases schema families,
all row-converter arbitraries, UI equivalence/validity laws, and the repository
identity encode/decode/re-encode comparisons. Domain's inline ten-run minimum
now uses fcRuns(10), restoring the configured floor and replay seed. Existing
10/20/25/50-run floors remain unchanged. Name every schema family separately.

The create/list test retains its seeded repository and original assertions,
then records the exact create input and checks listed identity/title. The
client get test retains version/absence checks, gives unexpected transport
methods distinct failure outcomes, records the exact query, and compares the
returned item. A bypassed create, wrong client method and changed query each
fail the strengthened tests. These controls modify test invocations only;
production sources remain untouched and test sources are restored exactly.

All six package audits and docgen pass. Runs with BEEP_FC_NUM_RUNS=400 and
BEEP_FC_SEED=20260708 pass in the five property-bearing packages (13/4/16/7/7
selected-file tests). These are property-file runs, not whole-package counts.
Existing resource and flake reviews preserve independent in-memory stores,
sequential shared PGlite, actual migrations and all original deadlines. No
sleep, retry, timer or resource-substitution change is introduced.
