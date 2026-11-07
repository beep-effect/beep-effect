# Close cleaner and registered resolver method failures

The admitted cleaner's run/runOwned methods now expose only CitationEngineFailure
with R=never. A separately captured registered-resolver boundary provides the
same closed method failure surface while retaining the original private resolver
for adapter diagnostics and source-compatibility tests. Installation failures
remain separate. Resolver admission, captured policy and complete operation
timing still belong to the enclosing engine composition; this wrapper does not
claim to be the public Engine service.

Cleaner input, port and admission refusals become fresh input failures. Safety
failures retain their exact limit with the clean operation. Registered resolver
evidence refusal becomes the source-evidence prerequisite failure; known budget
refusal preserves its exact limit under resolve. Other declared callback/input
failures remain input refusal. Missing optional budget metadata never fabricates
a category, and no driver/native refusal becomes an unsupported requested mode.

Effect typed catch and Match provide the boundary. Fresh declared fields exclude
incidental source, frame, reason and cause properties. Debug events contain only
closed operation/class labels. Interruption and defects bypass typed translation.

Resolution source/mention admission now occurs before JSON restoration snapshot
encoding. This avoids the second full structural allocation on already-refused
input while retaining exact budget labels. It does not establish a complete
allocation proof for initial schema decoding or every other resolution input.

## Verification

Seven tests across port failure, admitted cleaner, installed resolver boundary
and resolution-limit controls pass in 2.36 seconds. Twenty-two separate default
callback/direct-resolver/cleaner regressions pass in 4.64 seconds, retaining the
original 76 registered contexts, focused direct-resolution cases and receipts.

Controls cover every declared cleaner/admission reason and every callback reason,
redaction, native HTML resource preservation, all five known resolution budget
categories, actual work exhaustion, mismatched source evidence, subsequent valid
receipt reuse, cleaner port refusal, malformed requests and interruption with
admission release. Compile-time assignments and emitted method declarations
confirm the closed error union and no caller requirements. The private resolver
remains available for tests that inspect adapter diagnostics.

An initial test-only callback context used the wrong outcome-group shape. The
fixture was corrected to its declared schema; actual authority-count, receipt,
safety and evidence assertions remained unchanged. Final package lint/types,
declaration emission and blocking laws pass. Scoped Fallow reports zero
introduced findings and nine inherited clone groups under unchanged policy.
No source expectation, prerequisite, baseline, threshold or public failure class
changes.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationPortFailure.test.ts \
  test/CitationCleanerOperation.test.ts test/CitationResolverBoundary.test.ts \
  test/CitationResolutionLimit.test.ts
bunx --bun vitest run test/CitationDefaultCallbacks.test.ts \
  test/CitationResolve.test.ts test/CitationCleanerOperation.test.ts
```

Complete extraction translation, admitted resolver/public request composition,
public Engine/Layer and reports, full host protocols, whole-engine safety/scaling,
lawful transforms and exhaustive source/donor reconciliation remain required.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open without waiver or accounting promotion. Hosted new-head
verification remains separate from local component proof.
