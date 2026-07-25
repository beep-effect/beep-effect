# Agent Execution Sandbox

## Status

Stage: `capture`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Model-generated code and cross-tool agent runs should not inherit ambient
host authority merely because their inputs were scrubbed or verified. This
exploration was routed from the
[`academia-corpus-mining`](../academia-corpus-mining/README.md) align
dispatch (2026-07-25, high-priority route) after the corpus exposed the need
for a separate default-deny execution boundary.

## Next Open Question

Master align Q10 (inherited from the dispatch): which comes first as the
action-authorization proof — privileged read plus outbound sink,
browser-to-terminal execution, citation-derived legal action, or
model-generated code? The capture's "Tensions I am leaving open" section
weighs the four candidates.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): route provenance, corpus evidence, repo composition map, boundary sketches.

## Trail

- 2026-07-25: packet opened — routed from the `academia-corpus-mining` align
  dispatch (high-priority route: default-deny execution authority, resource
  limits, network policy, immutable execution records). Capture landed with
  corpus evidence, the repo composition map, and inherited master align Q10.
