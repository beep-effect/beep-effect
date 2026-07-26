# Capture — epistemic-belief-view-revision

2026-07-25 — packet opened from the recorded route
`new-exploration <epistemic-belief-view-revision>`
(`explorations/academia-corpus-mining/research/t3-master-synthesis.md`, route
table; sources: memory-bitemporal + legal-norms-reasoning clusters).

## The seed decision (verbatim anchor)

Academia align 2026-07-25 (master Q4): "What composes over the bitemporal edge
core first: preferred belief views, legal multitemporality, exact-version
telemetry, or interpretation/closure records?" → **Preferred belief views.**
Rationale: most product-shaped payoff (what does the attorney currently
believe, and why, with inconsistent evidence retained rather than destroyed) —
and the other three candidates all want a preferred-view mechanism underneath
them anyway. (`explorations/academia-corpus-mining/DECISIONS.md`, 2026-07-25
"first composition over the bitemporal core".)

The trigger condition ("stays recorded until the bitemporal core itself
lands") fired: PR #452 merged 2026-07-25 as `d117ecf26d`;
`goals/epistemic-bitemporal-edge-core` is completed-retained.

## What the substrate now guarantees (what views can lean on)

- Immutable bitemporal EdgeVersion lineage, half-open two-axis intervals,
  canonical `asOf(validAt, knownAt)` reads.
- Durable ClaimDisposition; atomic close-and-insert supersession with typed
  conflicts; supersedes_id lineage.
- Competing evidence-scoped assertions coexist; supersession closes only the
  affected logical lineage (dispatch-note requirement 1).
- The core persists NO preferred view — coexistence without preference is the
  invariant a view layer must not break.

## The shape (fat-marker, to be interrogated later)

A belief view = a **recoverable, replayable projection** that selects one
working assertion per logical lineage (or abstains), under a named selection
policy, for a named principal/scope, at a named (validAt, knownAt) pair.
Revising a view = new view version with causal ancestry — never a mutation of
evidence or authority. "Recoverable" means: drop every view table, replay from
authority, get byte-identical views back.

## Open questions carried in (from the 2026-07-25 dispatch note)

- Master align Q1 — canonical names/owners for the typed verdict families
  (shape validity, anchor fidelity, semantic stance, source authority/
  currentness, human disposition, action authorization, release). A view's
  selection policy consumes several of these; naming them is upstream of any
  view schema.
- Master align Q3 — retention classes (retention-bearing authority vs
  expirable operational events vs prunable projections vs prohibited
  secret-bearing inputs). Views are the canonical "prunable projection";
  answering Q3 for views is cheaper than answering it in general.

## Tensions to keep visible

- A preferred view must never leak back into authority ("approval is a
  recorded scoped human disposition, not truth manufacture" — align decision 2).
- Contradiction triage (goals/epistemic-contradiction-triage) resolves
  lineages; belief views *rank* or *select among* open ones. Different
  operations, and triage must not grow a view mechanism ad hoc.
- Legal multitemporality (enforceability/efficacy/applicability) is explicitly
  NOT collapsed into the two core axes; a view policy may need to consume
  those distinctions later without the core growing columns
  (dispatch note, tensions §3).

## Raw product framing (why an attorney cares)

"What do we currently believe about this matter, why, and what would change
it?" — a view answers the first two from retained inconsistent evidence; the
revision history answers the third. Contrast Cognee/file-memory: those are
operator memory; this is case-knowledge state with audit-grade lineage.
