# Provider driver local proof

All twelve recorded files were reviewed through scope, assertions, property,
flake, then observability. No production schema or implementation changed.
Each file now imports the accepted instrumented runner. Five development
dependencies, generated references, Fallow metadata, and forty-four cache
dependency lists reflect that adoption; cache eligibility is unchanged.

## Preserved and strengthened behavior

- Anthropic repair property retains its schema-derived tuple, successful encode,
  exact reencoded Option equality, and twenty-five-run floor. Its existing
  three-schema property retains fifty runs.
- OpenAI fixture blocks keep independent captures and language/embedding
  metadata contexts. Failed key acquisition remains inside its assertion;
  the test runner owns the scope. Five invalid-input cases retain their inputs
  with matching failure helpers; both property schemas retain fifty runs.
- OpenAI compatibility keeps nineteen original test names and sixty-eight
  expectation expressions, including both header clients in one comparison.
  Effectful fixture ownership replaces the copied scope helper and unsafe cast.
- Venice retains eleven isolated fixtures, both round-trip laws and their
  twenty-five/fifteen-run floors. Its first-event bound remains one second
  but uses the live clock; an unclosed native response body now has an explicit
  cancellation witness after take-one completes. The optional integration
  credential predicate and enabled live API assertions are unchanged. The
  absent-key placeholder is reported skipped instead of passing.
- xAI retains all fourteen arbitrary domains and the twenty-five-run floor.
  Typed outcome helpers preserve the original failure and payload assertions.
  All four SSE endpoints now assert exact payload and sequence, retaining the
  original length assertions.

## Final verification

Full package-verify passed after runner adoption for all five packages.
OpenAI was reverified after removing the last redundant inner scope. The final
syntax-only scan found no remaining detector rows for these packages. Fallow
boundaries and cache audit passed; unassessed cache tuples remain unassessed.

Configured JSON reporter runs, including the optional integration registration:

| Package | Before Node | After Node | Before Bun | After Bun | Final pass/skip |
| --- | ---: | ---: | ---: | ---: | --- |
| @beep/anthropic | 6.865 s | 4.699 s | 2.623 s | 1.542 s | 9/0 |
| @beep/openai | 4.942 s | 4.702 s | 2.439 s | 1.623 s | 12/0 |
| @beep/openai-compat | 4.925 s | 4.589 s | 2.872 s | 1.564 s | 19/0 |
| @beep/venice-ai | 5.497 s | 4.763 s | 3.051 s | 1.634 s | 16/1 |
| @beep/xai | 5.148 s | 4.435 s | 3.120 s | 1.486 s | 14/0 |

Every run exited zero and recorded stable source, manifest and lockfile hashes.
Public raw reports and resource contexts retain both runtimes. Load, pressure,
limits and runtime versions are evidence of shared workstation conditions, not
a controlled performance comparison. No live provider request is claimed by
the absent-key run.

The configured signer recovered and the final implementation is committed as
`d3a9c0f66194edf067944a624ad229d11eb5ed07`. The earlier Anthropic and compatibility phases retain their own
source commit credits. All eighty actionable rows in this twelve-file wave
are resolved; forty-five no-findings rows retain their coverage-only status.
The final ratchet reports 7,959 repository findings and no introduced findings
after removal of exactly seventy-seven provider baseline entries. The measured
11.08-second scan does not establish the goal's sub-ten-second target.

This is local proof, not goal closure or hosted merge readiness.
