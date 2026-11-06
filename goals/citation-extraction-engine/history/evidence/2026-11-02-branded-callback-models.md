# Branded callback data and oracle artifact models

Hosted schema-first policy identified exported bare object schemas in callback
session data and oracle artifact alternatives. The callback pair, group,
assignment, decision, final entry, prior-full input, and Id. input are now
annotated, unique-branded `S.Opaque` models. Their actual producers use the
corresponding constructors instead of returning unbranded object literals.
Final insertion entries and callback-visible groups retain separate brands.

The two contextual callback output schemas had identical fields. They now share
one branded `CitationCallbackResult` model in the existing resource module. The
prior-full and Id. input contracts stay separate. Default observation issuance
constructs the result before registering that exact object in its weak issuer
map, preserving its capability identity. Both dispatch paths use the same JSON
codec; no duplicate wire representation or request-selected callback was added.

Oracle artifact alternatives now use private branded tokenizer/model payload
models under the existing tagged union. The exact-byte JSON transform and its
coherence law remain intact; original payload strings and fixture values did
not change.

Integration fixes discovered by the server source/test type check also provide
the Digest service to two HTML test runtimes, name the digest test helper's
Effect function, and use `Effect.mapBoth` for one cleaner-stage test adapter.
No native HTML worker qualification run was started locally.

The schema-first inventory writer removed stale entries for retired
Parenthetical/PinciteInfo models and recorded 28 schema-derived property-test
advisories as advisories, not exceptions. Its scan reported the two stale
entries against the prior inventory and exited nonzero; the written inventory
removes them. A subsequent full schema-first verdict is left to hosted CI.
No new schema policy exception or parity-backlog admission was added. The schema
catalog and identity profile were refreshed with their canonical writers.

Validation:

- Server source-and-test type check: passed, zero diagnostics.
- Goal operations type check: passed.
- Four focused callback/mutation suites: 21 tests passed in 12.98 seconds.
- Oracle assertion suite: seven tests passed in 4.64 seconds.
- All 12 portable evidence audit components passed; target parity stays pending.
- Final divergence ledger audit passed after the shared-codec consolidation.
- Focused Oxlint passed with seven existing namespace-import warnings; Biome
  passed for the changed source/configuration files.

Hosted reviewer findings also led to removal of the unused private test path
alias and restoration of PR #2511 to draft, matching the approved publication
contract. Full hosted quality and exhaustive target parity remain open.
