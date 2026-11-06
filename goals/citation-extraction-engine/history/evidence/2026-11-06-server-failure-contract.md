# Closed server citation failure contract

The use-case server subpath now publishes the five failure families specified
by SPEC.md: CitationInputError, CitationPrerequisiteError,
CitationSafetyLimitExceeded, CitationAnnotationError and
CitationOperationUnsupported. CitationEngineFailure is their annotated schema
union. Root and client/public exports remain unchanged.

The closed operation schema is shared with the existing safety failure instead
of repeating its four literals. Safety operations, resource names and encoded
payloads remain unchanged. All new errors are branded annotated TaggedError
classes, with operation and, where relevant, a closed prerequisite dependency.
Annotation fixes its operation to annotate. No source text, replacement text,
caller-controlled mode label, schema issue or nested cause is declared.
Unknown/ambiguous/unresolved citation meanings stay domain data. Unsupported
mode is documented only for an explicitly unsupported request; it is never a
fallback for missing canonical work.

## Narrow translator and disclosure

The private extraction-boundary translator accepts only its schema-derived
union of established entry/verified-input, canonical-source, vocabulary and
safety failures. Entry/verified boundary failures become CitationInputError.
Canonical-source and vocabulary refusals identify their prerequisite dependency.
Safety preserves the original operation and exact resource name. Every result
is reconstructed from declared fields, including safety errors; incidental
properties and nested private causes do not cross the boundary.

The translator emits a debug event containing only the closed operation and
private failure-class labels. It does not log private input, causes, native
frames or arbitrary messages. It does not catch unknown errors, classify
arbitrary native failures, or produce CitationOperationUnsupported. The full
engine still needs the remaining individually justified port/native mappings;
this helper is not installed as an unchecked catch-all or claimed as a complete
public service boundary.

## Verification

Three use-case tests across two files pass in 3.10 seconds. They exercise all
five failure codecs, exact operation values, rejection of unknown tags and
operations, domain-outcome exclusion, root/client export isolation, and the
existing complete safety resource-name test. The final private translator test
passes in 1.89 seconds, with a compile-time R=never/closed-failure assignment.

Each of its five input families is tested after adding private source text and
a nested native frame to the error object. Neither property nor the private
reason survives in the returned error. Encoded keys contain only the relevant
public tag/operation/dependency/resource fields. Safety preserves its original
clean operation even when translating an enclosing extraction refusal.

Both packages' lint/type checks and declaration builds pass. Blocking laws and
codec lint pass. Scoped health/duplication scans report no findings for the new
server and use-case modules/tests. Package README and the server barrel agree
with the restricted ownership. Hosted confirmation remains pending. Fallow
passes on preceding head 4646ca8965, Check run 42270206587, job 128072663999.
Its scanner failure still awaits independent policy PR #2786 landing on main.

```sh
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice-use-cases
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/use-cases
bun run beep:build
bunx --bun vitest run test/CitationEngineFailure.test.ts \
  test/CitationSafetyFailure.test.ts
cd ../server
bun run beep:build
bunx --bun vitest run test/CitationEngineFailure.test.ts
```

Raw request/report schemas, public cleaner/tokenizer ports, CitationEngine
service/Layer, complete native/port translation, deployment binding, final
Document integration, transforms, broad host semantics, exhaustive accounting,
whole-engine safety/scaling and retained lifecycle remain open. All eleven
representation laws, four fidelity questions and fifteen unfinished proof rows
remain open without a semantic waiver or completion claim.
