## 1. Instance

- id: `r2-apps-contact-form-submit-phase`
- file:line: `apps/oip-web/src/components/ContactForm.tsx:122`
- symbol: `ContactForm`
- members: `isSubmitting`, `isRejected`
- evidence classes:
  - E3 at `apps/oip-web/src/components/ContactForm.tsx:135` — isRejected is !isSubmitting && contactStatus===rejected; combined-true cannot be constructed.
  - E2 at `apps/oip-web/src/components/ContactForm.tsx:179` — Submit button disables on isSubmitting; rejected copy renders only when isRejected.

## 2. Current shape

Live sibling-state declaration at `apps/oip-web/src/components/ContactForm.tsx:121`:

```ts
const submitResult = useAtomValue(submitContactAtom);
const isSubmitting = AsyncResult.isWaiting(submitResult);
const submittedStatus = AsyncResult.matchWithWaiting(submitResult, {
  onDefect: () => "rejected" as const,
  onError: () => "rejected" as const,
  onSuccess: (result) => result.value.status,
  onWaiting: () => undefined,
});
const contactStatus = submittedStatus ?? status;
const statusMessage = isSubmitting
  ? "Sending note..."
  : contactStatus === "accepted"
    ? "Your note was received."
    : null;
const isRejected = !isSubmitting && contactStatus === "rejected";
```

The members are read at `apps/oip-web/src/components/ContactForm.tsx:179`, `:180`, and `:196`.

## 3. Cardinality gap

The two booleans represent four combinations, but only three boolean combinations are legal; both false additionally conflates two meaningful phases. The honest legal states are:

- `idle`: no in-flight request and no accepted/rejected status.
- `submitting`: the mutation is waiting.
- `accepted`: the effective submission status is accepted.
- `rejected`: the effective submission status is rejected.

`isSubmitting && isRejected` is illegal. Idle and accepted currently both set the two inventoried booleans false.

## 4. Target schema

Reuse the existing nearby `ContactSubmissionStatus` literal kit for the accepted/rejected options. Add `LiteralKit` to the existing `@beep/schema` import, and derive the larger phase kit rather than duplicating those status literals:

```ts
import { EmailString, LiteralKit } from "@beep/schema";

const ContactSubmitPhase = LiteralKit([
  "idle",
  "submitting",
  ...ContactSubmissionStatus.Options,
]).pipe(
  $I.annoteSchema("ContactSubmitPhase", {
    description: "Exclusive client-side lifecycle phase of an OIP contact submission.",
  })
);

type ContactSubmitPhase = typeof ContactSubmitPhase.Type;
```

Derive one phase from the existing mutation and effective status:

```ts
const contactStatus = submittedStatus ?? status;
const submitPhase: ContactSubmitPhase = AsyncResult.isWaiting(submitResult)
  ? ContactSubmitPhase.Enum.submitting
  : (contactStatus ?? ContactSubmitPhase.Enum.idle);

const statusMessage = ContactSubmitPhase.$match(submitPhase, {
  idle: () => null,
  submitting: () => "Sending note...",
  accepted: () => "Your note was received.",
  rejected: () => null,
});
```

Use `ContactSubmitPhase.is.submitting(submitPhase)` for disabled/label behavior and `ContactSubmitPhase.is.rejected(submitPhase)` for rejected copy. No second boolean aliases are introduced.

## 5. Migration inventory

- `apps/oip-web/src/components/ContactForm.tsx:11` — add `LiteralKit` to the existing schema import.
- `apps/oip-web/src/components/ContactForm.tsx:122` — remove `isSubmitting` and derive one `submitPhase` after `contactStatus` is known.
- `apps/oip-web/src/components/ContactForm.tsx:130` — replace the submitting/accepted conditional chain with exhaustive `ContactSubmitPhase.$match`.
- `apps/oip-web/src/components/ContactForm.tsx:135` — delete the `isRejected` coherence formula.
- `apps/oip-web/src/components/ContactForm.tsx:179` — disable the button with the schema-derived `submitting` guard.
- `apps/oip-web/src/components/ContactForm.tsx:180` — select button copy from the same `submitting` guard or a small exhaustive phase match.
- `apps/oip-web/src/components/ContactForm.tsx:196` — render rejection copy with the `rejected` guard.
- `apps/oip-web/src/contact/ContactSubmission.model.ts:97` — no change; reuse `ContactSubmissionStatus.Options` and its accepted/rejected literals as the source of truth.

No other source or test reads or writes the two local members.

## 6. Guard-deletion accounting

- `apps/oip-web/src/components/ContactForm.tsx:130` — delete the submitting-then-accepted conditional chain and replace it with an exhaustive phase match.
- `apps/oip-web/src/components/ContactForm.tsx:135` — delete `!isSubmitting && contactStatus === "rejected"`, the explicit runtime coherence guard preventing simultaneous submitting/rejected.
- `apps/oip-web/src/components/ContactForm.tsx:179`, `:180`, and `:196` — delete three reads spread across two booleans; all presentation branches consume the single phase.

There is no legacy normalizer or mutual-exclusion error.

## 7. Encoded-side impact

none (internal)

`ContactSubmitPhase` is a render-local projection. The HTTP response and page-query contract continue to use the existing `ContactSubmissionStatus` encoding unchanged.

## 8. Test impact

- `apps/oip-web/test/oip-web.test.tsx:552` — this is the only test rendering `ContactForm`; its timestamp-focus behavior should remain unchanged.
- No current test asserts submitting, accepted, or rejected UI. Add cases for all four phases, including the critical proof that waiting wins over a prior rejected status and cannot render the rejection copy simultaneously.

## 9. Risk & sequencing

Land after or alongside no other required change: the design reuses the already-exported `ContactSubmissionStatus` kit and changes only `ContactForm.tsx`. Keep `ContactSubmissionStatus` as the public HTTP/page status; `ContactSubmitPhase` is deliberately a larger UI-only domain and must not replace the boundary schema.
