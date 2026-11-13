---
title: "Open PRs ready at content-final; drafts opt-in and cheap-tier only"
date: 2026-11-13
lane: "feat/yeet-open-ready-at-final"
reversal: "restore draft default in publish/open and the AGENTS.md bullets"
---

Operator ruling 2026-11-13. A draft labelled ready-for-heavy ran the heavy matrix on every work-in-progress push: about 70 hosted jobs a run against a cap of 60, so draft pushes took runners from final PRs and delayed check results on main, and the review window started only at a later flip that sessions forgot.

yeet publish and yeet open now open the pull request ready for review, labelled ready-for-heavy, and only when the head carries a passing yeet final-check receipt. The rule is the one yeet ready enforces at a flip (ReadyGate requireFinalCheck, with the ancestor refresh carry), asked before the push so a refusal leaves nothing on the remote. A branch whose pull request is already open is a fix push and needs no receipt to push; the push restarts the review window as before.

Drafts are opt-in with --draft. A draft carries no ready-for-heavy label, so it gets the cheap hosted tier only; yeet ready applies the label when it flips the draft, and repairs a ready pull request that lacks it. The open mode is a three-value domain (ready, draft, draft-heavy). Yeet chooses draft-heavy itself in two cases a receipt cannot cover: a stack layer, which must exist before its parent merges, and a worker compute profile, whose final-check gates are hosted-only and so cannot pass before hosted CI has run.

yeet open keeps its role as the route with no cheap gate, and can no longer bypass final-check: it needs the same receipt, where each gate constrained compute could not run is a recorded yeet final-check --skip gate=reason. The pull request body gets a Final check section naming the gates that ran and each skip, so the body records them without a hand-written list.

No workflow file changed: heavy admission is decided by the label alone (heavy-admit.yml, check.yml admission job). The review window already anchors on the open of a pull request that was never a draft (ReviewWindow pr-opened anchor, covered by yeet-review-window tests).
