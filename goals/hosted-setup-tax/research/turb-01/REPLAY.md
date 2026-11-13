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
window; their rows hold for the commits where they are. The receipt lists each shrunk commit's
`selectedPackages` and `dependentPackages` as the planner emits them. In 25 commits a directly changed owner
is also a dependent of another changed seed, so it appears in both lists; consumers take their union
(`CoverageRegression.ts`). Counted as unique packages, the median shrunk commit selects 2 (40 of the 67
select at most 2). The widest is a repo-utils catalog regeneration at 197 packages, where the commit's own
source changes, not the row, set the scope.

## Caveats

- These are main first-parent commits (squash merges), not PR runs. A PR's changed-file set is its squash
  commit's, so the share carries over to PR heads only roughly; the certainty-scorecard conversion share
  (TURB-01 slice 2, ROUT-05 corpus) is the number acceptance reads.
- 9.2% sits next to the exploration skeptic's sample (about 8% fully convert), not the 15-19% figure.

# TURB-01 slice 1b: the remaining "no current workspace owner" paths

Slice 1b gives scanned owner rows to the paths the 2026-11-13 full-fallback census still found on the
"no current workspace owner" fallback: the skill tree (`.claude/skills/**`) and `skills-lock.json`, the
harness ledger (`harness-ledger/**`), `biome.identity.jsonc`, `standards/check-census.regression-baseline.jsonc`
and `standards/root-package.projection.generated.json`. The replay is
[`ops/turb-01b-replay.ts`](../../ops/turb-01b-replay.ts); the receipt is
[`replay-1b-98c2decbdb3.json`](./replay-1b-98c2decbdb3.json).

## Method

- **Corpus:** the last 1000 first-parent commits of `98c2decbdb3` (2026-10-23 to 2026-11-13), rebuilt from
  git as in slice 1. Corpus text sha256 `9503e419cf29c87a91083be03df558f68590a8c6634fc8309b2db17ba964e30d`.
- **Planners:** `before` is `CoverageScope.ts` exactly as it stood at `98c2decbdb3` (written beside the current
  module for the run, so it keeps its own hand-written rows); `after` is this slice's. Both plan over today's
  203 workspace owners. Slice 1 renamed mapped files instead; that cannot reproduce a file that already had a
  narrower hand-written row, and three skill files had one.
- **Partitions:** the Test Unit partitions the coverage planner's selection alone allocates
  (`plannedCiLanePartitions`, 24 for a full run). Turbo's `--affected` selection can add more on a real run.
- **Fail conditions (exit 1):** a commit that shrank had a full reason other than a newly mapped file's; a
  commit that stayed full lost or gained any other reason; a commit that was not full changed without a newly
  mapped file, became full, or lost a selected package.

## Result

```sh
bun goals/hosted-setup-tax/ops/turb-01b-replay.ts --out goals/hosted-setup-tax/research/turb-01/replay-1b-98c2decbdb3.json
```

| Measure | Commits |
| --- | --- |
| Replayed | 1000 |
| Touch a newly mapped file | 103 |
| Full before the rows | 409 |
| Full after the rows | 369 |
| Shrink from full to owner-scoped | 40 (4.0% of commits, 9.8% of the full plans) |
| Shrink to noop | 0 |
| Stay full, fewer reasons | 59 |
| Widened (not full before, more packages after) | 2 |
| Violations | 0 |

The 40 shrunk commits by newly mapped path (a commit can count twice): skill tree 29, `skills-lock.json` 9,
`biome.identity.jsonc` 6, check-census baseline 2, root-package projection 1, harness ledger 1. Planner-only
partitions after the shrink: 13 in 27 commits (the skill tree's seven readers), 9 in 5 (repo-cli alone), 10 to
14 in 4, and 22 or 24 in 4 whose own source changes span the matrix: 424 of the 960 partitions those commits
allocated before.

The 2 widened commits each changed one skill file that already had a hand-written row (`29ccc707fa9`,
`.claude/skills/yeet/SKILL.md`, 10 to 13 partitions; `2096258857f`,
`.claude/skills/yeet/references/gates-and-proof.md`, 9 to 13). The skill tree's scanned readers now apply to
every file in it, these two included.

## Caveats

- `standards/root-package.projection.generated.json` is a Turbo global input (`turbo.json` `global.inputs`), so
  Turbo's own `--affected` still selects every test package when it changes: the one commit counted here
  (`0729e466e20`) shrinks in the coverage planner only. Its row is still the scan's honest result.
- The skill tree's row scans for the `.claude` segment, not the tree's basename `skills`: both are sound
  supersets of the tree's readers, and `skills` also matches a schema.org term, an HTML id and a CLI
  subcommand (15 owners and 15 partitions against 7 owners and 13 partitions).
- The same main-commit caveat as slice 1 applies; the full-fallback census of 2026-11-13 (PR runs) put the
  class-only counterfactual for these paths at 9 runs and 120 of 1,128 full-matrix shard jobs.
