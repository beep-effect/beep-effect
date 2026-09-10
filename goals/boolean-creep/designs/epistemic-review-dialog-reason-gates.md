# Instance

- id: `epistemic-review-dialog-reason-gates`
- file:line: `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1117`
- symbol: `ReviewDialog`
- members: `reasonMissing`, `reasonTooLong`, `reasonInvalid`, `confirmDisabled`
- evidence classes:
  - E4 at `ContradictionTriageView.tsx:1117-1119` — the reason is trimmed before length checks; `reasonInvalid` is exactly `reasonMissing || reasonTooLong`, and a zero-length reason cannot exceed the 2,000-character maximum.
  - E4 at `ContradictionTriageView.tsx:1120` — `confirmDisabled` is exactly reason invalidity or `AsyncResult.isWaiting(reviewResult)`, so invalid-and-enabled is unreachable.
  - E2 at `ContradictionTriageView.tsx:1135-1185` — the too-long bit selects the validation copy, the invalid aggregate marks the field and textarea, and the aggregate disable bit controls the confirm action.

# Current shape

`ReviewDialog` derives four booleans from one controlled reason plus the independently controlled review result:

```ts
const normalizedReason = Str.trim(reason);
const reasonMissing = Str.isEmpty(normalizedReason);
const reasonTooLong = Str.length(normalizedReason) > CONTRADICTION_REVIEW_REASON_MAX_LENGTH;
const reasonInvalid = reasonMissing || reasonTooLong;
const confirmDisabled = reasonInvalid || AsyncResult.isWaiting(reviewResult);
```

The textarea retains the untrimmed controlled `reason` as its displayed value and forwards each raw edit through `onReviewReasonChange`. The panel trims the latest controlled value only when `onReviewConfirm` reaches `confirmReview` at `ContradictionTriagePanel.tsx:293-303`. The field's `maxLength` is the same domain constant used by the persisted `ContradictionReviewReason` schema.

The selected proposal is an independent `Option`: it chooses rejection versus supersession copy and payload construction. It is deliberately outside this carrier.

# Cardinality gap

Four booleans represent sixteen tuples. Exactly four are produced, in member order `reasonMissing`, `reasonTooLong`, `reasonInvalid`, `confirmDisabled`:

- `0000` — normalized reason is valid and no review is waiting;
- `0001` — normalized reason is valid and a review is waiting;
- `1011` — normalized reason is empty, therefore invalid and disabled;
- `0111` — normalized reason exceeds 2,000 characters, therefore invalid and disabled.

Missing and too-long cannot both be true. Waiting is an independent input, but it only changes this four-bit projection when the reason is valid: invalid-plus-waiting and invalid-plus-idle have the same tuple. The classifier may collapse those two inputs for dialog field/disable rendering because they are observationally identical there. It must not replace or normalize `reviewResult`; other readers still expose pending and refreshing status independently.

# Target schema

Add one private, named `LiteralKit` beside the other private view classifiers in `ContradictionTriageView.tsx`; the file already imports `LiteralKit` and no existing reason-gate vocabulary exists in the repository:

```ts
const ReviewDialogReasonGate = LiteralKit([
  "valid-enabled",
  "valid-waiting",
  "missing-disabled",
  "too-long-disabled",
]).pipe(
  $I.annoteSchema("ReviewDialogReasonGate", {
    description: "Derived reason validation and submit availability for the contradiction review dialog.",
  })
);
type ReviewDialogReasonGate = typeof ReviewDialogReasonGate.Type;
```

Derive one `reasonGate` from `Str.trim(reason)` and the waiting input. Match missing first, then too-long, then use `Bool.match(AsyncResult.isWaiting(reviewResult), ...)` for the two valid states. Keeping this priority order preserves whitespace-only classification, the inclusive 2,000-character maximum, and the fact that invalid-plus-waiting remains the appropriate invalid member rather than becoming `valid-waiting`.

Use only schema-derived literal guards/matching at the readers:

- `missing-disabled | too-long-disabled` sets both `Field data-invalid` and textarea `aria-invalid`;
- `too-long-disabled` selects the existing maximum-length description; every other member selects the existing persistence description, including missing;
- every member except `valid-enabled` disables the confirm action.

Do not add a second status family, a `reasonInvalid` helper, or a new submit guard inside `onReviewConfirm`. The literal is a private render classifier, not a new stored form state or public domain model.

# Async and callback preservation

`reviewResult` remains an orthogonal prop and continues to reach all existing readers:

- `ReviewStatus` at `ContradictionTriageView.tsx:833-864` renders the initial-waiting “Recording decision” alert, failure/defect copy, success copy, and success-with-waiting “Refreshing persisted state…” text.
- `CandidateComparison` at lines 888-903 derives `reviewBusy` independently and disables the surrounding reject/proposal actions while rendering `ReviewStatus`.
- `currentReviewResult` at `ContradictionTriagePanel.tsx:116-121` continues hiding a result that belongs to another selected candidate.

An invalid reason during a waiting review maps to an invalid gate member, while those separate readers still observe the waiting `AsyncResult` and keep their spinner/copy. Do not derive or overwrite `reviewResult` from `reasonGate`.

The `AlertDialogAction` keeps the same `onClick={onReviewConfirm}`. Native disabled-button semantics continue preventing click dispatch for missing, too-long, or waiting states. The callback itself remains unguarded; adding validation inside `confirmReview` would change direct-callback behavior and is outside this representation migration. On an enabled click, the panel reads and trims the current controlled reason, builds the same reject or supersede decision, and starts the same non-concurrent mutation. The dialog is not automatically closed or cleared on submission, success, or failure today; preserve that behavior.

# Migration inventory

- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:12` — reuse the existing `LiteralKit` import; no new shared vocabulary or dependency is needed.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:56-78` — colocate the private annotated gate kit near the existing file-level literal declarations without exporting it from the package barrel.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1098-1120` — retain all controlled props; replace the four boolean locals with one `reasonGate` derivation. `normalizedReason` may remain local or live inside the classifier.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1121-1134` — leave supersession/rejection copy selection unchanged and independent.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1135-1138` — derive description copy by matching the gate; only `too-long-disabled` uses the length error.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1162-1169` — derive field and textarea invalidity from the two invalid members; preserve raw controlled value, raw `onChange` forwarding, `required`, placeholder, id, and the 2,000-character `maxLength`.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:1177-1186` — disable unless the gate is `valid-enabled`; retain action copy, variant, test id, and callback reference.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriageView.tsx:833-903` — no carrier migration: retain independent pending/success/error rendering and surrounding action disablement.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriagePanel.tsx:46-57,116-135,223-236` — no carrier migration: preserve host-owned dialog state, candidate-scoped visible review selection, and rejection/supersession decision construction.
- `packages/epistemic/ui/src/ContradictionTriage/ContradictionTriagePanel.tsx:279-303,344-356` — preserve open-time reason reset, cancel/open-change behavior, raw reason updates, confirm-time trim, command construction, and review mutation timing.
- `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:999-1051` — reuse the authoritative 2,000-character constant and leave the persisted trimmed/non-empty/max-length schema unchanged.
- `packages/epistemic/client/src/ContradictionTriage/ContradictionTriage.atoms.ts:539-587` — leave the non-concurrent mutation, candidate-id association, success updates, invalidation, and error channel unchanged.

Exact repository search finds no other reader of the four locals. `ContradictionTriageView` receives its controlled values either directly in `ContradictionTriageView.test.tsx` or from `ContradictionTriagePanel`; there is no Storybook story for this dialog. The professional desktop mounts the panel under dock key `contradiction-triage` at `apps/professional-desktop/src/App.tsx:584`, with deterministic browser fixtures from `apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts`.

# Guard-deletion accounting

Delete all four inventoried local declarations:

- `reasonMissing` — the `missing-disabled` member owns the empty-trimmed-reason case;
- `reasonTooLong` — the `too-long-disabled` member owns the over-2,000 case and its copy;
- `reasonInvalid` — schema-derived invalid-member guards drive both accessibility attributes;
- `confirmDisabled` — only `valid-enabled` enables the action.

Delete the two OR relationships that must currently stay coherent (`reasonMissing || reasonTooLong`, then `reasonInvalid || waiting`). Do not recreate them as helper booleans or ad-hoc predicates. The classifier may inspect `AsyncResult.isWaiting(reviewResult)` once after ruling out both invalid reason cases.

# Encoded-side impact

none (private derived render state)

The literal is recomputed during render and is neither exported, persisted, sent through RPC, nor added to component props. The controlled reason string, `AsyncResult`, review command, and encoded domain reason remain unchanged.

# Test impact

Retain and extend `packages/epistemic/ui/test/ContradictionTriageView.test.tsx`:

- lines 460-548 continue proving raw textarea edits are forwarded and one valid supersession click calls `onReviewConfirm`;
- lines 551-566 continue proving a controlled 2,001-character value is invalid, disabled, and shows the maximum-length copy despite the textarea's browser `maxLength`;
- add the complete four-tuple render matrix: valid idle enables; valid waiting disables; whitespace-only maps to missing/invalid/disabled with the ordinary persistence description; 2,001 normalized characters map to too-long/invalid/disabled with the limit description;
- add exact-boundary cases showing surrounding whitespace is trimmed for classification, 2,000 normalized characters remain valid, and 2,001 are too long;
- render an invalid open dialog with `AsyncResult.initial(true)` and assert both the invalid field/disabled confirm state and the independently rendered `contradiction-review-pending` status remain present;
- render valid reason plus review failure/defect/success states and retain the existing `ReviewStatus` copy/privacy assertions. Failure and settled success are not waiting, so this migration must not introduce a new disable reason;
- click each disabled button and assert `onReviewConfirm` is not called; click `valid-enabled` and assert exactly one call. Do not directly invoke the callback and expect a new validation guard.

No domain, RPC, client-atom, or server test should change because the carrier is private derived UI state.

# Recorded browser QA

This is gesture-bearing UI, so the implementation milestone must run the `browser-qa-loop` record → extract → judge flow against `http://professional-desktop.beep.localhost:1355` and finish with a schema-validated inventory whose `requiredCount` is `0`. Use the opt-in deterministic contradiction QA seed and record these scenarios:

1. Open the `Contradiction Triage` dock panel, select an unresolved candidate, open rejection, enter whitespace, and verify the required field is invalid while confirm stays disabled; replace it with a valid reason and verify confirm enables without changing rejection copy.
2. Open a persisted supersession proposal and verify the selected-proposal target, default variant, and “Approve supersession” copy remain independent of the reason gate. Cancel, reopen, and verify the panel's existing open-time empty-reason reset and disabled state.
3. Paste/type at the browser maximum boundary and verify the textarea enforces 2,000 characters, the resulting non-empty reason remains valid, and no too-long copy appears. The controlled 2,001 state remains covered by the component test because browser `maxLength` prevents ordinary user entry.
4. Submit one valid review, immediately attempt a second click, and capture the transition where the confirm action and surrounding review actions are disabled while the existing “Recording decision” status is shown. After success, preserve the existing recorded/refreshing copy and current dialog open-state behavior.
5. Exercise a typed review failure or stale-candidate fixture if the QA harness already exposes it; verify the existing sanitized error alert remains visible and no private error/log detail is rendered. Do not add a new failure trigger solely for this carrier migration.

Record witness assertions for dialog open state, `aria-invalid`, disabled state, action copy, selected proposal target, callback/result transition, pending alert, and final disposition. Preserve the existing minimum-duration pointer/typing evidence required by the QA skill.

# Risk and sequencing

Land as an internal Tier 1 epistemic UI change after independent design review. The primary risks are collapsing the orthogonal waiting signal outside the dialog, changing callback validation/timing, or letting the four-state name imply that supersession is part of the reason gate. Keep `reviewResult` and `selectedProposal` independent, preserve controlled-input and mutation behavior, update the focused component tests, then run full `@beep/epistemic-ui` package verification and recorded browser QA.
