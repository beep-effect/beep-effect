# Review-dialog reason-gate design refresh

Date: 2026-09-08

## Source baseline

- Checkout HEAD: `7440cb8c4302ce64b87860069a464bafbf65f576`.
- Frozen upstream corpus: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
- Source, tests, inventory, lifecycle status, dependencies, generated files, and git refs were not changed.

## Qualification result

`epistemic-review-dialog-reason-gates` is a valid expanded 16/4 derived carrier. In field order `reasonMissing`, `reasonTooLong`, `reasonInvalid`, `confirmDisabled`, the only tuples are:

- `0000`: valid normalized reason, review idle;
- `0001`: valid normalized reason, review waiting;
- `1011`: missing normalized reason, disabled;
- `0111`: over-2,000 normalized reason, disabled.

The earlier two-boolean D1 assessment was correct for the isolated `reasonMissing`/`reasonTooLong` pair, but incomplete once their aggregate invalidity and final disabled projection are included. The expanded record captures two chained implications and eliminates all four locals.

## Behavioral findings preserved in the design

- Classification uses `Str.trim(reason)`. Whitespace-only input is missing; exactly 2,000 normalized characters are valid; 2,001 are too long.
- The textarea displays and forwards the raw controlled string. `ContradictionTriagePanel.confirmReview` trims the latest controlled value only when the click callback runs, then constructs the same reject or supersede command.
- The confirm button uses native disabled semantics. The current callback has no internal validation guard, and the design does not add one or change callback timing.
- The browser `maxLength` prevents normal interactive entry beyond 2,000, while controlled props can still present an over-limit value; the existing component test covers that case.
- Missing reasons currently retain the ordinary persistence description while only too-long reasons show the maximum-length error. The design preserves that copy distinction.
- `selectedProposal` remains independent. It continues selecting rejection versus supersession title, description, action text, variant, target rendering, and command payload.
- The dialog currently remains open and retains state on submission, success, or failure. Opening a reject/supersession review resets its reason; cancel/open-change only changes `open`. The design does not change either behavior.

## Waiting, error, and result audit

Waiting is orthogonal to reason validity even though invalid-plus-waiting and invalid-plus-idle have the same four-boolean tuple. The private literal is used only for dialog invalidity/copy/disabled rendering. `reviewResult` remains unchanged and continues flowing to:

- `ReviewStatus` (`ContradictionTriageView.tsx:833-864`) for the “Recording decision” pending alert, sanitized error/defect handling, success, and success-with-waiting refresh copy;
- `CandidateComparison` (`:888-903`) for the independent busy lock on surrounding actions;
- `currentReviewResult` (`ContradictionTriagePanel.tsx:116-121`) for candidate-scoped result visibility.

An invalid reason during waiting therefore keeps its invalid literal member while pending UI remains observable through the unchanged `AsyncResult`. No waiting signal is derived from or overwritten by the literal.

Review failures continue through typed `ContradictionActionError` or `RpcClientError` rendering. Existing UI tests prove private transport cause/message text is not rendered. The classifier introduces no logging and does not touch the client mutation's typed error channel.

## Target and reuse

No existing repo-owned literal family names this four-state projection. The design adds one private annotated `LiteralKit` in `ContradictionTriageView.tsx` with:

- `valid-enabled`
- `valid-waiting`
- `missing-disabled`
- `too-long-disabled`

It reuses the existing file import and the authoritative `CONTRADICTION_REVIEW_REASON_MAX_LENGTH`. It is not exported or stored. Schema-derived literal guards and matching replace every reader; no replacement invalid/disabled helper booleans are introduced.

## Tests and recorded QA

The design maps the existing component coverage at `ContradictionTriageView.test.tsx:460-566` and requires focused additions for all four tuples, trim/boundary behavior, disabled click semantics, and invalid-plus-waiting with the pending alert still present. Domain/RPC/client/server tests remain unchanged.

The professional desktop mounts the panel at dock key `contradiction-triage` (`App.tsx:584`) and has deterministic fixtures in `ContradictionQaSeed.ts`. There is no Storybook story for this dialog. The implementation must record the browser QA scenarios listed in the design and complete record → extract → judge with `requiredCount: 0`; historical contradiction-triage QA does not replace fresh evidence for this gesture-bearing migration.

## Inventory guidance

The parent-proposed members and 16/4 cardinality are supported. Keep `supersession` outside the record. The evidence note should make clear that waiting is an independent input whose invalid-reason combinations collapse only in this four-boolean projection; `reviewResult` itself remains observable elsewhere.

## Validation

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed: `design coverage OK: 103 qualified ids`.
- Scoped `git diff --check` passed for the design and this handoff.
