# Instance

- id: `epistemic-candidate-comparison-action-gates`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:891`
- symbol: `CandidateComparison`
- members: `settledDisposition`, `resolved`, `reviewBusy`, `waiting`,
  `actionsDisabled`
- evidence:
  - E3 at `ContradictionTriageView.tsx:888-891` — `resolved` is exactly the
    presence projection of `settledDisposition`.
  - E4 at `ContradictionTriageView.tsx:892-893` — `actionsDisabled` is exactly
    `resolved || reviewBusy || waiting`; every enabled tuple with any cause true
    is unreachable.

The stable ID expands the earlier four-Boolean D1 record. Its original
independence finding remains valid for the three disable causes, while the
presence and OR aliases make the complete cluster qualify. Replacement P3
review remains pending.

# Current shape

`CandidateComparison` first chooses a settled disposition. A persisted
`detail.disposition` wins; otherwise `reviewDisposition` may expose a successful
review for the same candidate whose resolution time is at or before `knownAt`.
The existing domain owner `ContradictionDispositionStatus` has two cases,
`rejected` and `superseded`, so the Option has three meaningful alternatives:
None, Some(rejected), and Some(superseded).

Three causes independently close or disable actions:

- a settled disposition replaces reject/proposal buttons with resolved copy;
- a waiting review result disables still-open buttons while `ReviewStatus`
  shows recording or refreshing state;
- a waiting detail success disables still-open buttons while the comparison
  keeps its previous value and shows “Refreshing candidate.”

All three causes can coexist. A resolved detail or successful review may be
displayed while both the review result and detail result are waiting. The
combined state continues to render the review status, detail-refresh badge,
resolved proposal copy, and resolved footer; it must not be normalized to a
plain idle resolution.

# Cardinality gap

The original four booleans have 16 representable and 8 reachable tuples: the
first three inputs are independently true or false, and the fourth is their OR.
Full-cluster accounting also includes the three alternatives of the
case-owning `settledDisposition` Option. Five members therefore represent
`3 × 2⁴ = 48` combinations. Exactly `3 × 2 × 2 = 12` are reachable because
Option presence determines `resolved`, while resolved, review waiting, and
detail waiting determine `actionsDisabled`.

Every one of the 12 rows is supported by the exported controlled component
contract and Effect's current `AsyncResult` constructors. Some(rejected) and
Some(superseded) can each originate from persisted detail independently of
either waiting flag. None can coexist with review waiting through an initial or
failure waiting result, or a successful foreign/future disposition; detail
success independently supports `waiting` false or true.

Do not multiply the action carrier by every `AsyncResult` variant, error cause,
previous success, or disposition payload field. `ReviewStatus` observes those
states independently, and `reviewBusy = AsyncResult.isWaiting(reviewResult)` is
their exact projection into action gating. Likewise CandidateComparison is
called only from the detail result's Success arm, where the passed `waiting`
flag is the exact refresh projection. Decision reason and supersession IDs
remain case payloads on the existing disposition.

# Target schema

Reuse the file's existing `LiteralKit` import and `$I` owner for one private
derived action domain:

```ts
const CandidateComparisonActionGate = LiteralKit([
  "open-enabled",
  "open-review-busy",
  "open-refreshing",
  "open-review-busy-refreshing",
  "resolved",
]).pipe(
  $I.annoteSchema("CandidateComparisonActionGate", {
    description: "Derived availability of contradiction candidate review actions.",
  })
);
type CandidateComparisonActionGate = typeof CandidateComparisonActionGate.Type;
```

Derive `resolved` first from the existing settled Option. An unresolved value
then retains all four combinations of review waiting and detail waiting. This
five-value quotient avoids a Boolean bag while preserving independently visible
busy causes:

| Gate | Review status | Detail badge | Action presentation |
| --- | --- | --- | --- |
| `open-enabled` | ordinary current result | absent | reject and proposal actions enabled |
| `open-review-busy` | pending/refreshing | absent | reject and proposal actions disabled |
| `open-refreshing` | ordinary current result | present | reject and proposal actions disabled |
| `open-review-busy-refreshing` | pending/refreshing | present | reject and proposal actions disabled |
| `resolved` | still driven independently | still driven independently | action buttons replaced by resolved payload copy |

Keep `settledDisposition` as the case-owning Option because the renderer needs
the rejected/superseded payload and reason. Keep `reviewResult` and `waiting`
as independent upstream values for `ReviewStatus` and the refresh badge. The
`resolved` gate intentionally aliases all busy combinations only after actions
have been replaced; the separate status readers continue exposing those causes.

Use schema-derived gate guards or exhaustive matches for button disabled state
and the `data-resolved` attribute. Do not create a second disposition union,
copy status/reason into the gate, or move the old booleans into a helper result.

# Migration inventory

- `ContradictionTriageView.tsx:8-58` — reuse the existing `LiteralKit` import
  and local identity owner; define the private action gate beside other private
  view classifiers without exporting it.
- `ContradictionTriageView.tsx:126-189` — retain the exported controlled props,
  full `AsyncResult` types, callbacks, selected proposal/source Options, and
  `ComparisonPaneProps` aliases unchanged.
- `ContradictionTriageView.tsx:234-258` — retain `dispositionLabel` and
  `reviewDisposition` exactly, including candidate identity, known-time cutoff,
  and the rejection/supersession payload.
- `ContradictionTriageView.tsx:712-807` — coordinate atomically with
  `epistemic-proposal-card-action-flags`: retain `ProposalCard`'s resolution
  Option, applied-proposal display, selected styling, callback payload, and
  resolved copy. Replace its Boolean props with the proposal presentation
  literal derived from this gate, settled resolution, and proposal identities.
- `ContradictionTriageView.tsx:816-864` — retain `DispositionAlert` and
  `ReviewStatus`. Initial waiting, error/defect, success, and success-with-
  waiting copy continue to match the original `reviewResult`.
- `ContradictionTriageView.tsx:866-893` — retain the settled Option calculation;
  replace the three locals `resolved`, `reviewBusy`, and `actionsDisabled` with
  one direct gate derivation from the Option, `AsyncResult.isWaiting`, and the
  existing detail waiting prop.
- `ContradictionTriageView.tsx:895-913` — keep the detail-refresh badge driven
  directly by `waiting` and `ReviewStatus` driven by `reviewResult`.
- `ContradictionTriageView.tsx:914-968` — pass the gate into the colocated
  proposal presentation classifier; preserve settled-resolution payloads,
  selected/applied proposal identity comparisons, and list/order/key behavior.
- `ContradictionTriageView.tsx:970-994` — derive `data-resolved` from the gate;
  preserve the settled Option match, reject callback, destructive variant,
  resolved status label, reason, layout classes, and test IDs.
- `ContradictionTriageView.tsx:998-1037` — preserve the detail AsyncResult match.
  CandidateComparison remains Success-only and receives its `waiting` bit from
  that success rather than receiving a new gate prop.
- `ContradictionTriagePanel.tsx:46-121` — retain `noVisibleReview`, atom reads,
  and candidate-scoped `currentReviewResult`; a result for another candidate
  remains hidden as initial-not-waiting.
- `ContradictionTriagePanel.tsx:193-358` and
  `ContradictionTriage.atoms.ts:565-587` — preserve selection, review command,
  nonconcurrent mutation, known-time advancement, invalidation, and refresh
  behavior. The action gate is not stored in atoms.
- `Contradiction.model.ts:954-1131` and entity lines 128-153 — reuse the
  authoritative rejected/superseded domain owner and persisted disposition
  payload without edits.

Exact repository search found no other reader of the three local booleans.
`ContradictionTriageView` is re-exported from the epistemic UI barrel, so direct
controlled-prop tests and callers remain supported even when their combinations
are broader than the panel's most common mutation sequence.

# Guard-deletion accounting

Delete `resolved`, `reviewBusy`, and `actionsDisabled`, the Option-presence
projection, and the three-way OR. Delete direct reads of `actionsDisabled` at
both ProposalCard and reject-button sites. One action-gate classifier and its
schema-derived match/guards own candidate-wide action presence and
availability. The separately designed proposal presentation classifier consumes
this gate rather than recreating its three input booleans.

Do not return `resolved`, `reviewBusy`, or `waiting` booleans from the helper.
The existing `waiting` prop is retained because it independently renders the
detail-refresh badge. `reviewResult` is retained because `ReviewStatus` renders
its variant, error, disposition, and waiting copy. `settledDisposition` is
retained because resolved UI consumes its status and reason. These source
values are read directly by their independent observers and only projected
once into the action gate.

# Encoded-side impact

None. `CandidateComparisonActionGate` is private render-time state. No prop,
atom, RPC command/result, domain schema, persisted disposition, JSONB decision,
or package export changes. Preserve Option absence, rejected/superseded tags,
reasons and supersession IDs, `AsyncResult` states and waiting semantics,
candidate/time filtering, callback identity, and all current default values.

The migration must not synthesize a settled disposition from busy state,
discard a successful waiting result's payload, or persist the new literal.

# Test impact

Extend `packages/epistemic/ui/test/ContradictionTriageView.test.tsx` with a
12-row source table over None/rejected/superseded settled dispositions,
review-busy false/true, and detail-waiting false/true. Assert the derived gate
member and current DOM behavior without replacing public props with the private
literal:

- only unresolved/nonbusy enables reject and every proposal action;
- each unresolved busy cause disables both action families while preserving a
  selected proposal's pressed/secondary presentation;
- combined review/detail waiting keeps both the review status and refresh badge;
- both disposition statuses replace actions with exact status/reason copy;
- resolved plus both waiting causes keeps both independent indicators while
  actions remain replaced;
- disabled real clicks do not invoke reject or supersede callbacks, while the
  enabled row forwards each callback exactly once.

Retain existing lines 611-632 persisted-resolution coverage, lines 652-720
authoritative/foreign/future review-result behavior, proposal applied-state
coverage, stale/error copy, and review-dialog tests. Add an explicit successful
review with `{ waiting: true }` to prove its value still resolves the candidate
while `ReviewStatus` says the persisted state is refreshing.

Run recorded browser QA through the professional desktop contradiction-triage
fixture after implementation. Capture with real clicks:

1. open enabled reject and proposal actions;
2. review-busy open state with pending/refreshing copy and blocked actions;
3. detail-refreshing open state with its badge and blocked actions;
4. both busy causes together, with both indicators and blocked actions;
5. persisted and optimistic resolved states, including resolved plus both busy
   inputs, proving status/reason copy and complete action replacement.

Record, extract, build the judge pack, ingest the judgment, and require a green
capture plus `requiredCount: 0`. Preserve current focus, hover, disabled,
responsive layout, and dialog-opening behavior.

# Risk and sequencing

Tier 1 private derived-state migration. The main risk is erasing why an open
candidate is disabled, or treating a waiting successful review as payload-free.
Keep all independent status readers, replace only the action gate, and validate
the complete 12-row source matrix. Run focused epistemic UI tests, package
verification, and recorded browser QA after implementation. Formal P3 remains
required before apply.

# Qualification recommendation

Promote the stable `epistemic-candidate-comparison-action-gates` record with
members `settledDisposition,resolved,reviewBusy,waiting,actionsDisabled`,
cardinality 48/12, `storage=derived`, `exposure=internal`,
`targetShape=literalkit`, and Tier 1. Preserve the former D1 note as discovery
history: the three disable causes remain independent and combined true is
legitimate; qualification comes from the Option-presence and OR aliases.
