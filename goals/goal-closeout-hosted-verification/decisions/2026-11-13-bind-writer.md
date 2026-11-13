---
title: "set-status binds the final PR; a merged PR needs --adopt-merged"
date: 2026-11-13
lane: "feat/goal-closeout-hosted-verification"
reversal: "Restore adoptVerifiedCloseout and the status-only path, accept MERGED without the flag, and delete reopened final refs."
---

Agent decision (`research/design-pr-a.md` DN-17, DN-18). DN-17 is amended by orchestrator ruling 2026-11-12.

`goals set-status <slug> completed-retained [--final-pr N [--adopt-merged]]` is the only writer of `closeout`. It picks the final in this order:

1. A raw `proposedCloseout` key's own final, read from the raw manifest JSON so that it still works after the field leaves the schema. A conflicting `--final-pr` is refused.
2. `--final-pr N`: an OPEN PR binds. A MERGED PR binds only with `--adopt-merged`. A CLOSED PR is refused.
3. The checked-out branch's OPEN PR, from `gh pr view`.

Rules (2, OPEN) and (3) refuse when `completionGate.pullRequests` already names a different `final` that has merged, and they print the `--final-pr M --adopt-merged` form. Without a final, the command refuses: "publish first, then rerun". Any other `final` ref is demoted to `supporting`. A grandfathered packet gets a status-only flip. `--adopt-merged` without `--final-pr` is refused. `set-status` no longer reads completion receipts, and `adoptVerifiedCloseout` is deleted.

Once `proposedCloseout` is removed (S10), a raw `proposedCloseout` key in any manifest is a blocking doctor `manifest-invalid` finding that names `bun run beep goals set-status <slug> completed-retained` as the fix.

DN-18: reopening a committed closeout (to `active` or `paused`) deletes `closeout` and demotes its final ref to `supporting`.

Why: this closes the status-only bypass that #2985 and #3132 used. It also stops a later PR from closing a goal by naming an old merged PR, and stops a goals-only follow-up from becoming the final over a work PR that has already merged.

Reverse: restore `adoptVerifiedCloseout` and the status-only path, accept MERGED without the flag, and delete the reopened final ref instead of demoting it.
