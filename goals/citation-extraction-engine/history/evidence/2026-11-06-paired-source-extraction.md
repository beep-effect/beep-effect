# Independently verified plain and markup sources

`CitationEngineSourcePairInput` owns raw primitive plain/markup argument slots
and reuses the existing identity/text and named-option fields. Slot names own
the roles. Null means no source; a supplied empty string retains its identity.
The schema is server-only and grants no verified capability. Retained Document
input is not replaced, rejected as unsupported, or claimed complete.

The existing source adapter now prepares single or paired inputs. Pair preparation
checks plain first and preserves the original eyecite shortcut without reading
markup/options. Otherwise both source metadata/text slots and named options are
snapshotted before either resolver call. Effective size checks precede resolution;
resolved size checks precede digest verification. The canonical SourceTextResolver
and provenance verifier independently verify every supplied source. No additional
resolver, hash implementation or source-proof issuer is introduced.

The existing admitted source-extraction constructor also has a pair constructor.
Both compose through the same metadata operation, parent permit, outer timing and
cumulative budget. Every returned extract has R=never. Verified extraction accepts
an optional genuine companion capability after the shortcut check and records
both argument identities in its private result.

## Source behavior and lineage

The sealed 112-case source Document input-mode corpus independently establishes:
both nonempty sources retain supplied plain text for tokenization, select markup
as Document.source, omit geometry construction, and reject truthy cleaner steps.
The paired verified path invokes that unchanged production Document path. It
selects the same parent, derives tokenizer-text evidence from markup when needed,
and verifies anchors against that exact output text. It does not claim plain-text
coordinates are coordinates in the original markup. The changed-text derivation
commitment includes companion identity when present. Existing single-source
commitments omit the new optional field and retain their encoding.

Supplied empty markup selects the original Plain branch instead; no text-based
HTML-role guessing is introduced. Empty supplied identities remain represented,
while the original empty-input refusal is still delegated to Document execution.

## Verification

Initial direct paired-proof and existing canonical/single-source regression pass
five tests across three files in 56.91 seconds. Connected raw-pair regression and
boundary controls pass thirteen tests across four files in 67.18 seconds on Bun
and Node. The pair tests compare complete original model state and semantic
citations to the unchanged primitive route, check both identities and markup
parent lineage, verify raw plain-text slices and reject a forged companion before
native work. Truthy cleaner refusal and ignored shortcut companion getters match.
Both actual resolver calls assert one active parent permit with no queued work.

Boundary tests mutate markup metadata/text and cleaner arrays during the first
resolver call; the original second source and options remain intact. Both slots
are preflighted before resolution. Paired shortcut markup/option getters stay
unread. An empty supplied source resolves and retains its identity. A separate
canonical-source test proves distinct companion identities change the derivation
identity while preserving the same output text digest.

Three use-case contract tests pass in 1.64 seconds, including paired raw Unicode,
empty/null distinctions and root/client export isolation. Both packages' lint/type
checks and server declarations pass. Documentation generation passes all 569
examples. Blocking laws and scoped codec lint pass. Scoped SourceRequest Fallow
reports no findings. No thresholds or baselines change.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationSourceRequest.test.ts \
  test/CitationPairedSource.test.ts test/CitationCanonicalSource.test.ts \
  test/CitationVerifiedExtraction.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationEngineInput.test.ts
bun run beep:docgen
```

This is connected primitive-pair composition proof, not exhaustive paired-model
qualification. Retained Document dispatch, full public request/report/ports/service/
Layer, remaining translators, transforms, final document integration, exhaustive
canonical/donor accounting and whole-engine safety/scaling remain required. All
eleven representation laws, four fidelity questions and fifteen unfinished proof
rows remain open without a waiver. The CLI GitHub credential hit
API rate limiting. The connected GitHub tool confirms PR #2737 remains open and
ready at the preceding head; new published-head/hosted confirmation remains due.
