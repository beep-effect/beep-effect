# Evidence Source Policy Calibration

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Declare source trust, source-assertion confidence, extractor confidence, validator score, and reviewer disposition as separate typed fields. The signals arise at different pipeline stages and are not mutually calibrated — collapsing them into one score destroys the information a downstream consumer needs to weigh evidence.

Born 2026-08-17 from the `academia-corpus-mining` wave-2 routing triage — the
operator chose to spawn all four proposed explorations so the portfolio holds
research-backed queued work for roadmap ordering and future model capability.

## Next Open Question

Resume when an epistemic consumer needs calibrated multi-signal confidence (source trust vs extractor vs validator vs reviewer) rather than a single collapsed score.

## Provenance

- Parent: [`explorations/academia-corpus-mining`](../academia-corpus-mining/README.md)
- Synthesis: `synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus
- Paper evidence: `0a8de1437753`, `b7ab12db479a` (`id`-keyed into that corpus)

## Trail

- 2026-08-17: packet created from the academia-corpus-mining wave-2 routing triage (operator-ratified); parked at capture with a named resume trigger.
