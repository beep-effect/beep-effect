# P5 L3 and L6 cache input review

The rdf workspace drops its md dependency: the Markdown section fold moved into
`@beep/md`. Ontology adds spdx as a dependency and annotation as a development
dependency for the SSSOM mapping set, and loses the legal seed files to the
law-practice asset pack. Law-practice domain ships the asset-pack payloads and
adds ontology, which its vocabulary pack loads through, and platform-bun for
the pack tests. Law-practice use-cases adds n3, rdf and ontology as development
dependencies for the Turtle parity test of the moved vocabularies.

The re-record must cover every drifted subject, so it also records three drifts
the P4 lane introduced and had not re-recorded when P5 merged it: epistemics
adds rdf and annotation for the nanopublication codec (97b2de8a43b), party-server
adds test-utils, jsonc and text with the claim-ledger rewrite (2ced3e0a632), and
the root policy fingerprint changed in the same commit.

The reviewed projection preserves computation commands, outputs and declared
environment. The new edges are required to typecheck and test the moved and
new modules. This records configuration, grants no qualification and uses the
live .bun-version profile, local-linux-x64-bun1.4.5. The existing
qualification-v3 epoch and lint scope remain.
