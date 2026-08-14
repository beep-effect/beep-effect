# Effect Ontology Domain v4 Experiment

This directory is a quarantined, production-quality Effect v4 reinterpretation
of the MIT-licensed `Domain` module from `effect-ontology`.

The experiment preserves the upstream module tree for comparison, but it does
not preserve the upstream architecture or public API by default. Live
`@beep/*` packages remain authoritative. Each upstream symbol and behavioral
contract receives an explicit semantic disposition in
[`PORTING_LEDGER.md`](./PORTING_LEDGER.md).

## Boundaries

- `scratchpad/index.ts` must not export this experiment.
- Product packages must not import this experiment.
- Standard RDF, IRI, SHACL, identity, provenance, and artifact concepts reuse
  their canonical `@beep/*` owners.
- Upstream wire shapes are accepted only by explicit, total ingress adapters.
- A successful experiment does not authorize production promotion.

## Source

The reproducible source baseline, hashes, dirty patch, and license notice live
beside this file:

- [`SOURCE_BASELINE.md`](./SOURCE_BASELINE.md)
- [`UPSTREAM-DOMAIN.patch`](./UPSTREAM-DOMAIN.patch)
- [`LICENSE.effect-ontology`](./LICENSE.effect-ontology)

If the frozen source hashes drift, implementation stops until the baseline is
explicitly refreshed.

## Focused proof

Run these from the repository root:

```sh
bun run --cwd scratchpad check:effect-ontology
bun run --cwd scratchpad audit:effect-ontology-arbitraries
bun run --cwd scratchpad audit:effect-ontology-docs
bun run --cwd scratchpad test:effect-ontology
bun run --cwd scratchpad lint:effect-ontology
bun run --cwd scratchpad docgen
```

The arbitrary audit loads all 54 retained source modules, derives every uppercase
exported schema with reporting enabled, requires identifier/title/description
and `toArbitrary` annotations, requires zero derivation warnings, and checks
eight generated decoded values per export with `Schema.is`.

The documentation audit requires `@example`, `@category`, and `@since` on
exported declarations; examples plus parameter/return descriptions on all
schema-backed class behavior, including private implementation classes exposed
through public schema values; and a user-facing `message` on every locally
constructed check.

Canonical schemas own their constructive `toArbitrary` metadata so consumers
can import them directly without declaration wrappers. An
encoded-to-declaration codec remains appropriate only for an explicit ingress
adapter whose wire representation differs from the canonical decoded model.

The focused lane is authoritative for this experiment. Broad repository gates
remain regression checks and must not be reported as a substitute.
