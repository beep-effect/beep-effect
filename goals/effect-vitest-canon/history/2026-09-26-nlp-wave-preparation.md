# NLP wave preparation

The isolated `codex/effect-vitest-nlp` branch starts at main `7581ead6c8`.
This selects the existing ten-file backlog under the backlog-first authorization.
Its scheduled prerequisites are identity, schema, test-utils and utils; this
package does not depend on the pending RDF, HTML or Markdown waves.

The frozen inventory contains 97 detector rows and 40 human rows. Thirteen
human rows identify property floors, graph edge-payload assertions, generated
Composable laws or property failure diagnostics. The current detector scan
emits 102 rows: 64 EV001, 16 EV006, 21 EV007 and one EV011. Historical rows
and the baseline remain intact until final package reconciliation.

Three test files are byte-identical to the frozen base. The seven changed files
were reviewed against that base: changes consist of Arbitrary module moves,
typed schema boundary migrations, safe sentence indexing and an inherited
PatternCore discard budget. They introduce no resource acquisition. The prior
scope judgment still applies: graph, algebra, schema and text operations are
local; path strings do not make these filesystem tests. Preserve the inherited
20,000-discard PatternCore option and the original five-way generator tuple.

Fresh baselines both pass all 168 tests with zero failures or pending cases:

| Runtime | Whole command seconds |
| --- | ---: |
| Node | 4.554105289003928 |
| Bun | 3.077367795005557 |

Source, test, manifest and lockfile hashes were stable across each run. Reports,
source comparisons and runtime/load/pressure/resource-limit contexts are stored
in `ops/inventory/timings/nlp-preparation/`. These runs occurred while other
quality jobs were active; they are not isolated performance measurements or
direct comparisons with the frozen Vitest 4 baseline.

Current source confirms the reviewed findings remain applicable: the generic
Monoid harness still omits run options; mapEdges and bimap still omit transformed
edge payload assertions; Composable laws still use only fixed strings. Preserve
all existing comparators, bounds, optional wire keys, generation links and
SentenceConcat's deliberately identity-only coverage.

Proceed in D12 order: assertions, property remediation, concrete flake evidence,
then the instrumented runner. No package source or tests change in this
preparation checkpoint. Package proof, after timings, ledger/baseline closure
and hosted PR gates remain outstanding.
