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

## 2026-10-14 — an operator mail went out from the attorney's mailbox

- **Doing:** sending the round-1 questions, meant to come from the operator, through the outbox MCP.
- **Evidence:** the outbox server is configured for one mailbox, the attorney's, so the message went
  from the attorney to the attorney. The server's instructions name a single configured mailbox but
  no step stated which one before the send.
- **Would have prevented it:** state the sending mailbox before any outbox send, and send operator
  mail through the delegated (signed-in user) connector instead of the outbox.

## 2026-10-14 — GitHub's GraphQL burst limit blocked ready and reply for about 20 minutes

- **Doing:** flipping PRs ready and answering review threads across several open lane PRs.
- **Evidence:** `gh pr ready` and `bun run beep yeet reply` failed with `GraphQL: API rate limit
  already exceeded` for about 20 minutes while REST calls (`gh api repos/<o>/<r>/pulls/<n>`) kept
  working.
- **Would have prevented it:** REST fallbacks for the ready flip and thread replies, or one shared
  poller per workstation instead of a GraphQL poll per session.

## 2026-10-14 — a fresh lane started behind origin/main and could not run the quick verify

- **Doing:** opening lanes with `bun run beep worktree new`.
- **Evidence:** the new lane is based on the clone's local `main`, not `origin/main`, so each lane
  needed a `git reset --hard origin/main` after creation. In a fresh lane,
  `bun run beep quality package-verify <pkg> --quick` failed on missing dependency dists; the turbo
  check task (which builds dependencies first) passed.
- **Would have prevented it:** base new lanes on `origin/main` after a fetch, and have the quick
  verify build dependency dists (or route through the turbo check task).

## 2026-10-14 — sweep refused a lane whose PR was opened over REST

- **Doing:** retiring a lane after its PR merged, with `bun run beep yeet sweep --retire`.
- **Evidence:** the PR had been opened over REST during the GraphQL rate limit, so no PR lease was
  recorded, and the sweep refused with "no pull request was observed".
- **Would have prevented it:** record the PR lease from the REST create response, the same as from
  the `yeet publish` path.
