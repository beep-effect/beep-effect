# Backlog-first remediation start

Benjamin authorized implementing the existing legitimate inventory before auditing
the remainder introduced while main moved. PLAN.md and the manifest record this
execution order. P1 current-main completeness remains open.

The first change shares the immutable IdentityRegistry lookup layer through
`it.layer`, with an explicit five-second acquisition/cleanup bound. The missing
reference test still checks its original error tag and reference. Duplicate
identity, IRI and CURIE construction tests retain their test-owned builds and
encoding/key assertions. The projection test retains its separate layer subject.
The construction helper remains for those subject tests; its final disposition
belongs to the remaining identity package work.

Validation on this slice passed the full `@beep/identity` package audit and
docgen, plus Node Vitest before and after with 110 passing tests. The Effect
Vitest detector check passes with no new findings. Goal doctor has no blocking
findings; goal index succeeds. No inventory row is marked fixed without commit
evidence, and no detector baseline was raised. No timing speedup is claimed:
the archived rc.113 measurements use a different runtime, and these smoke-run
reports do not contain the required workstation-load context for a timing claim.

The next work is the remaining identity inventory in lens order, followed by
other dependency-ordered packages. Keep foundation/modeling in its own PR.

## Identity property adapter migration

Nine manual `Effect.runSync(Arbitrary.checkEffect(...))` registrations across
Curie, Fibered, Identity, PnLocal and Vocab now use the public `it.prop` adapter.
All nine callback bodies match their originals token-for-token. Their generators
are retained. The adapter replaces the outer `Passed` tag checks with structured
failure and replay reporting; every assertion inside each law remains intact.

All ten property registrations now use `fcRuns(100)`, preserving the native
100-run default while honoring the configured floor and seed. Identity declares
a development dependency on the existing leaf package `@beep/fc-runs`, avoiding
a dependency on the downstream test-utils package. The constant-registry test is
named as repeated deterministic coverage and retains its entire traversal.

Full package audit and docgen pass. The ordinary Node Vitest run passes all 110
tests. With `BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708`, the shared configuration
selects five property-bearing files and all 65 tests in that subset pass. This
subset is separate evidence from the ordinary whole-package run. The detector
reports 19 resolved findings and zero introduced findings against the unchanged
baseline. No inventory closure or fix SHA is claimed before publication.

Remaining identity work includes specialized assertion helpers, production
arbitrary richness, construction-subject dispositions and observability adoption.
The detector baseline and inventory closure will be updated with reviewed commit
evidence for the completed wave.

## Public assertion and import cleanup

Two known string-payload Option assertions now use `assertSome`; the escaped-name
None assertion uses `assertNone`. The current rc.117 public entrypoint re-exports
Vitest, including `expectTypeOf`, so direct Vitest imports in the identity tests
now use `@effect/vitest`. Full package audit and docgen pass after these edits.

The VocabRegistry presence-only assertion remains unchanged. Its codec produces
`VocabEntry` class instances, while CoreVocab is plain registry data; inventing a
payload expectation solely to use `assertSome` would change the original law.
Retain this evidence for the final EV006 disposition.

Observability adoption also needs a dependency-aware decision: test-utils already
depends directly on identity. Importing its instrumented runner back into identity
would create a package cycle. Reuse an existing upstream entrypoint if available,
or review a leaf extraction before adoption. No cycle has been introduced.

## PN name generator coverage

The SafePnLocal, SafePnPrefix and EscapedPnLocal arbitrary codecs now use bounded
grammar patterns instead of sets of five, four and four literal strings. Patterns
cover the existing PN base Unicode ranges, position-specific character rules,
percent escapes and backslash escapes. Generation is bounded to 40 grammar units;
the public predicates keep their existing unbounded acceptance behavior. The
identity transformations in both arbitrary-codec directions are unchanged.

Four added tests check sample count, variety beyond the old literal lists,
acceptance by the existing validators, supplementary Unicode, and both escaped
unit forms. They use seed 20260708 and bounded sampling because the generators
are the subject of these tests. Existing invalid-input examples and property
laws remain in place.

The full package audit and docgen pass. Ordinary Node Vitest reports 114 passing
tests; the configured 400-run seeded property subset reports 69 passing tests.
Schema-first lint and the Effect Vitest ratchet pass. The latter still reports
28 resolved findings and zero introduced findings; generator richness is a
human-lens finding rather than an additional mechanical resolution. All results
remain local pending the remainder of the wave and publication.

## Registry resource completion and runner prerequisite

IdentityRegistry's generic `provideScopedLayer` wrapper is removed. Successful
immutable lookups share the suite layer. The three conflict tests build their
subject layers in the scope supplied by `it.effect`, preserving typed conflict
failures. The projection case builds its own layer and reads IdentityRegistry
from the resulting Context before resolving the original reference. No generic
Effect.provide or explicit nested scope remains in this file.

The full identity package audit and docgen pass. The detector reports 30 resolved
findings and zero introduced findings against the unchanged baseline.

The instrumented runner has four implementation files: Vitest.ts,
Vitest.errors.ts, internal/VitestRuntime.ts and internal/VitestInstrumentation.ts.
Only Vitest.errors.ts introduces identity/schema imports into that closure. Its
SchemaUtils use supplies the optional last-log default; its identity composer
supplies schema annotations. A dependency-free test-runner package can own this
implementation with Effect-native schema defaults, preserving public error
shapes, identifiers, callable methods, watchdog behavior and context isolation.
The existing test-utils/Vitest entrypoint must re-export that same implementation
and error constructors, preserving D7's public API. The source-only controlled
clock entrypoint and its publish exclusions must remain intact.

Implement and prove this prerequisite separately from the foundation/modeling
wave, then adopt the leaf runner here. Do not add a reverse dependency from
identity to test-utils, duplicate the runner, or bypass the watchdog. Existing
runner unit and subprocess tests supply the behavioral contract and must run
through the compatibility entrypoint as well as the leaf before adoption.

## Presence-only assertion disposition

The existing EV006 row for Vocab.test.ts explicitly recommends `utils.assertTrue`
while retaining the complete `Option.isSome` expression and true polarity. That
recommendation is now applied. The decoder call and Boolean predicate are
unchanged; no expected VocabEntry payload is invented. This supersedes the
earlier pending disposition above. The compiler requires the equivalent
`decodeVocabRegistryOption(CoreVocab).pipe(O.isSome, assertTrue)` form. Full
package audit/docgen pass, and the unchanged baseline reports 31 resolved
findings with zero introduced. The detector disappearing is supporting evidence,
not proof of a stronger payload assertion. Commit evidence and inventory closure
remain pending.
