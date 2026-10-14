# Opportunities & friction receipts

Two receipts from the opening sitting were appended to the predecessor's ledger on 2026-10-13 and
stay there: attorney markup PDFs arriving through the connector as text only, and the USPTO Guide
sitting behind bot walls (`goals/design-figure-generation/research/OPPORTUNITIES.md`).

## 2026-10-13 — a judge P1 on claim scope was overridden by an agent ruling

- **Doing:** reading the predecessor's live judge rounds against the attorney's round-1 markup.
- **Evidence:** live judge round 2 raised the missing interior fastening features as P1 (R2-01 in the
  `goals/design-figure-generation/history/live-matter/evidence.json`). On 2026-10-06 the predecessor's Decision Log
  left them out "as unclaimed". The same day's reflection carried a codification TODO to route
  claim-scope findings to the attorney as questions, but the drawing judge prompt never gained that
  rule. One of the attorney's requests (F5) was to show them.
- **Would have prevented it:** the claim-scope rule in the judge prompt and a review-loop
  disposition (`clarify`) that sends the question to the attorney instead of a Decision Log row.
  PR-G lands both.

## 2026-10-13 — the reviewed set was not the signable set

- **Doing:** matching the attorney's eight markup pages to the sheets that were sent.
- **Evidence:** raster ink coverage matched the markup to the unshaded set (PDF sha256 prefix
  17e086a2, FIG 1 coverage 1.0), not the shaded set the sign-off flow names (227efb7a, coverage
  0.29). Several shading comments were therefore about a set that carried no shading at all. No
  record said which set had gone out.
- **Would have prevented it:** a delivery record written when the outbox draft is created
  (message id, attachment sha256 values, sheet-set hash) and a review round keyed to that hash.
  PR-G adds `DeliveryRecord` and `ReviewRound.reviewedSheetSetSha256`.
