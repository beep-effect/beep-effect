# Inline schema annotation recognition

PR #1188 extracts the instrumented runner without a dependency on identity or
schema. Its error classes preserve the historical annotation values directly in
the supported `Schema.TaggedError` constructor argument. The documentation
inventory reported these two classes as missing annotations because its existing
recognizer only accepted annotation helper calls.

This separate tooling change recognizes object-literal metadata in the documented
annotation argument of `S.Class` and `S.TaggedError` class heritage expressions.
It does not treat the fields argument or an empty annotations object as metadata.
The regression fixture covers both accepted constructors and both negative cases.
Existing helper-call recognition is retained. No documentation baseline is raised.

The local Effect reference confirms that class `.annotate(...)` rebuilds a schema;
replacing the class constructor with that result would change the runner API.
The detector correction therefore preserves the actual runtime declarations.

The focused quality artifact generator suite passes. Full package and repository
proof, publication, and hosted closeout remain required before merge readiness.

The first full repo-cli proof passed audit (760.2 seconds) and docgen
(25.3 seconds). After integrating main at 6c412ed5a3, the regression uses
the instrumented it.layer runner with scoped fixture release and the typed
inventory builder. All six focused tests pass, and the Effect Vitest ratchet
reports zero introduced and zero resolved findings. A final lint/check proof
and the full publication proof validate the revised test and equivalent
Effect Array.some form.

Final package lint (3.4 seconds) and check (6.3 seconds) passed. The focused
suite covers the revised fixture lifecycle; full publication proof remains
required before merge readiness.
