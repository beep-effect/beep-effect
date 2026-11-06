# Public captured cleaner port with one contract owner

The existing lazy cleaner execution contract now belongs to
@beep/law-practice-use-cases/server (package 0.0.0, Effect 4.1.2) as the
CitationCleaner Context.Service. The private CitationCleanerRuntime definition
is removed, and every source/test consumer migrates directly. No compatibility
alias, second cleaner implementation, value issuer, registry, cursor owner,
reservation ledger or native worker is introduced.

The use-case server subpath also owns CitationCleanerObject, its from-self
CitationLiveCleanerObject codec/type, CitationCleanerTextCharge,
CitationCleanerProduced, CitationCleanerWorkSnapshot, CitationCleanerRun,
CitationCleanerCursor, CitationCleanerWork and CitationCleanerFailure. The server
continues to own actual issuance, weak-map identity validation, callback dispatch,
work retirement and native adapters. Structural handles do not grant ownership;
structural charge copies do not grant spending authority. Nothing is exported
through package root or /public.

## Preserved capabilities and errors

The port preserves fromText, assertOwned, textUnits, lazy open, separate contains
and get, callable and invoke. Cursor advancement and nested/reservation/capacity
work remain runtime capabilities with R=never. Non-string host values, callable
and retained iterator state stay in captured adapters, not request data. Default
Document services provide this public tag directly, and the existing pipeline
captures it directly. Trusted custom ports can use the same contract without
reimplementing the pipeline's budget or retirement logic.

CitationCleanerFailure retains the existing closed reason codes and source-free
payload. It is a declared port failure, as permitted by SPEC's Server Failures and
Boundary Translation section. It is not a sixth member of CitationEngineFailure;
the five engine-boundary cases are unchanged. Final engine translation of cleaner
port failures remains required, not claimed complete by publishing this port.

## Hosted Fallow repair

The preceding report head d2dbf8c748 fails Check run 42283303588 job 128117750941.
Raw artifact 13536027789 identifies duplicate single/pair timing blocks and shared
malformed-install/raw-row invocation test controls. One source preparation factory
now selects the captured single/pair adapter method at installation; request data
cannot select a method or supply callbacks. It retains the same timed computation.
Shared test helpers preserve all four malformed policy/runtime/configuration/
pattern attempts, stage-specific oversized-budget assertions and original row
execution/expected model assertions. The raw-row helper's generic signature still
requires a captured R=never extract method. Obsolete exports are removed.

The final local Fallow audit passes: zero introduced dead code, duplication,
complexity, styling or diff-risk findings. Nine inherited clone groups remain
nonblocking under the unchanged new-only policy. No suppression, threshold or
baseline changes. Hosted confirmation for the new head remains pending.

## Verification

- Forty-one server tests across five files pass in 58.63 seconds: pipeline,
  values, live registry, production Document services and verified raw extraction
  on Bun/Node. This covers retained callback replacement/state, separate lookup
  observations, host values, ownership, reservation handles and Scope closure.
- Seven post-refactor integration tests across four files pass in 72.63 seconds:
  source-report Clock, raw entry, semantic extraction and paired source execution.
- Three selected malformed-installation controls pass in 4.66 seconds; thirteen
  other tests in those files are intentionally not selected by that focused run.
- The public contract test passes in 2.05 seconds: a complete service definition
  enforces closed methods, fromText has R=never, port failure is outside the engine
  error union, and runtime exports remain absent from root/client surfaces.
- Both packages' lint/type checks, server declaration build and blocking laws
  pass. Actual package docgen typechecks all 579 examples.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationCleanerPipeline.test.ts \
  test/CitationCleanerValues.test.ts test/CitationCleanerRegistry.test.ts \
  test/CitationDocumentServices.test.ts test/CitationVerifiedExtraction.test.ts
bunx --bun vitest run test/CitationPinExtraction.test.ts \
  test/CitationPreCaseMetadata.test.ts test/CitationPostCaseMetadata.test.ts \
  -t 'rejects malformed installation'
bunx --bun vitest run test/CitationExtractionReport.test.ts \
  test/CitationExtractionEntry.test.ts test/CitationSemanticExtraction.test.ts \
  test/CitationPairedSource.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationCleanerPort.test.ts
bun run beep:docgen
```

Public tokenizer contract, full request/service/Layer and selected-port deployment
binding, complete port/native failure translation and failure reports, mutable/
custom-tokenizer Document behavior, transforms, final document integration,
exhaustive canonical/donor accounting and whole-engine safety/scaling remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without a semantic waiver.
