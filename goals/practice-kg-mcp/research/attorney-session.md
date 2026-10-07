# Attorney session — AC-6 and the G-1..G-5 correctness calls

One sitting with the attorney at his PC, run by the operator. It closes P5
(acceptance evidence) and P8 (hand-off): every remaining item needs a person.
Allow 45 minutes. Record answers in `history/p8/<date>-attorney-session.md`
with counts and his verdicts only; quote no client documents.

## Before the session (operator, from the workstation)

1. Confirm the install over SSH with Claude Desktop closed:
   `practice-kg-mcp.exe --self-check --bundle-dir <bundle folder>` prints one
   line with `"ok":true`, the installed bundle version (`2026-10-07-04` once
   the P11 swap has run, `2026-10-07-01` before) and its `nodes` count. Note
   both. Then relaunch Claude Desktop.
2. Choose the five placeholders with the attorney's own matters, using the
   selection guidance in `research/acceptance-gauntlet.md` (bottom section).
   Write them on paper, not in the repo.

## 1. In-chat install check (2 minutes)

In a new Claude Desktop chat: "Call kg_provenance with no arguments." Pass:
the reply names the bundle version from step 1, the same number of rows as
the `nodes` count from step 1, and lists the knowledge-graph tools. Fail: the tools are missing or the call errors — stop
and send the error text to the practice-KG session.

## 2. The five gauntlet questions (25 minutes)

Ask each question in his own words, substituting the chosen placeholders. For
each, he gives one verdict: **right**, **partly right** (say what is missing or
wrong), or **wrong**. Also note whether the answer showed its sources.

| # | Question shape | What he checks |
| --- | --- | --- |
| G-1 | Everything on family FAMILY: applications, grants, USPTO status | Every application and patent of the family is listed and none from another client's family with the same number |
| G-2 | Patents A and B side by side: compare claims | The claims shown are the right patents' claims |
| G-3 | What did the examiner reject in FAMILY's office action, and where | The answer is labelled `candidate — unreviewed` and the cited span says what the answer claims |
| G-4 | Which matters ever dealt with TECHNICAL-TERM | No obvious matter is missing; none listed is wrong |
| G-5 | Correspondence with PERSON between DATE-A and DATE-B | The messages are the right ones; the matter linkage note is present |

## 3. Two checks added since the gauntlet was written (8 minutes)

- **Matter lookup.** Give him three references from today's mail (a docket
  number, an application number, a client-keyed docket). For each, ask
  "which matter is this?" and get his verdict on the answer. A reply of
  "several candidates" or "none" is correct when it is honest; it is wrong only
  if it names a single wrong matter.
- **Correspondent lookup.** Pick two senders he writes to often: one person
  who works on one matter, and one foreign associate who works on many. Ask
  "which matters does ADDRESS write about?" The first should resolve to one
  matter; the second must come back as a ranked list, never one matter.

## 4. AC-6 — his own questions (10 minutes)

Ask: "What would you ask this tomorrow morning?" Capture up to ten questions
verbatim on paper, then try two of them live. Record in the history file only
the question type (for example "deadline for family", "who is the examiner"),
whether it answered, and his verdict — not the client names in them. These
become the post-week backlog (SPEC AC-6).

## After the session

- Write the history file and update `ops/manifest.json` (P5 and P8 complete if
  every G verdict is right or partly right with an accepted follow-up).
- Anything **wrong** becomes a defect row in `SPEC.md` with the question type,
  the tool path, and the fix owner.
