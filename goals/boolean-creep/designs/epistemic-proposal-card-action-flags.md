# Instance

- id: `epistemic-proposal-card-action-flags`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:712`
- symbol: `ProposalCard`
- members: `resolution`, `disabled`, `selected`, `applied`
- evidence:
  - E3 at `ContradictionTriageView.tsx:725-731` — `applied` is exactly a
    superseded disposition whose `proposalId` equals this card's proposal ID.
  - E4 at `ContradictionTriageView.tsx:888-893,950-957` — a settled resolution
    makes the candidate resolved and therefore makes every proposal card
    disabled. An applied proposal consequently cannot be enabled.

The stable ID expands the former two-Boolean D1 record. `disabled` and
`selected` remain independent while actions are open. Qualification comes from
the omitted settled-resolution case and the derived applied identity match,
not from declaring selection and disablement mutually exclusive. Replacement
P3 review remains pending.

# Current shape

`CandidateComparison` passes the same `settledDisposition` and
`actionsDisabled` to every proposal card. It independently compares the
controlled `selectedProposal` ID with each card's proposal ID. `ProposalCard`
then derives `applied` by matching the disposition decision:

- None: review button is present; `disabled` controls native button
  availability and `selected` controls `aria-pressed` plus the secondary
  variant;
- Some(rejected): actions are closed, no proposal is applied, and the resolved
  paragraph names the rejected status;
- Some(superseded): actions are closed; only the card whose proposal ID equals
  `decision.proposalId` receives `data-applied=true`, the filled badge, its
  test ID, and “Applied proposal” copy.

Selection is independent of applied identity. The dialog owner retains its
selected proposal when the dialog closes, and a completed supersession can
coexist with either the same selected card or a different card. With multiple
proposals, one card may be applied while another remains explicitly labelled.
Do not clear selection, force it onto the applied card, or erase the
selected-and-disabled button presentation while the resolution is still None.

# Cardinality gap

The r26 three-Boolean projection has eight representable and six legal tuples:
`applied` implies `disabled`, while `selected` is free. Full-cluster accounting
must also include the existing disposition case that explains both the action
branch and applied identity. Treating `resolution` coarsely as None,
Some(rejected), or Some(superseded), the four members represent
`3 × 2³ = 24` combinations and exactly ten are supported:

| Resolution | Disabled | Selected | Applied | Legal rows |
| --- | --- | --- | --- | --- |
| None | false or true | false or true | false | 4 |
| Some(rejected) | true | false or true | false | 2 |
| Some(superseded) | true | false or true | false or true | 4 |

For None, review-result waiting and detail refresh independently supply both
disabled values. For either settled status, the candidate-wide resolution gate
forces disabled. A rejected decision has no proposal ID and cannot apply a
card. A superseded decision may match or differ from each card's ID, as the
existing two-proposal test demonstrates. The exported controlled view props
support either selected identity independently of those cases, including a
retained selection after the review resolves.

Do not multiply the carrier by full proposal payloads, reason text, timestamps,
or every concrete proposal ID. The existing disposition tagged union owns
status and payload. The equality result is the exact finite projection needed
for this card, and `applied` already records it. The selected Option and proposal
payload remain separately available to the dialog and callback.

# Target schema

Add one private `LiteralKit` beside the candidate action gate and reuse the
file's existing `$I` annotation owner:

```ts
const ProposalCardPresentation = LiteralKit([
  "available",
  "selected",
  "busy",
  "busy-selected",
  "resolved",
  "applied",
]).pipe(
  $I.annoteSchema("ProposalCardPresentation", {
    description: "Derived action and resolution presentation for one contradiction proposal card.",
  })
);
type ProposalCardPresentation = typeof ProposalCardPresentation.Type;
```

Derive the presentation once at the `A.map` call site from the shared
`CandidateComparisonActionGate`, `settledDisposition`, `selectedProposal`, and
the current proposal. Match resolution first:

- a matching superseded proposal maps to `applied`;
- every other Some resolution maps to `resolved`;
- None plus `open-enabled` maps to `available` or `selected` by selected-ID
  equality;
- None plus any busy open gate maps to `busy` or `busy-selected`;
- the gate's `resolved` member with resolution None is structurally
  unreachable and must use an exhaustive typed classifier rather than a
  fallback that invents UI behavior.

The six values are an observational quotient of the ten source rows. Once a
resolution replaces the button, `selected` no longer changes this card's DOM;
the original selected Option remains intact for `ReviewDialog`. Rejected and
nonmatching superseded resolutions share `resolved` presentation, while the
unchanged `resolution` payload independently supplies exact status copy. This
keeps the case owner authoritative and avoids copying reason or proposal IDs
into a second union.

Use `ProposalCardPresentation` schema-derived guards or exhaustive matches for
button presence, disabled state, selected styling, badge treatment, and
`data-applied`. Do not return `disabled`, `selected`, or `applied` booleans from
a helper and do not duplicate the candidate action-gate vocabulary.

# Migration inventory

- `ContradictionTriageView.tsx:8-58` — reuse the existing `LiteralKit`, Match,
  Equal, Option, and annotation imports; define the private presentation kit
  beside `CandidateComparisonActionGate` without exporting either.
- `ContradictionTriageView.tsx:126-189` — retain the exported controlled view
  props, selected-proposal Option, callbacks, and review/detail AsyncResults.
- `ContradictionTriageView.tsx:234-258` — retain `reviewDisposition`, including
  candidate identity and `knownAt` filtering that choose the settled Option.
- `ContradictionTriageView.tsx:712-731` — replace ProposalCard's `disabled` and
  `selected` Boolean props plus local `applied` with one private
  `presentation`; retain `proposal`, `resolution`, and callback props.
- `ContradictionTriageView.tsx:733-744` — derive `data-applied`, badge test ID,
  variant, and copy from the `applied` member with exact existing values.
- `ContradictionTriageView.tsx:746-777` — preserve rationale, fact, proposal ID,
  target, dates, layout classes, titles, and all test IDs.
- `ContradictionTriageView.tsx:778-805` — keep resolution as the branch owner.
  In the None branch, derive `aria-pressed`, disabled, and primary/secondary
  variant from the four open presentation members. In Some, keep the exact
  resolved status paragraph and icon.
- `ContradictionTriageView.tsx:866-893` — implement atomically with
  `epistemic-candidate-comparison-action-gates`; compute the shared candidate
  gate once and retain `settledDisposition` as its authoritative payload.
- `ContradictionTriageView.tsx:947-958` — derive each card presentation at the
  map site from gate, resolution, and both proposal identities; preserve array
  order, key, proposal object, and callback.
- `ContradictionTriageView.tsx:970-994` — keep the candidate footer's resolution
  payload, reason, and reject callback under the shared candidate gate; do not
  derive proposal presentation there.
- `ContradictionTriageView.tsx:1098-1186` — retain `ReviewDialog`'s selected
  proposal consumer, rejection/supersession copy, proposal target, and submit
  payload. The proposal-card quotient must not clear or rewrite this Option.
- `ContradictionTriagePanel.tsx:46-57,279-303,344-356` — preserve host dialog
  state. Opening rejection writes None, opening supersession writes Some, and
  `onOpenChange` changes only `open`, so a closed dialog may retain selection.
- `Contradiction.model.ts:845-930,954-1136` and entity lines 128-153 — reuse the
  authoritative proposal schema, disposition-status LiteralKit, decision tagged
  union, and persisted disposition entity without edits.

Exact source search found no other `ProposalCard` call site or reader of its
three Boolean observations. The view is package-exported and direct tests can
supply supported controlled combinations beyond the panel's common mutation
sequence. This migration therefore changes only private props and derived
render state.

# Guard-deletion accounting

Delete ProposalCard's `disabled` and `selected` Boolean prop declarations,
delete the local `applied`, and delete the inline selected-ID Boolean passed at
the call site. Delete their direct Boolean reads in `data-applied`, badge,
button `aria-pressed`, disabled, and variant expressions.

One `ProposalCardPresentation` classifier owns these observations. It consumes
the already-designed candidate gate instead of reconstructing
`resolved || reviewBusy || waiting`. It may inspect the settled disposition and
the two proposal IDs once. Do not recreate the three booleans in an object,
helper return, or local aliases.

Retain `settledDisposition`, `selectedProposal`, and each proposal payload.
They have independent readers: footer/disposition copy, ReviewDialog payload,
and card content/callback respectively. Their presence is not Boolean creep
after the redundant presentation projections are removed.

# Encoded-side impact

None. `ProposalCardPresentation` is private render-time state. No public prop,
atom, RPC command/result, persisted disposition, JSONB decision, package
export, default, timestamp, proposal payload, or encoded proposal ID changes.

Preserve exact rejected/superseded tags, reasons, applied proposal identity,
selected proposal identity, callback object identity, and current absence
semantics. The target literal is never encoded or stored.

# Test impact

Extend `packages/epistemic/ui/test/ContradictionTriageView.test.tsx` with the
ten-row full source matrix while exercising only existing public props:

- None with enabled/disabled × selected/unselected proves the four button
  presentations, including disabled-selected `aria-pressed`, secondary variant,
  and click suppression;
- rejected with selected/unselected proves closed actions, false applied data,
  outline “Explicit proposal” badge, and rejected status copy;
- superseded with matching/nonmatching applied ID × selected/unselected proves
  all four rows, exact one-card applied badge/test ID, and independent retained
  selection;
- an enabled unselected/selected click forwards the exact proposal once;
- busy proposal clicks and every settled proposal suppress the action by
  retaining the current disabled-or-absent native controls.

Retain current lines 652-720 authoritative/foreign/future disposition tests and
the existing two-proposal applied-identity assertion. Add an explicit completed
supersession while the same proposal remains selected, and another with a
different retained selection, so neither identity is silently normalized.
Coordinate this table with the candidate gate's 12-row source characterization
rather than building two unrelated fixtures.

Run recorded browser QA through the professional desktop contradiction fixture
after implementation. Capture real interactions for:

1. available and selected proposal buttons;
2. busy and busy-selected buttons, preserving disabled styling and pressed
   state while clicks remain blocked;
3. rejected resolution with explicit badges and closed-action copy;
4. superseded resolution with exactly one applied filled badge and every other
   proposal's outline badge;
5. a resolved view after dialog close, confirming retained selection still
   drives subsequent ReviewDialog mode without leaking a button into the card.

Record, extract, build the judge pack, ingest the judgment, and require a green
capture plus `requiredCount: 0`. Preserve current focus, hover, disabled,
selected, badge, responsive layout, and dialog-opening behavior.

# Risk and sequencing

Tier 1 private derived-state migration. Implement in the same edit as
`epistemic-candidate-comparison-action-gates` because ProposalCard consumes the
new candidate gate and both designs delete the same `actionsDisabled` flow.
Applying either half alone would recreate a Boolean adapter.

The main risk is collapsing selection into applied identity or losing the
disabled-selected style. Validate all ten rows, the candidate gate's twelve
rows, focused epistemic UI tests, package verification, and recorded browser QA.
Formal P3 remains required before apply.

# Qualification recommendation

Promote stable `epistemic-proposal-card-action-flags` with members
`resolution,disabled,selected,applied`, cardinality 24/10,
`storage=derived`, `exposure=internal`, `targetShape=literalkit`, and Tier 1.
Preserve the former D1 as discovery history: disabled and selected really are
independent in the open case; qualification comes from the resolution and
applied aliases added by the complete cluster.
