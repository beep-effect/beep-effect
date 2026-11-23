# @beep/langextract

Provider-neutral LangExtract-style structured extraction capability with
source-grounded character spans.

## Architecture Fit

`@beep/langextract` is a foundation capability only while it remains a
repo-owned structured-extraction substrate. It owns target schemas, prompt and
response contracts, model-output parsing, deterministic source alignment, typed
errors, service orchestration, and verified extraction documents over `@beep/annotation`.

It consumes an injected `effect/ai/LanguageModel`, Effect model-name services, and
`effect/crypto/Digest`. It verifies the requested capture before calling the model. Concrete
providers, provider SDKs, provider environment/config loading, live provider
smoke tests, CLI workflows, rendering, and visualization belong outside this
package.

Current consumer proof is `@beep/law-practice-use-cases`, which uses the
capability for office-action extraction and its grounded IR-to-law mapping.
The platform-capability rationale is a shared provider-neutral boundary that
future `@beep/nlp-mcp` and agent workflows can reuse without importing a
provider SDK or product semantics.

## Reuse Audit

- Reuses `@beep/text` captures, anchors, positions, verified receipts and occurrence ids.
- Reuses `@beep/annotation` kinds, content ids, generation attribution and the checked document codec.
- Reuses `@beep/jsonc/ActivityStart` for the extraction activity and `@beep/schema/UnitInterval` for confidence.
- Keeps extraction targets, parser state, alignment scores, readings and residual candidates local.

A target declares the class or relation vocabulary its label annotates. The handoff
verifies the aligner's own anchors and emits typed Mention, RelationCandidate and
CorefCandidate annotations. Readings and residuals account for every parsed candidate;
`candidateCount` makes a lost tail detectable. Confidence stays in the reading.
Wire callers use `decodeExtractionHandoff`; `encodeExtractionHandoff` writes canonical
document tables and readings. In-process callers receive `LangExtractResult.handoff`.

The named consumers are office-action review, semantica and the Lejeune provider smoke.
`test/Handoff.test.ts` covers capture identity, activity pins, verified receipts, typed
candidates, candidate preservation and the checked codec. The law-practice flow test
runs the real extraction service into review over a synthetic fixture.

## Public Surface

- `@beep/langextract/Target`
- `@beep/langextract/Extraction`
- `@beep/langextract/Alignment`
- `@beep/langextract/Handoff`
- `@beep/langextract/Service`
- `@beep/langextract/VerifiedSpan`

`./internal/*` is intentionally blocked.

## Development

```bash
bun run build
bun run check
bun run test
bun run lint
```
