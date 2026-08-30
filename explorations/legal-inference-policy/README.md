# Legal Inference Policy

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `capture`
Status: `parked`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Keep observed, extracted, and inferred edges distinct; gate KG completion by predicate and topology; retain derivation DAGs so inferred edges can be unwound. Logical expansion raises recall but can reduce precision and recursively amplify prior predictions — in a legal KG that amplification is a correctness hazard, so inference needs a *policy*, not just a mechanism.

Born 2026-08-17 from the `academia-corpus-mining` wave-2 routing triage — the
operator chose to spawn all four proposed explorations so the portfolio holds
research-backed queued work for roadmap ordering and future model capability.

## Next Open Question

Resume when KG inference/completion work is pulled onto the roadmap (successor work to completed epistemic-bitemporal-edge-core) or a completion consumer appears.

## Provenance

- Parent: [`explorations/academia-corpus-mining`](../academia-corpus-mining/README.md)
- Synthesis: `synthesis/wave2-synthesis.md` in the machine-local academia-2026-07 research corpus
- Paper evidence: `68833ada82df`, `6b8bc18b69e7` (`id`-keyed into that corpus)

## Trail

- 2026-08-17: packet created from the academia-corpus-mining wave-2 routing triage (operator-ratified); parked at capture with a named resume trigger.
