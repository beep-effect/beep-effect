# Epistemic Belief View Revision

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The bitemporal edge core retains competing assertions without ever preferring
one — coexistence without preference is its invariant. An attorney still needs
an answer to "what do we currently believe about this matter, and why." A belief
view is the recoverable, replayable projection that selects one working
assertion per logical lineage (or abstains) under a named policy, for a named
principal, at a named `(validAt, knownAt)` — revised by new versions with causal
ancestry, never by mutating evidence or authority.

This exploration was routed from the
[`academia-corpus-mining`](../academia-corpus-mining/README.md) align dispatch
(2026-07-25, master Q4: "first composition over the bitemporal core" —
[`DECISIONS.md`](../academia-corpus-mining/DECISIONS.md); recorded route
`new-exploration <epistemic-belief-view-revision>` in
[`research/t3-master-synthesis.md`](../academia-corpus-mining/research/t3-master-synthesis.md)).
Its trigger condition — "stays recorded until the bitemporal core itself
lands" — fired when
[`goals/epistemic-bitemporal-edge-core`](../../goals/epistemic-bitemporal-edge-core/README.md)
closed `completed-retained` on 2026-07-25.

## Next Open Question

Which proposed verdict-family names and owners should the epistemic goal family
ratify, and which exact fields define the projection-owned
`BeliefContentionKey` used to compare distinct evidence-scoped authority
lineages? After those are settled, align must choose the minimal policy and
abstention vocabulary and whether first delivery materializes revisions or
computes them on demand.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0): seed decision, what the substrate now guarantees, fat-marker shape, inherited questions, tensions.
3. [`RESEARCH.md`](./RESEARCH.md) - stage-1 synthesis: live contracts, proposed verdict names, view/revision semantics, and align frontier.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

## Trail

- 2026-07-25: packet opened — routed from the `academia-corpus-mining` align
  dispatch (master Q4: preferred belief views compose first over the bitemporal
  core). Capture landed with the verbatim seed decision, the substrate
  guarantees the view layer may lean on, the fat-marker projection shape, and
  inherited master align Q1/Q3.
- 2026-08-13: research stage completed — grounded the shipped authority and
  active triage contracts, proposed (without locking) the shared verdict-family
  names, identified the evidence-scope/contention-key gap, and specified
  deterministic view revision and retention semantics. `ATLAS.md` sync is
  deferred to the campaign PR.
