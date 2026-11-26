# P6 L5 and L7 cache input review

Row 16 moved Core and the graph node schemas from nlp into nlp-processing, so
nlp-processing, wink and semantica drop their nlp dependency. Nlp-processing
adds jsonc for the attributed operation activities, moves text from a
development dependency to a runtime one and exports Activity, Operation and its
instrument declarations.

Law-practice domain adds epistemics and jsonc for the law-owned claim core and
the matter scope values. Law-practice use-cases replaces epistemic-use-cases
and nlp with jsonc and exports the claim proposal, claim store, law admission,
matter wall and provenance traversal modules. Law-practice server replaces
epistemic-server, epistemic-use-cases and nlp with epistemics and exports its
claim store, matter authority and provenance traversal layers.

Ontology server and use-cases add ontology for the audit of agent-proposed
terms before a session saves them.

The reviewed projection preserves computation commands, outputs and declared
environment. The new edges are required to typecheck and test the moved and
new modules, and the removed ones name workspaces the packages no longer
import. This records configuration, grants no qualification and uses the live
.bun-version profile, local-linux-x64-bun1.4.5. The existing qualification-v3
epoch and lint scope remain.

The re-record also covers the root. The policy-tools fingerprint now seals
jsonc's ActivityRecord module, which the policy tooling reaches through jsonc,
so the shared policy-fingerprint task in turbo.json gains that input.
