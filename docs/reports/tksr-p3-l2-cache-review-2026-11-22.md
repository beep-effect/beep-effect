# P3 L2 cache input review

The annotation workspace adds modeling dependencies on identity, schema, text,
jsonc and rdf, with RDF reachable only through its adapter subpath. Langextract
adds annotation and jsonc and drops nlp. Law-practice use-cases and semantica add
annotation. Nlp and wink add text; nlp-processing uses text in tests and examples.
The Tika and Anthropic implementation changes retain their existing task edges.

The reviewed projection preserves computation commands, outputs and declared
environment. New dependency build edges are required to typecheck the new
annotation consumers. This records configuration, grants no qualification and
uses the live .bun-version profile, local-linux-x64-bun1.4.5. The existing
qualification-v3 epoch and lint scope remain.

The final reviewed projection includes the regenerated policy-tools fingerprint
used by the root lint:policy-fingerprint computation. The cache review is
recorded after that generator, so the effective configuration and its source
digests describe the same final tree.
