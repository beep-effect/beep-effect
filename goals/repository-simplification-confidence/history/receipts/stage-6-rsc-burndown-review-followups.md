# Burn-down review follow-ups

## RSC-BD-REVIEW-01 — separate append-only packet ledgers

Owner: repository-simplification-confidence program orchestration.
Source: PR #1605 discussion_r4236106593 (P2).
The current brief explicitly requires union merging the whole SPEC and friction
ledger. This avoids losing independent lane receipts, but union merging edited
normative prose can duplicate or interleave content without a conflict marker.
Retain the requested behavior for this repair. Follow-up acceptance: move the
append-only decision ledger to its own file, limit union attributes to those
ledgers, and prove concurrent normative-prose edits remain conflicted while
independent append-only entries are preserved. Removing the two union
attributes reverses the current choice.

## RSC-BD-REVIEW-02 — scanner boundary when scratchpad code is promoted

Owner: scratchpad porting lane / repository quality policy.
Source: PR #1605 discussion_r4236106598 (P2).
The current brief prefers excluding scratchpad because it is an unshipped lab.
That intentionally excludes future lab code too. Retain this boundary for the
inherited fixture false-positive repair. Follow-up acceptance: before lab code
is promoted into a supported product/package, remove the blanket exclusion and
replace it with fixture-path or exact rule-specific annotations; prove the
key/XSS controls remain excluded and an actual introduced vulnerability in
promoted code fails SAST. Removing scratchpad/ from .semgrepignore reverses the
current boundary and restores scanning of the lab.
