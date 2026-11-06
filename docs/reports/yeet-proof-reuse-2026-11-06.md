# Avoiding repeated Yeet work, 2026-11-06

## Resume completed final-check steps

A late failure or interruption previously lost the earlier final-check step
results: only the complete receipt was durable. Every successful reusable step
now records an existing lane proof immediately. `yeet final-check --resume` can
reuse it only when source tree, head, base, command and environment still match.
Without `--resume`, commands execute again and refresh successful step proofs.

This uses `LaneProofReuse` and its atomic write and before/after identity checks.
It does not create another cache protocol. The final-check command still refuses
a dirty or moved checkout, reruns expectation rewrites, and requires the complete
head-pinned final receipt before ready. Cheap composite gates and Repo Sanity
always execute because they can contain checks of changing external state. Failed
commands and explicit skips do not create reusable successes.

Real-Git regression controls demonstrate reuse before a final receipt exists,
retention of an earlier success after a later failure, failure replay, and
invalidation after command/environment, untracked source, head or base changes.
These controls establish avoided command executions, not an end-to-end time gain.

## Retry a publication without reinstalling the same head

Ordinary preflight retries now consult the existing clean-install receipt. A valid
receipt avoids creating, installing and deleting another disposable checkout.
The exact commit/tree, manifest and lockfile hashes, Bun/host identity and existing
four-hour expiry still govern reuse. Reuse does not extend that expiry. A missing,
changed, malformed or expired receipt runs the normal clean installation; a failed
installation still clears the old receipt. Mutable dependency directories are
never shared as proof.

The regression performs a real clean install, replays the preflight and checks the
unchanged receipt and reuse result, then commits a broken lockfile and verifies a
real failure with the receipt removed. Existing input and expiry controls remain.

## One remote monitor per PR

The Yeet monitoring reference now tells agents to wait on the existing monitor
and consume its fresh, matching-head status artifact. A stale snapshot is not
current readiness. New failure logs, review threads and the final merge gate
still require targeted live reads. This replaces overlapping polling paths; no
unmeasured token or API percentage saving is claimed.

## Validation and reversal

The focused proof/final-check suite passed 45 tests. Full CLI package verification
passed (audit 186.8s, docgen 43.8s), including lint and test type checking after the
new controls. Hosted proof and operational before/after timings remain pending.

Reversal removes `--resume` and the preflight receipt fast path, returning to
fresh execution. Existing receipt files remain safe to ignore; no migration or
persistent dependency cache cleanup is required.
