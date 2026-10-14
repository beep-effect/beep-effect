# Architecture Boundaries Report

Scope: P1 read-only architecture lane for `@beep/langextract`.

Status: completed from packet files, architecture standards, export catalog, `@beep/nlp`, and driver package inspection.

## Facts

- The packet asks for `@beep/langextract` as an Effect v4 provider-neutral foundation capability for structured extraction with source-grounded spans.
- The packet explicitly excludes provider SDK adapters, provider env/config, live provider smoke tests, CLI, rendering, visualization, and V1 driver placement.
- The packet allows an injected `effect/ai/LanguageModel`, but forbids concrete provider driver imports from the foundation package.
- Repo standards outrank packet prose when they conflict.
- `foundation/capability` is the last generic destination. It requires specific-home-first proof, no product semantics, no external engine/SDK wrapper role, no tooling/UI role, and consumer or platform-capability proof.
- Drivers own external boundary wrappers, SDK/client wrappers, provider runtime configuration, retry/rate-limit behavior, and test layers around external systems.
- Foundation packages must not depend on product slices, app packages, or concrete drivers.
- `@beep/nlp` already exists as a foundation capability and already owns product-neutral span/provenance/handoff vocabulary.
- Existing provider-specific language-model construction lives in drivers and adapts provider clients into Effect AI `LanguageModel` layers.
- `@beep/nlp` already imports `effect/ai` for driver-neutral tool contracts, which supports the packet's narrow allowance for injected `LanguageModel`.

## Evidence

- Packet intent: `goals/langextract-capability/GOAL.md`, `SPEC.md`, and `ops/manifest.json`.
- Foundation and driver rules: `standards/ARCHITECTURE.md`, `standards/architecture/03-driver-boundaries.md`, and `standards/architecture/07-non-slice-families.md`.
- Testing, error, and observability rules: `standards/architecture/08-testing.md`, `09-errors-across-boundaries.md`, and `12-observability.md`.
- Existing NLP primitives and consumer policy: `packages/foundation/capability/nlp/src/Handoff/Contract.ts` and `packages/foundation/capability/nlp/README.md`.
- Existing provider adapters: `packages/drivers/openai-compat`, `packages/drivers/xai`, and `packages/drivers/venice-ai`.
- Catalog search found no existing `@beep/langextract` export.

## Inferences

- `@beep/langextract` can be a foundation capability only if V1 is a repo-owned structured-extraction substrate: target schemas, prompt/response contracts, parsing, alignment, typed errors, handoff adapters, and deterministic fake-model testing over an injected language model.
- If V1 wraps a provider SDK, loads provider config, owns live smoke tests, or exposes CLI/rendering workflows, it should not be placed in foundation/capability.
- The package should depend inward on foundation packages and sideways on existing foundation capabilities such as `@beep/nlp`, but not outward to drivers or apps.
- The package should hide unstable AI details behind its own stable service and model contracts where possible.

## Recommendations

1. Place `@beep/langextract` at `packages/foundation/capability/langextract` only for the provider-neutral substrate.
2. Allow dependencies on `effect`, `@beep/schema`, `@beep/identity`, `@beep/utils`, `@beep/nlp`, and possibly `@beep/observability`.
3. Allow `effect/ai/LanguageModel` only as an injected service requirement or constructor dependency.
4. Disallow dependencies on provider drivers, provider SDKs, apps, product slices, env/config loaders, CLI packages, and visualization/rendering packages.
5. Use a small explicit public export surface. Candidate subpaths: root, `Target`, `Extraction`, `Alignment`, `Service`, and `Handoff` if it adapts to `@beep/nlp/Handoff`.
6. Block `./internal/*` from package exports.
7. Include README sections for architecture fit, dependencies, non-goals, public subpaths, consumer or platform-capability proof, and reuse decisions.
8. Define typed boundary errors and translate model/provider/schema failures into those errors.
9. Add observability only for counts, ids/hashes, durations, status, and technical facts. Do not record raw text, prompts, completions, secrets, or PII.

## Do Not Do

- Do not copy the broader v3/reference topology into this repo.
- Do not implement provider SDK adapters, env/config loading, live provider smoke tests, CLI, rendering, or visualization in V1.
- Do not import concrete provider drivers from `@beep/langextract`.
- Do not duplicate `@beep/nlp` handoff primitives.
- Do not make root wildcard exports the canonical API.
- Do not add placeholder packages or placeholder subpaths.
- Do not log raw source text, prompts, completions, secrets, large payloads, or PII.

## Open Questions

- Does architecture review accept explicit platform-capability rationale for an initial zero-consumer package, or must the package wait for named consumers?
- Which first consumers should prove the capability gate?
- Should public service APIs expose only high-level extraction, or also lower-level pure prompt/parse/align functions?
- What exact observability attribute names should be canonical for extraction and alignment?
