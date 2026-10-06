---
"@beep/law-practice-use-cases": minor
"@beep/law-practice-server": minor
"@beep/docket-intake": minor
---

Docket intake reviews every item in a bounded loop instead of one pass. The
paralegal agent enters the message, the secretary agent reads the source for
itself and criticises the entry, and the paralegal revises or defends what is
disputed, until a confidence score reaches a threshold or the round limit is
hit. The score is `0.5 * M + 0.5 * A` behind a gate of deterministic checks:
`M` is "no P0 or P1 finding left", `A` is the share of independently read
fields that agree. A model's own confidence is recorded and never scored.

`@beep/law-practice-use-cases` adds the review models (`ReviewFinding`,
`DeterministicCheck`, `FieldAgreement`, `ExtractorFieldResponse`,
`ReviewDispute`, `ReviewRound`, `ReviewVerdict`, `DocketReviewConfig` and their
literal domains), the pure policy (`runDeterministicChecks`, `compareReadings`,
`scoreRound`, `terminalStatus`, `reviewDisputes`, `mergeRereading`,
`assessReviewRound`), and the ports `DocketParalegal.revise`,
`DocketSecretary.critique` and `DocketSecretary.reread`. `ParalegalDocketEntry`
gains `citedText`, `DocketSourceDocument` gains `text`, `DocketIntakeConfig`
gains `review`, and `DocketEntered` and `DocketNeedsReview` carry the review
verdict. An item the loop does not accept ends as `DocketNeedsReview` with the
reason `flagged-low-confidence`, `flagged-max-rounds` or
`deterministic-failure`: one entry in `Docket - needs review` whose subject
starts `[LOW CONFIDENCE]`, `[REVIEW LIMIT REACHED]` or `[CHECK FAILED]`, on the
earliest date either agent read, with no reminders. Each completed round is
saved in the message's ledger record before the next begins, so a restart
continues from the next round. Reminder entries now carry the Junk Email or
Deleted Items line as the other entries do.

The secretary reads a due date the source states outright for itself:
`SecretaryReview` gains `statedDueDate` and `citedText`, `stated-due-date` is
a compared field when either side read one, the citation checks also run on
the secretary's reading when it cites text (`DeterministicCheck.side`), and a
source whose stated date differs from its own mail date plus period gets a
code-written `P1` finding and an entry on the earlier date.

`@beep/law-practice-server` implements the three new agent calls, and the file
store now reports a state directory it cannot write its lock to as `store` /
`lock` instead of `state-locked`.

`@beep/docket-intake` reads `DOCKET_INTAKE_REVIEW_MAX_ROUNDS` (default `3`)
and `DOCKET_INTAKE_REVIEW_ACCEPT_THRESHOLD` (default `0.85`).
