# Schema property adapter preparation

Migrated 25 direct synchronous checkEffect properties in ten files to native
it.effect.prop registrations. The original 20 test registrations become 25
properties because five Protobuf cases each contained two schema properties.
Those now have distinct schema-qualified names; no generator or assertion was
removed. Existing fcRuns(25), fcRuns(50), and fcRuns(100) floors are unchanged.

SafeObject codec Effects inside both generated round-trips are now yielded in the
property callback, removing nested runSync boundaries while preserving guards and
normalization equality. The static callback setup in ArrayBuffer and codecStatics
remains in local registration blocks.

All three TypedArrays generated round-trips now compare the complete decoded
sequence against the original generated value, in addition to retaining the
constructor identity assertions and source-schema generators.

Package audit/docgen passed after these edits. Full Node test run: 722 tests in
78 files passed. The five-test increase is the split Protobuf property names.
This is local preparation; three generation-link checkEffect sites still need
migration and no canonical findings have been credited fixed yet.

Full Bun verification also passed: 722 tests in 78 files.

## Generation-link and diagnostic follow-up

Migrated the remaining three direct checkEffect sites: FileSignature and
DetectedFileInfo retain their generation-transformation checks and fcRuns(50);
the Double/Float loop now registers a generated round-trip property for each
schema with fcRuns(100). Both original fixed-value cases still check zero, signed
finite values, NaN and infinities through the AST-derived generation codec.
There are no direct Arbitrary.checkEffect calls left in the schema test files.

Corrected the generated JSON Schema document oracle to permit the literal
noncanonical wire key `extensions`, which an existing codec round-trip already
accepted. A focused regression checks that the same wire value both round-trips
and passes the oracle. All other document validity predicates remain.

Full Node and Bun suites after those edits: 725 tests in 78 files passed.
Package audit/docgen passed.

The later URL smoke-test change preserves seed 0x5eed and count 20, yields the
sample Effect directly, and gives each guard assertion schema/index/value context.
SafeObject's throwing getter/proxy case now yields Effect.exit and retains both
the synchronous construction not-to-throw assertion and typed-failure check.
After these last two files changed, their 13 focused tests passed in both runtimes
and full package audit/docgen passed again. The earlier 725-test runtime runs
predate only these last two changes.

## Declaration traversal and aggregate diagnostics

The declaration traversal case now includes S.Option with an annotated String
type parameter. It checks the Declaration AST tag and exact root-first output
containing both declaration and parameter annotations. The original zero-parameter
S.declare, union and record checks remain. This closes the oracle gap where
removing Declaration.typeParameters traversal could previously leave the test green.

Conformance preserves all invalid descriptor, runtime-validator and revision
inputs, but checks each with identifying context instead of A.every aggregates.

Full schema audit/docgen passed; all 25 affected tests in two files passed under
Node and Bun. Canonical ledger credit awaits the wave commit and reconciliation.
