# Attorney sitting of 2026-10-09

## Sitting and verdict provenance

The attorney and operator started the sitting at about 23:15Z on 2026-10-09.
An installation-preflight verdict precedes it at 23:05:24Z. The answer log was
locked at 2026-10-10T01:40:07.086Z with 16 answered questions. Its 66 rows are
revisions; the last row for each question supplies the final verdict.

The operator could not finish the review flow with the attorney. ChatGPT
computer use completed the last part for the operator after independent reads
of source documents and the recorded model runs. Verdict timestamps from
G-2 onward are after 01:07Z; the findings summary describes the later portion
as G-3 onward. These are assisted assessments of recorded answers, not 16
unassisted attorney evaluations. AC-6.1 and AC-6.2 were agent-selected checks.

The tally is 1 `pass`, 11 `right`, 1 `partly right`, 1 `wrong`, and 2 `no`.
The `no` verdicts confirm known defects. G-2's `wrong` records retrieval failure;
it does not show that the model retrieved the claims and analyzed them wrongly.
G-3 grades the earlier incomplete run even though a later retry improved it.

## Per-question results

| ID | Final verdict | Redacted finding | Defects |
| --- | --- | --- | --- |
| step1 | pass | Headless installation preflight passed. | none |
| G-1 | right | Family identification was correct; a continuation child was absent and document retrieval failed. | DF-1, DF-2, DF-7 |
| D-1 | no | Confirmed a cited prior-art number presented as the family's own filing or grant. | DF-1 |
| G-2 | wrong | Reviewer verified claims independently; the recorded model run could not retrieve them and listed an unrelated source. | DF-2 |
| G-3 | partly right | Recorded answer omitted rejection grounds and affected claims; a later retry read the text and recovered the grounds. | DF-3, UX-1 |
| D-2 | no | Confirmed an email filed under family A whose subject identifies family B; totals were not recounted. | DF-4 |
| G-4 | right | Text search found 23 hits; quoted prior art required ownership context hidden by default columns. | DF-5 |
| ML-1 | right | Resolved a unique client and counted 89 documents. | none |
| ML-2 | right | Returned one US entry shared by eight country dockets and disclosed the known attribution gap. | DF-7 |
| G-5 | right | Corrected the overlap arithmetic: 83 + 51 - 1 = 133; the first table showed 132. | DF-6 |
| ML-3 | right | Disclosed the cited-art warning. | DF-1 |
| ML-4 | right | Reported ambiguity across three clients and distinguished family totals from docket totals. | DF-7 |
| CL-1 | right | Distinguished 11 total documents from 10 attorney-filed documents. | none |
| CL-2 | right | Reported 51 ambiguous matches and ranked the first five. | none |
| AC-6.1 | right | Agent-selected check distinguished rejection grounds from applicant arguments. | DF-3 |
| AC-6.2 | right | Agent-selected check found a loose email by text search after email_search returned nothing. | DF-4 |

ML-1 through ML-4 and CL-1 through CL-2 replace identifying question IDs in
their order in the private answer log. The orchestrator must retain an explicit
alias map with the private archive. This lane leaves the read-only archive
unchanged and retains no identifying map inside the worktree.

## Defects and next owners

Severity is the closeout lane's triage assessment. P1 means a wrong ownership
claim, blocked retrieval, missing legal grounds, or an unusable evaluation flow.
P2 means a disclosed coverage gap or misleading default/count presentation.
The sitting remains closed while the owners repair these tracked follow-ups.

| ID | Severity | Finding | Next owner | Follow-up |
| --- | --- | --- | --- | --- |
| DF-1 | P1 | Cited prior art becomes family membership under mention-dominance. | Mention-dominance attribution owner | Require ownership evidence; retain citations as mention edges. |
| DF-2 | P1 | Document get/search and document provenance fail during the sitting. | Practice KG server owner; orchestrator for PC configuration | Apply the configuration recommendations, ship startup document-store probes, and reproduce any remaining failures. |
| DF-3 | P1 | Candidate extraction omits rejection grounds and affected claims. | Practice KG server / OA extraction owner | Separate examiner grounds from applicant assertions and original from amended numbering. |
| DF-4 | P1 | Folder filing is mistaken for matter association; email search misses a loose email. | Email index coverage and matter-attribution owners | Preserve conflicting subject evidence; reconcile loose-email and archive coverage. |
| DF-5 | P2 | Text-search defaults hide ownership columns and quoted-art context. | Tier/column defaults owner | Expose ownership and distinguish document ownership from quoted subject matter. |
| DF-6 | P2 | Count presentation subtracts overlap twice. | Practice KG server / eval presentation owner | Show raw counts, overlap and the deduplicated total. |
| DF-7 | P2 | A US entry is shared across eight country dockets. | Mention-dominance attribution owner | Keep family membership separate from country-docket membership and counts. |
| DF-8 | P2 | kg_find hides client; minimal family output truncates where balanced does not. | Tier/column defaults owner | Expose client identity and disclose truncation consistently. |
| UX-1 | P1 | The review app was too confusing to complete with the attorney. | Agent evaluation owner | Retire this app and its residual null-deck guard under S15; automate future evaluations. |

DF-2's per-call evidence and configuration recommendations are in
[the retrieval diagnosis](2026-10-09-retrieval-failure-diagnosis.md).

## S15 and phase closure

S15 closes this sitting as evidence and directs agents to run future attorney
evaluations. Agents ask through the practice tools, grade against expected
answers grounded in private source evidence, and raise only unresolved items
to the attorney. The review app and its residual null-deck guard are retired as
moot. This record does not claim a service shutdown or deletion on the PC.

P5 closes with correctness verdicts and a defect register. P8 closes with the
installed system's real-question evidence, this record and the reflection.
D-28 and D-29 replace the remaining person-only gate with the assisted sitting
and S15. Every packet phase is complete; the same PR records
`completed-retained`. Defects remain follow-ups, rather than new open phases.
The orchestrator still owns this PR's review, hosted checks and merge gate.

Any future attorney-facing unresolved item needs one question at a time, a
plain answer and only the needed sources with the relevant passage highlighted.
Distinguish examiner rejection from applicant response and incomplete answers
from retrieval failures. Confirm saved verdicts visibly. Keep duplicate sources,
known gaps and unrelated warnings in optional details, and preserve context
across sessions.

## Private evidence pointers

The archive root is
`~/data-home/oppold-corpus/ops/practice-kg/sitting-2026-10-09-pull/`.
`findings-full.md` is the private condensed findings ledger; `notes.md` holds
contemporaneous model notes. `transcripts/` is the sitting subset and
`transcripts-all/` is the wider transcript pull. `pc-logs/` holds extension
process logs, MCP lifecycle logs and the legacy server manifest. Keep all
source text, subjects, addresses, identifying question IDs and transcript
filenames in that private archive.

The immutable answer and lock evidence currently remains in
`~/data-home/oppold-corpus/ops/practice-kg/review-app-sitting/answers.jsonl`
and `locked.json`. The lane only read these files. No copied answer or lock
file was present at the pull root when inspected. The private S15 ruling is
in `~/.cache/beep/orchestrator/briefs/rsc/RULINGS.md`.
