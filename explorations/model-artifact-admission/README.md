# Model Artifact Admission

## Status

Stage: `capture`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

A model or prompt should not inherit qualification after its artifact,
adapter, modality, wrapper, or decoding environment changes. This
exploration was routed from the
[`academia-corpus-mining`](../academia-corpus-mining/README.md) align
dispatch (2026-07-25, high-priority agent-security route): bind
qualification to the exact model, adapter, modality, prompt, wrapper,
decoding configuration, and artifact digest.

## Next Open Question

How do we identify hosted mutable models precisely enough for scoped
admission without inventing an unavailable artifact digest? (A provider
model name is not an artifact digest — see the capture's "Boundary sketches
and tensions".)

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): route provenance, corpus evidence, repo composition map, boundary sketches.

## Trail

- 2026-07-25: packet opened — routed from the `academia-corpus-mining` align
  dispatch (high-priority route: bind qualification to the exact executable
  model arrangement). Capture landed with corpus evidence (VLM adaptation
  drift, prompt-tuning backdoors, non-transferable optimized prompts), the
  repo composition map, and three capture questions.
