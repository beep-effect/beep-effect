# Repo-utils assertion checkpoint — 2026-09-26

The assertion phase applies 131 helper substitutions across nine admitted files:
42 independently expected whole Some comparisons, twelve None comparisons,
25 branch-only Some predicates, fifty Exit failure predicates and two declared
error-equivalence predicates. All narrowing guards, partial field checks, exact
rendered diagnostics, error identity checks and public synchronous throw subjects
remain intact. All fourteen complete property bodies remain byte-identical.

Ten whole Some comparisons retain their original Vitest toEqual semantics.
A failed intermediate proof established that assertSome uses stricter prototype
comparison for Schema.Class values against independent plain-object expectations.
The retained cases include nested funding/reference classes, not just the first
five failing test cases. The evidence is recorded in
`research/repo-utils-assertion-boundaries.json`. No expected values were generated
from the schema or implementation. Fifty Exit predicates retain explicit
exception boundaries where no independent complete Cause is specified.

Final `bun run beep quality package-verify @beep/repo-utils` exited 0:
audit 8.8 seconds, docgen 5.9 seconds. Inverse substitution comparison restores
all non-import source tokens across 32 configured inputs, and current hashes
match the final preservation receipt. The additional Sha256Hex suite remains
unchanged and outside admitted lens-remediation credit. The first proof caught
introduced helper type/style issues; the second caught prototype semantics.
Both are retained as failed evidence, superseded by this successful final proof.

Property registration, witness strengthening, flake controls and observability
remain separate subsequent phases. No production code changed.
