# Public annotation data and reported operation

Server use cases now own CitationAnnotationMode, CitationAnnotationReplacement,
CitationEngineAnnotationInput and CitationEngineAnnotationResult. The original
private mode/replacement exports are removed without aliases; annotation
preparation, assembly, skip/wrap stages and all discovered consumers import the
same definitions. Root/client surfaces still exclude these server contracts.

Replacement positions explicitly retain original Python code-point slice
semantics, including negative/out-of-range positions. They are not verified
UTF-16 anchors. Before/after words and rendered output retain exact native
Unicode storage. Raw source slots and named modes are data; callbacks/updaters
remain captured server capabilities. The admitted boundary keeps original lazy
slot validation rather than eagerly inspecting ignored source arguments.

The reported annotation constructor delegates to the existing admitted raw-source
operation. It captures policy and the trusted installation artifact reference;
request overrides and later Context replacements cannot substitute authority.
Selected/companion source proofs remain genuine original verifier output. Native
rendered text is not relabeled as a newly verified source manifestation.

Source annotation measures complete admitted source/mapping/callback work with
Effect.timed. The reported result uses that duration and final parent text
reservation; queue waiting is outside measured work but still consumes the
operation deadline. Private evidence fields derive from the public schema with
an explicit S.Codec type boundary so declaration emission does not expose the
provenance implementation's private capability property.

Annotation and resolution now share the existing snapshot module's operation
policy/artifact capture helper. Effect Schema validates the reference and codec
copies the policy; the enclosing engine installer still owns implementation
attestation. No new admission, timer, worker or serialization framework is added.

## Verification

Twelve final source-annotation/timing/resolver tests pass in 4.22 seconds. Four
use-case contract tests pass in 4.98 seconds. Eleven separate assembly/entry/
callback regressions pass in 8.04 seconds, including all 214 original unchecked
annotation outcomes under repeated fresh work ownership.

Actual Bun and Node paths retain exact mapped HTML output, selected/companion
proofs and independently confirmed native exits. Controls cover captured policy
mutation, ignored request artifact/policy, closed method failures, callback
recovery and unchanged source snapshots during asynchronous resolver mutation.
A controlled Clock test holds admission for 10 ms, then performs 5 ms of source
resolution and 7 ms of callback work. The successful public report records 12 ms
of work, excludes queue time and leaves no active/queued admission. Existing
shared-deadline refusal and cancellation controls continue to pass.

Contract controls retain named mode defaults and negative/out-of-range tuple
positions, reject callable replacements, and enforce root/client separation.
The initial test callback used the wrong argument/result shape and a result
schema import was missing; both fixtures were corrected without weakening
expectations. Fallow initially found duplicated policy capture and an unused
mode type; shared Schema capture and the typed mode default resolve both.

Both packages pass lint/type checks and blocking laws; server declarations emit.
Scoped Fallow passes with zero introduced findings and nine inherited clone
groups. Baselines, source expectations, limits and thresholds are unchanged.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationSourceAnnotation.test.ts \
  test/CitationSourceAnnotationTiming.test.ts test/CitationResolverBoundary.test.ts
bunx --bun vitest run test/CitationAnnotationAssembly.test.ts \
  test/CitationAnnotationEntry.test.ts test/CitationAnnotationCallbackBoundary.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationEngineInput.test.ts
```

The complete four-operation public service/Layer, remaining clean/resolve public
composition, general host/model protocols, builtin difflib, lawful transforms,
whole-engine safety/scaling, deployment attestation and exhaustive source/donor
reconciliation remain required. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows remain open without semantic waiver.
Hosted exact-head qualification is separate from this local component evidence.
