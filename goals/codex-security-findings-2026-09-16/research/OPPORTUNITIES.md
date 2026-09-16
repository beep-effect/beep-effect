# Execution friction receipts

## 2026-09-16: stale corpus citation lines

The September 8 packet verification command ran 84 tests: 82 passed and two
failed with `source citation anchor differs in current tree`. Checking the
same citations against committed HEAD reproduced the mismatches, so this is
inherited drift. The anchors still exist, but subsequent source edits moved
their line numbers. A citation refresh receipt that preserves capture provenance
would prevent unrelated source movement from blocking security closeout.

## 2026-09-16: dashboard authentication

The findings list redirects to ChatGPT login. Local CSV ingestion and code
verification can continue; exact-ID status verification needs the operator's
signed-in browser session. No credentials were accessed. The session became
available during full-proof preparation; the list showed the four captured
findings still open.

The citation relocation changed three manifests by a few bytes, so their
`bytes_emitted` totals also needed reconciliation. All five full pin verifiers
then reported verified unchanged. No raw payload or generator was modified.

## 2026-09-16: repair scope

`bun run beep yeet repair` reported inherited terse-effect candidates in ten
files outside the remediation and rewrote one unrelated Worktree helper.
The rewrite was reviewed and restored to HEAD. Scoping safe rewrites to the
reviewed change set would prevent unrelated edits during security closeout.
The affected CLI package audit and docgen passed before this repair pass.

## 2026-09-16: full-proof admission

The full Yeet proof queued behind other active checkouts under the shared
memory budget. Admission repeatedly reported an undecodable lease. No other
checkout process or lease was manually changed; the canonical scheduler owns
admission and quarantine.

## 2026-09-16: pre-commit proof and log volume

The full dirty-tree proof's commit-range SAST and secrets lanes saw zero
branch commits. The publish proof must cover the actual committed change;
the empty-range passes are not remediation evidence.

The lint-policy medium group passed 154 tasks but replayed several megabytes
of output. Compact task totals plus retained per-lane logs would make failure
attribution easier without weakening any gate.

The coverage planner reported a full fallback because the shared Effect Vitest
inventory has no workspace owner. A reviewed fingerprint-only inventory update
therefore expands this CLI remediation to ten repository-wide coverage shards.
An ownership-aware inventory impact rule could retain proof coverage with less
repeated work; the current gate was left unchanged and run as selected.
