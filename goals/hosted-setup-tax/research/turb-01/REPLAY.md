# TURB-01 slice 1: first-parent replay of the coverage scope planner

The exploration's replay (727 commits, "15-19% of PR runs") was not a repo artifact. This one is: the
corpus is rebuilt from this repository's history by
[`ops/turb-01-replay.ts`](../../ops/turb-01-replay.ts), and the receipt is
[`replay-5e09d90a6da.json`](./replay-5e09d90a6da.json).

## Method

- **Corpus:** the last 727 first-parent commits of `5e09d90a6da` (2026-10-27 to 2026-11-09), each with the
  files it changed against its first parent (`git log --first-parent -m --name-only`). Corpus text sha256
  `e7fe9480e6f4010cbe5de58f5b45e2d0379c973b792508cabecc3fdfe85b87ae`.
- **Planner:** the checkout's own `planCoverageAffectedScope` over the checkout's 202 workspace owners, run
  twice per commit. `after` plans the changed files as they are. `before` renames every file a
  generated-standards row maps to an unmapped standards path, which is what the planner did with it before
  the rows (the "no current workspace owner" fallback). Owners come from today's checkout, not each
  commit's tree; both variants share them, so the comparison isolates the rows.
- **Fail conditions (exit 1):** a commit whose plan changed was not `full` before; a commit that shrank had
  a full reason from a file no row maps; a commit that stayed `full` lost a reason other than a mapped
  file's.

## Result

```sh
bun goals/hosted-setup-tax/ops/turb-01-replay.ts --out goals/hosted-setup-tax/research/turb-01/replay-5e09d90a6da.json
```

| Measure | Commits |
| --- | --- |
| Replayed | 727 |
| Touch a mapped file | 227 |
| Full before the rows | 354 |
| Full after the rows | 287 |
| Shrink from full to owner-scoped | 67 (9.2% of commits, 18.9% of the full plans) |
| Shrink to noop | 0 |
| Violations | 0 |

The 67 commits whose only full trigger was a mapped file, by mapped file (a commit can count twice):
instrumentation catalog 43, JSDoc inventory 31, schema-first inventory 9, cache-qualification baseline 4.
The policy fingerprint and `fallow.boundaries.generated.jsonc` were never the only full trigger in this
window; their rows hold for the commits where they are. Median selection after the shrink is 2 packages
(40 of the 67 select at most 2); the widest is a repo-utils catalog regeneration at 392 owners and
dependents, where the commit's own source changes, not the row, set the scope.

## Caveats

- These are main first-parent commits (squash merges), not PR runs. A PR's changed-file set is its squash
  commit's, so the share carries over to PR heads only roughly; the certainty-scorecard conversion share
  (TURB-01 slice 2, ROUT-05 corpus) is the number acceptance reads.
- 9.2% sits next to the exploration skeptic's sample (about 8% fully convert), not the 15-19% figure.
