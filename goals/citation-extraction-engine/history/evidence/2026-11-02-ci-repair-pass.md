# PR 2511 hosted CI repair pass

Inspected Check run 41565045980 at head 3775253488. Direct failures were unit
shard unit-d (125684432177), Integration (125684816743), Lint Policy
(125684816719), and Fallow (125684431937). Test Unit summary (125689067911)
propagated the shard failure. Coverage Regression (125689098292) stopped on
UNIT_RESULT=failure; it did not produce a fresh coverage comparison.

## Root fixes

The private test-import migration incorrectly rewrote nine worker-entrypoint
file URLs in eight helpers/tests as package import aliases. Restore their
original relative file URLs. The two-child smoke test now receives the actual
parse-error for empty input and successful text for ordinary HTML. Error reply
codec controls also pass. A full local corpus replay was interrupted with exit
130; it is not passing evidence. Full corpus/integration runs stay on hosted CI.

Add test-local tsconfig discovery files extending each package's existing test
configuration. TypeScript, Vitest and Fallow now resolve the same private test
aliases while package exports remain blocked. Fallow dead-code reporting for
law-practice has zero findings, down from 238 (185 unresolved imports, 51
unused files and two unused exports). No ignore rule or severity changed.
Correct the fixed Complete regex result envelope to TaggedStruct.

Update the nine introduced broken documentation references: active designs
point to canonical citation/verified-span/TextQuote models; historical reports
link to exact pre-retirement source snapshots rather than nonexistent current
paths. No source receipt is rewritten. Refresh stale schema-inventory locations.

## Schema-test dispositions

Add genuine schema-derived properties for generated citation identity tokens,
exact quote/context text, source-budget codec preservation and one-byte native
source/boundary preservation. Existing golden controls remain.

Review the remaining schema-heavy observation suites individually. Their codecs
load authenticated source traces, hashes, native outcomes or runtime identity
histories; arbitrary fixture regeneration would not provide independent source
expectations or mint trusted evidence. Record this golden/regression purpose in
each inventory reason, with companion generated codec tests identified where
applicable. This is a test-policy disposition, not a parity, coverage, resource
or semantic waiver. No test, oracle row, event, failure direction or source
assertion is removed.

## Remaining and verification boundaries

The two-child native smoke passes, along with focused reply/result checks,
domain identity/quote properties and limit properties. Package type/law checks
and exact policy checks are retained with this repair's receipts. The first
post-resolution Fallow audit has zero dead-code issues but retains 72 complexity
findings and 23 duplication groups; those require refactoring and remain open.
Coverage floor gaps from older measured heads are not waived or lowered. Fresh
hosted unit, integration and coverage results are required before claiming the
corresponding jobs green. The full citation-engine goal remains incomplete.
