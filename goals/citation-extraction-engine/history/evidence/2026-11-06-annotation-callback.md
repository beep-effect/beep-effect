# Captured native annotation callbacks and deferred join failures

The existing assembly now captures an optional native-string annotator service
at installation. It receives original before/after words and the span after
sorting, overlap trimming and skip/wrap preparation. Its returned string replaces
the complete annotated span, so default before/after concatenation does not run.
Skipped/fully covered annotations invoke no callback. With no callback installed,
the existing unchecked/default assembly remains unchanged.

This is explicitly the native-string callback profile, not a claim about
arbitrary before/after host values, their ordering/coercion, nested callbacks or
complete public annotation dispatch. No callable is encoded in request data.
There is no new value arena, ticket issuer, registry or execution framework.
Existing captured budget, Unicode preparation, native range assembly and span
strategies supply the work. Returned methods require R=never and belong to the
enclosing admitted operation Scope/deadline.

## Callback results and failure order

An actual callback failure stops immediately. A non-string return is retained
as a closed NonText result until final join: subsequent eligible callbacks still
run, and a later callback failure takes precedence over the deferred join
failure. No host return object is coerced or serialized. This classification
preserves the native profile's output/failure ordering; it does not discharge
final source exception-class/message representation laws.

Returned native text is independently admitted, validated and copied before
retention. A subsequent callback may change its own previously returned buffer
without changing already accepted output. Callback adapters must reserve before
producing new text through their captured parent authority; receiving snapshots
and final output have their own exact charges. Later caller Context cannot
replace the installed callback or captured budget.

The shared annotation Unicode failure translator now reports operationDeadline
when it is the actual shorter timer, including the existing template adapter.
Producer budget refusals are translated to the enclosing annotate operation.
The implementation introduces no alternate clock or timer framework.

## Original observations

The producer invokes unchanged annotate_citations with actual synthetic callable
definitions across unchecked, skip and wrap modes. All 144 source cases record
348 callback invocations, 51 failures, 268 parser checks and 64 wrap calls.
Programs cover whole-span replacement, empty/reused/subclass strings, native
point reversal, non-string first results, immediate exceptions and a later
exception overriding an earlier non-string result. Original subclass coercion
hooks are never called. Native Unicode, overlaps and malformed markup retain
complete original callback arguments and final outcomes.

- Original eyecite pin: `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`.
- CPython: 3.11.15.
- Producer SHA-256:
  `154a982c40642bab1d11c2fb5b331fc2268b1bb32d79cbb015efa4fda0adc03f`.
- Committed fixture SHA-256:
  `b212c0289337730e0c0196b596c846a01c1cfba8ca0565d6f9226e2bcaeade09`.

Fresh original replay has identical decoded content. Fixture formatting is
separate; byte-identical regeneration is not claimed. Existing eyecite
BSD-2-Clause and native Unicode/CPython notices apply.

## Target verification

Eleven tests across four files pass in 62.44 seconds. All 48 unchecked cases
compare original output/failure and callback arguments. Actual Bun and Node
markup replay each covers 36 selected cases, 79 callback invocations and 124
acknowledged XML/regex child exits, with released operation/native admission.
Existing assembly and complete template component regression remain passing.

A separate control mutates the first returned buffer during the second call:
accepted output remains AC. It also replaces the caller's callback service and
proves the original callback is retained. Four units of intermediate snapshots
are retained after refusal of the two-unit final output under ceiling five;
ceiling six succeeds with exact charge six. Both callbacks execute before the
final output refusal. A controlled receiving-reservation stall proves the
shorter 5ms enclosing deadline is labeled operationDeadline rather than the
50ms annotation limit. A producer refusal retains its limit while identifying
the enclosing annotate operation.

Server lint/types, declaration emission, blocking laws and scoped Fallow pass.
There are zero introduced findings and nine inherited clone groups; no baseline,
threshold or source expectation is weakened. The complete 144-case replay on
each runtime is registered for hosted integration, totaling 664 native children.
That hosted result remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationAnnotationCallback.test.ts \
  test/CitationAnnotationCallbackBoundary.test.ts \
  test/CitationAnnotationAssembly.test.ts test/CitationAnnotationTemplate.test.ts
bunx --bun vitest run test/integration/CitationAnnotationCallback.test.ts
```

General host values/aliases and arbitrary callback protocols, nested work,
complete public request/service/Layer, boundary translation and whole-engine
safety/scaling remain required. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows remain open without semantic waiver
or source/donor accounting promotion.
