# Waiver ledger

Items deliberately not fixed during the campaign. Reviewed async by the user;
**a veto moves the item back to the fix queue and re-opens the loop.**
Waived items do not block convergence.

## Pre-waived (campaign start, user-approved 2026-07-11)

Known v1 feature gaps — implementing them is feature work, not QA fixing.
Their UX **while stubbed** remains in scope (misleading affordances, missing
"not wired yet" signals, broken adjacent states are all fixable findings).

| id | item | scope note | user verdict |
|---|---|---|---|
| WV-001 | Attachment send transport — attachments are captured/previewed but never sent (`onAttach` toasts "isn't wired yet", `apps/professional-desktop/src/chat/ui/Composer.tsx`) | Capture UX, validation, chip strip, revocation all in scope | pre-waived |
| WV-002 | Real mention sources — `@` mentions are a static 3-item set serializing to plain text (`Composer.tsx:64`, by design in v1) | Typeahead UX, ARIA, positioning, async-staleness handling in scope | pre-waived |
| WV-003 | Version selector interaction — `turn-versions` renders literal text `versions`, no interaction | Its visual presentation as a non-affordance in scope | pre-waived |

## Campaign waivers (taste/out-of-scope items, added per round)

| id | round | item | why waived | user verdict |
|---|---|---|---|---|
