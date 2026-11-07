# Original canonical extraction corpus through the default engine

The new canonical extraction replay reads the authenticated original assertion
capture, not a new generated example list. It selects all 130 builtin Tokenizer
count assertions from `tests.test_FindTest.FindTest.test_find_citations` and
retains their original IDs. The original test constructs expected citation
objects independently; those objects supply expected kinds, token components and
metadata. Actual source-observed mention spans are retained separately. Neither
expected semantic values nor expected coordinates come from the target engine.

Each input enters through the default public engine using its original raw text
and cleaner selection. The corpus includes 115 uncleaned inputs, seven
all-whitespace inputs and eight HTML/inline-whitespace inputs. Full replay is
partitioned into thirteen consecutive ten-document tests on each runtime: all
130 inputs are scheduled on Bun and Node, with no optional filter. The focused
entry test runs the first two original inputs on both runtimes. Each test checks
that all observed native children have acknowledged exit.

Comparison covers ordered citation kinds, all original token components,
represented semantic metadata and verified primary spans. Original pin-cite
coordinate metadata is excluded from semantic metadata comparison, as in the
upstream test. The original parallel attribute assertions, corrected-reporter
method, remaining model methods, full/component coordinate comparisons and
Ahocorasick/Hyperscan tokenizer implementations remain separate obligations.
The test-only controlled missing-page identity provider remains explicit.

No new case is promoted to complete or ready merely because a replay has been
scheduled. Full hosted results must be checked at the published head before
recording any broader qualification. All source/donor accounting, representation
laws, resource/safety/scaling and lifecycle acceptance remain required.

The initial focused Bun/Node replay passes both tests in 45.64 seconds. After
sharing the existing semantic court-label comparison, server lint/types and the
Fallow new-only audit pass with zero introduced findings. The post-refactor
focused replay is still running at this checkpoint. Full hosted results and
all unrepresented source behaviors remain unqualified.
