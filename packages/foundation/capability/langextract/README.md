# @beep/langextract

Provider-neutral LangExtract-style structured extraction capability with
source-grounded character spans.

## Architecture Fit

`@beep/langextract` is a foundation capability only while it remains a
repo-owned structured-extraction substrate. It owns target schemas, prompt and
response contracts, model-output parsing, deterministic source alignment, typed
errors, service orchestration, and adapters into `@beep/nlp/Handoff`.

It consumes an injected `effect/unstable/ai/LanguageModel` service. Concrete
providers, provider SDKs, provider environment/config loading, live provider
smoke tests, CLI workflows, rendering, and visualization belong outside this
package.

Current consumer proof is `@beep/law-practice-use-cases`, which uses the
capability for office-action extraction and its grounded IR-to-law mapping.
The platform-capability rationale is a shared provider-neutral boundary that
future `@beep/nlp-mcp` and agent workflows can reuse without importing a
provider SDK or product semantics.

## Reuse Audit

- Reuses `@beep/nlp/Core.DocumentId`.
- Reuses and depends on `@beep/nlp/Handoff` for spans, provenance, mentions,
  entities, relations, and annotated documents.
- Promotes stricter span and confidence validation in `@beep/nlp/Handoff`
  instead of duplicating those primitives here.
- Keeps extraction targets, parser state, alignment scores, and orchestration
  local because they are LangExtract-specific.

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
