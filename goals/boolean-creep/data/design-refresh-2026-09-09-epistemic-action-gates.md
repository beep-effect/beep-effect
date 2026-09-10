# Epistemic candidate and proposal action-gate design refresh — 2026-09-09

## Scope and source

This audit covers the coupled stable records
`epistemic-candidate-comparison-action-gates` and
`epistemic-proposal-card-action-flags` at
`packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:712-994`.
The source checkout was `7440cb8c4302ce64b87860069a464bafbf65f576`; the
packages/apps main corpus was
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

Only the design and this handoff were written. Product source, tests,
inventory, lifecycle status, dependencies, generated files, and git refs were
not changed. Formal replacement P3 remains pending.

## Qualification and cardinality

The previous D1 correctly identified three independent disable causes:
resolved disposition, review waiting, and detail refresh waiting. It did not
account for the two derived aliases: `resolved` duplicates settled-disposition
presence, and `actionsDisabled` is the OR of all three causes. The expanded
cluster therefore satisfies E3/E4 without claiming the causes are exclusive.

The complete finite members are
`settledDisposition,resolved,reviewBusy,waiting,actionsDisabled`.
`settledDisposition` uses the existing rejected/superseded domain owner and has
three alternatives: None, Some(rejected), and Some(superseded). With four
booleans, 48 combinations are representable. Twelve are reachable: three
settled alternatives × two review-waiting values × two detail-waiting values;
Option presence determines resolved, and the three causes determine disabled.

All twelve rows are supported by the exported controlled component props and
current Effect `AsyncResult` constructors. Persisted resolved details can
coexist with any review result and either detail waiting value. An unresolved
detail can coexist with initial/failure waiting or a successful foreign/future
review disposition. A successful matching review can retain its disposition
while waiting, and detail refresh is independent.

The full `AsyncResult` variant/cause/payload domain stays outside this action
carrier. `ReviewStatus` independently consumes those distinctions, while
`AsyncResult.isWaiting` is their exact action-gate projection. CandidateComparison
is reached only from detail Success, whose waiting bit is passed directly.
This avoids inventing impossible cross products while preserving every
supported public input.

Recommended canonical metadata is 48/12, derived/internal/LiteralKit/Tier 1 on
the stable ID. Preserve the old D1 rationale as historical discovery evidence.

## Target and behavior

The private `CandidateComparisonActionGate` has five values:
`open-enabled`, `open-review-busy`, `open-refreshing`,
`open-review-busy-refreshing`, and `resolved`.

The four open members preserve both independent busy causes and their combined
state. `resolved` replaces action controls with the existing rejected or
superseded payload copy. Busy combinations may alias inside the resolved gate
because action presentation is identical, but `ReviewStatus` and the detail
refresh badge continue reading the original `reviewResult` and `waiting`
inputs, so resolved-plus-both-busy still renders both indicators.

`settledDisposition` remains an Option because its status, reason, and
supersession payload are rendered. The classifier must not copy that payload
into a second union. It deletes the three Boolean locals and their OR rather
than returning the same Boolean bag from a helper.

## Compatibility and consumer audit

No encoded boundary changes. The target is private transient render state and
does not alter controlled props, atoms, RPC, `AsyncResult`, domain schemas,
persisted JSONB dispositions, or package exports.

The complete local reader graph is:

- `ReviewStatus` renders initial waiting, error/defect, success, and
  success-with-waiting states;
- the detail `waiting` prop renders “Refreshing candidate”;
- persisted `detail.disposition` separately renders `DispositionAlert`;
- `settledDisposition` selects resolved proposal and footer payloads;
- `resolved` currently drives the footer layout data attribute;
- `actionsDisabled` currently disables every unresolved proposal and reject
  action.

The panel's `currentReviewResult` hides results belonging to another selected
candidate, review mutation remains nonconcurrent, and successful review still
advances known time and invalidates queue/detail reads. Those behaviors and the
existing candidate/time check in `reviewDisposition` remain exact.

## Test and browser QA handoff

Add a 12-row render characterization across all settled disposition, review
waiting, and detail waiting combinations. Pin enabled versus disabled action
behavior, exact rejected/superseded reason copy, both combined busy indicators,
resolved-plus-busy action replacement, disabled click suppression, and exact
enabled callbacks. Add matching-success-with-waiting coverage so the payload
is not discarded while refreshing.

Retain current persisted, optimistic, foreign-candidate, future-known-time,
proposal-applied, failure, and reason-dialog tests. Because the controls open a
gesture-bearing dialog, run the recorded browser QA loop against the
professional desktop fixture. Capture all four open gate members and resolved
with both busy inputs using real clicks, then extract/judge/ingest and require
green capture plus `requiredCount: 0`.

## Validation

Run the pinned packet design validator and scoped `git diff --check`. Formal P3
must independently confirm the 48/12 full-cluster count, the successful-
waiting payload behavior, and preservation of both busy indicators before
implementation.

## Proposal-card expansion and cardinality

The r26 report correctly adds `applied` to the former ProposalCard D1 pair:
`applied` is a superseded disposition whose proposal ID equals the card's ID,
and every settled disposition makes `actionsDisabled` true. The three-Boolean
projection is therefore 8 representable / 6 legal. That projection still omits
the case owner that controls the button-versus-resolved branch.

The complete finite cluster is
`resolution,disabled,selected,applied`, where resolution is coarsened through
the existing domain owner to None, Some(rejected), or Some(superseded). It has
24 representable and 10 legal rows:

- None contributes four rows: disabled and selected are independently false or
  true, while applied is false;
- rejected contributes two rows: disabled is true, applied is false, and
  selected remains free;
- superseded contributes four rows: disabled is true, selected remains free,
  and applied records whether this card's proposal ID matches the decision.

All ten are supported. Review/detail waiting supply both disabled values while
resolution is absent. The controlled selected-proposal Option is independent
of settled disposition, and panel close changes only dialog visibility rather
than clearing the selected proposal. Existing multi-proposal coverage proves a
superseded resolution yields matching and nonmatching cards simultaneously.
Direct controlled props also support selection of either card after resolution.

Recommended canonical metadata for stable
`epistemic-proposal-card-action-flags` is 24/10,
derived/internal/LiteralKit/Tier 1. Preserve the old D1 statement as discovery
history: disabled and selected remain independent in the unresolved branch.
The promoted qualification comes from settled-resolution and applied aliases.

## Coupled target and compatibility

The private proposal target has six presentation values: `available`,
`selected`, `busy`, `busy-selected`, `resolved`, and `applied`. Its classifier
consumes the new candidate action gate, settled resolution, selected proposal,
and card proposal. The four open values preserve enabled/disabled ×
unselected/selected button behavior. `applied` preserves the matching card's
data attribute, filled badge, test ID, and copy. `resolved` preserves every
other closed card; the unchanged resolution payload still supplies rejected or
superseded status copy.

This is an observational quotient of ten source rows. Selection no longer
changes ProposalCard DOM after its button is replaced, but the original Option
remains available to ReviewDialog. It must not be cleared, equated with applied
identity, or copied into the presentation payload.

Implement both action designs atomically in the same file. CandidateComparison
computes its five-state gate once. Each proposal presentation consumes that
gate rather than reconstructing `resolved || reviewBusy || waiting`. Delete the
ProposalCard Boolean props and local applied Boolean; retain resolution and all
domain payloads. This prevents a transitional Boolean adapter and leaves no
duplicate action-gate owner.

There is no encoded impact. Public view props, Options, AsyncResults, proposal
and disposition schemas, tags, reasons, proposal IDs, timestamps, callback
payload identity, atoms, RPC, persistence, exports, and defaults remain exact.

Add the ten-row proposal characterization alongside the candidate's 12-row
test. It must cover disabled-selected styling and click suppression, rejected
copy, matching/nonmatching superseded cards, selected+applied and
selected+nonapplied resolved inputs, exact one-card applied treatment, and
callback identity. Recorded browser QA must include all four open proposal
presentations plus rejected and multi-proposal superseded views.

## ReviewDialog leftover adjudication

The r26 `ReviewDialog` pair `open,supersession` remains D1. `supersession` is
the presence of the selected-proposal Option and chooses rejection versus
supersession copy/payload. In `ContradictionTriagePanel`, opening rejection
writes `{ open: true, selectedProposal: None }`, opening supersession writes
`{ open: true, selectedProposal: Some(proposal) }`, and `onOpenChange` writes
only `open`. Closing a supersession therefore yields false+Some. Initial or
closed rejection state yields false+None, and both open rows are ordinary.
All four pairs are supported, so this row should remain disqualified and should
not be admitted as a new target.

## Combined validation requirement

Run the pinned packet design validator and scoped `git diff --check` over both
designs and this handoff. Formal P3 must independently verify candidate 48/12,
proposal 24/10, the applied proposal-ID equality, retained selection after
close/resolution, and the atomic classifier boundary before implementation.
