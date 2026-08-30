# Model Artifact Admission

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Graduated 2026-08-17: the [`MAP`](./MAP.md) was ratified with five
adversarial-review amendments and
[`goals/model-arrangement-admission-core`](../../goals/model-arrangement-admission-core/README.md)
was scaffolded as a paused queue goal in the graduation PR — see
[`DECISIONS.md`](./DECISIONS.md). Eval harness and enforcement stay gated in
the MAP.

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

None — graduated. Fired MAP gates (the first real non-fixture qualification,
for the eval harness; the approval-gate consumer landing, for enforcement
wiring) reopen this exploration at decompose; execution questions belong to
[`goals/model-arrangement-admission-core`](../../goals/model-arrangement-admission-core/README.md).

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
- 2026-08-13: research complete -> align — answered the hosted identity
  boundary without fabricating a weights digest, proposed qualification
  evidence and full/delta rules, and grounded disposition/lineage composition
  in the shipped epistemic core. ATLAS synced in this PR.
- 2026-08-17: align closed -> decompose — identity-assurance floor,
  conservative requalification matrix, and five-status immutable disposition
  semantics ratified; BRIEF ratified with amendments (approval-gate consumer;
  repo's own arrangement as first fixture; admission-local vocabularies).
- 2026-08-17: MAP ratified -> graduated — 8-lane adversarial review produced
  amendments A-E (restricted fixture; closed chat-arrangement component set;
  enumerated kits + assurance-floor policy table; envelope+component digest;
  referential integrity). `goals/model-arrangement-admission-core` scaffolded
  paused in the graduation PR; ATLAS synced.
