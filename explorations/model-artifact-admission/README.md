# Model Artifact Admission

## Status

Stage: `research`
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

What minimum hosted identity-assurance level is required for each admitted role
and data class, and which component changes or sentinel regressions force full
requalification rather than a bounded delta suite? Align must also ratify the
`ModelArrangementDisposition` status/restriction/expiry vocabulary.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): route provenance, corpus evidence, repo composition map, boundary sketches.
3. [`RESEARCH.md`](./RESEARCH.md) - full stage-1 synthesis: hosted identity, evidence shape, change policy, and epistemic lineage.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-07-25: packet opened — routed from the `academia-corpus-mining` align
  dispatch (high-priority route: bind qualification to the exact executable
  model arrangement). Capture landed with corpus evidence (VLM adaptation
  drift, prompt-tuning backdoors, non-transferable optimized prompts), the
  repo composition map, and three capture questions.
- 2026-08-13: full research push completed — answered the hosted identity
  boundary without fabricating a weights digest, proposed qualification
  evidence and full/delta rules, and grounded disposition/lineage composition
  in the shipped epistemic core. `ATLAS.md` sync is deferred to the campaign PR.
