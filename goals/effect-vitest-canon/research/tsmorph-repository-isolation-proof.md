# Repository isolation in shared TSMorphService fixtures

Production repair `f26bf726266c0c04ebc4ad0ccd71c66e2aa4570f` is authorized by the standing instruction
to repair defects discovered during this goal. Preparing shared docgen fixtures
exposed a cross-repository cache collision. A probe using two temporary roots
with the same relative tsconfig/source paths returned the first source and then
an empty list for the second root. Both scopes had the same repository-relative
cache key. A request with explicit files also polluted the cached Project with
files from both roots.

Project pools (including the explicit-file pool), symbol indexes and resolved
scope records now partition by repository root. Public scope ids and cache-key
schemas remain unchanged. A cached id resolved for a single root retains its
existing external lookup behavior. When multiple roots share an id, lookup uses
the current repository; an unmatched current repository returns the existing
typed scope-resolution error rather than silently using another root.

Three new regressions fail on the original implementation with assertion
failures: ordinary and explicit-file pools retain the other root's source, and
scope lookup returns secondMarker while firstMarker is expected. The final
regressions use schema-valid tsconfig filenames and exported functions supported
by the outline API. The repaired full service suite passes 19 tests on Node and
Bun, with zero skips/failures. Coverage includes returning to the first root,
symbol-index isolation, single-root external lookup and ambiguous external
lookup rejection. The original two-root probe now returns both correct sources.

Generated package test diagnostics report exit zero with empty output. Full
@beep/repo-utils verification passes: audit 9.8 seconds and docgen 7.0 seconds.
Biome, JSDoc and diff checks pass. The root ratchet remains at 3,624 findings,
zero introduced and 1,393 resolved; no baseline update or finding waiver is used.
This is production correctness proof, not a before/after performance claim.

Private receipts: tsmorph-cross-root-probe-before/after.log,
tsmorph-isolation-before.json (three red regressions),
tsmorph-isolation-after-node/bun.json (full suite),
tsmorph-isolation-typecheck.log and tsmorph-isolation-package-verify.log.

An explicit repository selector on id-based requests could remove the ambient
cwd requirement for multi-repository clients. That is a possible API extension;
this repair preserves the public identifier format and fails closed when its
meaning cannot be determined. Goal completion and hosted readiness remain open.
