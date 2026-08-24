# Opportunities Ledger

Friction receipts recorded at the moment they happen (repo law: friction is a
first-class output). Redacted per public-repo rules.

## 2026-08-24 — Generated-file merge treadmill on packet PRs

**What was happening:** landing PR #781 (`docs(goals): graduate
configurable-full-document-editor`), a docs-only packet PR that was fully green
(28 checks, Greptile 5/5, zero threads) on every attempt.

**Evidence:** `bun run beep yeet merge` failed three consecutive times with
`gh pr merge --squash --match-head-commit <sha>` reporting "not mergeable: the
merge commit cannot be cleanly created". Five packet PRs landed on `main` the
same night (#776, #777, #778/#780, #779, #782), and every one rewrites the
generated `goals/INDEX.md`; two graduations also edited adjacent
`explorations/ATLAS.md` regions. Each reconcile requires a merge commit, an
index/baseline regeneration, and a full `yeet verify` (~20 min), during which
the next packet PR landed and re-conflicted the branch. Merged only via a
bounded reconcile→verify→push→monitor→merge retry loop (attempt 2), roughly
2.5 hours wall-clock for a docs-only change.

**What would have prevented it:** any of (a) a merge queue so green PRs
serialize server-side instead of racing; (b) making `goals/INDEX.md` a
merge-driver/union-style regenerated artifact (or regenerating it in CI on
`main` post-merge) so packet PRs stop conflicting by construction; (c) a
cheaper re-proof tier for a base-merge whose only delta is regenerated
index/baseline files. The ATLAS conflict class additionally needs judgment
(entries move between sections on graduation), so (a) or (b) helps most.
