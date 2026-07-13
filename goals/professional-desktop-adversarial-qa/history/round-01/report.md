# Round 01 — adversarial review and fix (2026-07-12)

## Reviewers

Ten codex `gpt-5.6-sol` (effort `medium`) lanes: four read-only code reviews
(editor, chat + codec, sync/intake, ontology) run in parallel, then six browser
lanes driven serially through the Chrome extension against the live app with
real Anthropic and real Box.

**53 findings** (1 P0, 21 P1, rest P2/P3), full inventory in
`../../ledgers/findings.md`, lane reports beside this file, screenshots in
`screenshots/`.

## What the reviewers caught that mattered

The two lanes that paid for themselves were the ones with *live repros*:

- **Edit → Rewrite never actually rewrote.** The banner promised the thread
  would be rewritten from that point; the transcript hid the tail only while the
  replacement streamed, then brought it straight back — and the model was being
  handed the replaced tail as history, answering the wording the user had just
  discarded. Fixed by projecting the timeline to its active branch and reading
  the conversation through that projection in both the renderer and the model
  history. Verified live: after editing turn 2 of 3, the transcript is
  `ONE → TWO-EDITED` and stays that way across a hard reload.
- **Real Box sync had never worked.** (Found in round 00.) The Box SDK
  materializes absent response fields as present-but-undefined keys; the
  generated exact-optional schemas rejected every final-page listing, the
  mirror-root probe failed, and the panel reported an honest-looking
  "disconnected". Fixed in the driver; the full intake → LLM filing → Box sync
  path now runs end to end (8 items synced, 0 errors).

Other confirmed defects fixed this round include: a stale typeahead flag that
could silently disable Enter-to-send forever; block toggles that nested a code
block inside a quote because they read a React snapshot instead of the editor;
concurrent ontology mutations silently discarding each other's edits (the P0);
a SPARQL `LIMIT` guard that a comment could defeat, removing the bound on
materialization; sync passes that could requeue each other's in-flight uploads;
a conflict "review" that hid the row but left the item conflicted forever;
document intake with no size limit at all; `javascript:`/`file:` URLs from the
model becoming clickable links; and every thread row stamped with its entity id,
so the sidebar dated every conversation "Dec 31".

## Numbers

- 39 findings fixed, verified, and committed across 9 commits.
- 3 findings moved to the backlog with rationale (see `../../ledgers/backlog.md`)
  — notably, the reviewer's proposed fix for detached assistant turns would have
  *deleted* the user turn under the new supersedes semantics, so it needs a
  distinct field rather than the patch as written.
- 14 findings still open (see ledger) — the largest cluster is turn-run state:
  post-Stop causality, mid-stream reload orphaning a turn, two-tab concurrent
  send, and composer lock-out after a refresh failure. These share one root
  (there is no persisted per-run identity/state) and want a single coherent fix,
  not four patches.

## Regression tests added

Each guards a defect that was live in the app, and each was mutation-tested
(reverted the fix, watched the test fail):

- Box: responses whose absent optional fields are present-but-undefined keys.
- SPARQL: a `LIMIT` in a comment, and a `LIMIT` bounding only a subquery.
- ThreadStore: rows stamped from the clock; a rename advances `updatedAt`
  without restamping `createdAt`.
- Timeline: a replacement drops the turn it replaces and everything after it.
- Ontology: Add Triple accepts the hash IRIs RDF vocabularies are built from
  (the first attempt at this fix used `AbsoluteIRI`, which forbids fragments,
  and disabled Apply for every realistic term — caught by live verification).

## Process notes

- I began fixing while lane F was still driving the browser; it observed a
  source change mid-run. Round 2 freezes the tree for the whole review wave.
- A stale tab held across a sidecar restart shows "Sync status is unavailable"
  and never retries — logged as F-001-52 rather than dismissed as environmental.
- The codex Chrome extension cannot select files from disk, so intake was
  exercised by constructing `File` objects in-page against the real input; the
  OS chooser dialog itself is the only thing not covered.
