# W1 lever query: change-event backfill

Goal `goals/ciops-ontology-pipeline`, phase P0, workstream W1. Census, classification and
final write on 2026-10-05 at HEAD `8b7392fe00`, over the first-parent history of `main`.

## Purpose

`explorations/beep-ci-operational-ontology/research/control-interventions.yaml` holds the
partition points of the KPI series (CQ-016). Before W1 it had three rows: iv-870, iv-929 and
iv-1006. Graduation Ruling 6 requires the rest to come from a reproducible query, not a
hand-picked list, so that no KPI reading crosses an untagged lever. This page records:

- the admission criterion and the rulings that shaped it;
- the query, its path families and the exact commands;
- the census and the verdict counts for all three passes;
- the verification protocol;
- what the query does not sweep, and its known limits;
- every census PR that did not become a row (appendix).

The rows stay seed data. `OperationalChangeEvent` and `ciops:landedAt` are ratified at auditor
run 4 through a Queue-G intake row, not by this page.

## Admission criterion

Graduation Ruling 6 (`explorations/beep-ci-operational-ontology/DECISIONS.md:1444-1451`), as
amended by P0 Ruling 2 (`goals/ciops-ontology-pipeline/research/decisions.md`, "2026-10-05 —
P0 sitting"):

> a row records a change to admission, ordering, gate selection or early stop, Turbo/cache task
> inputs, or lane assembly or sharding on any tier, plus hosted-runner capacity on the hosted
> tier; instrumentation-only and shadow-only changes are excluded.

The rulings that apply:

- **Graduation Ruling 6** set the criterion with "on the local tiers" where the amended text
  says "on any tier". The first pass was judged against that text.
- **P0 Ruling 2** amended the hosted clause. Hosted admission, gating, lane assembly and
  sharding qualify on the hosted tier, and hosted-runner capacity stays the hosted tier's own
  lever. Rows partition only their own tier's series.
- **P0 Ruling 3** ruled on the first pass's contested local rows, and ruled that a new check
  step inside an existing lane is gate selection, because it adds a predicate that can turn the
  lane red.
- **P0 Ruling 4** gave #1068 and #1269 their own rows, rewrote the third iv-1006 caveat as a
  cross-reference list, and ratified `mechanismChanged` as a scalar over a closed vocabulary.
  Co-mechanisms that land at the same instant go in a `CONFOUNDED` caveat, and caveat prose
  never becomes a CQ-016 partition point.
- **P0 Ruling 5** widened the path families, added the merge-subject PR parse, and ordered the
  second pass.
- **P0 Ruling 6** set `landedAt` for hosted-capacity changes applied outside the repository
  (see Landing instants).
- **P0 Ruling 7** decided the second pass's contested PRs, added `.envrc` and the
  `:(glob)**/docgen.json` pathspec to the families, and ordered a bounded third pass over the
  PRs the extension surfaced, three pass-1 re-reviews and the one commit with no PR.

Working definitions used by every classifier and refuter:

- **Instrumentation-only:** journaling, ledgers, telemetry, census, evidence, reports, status
  output, docs, tests, refactors, dependency bumps, and type or lint migrations that change no
  decision a mechanism makes.
- **Shadow-only:** time-to-certainty C4.1 shadow proof reuse with reuse off. Facts are written
  but never acted on.

## Mechanism vocabulary

| `mechanismChanged` | Meaning |
| --- | --- |
| `admission` | Who is admitted to run work and when, against what capacity: tickets, leases, token weights, origin locks, the shared runtime root, the Heavy Admission verdict, the re-dispatch of jobs lost to a dead runner. |
| `ordering` | The order lanes run in within a wave or the cost-ordered ladder: seed rows, comparator, ranks. |
| `gate-selection` | A predicate that decides whether a gate runs, or what it can fail on, for a change set: affected scoping, skip verdicts, a check step added inside a lane (P0 Ruling 3). |
| `early-stop` | The rule that stops scheduling after a red. No W1 row uses it as the primary value. |
| `turbo-cache-inputs` | What a cached task's identity covers and when a stored result replays: inputs, env, dependsOn, cache on or off, the remote-read posture, the shared cache directory and the lane-proof store key. It is the only cache value in the closed set. |
| `lane-assembly` | Which lanes or steps a tier assembles, including chunk bounds and which workflow hosts a job. |
| `sharding` | How one lane's work splits into parallel units. |
| `hosted-runner-capacity` | The supply of hosted runners: pool size, purchase model, allocation strategy, instance pools. Re-dispatching jobs lost mid-run onto the same pool is hosted admission (iv-1384), not supply. |

## Path families

These are the families in `goals/ciops-ontology-pipeline/research/scripts/w1_lever_query.sh`,
in the script's order and with the script's paths:

| Family | Paths |
| --- | --- |
| `scheduler-admission` | `packages/tooling/tool/cli/src/internal/repo-run`, `scripts/systemd` |
| `turbo-cache` | `:(glob)**/turbo.json`, `.envrc`, `packages/tooling/tool/cli/src/commands/Cache`, `.github/workflows/cache-warm.yml`, `packages/tooling/tool/cli/src/internal/cli/TurboCache.ts`, `packages/tooling/tool/cli/src/internal/cli/EnvConfig.ts`, `standards/cache-qualification.json`, `standards/turbo-remote-cache.md`, `packages/tooling/policy-pack/repo-configs/src/cache`, `scripts/enable-turbo-remote-reads.sh`, `infra/src/CiTurboCache.ts`, `infra/lambda/turbo-cache` |
| `lane-assembly` | `:(glob)**/docgen.json`, `packages/tooling/tool/cli/src/commands/Yeet`, `packages/tooling/tool/cli/src/commands/Quality`, `packages/tooling/tool/cli/src/commands/Ci`, `packages/tooling/tool/cli/src/commands/Lint`, `packages/tooling/tool/cli/src/commands/Docgen/internal`, `packages/tooling/tool/cli/src/internal/package-scripts`, `standards/lint-policy.sweeps.jsonc`, `vitest.shared.ts`, `.github/workflows/check.yml`, `.github/workflows/heavy.yml`, `.github/workflows/heavy-admit.yml`, `.github/actions/setup-monorepo-ci`, `scripts/ci-change-profile.sh`, `scripts/ci-job-env.mjs` |
| `hosted-runner` | `packages/tooling/tool/cli/src/commands/Runners`, `infra/src/CiFleetController.ts`, `infra/src/CiRunners.ts`, `infra/src/internal/ci-runners-entry.ts`, `infra/ci-runners/Pulumi.production.yaml`, `infra/ci-runners/Pulumi.yaml`, `infra/ci-runners/runner-image.json`, `scripts/ci-runner-resources.sh`, `docs/runbooks/ci-runner-reliability.md`, `docs/runbooks/aws-cost-operations.md`, `.github/workflows/fleet-lane-probe.yml`, `.github/workflows/fleet-shadow-check.yml`, `.github/workflows/rerun-runner-loss.yml`, `.github/workflows/heavy.yml`, `.github/workflows/heavy-admit.yml`, `.github/workflows/check.yml` |
| `package-scripts` | a probe, not a path list: `git log -G` over task-facing script-entry lines in every `package.json` (`:(glob)**/package.json`); the regex matches a changed line whose key is `beep:*`, any Turbo task name at `8b7392fe00` (`audit`, `build`, `check`, `codegen`, `coverage`, `docgen`, `doctest`, `lint`, `package-test-typecheck`, `storybook`, `test`, `transit`), `typecheck` or `proof`, with or without a `:sub` suffix |

`check.yml`, `heavy.yml` and `heavy-admit.yml` belong to both `lane-assembly` and
`hosted-runner`.

`:(glob)**/turbo.json` and `:(glob)**/docgen.json` are git pathspecs, so `git log` matches them
against each commit's changed paths and reaches every such file a commit added, edited or
deleted, including the `apps/labs/api-docs/docgen.json` that #1080 deleted. At `8b7392fe00` they
match 16 tracked `turbo.json` files (the root file, six app files, `infra/turbo.json`, seven
package files and one test fixture) and 132 tracked `docgen.json` files; a `turbo.json` deleted
earlier in the window would still be found (none was, so the pathspec census equals the earlier
`git ls-files` census at this commit; PR #1424 review). The script runs under `set -f` so the
shell never expands them. `.envrc` is one tracked file; it exports `TURBO_CACHE_DIR`, which
decides which shells share the local Turbo cache store.

The `package-scripts` family is a probe (PR #1424 review): workspace `package.json` scripts
assemble what a Turbo task runs, so a commit enters the census when it adds or removes a
script-entry line of a task-facing script in any `package.json`. The probe reaches a PR that
edits scripts without touching their generator (`internal/package-scripts`); at `8b7392fe00` it
lists 21 PRs, 18 of them already in the other families and three new (#872, #911, #936).

The first pass used four narrower families: `internal/repo-run`; the root and four app
`turbo.json` files, `commands/Cache` and `cache-warm.yml`; `commands/{Yeet,Quality,Ci}` with
`check.yml`, `heavy.yml` and `heavy-admit.yml`; and `commands/Runners` with the fleet-probe,
shadow-check and runner-loss workflows plus the three CI workflows. It missed the fleet infra
that sets hosted capacity (#1050, #1141, #1364), package `turbo.json` files, the cache-plan
code, `commands/Lint`, `commands/Docgen/internal`, `vitest.shared.ts` and `scripts/systemd`
(P0 Ruling 5). The second pass's families lacked `.envrc` and the `docgen.json` pathspec, so
they missed #1080 and #1254 (P0 Ruling 7).

### Deliberately not swept

- **Script bodies under other keys.** The `package-scripts` probe keys on task-facing script
  names (every Turbo task name at `8b7392fe00` plus `beep:*`, `typecheck` and `proof`); a
  `package.json` edit to a script whose key is outside that list (for example `dev`) does not
  enter the census through the probe, and a Turbo task added later needs the list extended. The generator
  `internal/package-scripts` (`bun run beep lint package-scripts --write`) stays in
  `lane-assembly` (P0 Ruling 5), so a generator change that rewrites many manifests is still
  reached that way.
- **Two change paths outside the repository.** Both act on AWS fleet state, and the runner
  runbooks (`docs/runbooks/ci-runner-reliability.md`, `docs/runbooks/aws-cost-operations.md`,
  both in `hosted-runner`) are their only record:
  - live edits to the fleet (scale-up Lambda environment and reserved concurrency, queue
    mappings, burst caps), such as the 2026-09-15 containment;
  - out-of-repo Pulumi applies of merged source, such as 2026-09-09 (#1050) and 2026-10-01
    (#1364).

  A git query sees the PR that records such a change, not the change. Rows for these events
  take `landedAt` from the runbook's recorded instant where one exists (see Landing instants).

## Commands

Run from the repository root with the audited commit checked out. The script is pure git with
no network access, and it reads the current branch.

```sh
# Census: one TSV line per (family, commit): family, sha, committedAt, subject
bash goals/ciops-ontology-pipeline/research/scripts/w1_lever_query.sh

# Unique PR numbers, one per first-parent commit
bash goals/ciops-ontology-pipeline/research/scripts/w1_lever_query.sh \
  | awk -F'\t' '!seen[$2]++ {print $4}' \
  | sed -nE 's/.*\(#([0-9]+)\)$/\1/p; s/^Merge pull request #([0-9]+).*/\1/p' \
  | sort -un

# First-parent commits whose subject carries no PR number
bash goals/ciops-ontology-pipeline/research/scripts/w1_lever_query.sh \
  | awk -F'\t' '!seen[$2]++ && $4 !~ /\(#[0-9]+\)$/ && $4 !~ /^Merge pull request #[0-9]+/ {print $2 "\t" $3 "\t" $4}'

# Then, per PR: its landing instant and merge commit, and its place on the audited line
gh pr view <N> --json mergedAt,mergeCommit
git merge-base --is-ancestor <mergeCommit> 8b7392fe00
```

For each family the script runs
`git log --since="${W1_SINCE:-2026-08-27T19:52Z}" --first-parent --format="%H%x09%cI%x09%s" -- <path>`
over each path, then sorts and de-duplicates per family. The default boundary is the minute
iv-870 landed and includes #870 itself (squash committed 19:52:02Z, `mergedAt` 19:52:03Z).
`committedAt` is the git committer date with the committer's UTC offset. A row's `landedAt` is
GitHub's `mergedAt` in UTC, except for the rows listed under Landing instants.

**PR-number parsing.** The PR number is the trailing `(#N)` of a squash subject, or the `N` of
a `Merge pull request #N from ...` subject. A commit with neither has no PR; the census lists it,
and under P0 Ruling 7 it is classified like a PR from its diff and message but never becomes a
row. The first pass parsed only `(#N)`, so it dropped #891, #892, #893 and #894 (P0 Ruling 5).
#871 is also a merge-subject commit, and only a widened family reaches it.

**Reproducibility check.** At `8b7392fe00` the census output is 321 lines with sha256
`8c95797ed6c2077f7d0b5d88bcc168cef0bfe24a8fa58cc73f435b55e4f1221c` (recomputed on 2026-10-05
after the PR #1424 review fixes); the PR parse returns 197 numbers. Earlier outputs: 300 lines,
sha256 `acdd01efe21eada8520ee0b13ea2ae16f6ad70ba239c34d42850543538ce4b4d`, after the P0 Ruling 7
extensions (194 PRs); 296 lines, sha256
`90157c67c93fe44050f8cc0a726ad929a85e08c83385113944170083f7ac28a7`, before them (190 PRs).

## Census (2026-10-05, `8b7392fe00`)

| Measure | Pass 1 (original families) | Pass 2 (widened, P0 Ruling 5) | Pass 3 (extended, P0 Ruling 7) | Pass 4 (review fixes, Ruling 7 addendum) |
| --- | ---: | ---: | ---: | ---: |
| Family lines (TSV) | 244 | 296 | 300 | 321 |
| `scheduler-admission` lines | 49 | 51 | 51 | 51 |
| `turbo-cache` lines | 40 | 58 | 59 | 59 |
| `lane-assembly` lines | 129 | 153 | 156 | 156 |
| `hosted-runner` lines | 26 | 34 | 34 | 34 |
| `package-scripts` lines | — | — | — | 21 |
| Unique first-parent commits | 159 | 191 | 195 | 198 |
| PRs | 155 (4 merge subjects unparsed) | 190 | 194 | 197 |
| Commits with no PR number | 0 | 1 | 1 | 1 |

Pass 2 classified 37 PRs:

- **35 new PRs.** The four merge-subject PRs #891 to #894, plus 31 that only the widened
  families reach: #871, #906, #984, #1007, #1050, #1053, #1072, #1085, #1141, #1145, #1160,
  #1175, #1180, #1185, #1232, #1233, #1259, #1289, #1307, #1324, #1335, #1337, #1341, #1348,
  #1362, #1364, #1368, #1375, #1376, #1377 and #1379.
- **Two re-reviews.** #952 and #989 were re-checked under the rule that admitted #1182 (with
  `affectedUsingTaskInputs` on, an uncached task's inputs can still change what `--affected`
  selects). Both stayed excluded.

No pass-1 PR fell out of the widened census. The commit with no PR number is `8ef3213cbf`
(2026-09-03T04:41:54Z, a `docs(ship-velocity)` commit that edits
`scripts/enable-turbo-remote-reads.sh`). `gh pr view` cannot verify it; the third pass
classified it under P0 Ruling 7 (see Verdicts).

Pass 3 classified 7 PRs and that commit:

- **Four new PRs** that only the P0 Ruling 7 extensions reach: #928, #1080 and #1192 through
  the `:(glob)**/docgen.json` pathspec (`lane-assembly`), and #1254 through `.envrc`
  (`turbo-cache`). No pass-2 PR fell out of the extended census.
- **Three re-reviews** of pass-1 exclusions whose widened-family hunks looked like levers:
  #1055 (Spot allocation strategy in `infra/src/CiFleetController.ts`), #1061 (a JSDoc metadata
  check added to the full docgen proof in `Docgen/internal/Local.ts`) and #1389 (the
  deprecated-apis `packages/tooling/tool` shard split in `Lint/Lint.command.ts`).
- **The commit with no PR**, `8ef3213cbf`, classified from its diff and message. Its own diff
  changes no decision: the `TURBO_TOKEN_REPLACE=1` mode it adds to
  `scripts/enable-turbo-remote-reads.sh` is opt-in and defaults to 0, and the posture stays
  `local:rw,remote:r`. The correction it records "corrected or completed" the four Turbo
  read-only variables in the git-ignored `.env` of 27 checkouts, outside the repository
  (`goals/ship-velocity/research/cache-proof.md:60-62` at `8ef3213cbf`). The criterion refuter
  refuted it and the facts refuter upheld its facts, so on the P0 Ruling 3 pattern it is
  excluded and iv-953 carries no caveat for it.

## Verdicts

| Outcome | Pass 1 (155 PRs) | Pass 2 (37 PRs) | Pass 3 (7 PRs, 1 commit) | Pass 4 (3 PRs, probe) |
| --- | ---: | ---: | ---: | ---: |
| Survived both refuters | 19 | 8 | 3 | 0 |
| Contested (one refuter refuted) | 14 | 5 | 1 | 1 |
| Dropped (both refuted) | 0 | 0 | 0 | 0 |
| `excluded-not-a-lever` at classification | 71 | 8 | 3 | 2 |
| `excluded-instrumentation-only` at classification | 47 | 16 | 1 | 0 |
| `excluded-shadow-only` at classification | 4 | 0 | 0 | 0 |

**Pass 1.** Of the 19 survivors, 3 were already rows (#870, #929, #1006) and 16 became new
rows. Of the 14 contested PRs, the steward admitted 10 at the P0 sitting:

- #982, #1064, #1155, #1165, #1195 and #1384 under P0 Ruling 2, which removed the only ground
  on which they had been refuted;
- #1102, #1112 and #1269 under P0 Ruling 3, because the criterion refuter upheld each one and
  only cites were corrected;
- #1029 under the P0 Ruling 3 rule that a check step inside a lane is gate selection.

The steward excluded #882, #913, #967 and #1143 under P0 Ruling 3. P0 Ruling 4 gave #1068 and
#1269 their own rows and rewrote the third iv-1006 caveat.

**Pass 2.** All 8 survivors became rows: #871, #891, #894, #1007, #1050, #1232, #1233 and
#1364. The 5 contested PRs were decided on the P0 Ruling 3 pattern: a PR becomes a row when
only the facts refuter refuted it, with its corrections applied, and is excluded when the
criterion refuter refuted it.

- Rows: #1053 and #1141.
- Excluded: #984 (local resource control, outside the vocabulary), #1085 (a guard with no
  realized target change at landing) and #1375 (the runbook record of #1364's apply, so that
  event has one row).

**Pass 3.** All 3 survivors became rows, each on both tiers:

- #1061 (`gate-selection`): the full docgen proof runs the JSDoc metadata check before Turbo
  starts, a check step inside an existing lane under P0 Ruling 3. Its hosted leg is push to
  main only, because pull-request runs never reach the full path.
- #1080 (`gate-selection`): the deleted `apps/labs/api-docs/docgen.json` took @beep/api-docs
  out of the configured-package set that drives Docgen proof-manifest verification,
  aggregation (128 to 127 packages) and the full proof's metadata check. Turbo's filter scope
  did not change. P0 Ruling 7 put the docgen.json path in the `lane-assembly` path family,
  which is not a mechanism ruling; the row names `lane-assembly` as the alternative reading.
- #1389 (`sharding`): the deprecated-apis `packages/tooling/tool` shard splits into `tool/cli`
  and `tool/docgen` (28 to 29 shards). The removal of re-export analysis from the docgen JSDoc
  check at the same instant is named in a `CONFOUNDED` caveat (P0 Ruling 4).

The one contested entry is the commit with no PR, `8ef3213cbf`. Its criterion refuter refuted
it, so it is excluded on the P0 Ruling 3 pattern and adds no caveat to iv-953 (P0 Ruling 7).
The classifiers excluded #928, #1192 and #1254 as not levers and #1055 as instrumentation-only:

- #928 brings a new workspace with its own docgen.json, which joins the Docgen set under the
  existing discovery rule.
- #1192 edits an existing docgen.json's exclude list, so the package set does not change.
- #1254 leaves the `.envrc` `TURBO_CACHE_DIR` export unchanged.
- #1055 set the On-Demand pool's allocation-strategy input to `lowest-price`, the value the
  deployed scale-up Lambda already applied (`docs/runbooks/aws-cost-operations.md:74` at
  `702e815971`), and the return to Spot (live on 2026-09-15, then #1141) used
  `price-capacity-optimized`.

**Pass 4** (package-scripts probe, PR #1424 review). #872 and #936 are new workspaces whose
`package.json` arrived with the standard script set and joined existing lanes under the
workspace glob (not a lever, as #928). #911 was contested: @beep/repo-cli's `beep:audit` gained
`beep:test:python` and `beep:lint:python`, but only `package-verify` (a standalone handoff
command, as ruled for #967) and the ad hoc root `audit` script run it, so the criterion refuter
refuted it and it is excluded on the Ruling 3 pattern. No row.

**Final count: 39 W1 rows** (16 pass-1 survivors + 10 steward-admitted + 10 from pass 2 + 3
from pass 3; none from pass 4). With iv-870, iv-929 and iv-1006 the ledger holds **42 rows**.
The other 155 census PRs are in the appendix, which also lists the three pre-existing rows as
"existing row" and the commit with no PR (39 + 3 + 155 = 197 PRs; 159 appendix lines).

The 39 W1 rows by primary mechanism:

| `mechanismChanged` | Rows | PRs |
| --- | ---: | --- |
| `turbo-cache-inputs` | 10 | #953, #1019, #1022, #1079, #1146, #1182, #1221, #1232, #1233, #1381 |
| `lane-assembly` | 8 | #1021, #1049, #1054, #1064, #1067, #1068, #1102, #1380 |
| `gate-selection` | 8 | #871, #1029, #1053, #1061, #1080, #1098, #1112, #1165 |
| `admission` | 5 | #874, #891, #894, #1155, #1384 |
| `sharding` | 4 | #982, #1007, #1195, #1389 |
| `hosted-runner-capacity` | 3 | #1050, #1141, #1364 |
| `ordering` | 1 | #1269 |
| `early-stop` | 0 | none |

Nine rows are hosted-tier only: #982, #1050, #1064, #1141, #1155, #1165, #1195, #1364 and
#1384. Each row's first caveat states its tier.

### Landing instants

`landedAt` is `gh pr view <N> --json mergedAt` for every row except two hosted-capacity rows,
whose fleet change an operator applied outside the repository at an instant the runbook
records. For those, `landedAt` is the recorded instant and the PR is the record (P0 Ruling 6).
A third row records a live change with no clock time on record, so it keeps the merge instant
and marks the mixed window in a caveat. The pass-3 rows (#1061, #1080, #1389) land at
`mergedAt` and add nothing to this table:

| Row | `landedAt` | `mergedAt` | Source of the instant |
| --- | --- | --- | --- |
| iv-1050-heavy-pool-on-demand | 2026-09-09T09:13:51Z | 2026-09-09T10:18:04Z | `docs/runbooks/ci-runner-reliability.md:98-100` at `de84d4218e` (the scale-up Lambda change) |
| iv-1141-heavy-pool-containment | 2026-09-16T00:18:38Z | 2026-09-16T00:18:38Z | Live change on 2026-09-15 with no clock time (`docs/runbooks/aws-cost-operations.md:3,63-64` at `2abd88d290`); the row marks 2026-09-15T00:00:00Z to `landedAt` as a mixed window |
| iv-1364-spot-pool-spread | 2026-10-01T12:05:00Z | 2026-10-01T10:22:28Z | `docs/runbooks/ci-runner-reliability.md:246-247` at `8b7392fe00` (end of the 12:03–12:05 UTC apply, minute precision), recorded by #1375 |

Every row's evidence still carries
`gh pr view <N> --json mergedAt,mergeCommit (verified 2026-10-05)`.

## Verification protocol

1. **Query.** The script lists candidate commits per family, and the PR parse turns them into
   PR numbers.
2. **Classify.** One lane per PR reads the merge-commit diff, restricted to the families in
   force for that pass. It records a verdict (qualifying, uncertain, `excluded-not-a-lever`,
   `excluded-instrumentation-only` or `excluded-shadow-only`), the mechanisms, the tier, a
   rationale, and cites at the merge commit or at HEAD.
3. **Refute.** Each qualifying or uncertain PR goes to two independent refuters, and each
   returns `refuted` true or false plus corrections.
   - The **criterion refuter** asks whether the diff changes a decision that a named mechanism
     makes, on a tier the criterion admits.
   - The **facts refuter** re-runs `gh pr view <N> --json mergedAt,mergeCommit`, checks that
     the merge commit is on HEAD's first-parent line, and resolves every cited `file:line`.
4. **Decide.**
   - Neither refutes: the PR **survives** and becomes a row.
   - One refutes: the PR is **contested**.
   - Both refute: the PR is **dropped** (none in any pass).

   The steward ruled on the first pass's contested set at the 2026-10-05 P0 sitting: Ruling 2
   admitted the six PRs refuted on the hosted clause alone; Ruling 3 admitted the PRs whose
   criterion refuter upheld them, excluded those it refuted, and made a check step inside a lane
   gate selection; Ruling 4 promoted #1068 and #1269 to rows and ratified the vocabulary. The
   second and third passes' contested sets followed the Ruling 3 pattern, as P0 Ruling 7
   confirmed (see Verdicts). PRs excluded at step 2 never went to refuters; the appendix lists
   each one with its reason so that any of them can be challenged.
5. **Write.** The final writer applied every correction, re-ran `gh pr view` for each pass-2
   and pass-3 row (all matched), checked the merge commits against `8b7392fe00`, and
   re-resolved the pass-2 and pass-3 cites at the merge commit or at HEAD. Every row:
   - starts its `hypothesis` with `OBSERVATIONAL:`;
   - opens its caveats with an adoption-qualified membership statement for its tier
     (`kpi-measurement-rules.md` §2);
   - cites repository paths at HEAD `8b7392fe00` or at the merge commit;
   - names co-mechanisms at the same instant in a `CONFOUNDED` caveat.

   Adoption-qualified membership means:
   - **Local tier:** a checkout counts only when its HEAD ancestry includes `mergeCommit`.
   - **Hosted tier:** a run counts when its head includes `mergeCommit`. Fleet capacity is
     shared state, so for the hosted-capacity rows membership follows runner launch time
     against `landedAt`, whatever the run's head.

## Known limits

- **Pass-1 PRs were classified against the original families.** Step 2 reads only family
  hunks, and 42 pass-1 PRs that are not rows also touch paths that only the widened families
  cover. The third pass re-reviewed the three whose hunks looked like levers (#1055, #1061 and
  #1389; see Verdicts). The other 39 were not re-reviewed against their widened-family hunks:
  the second pass's writer inspected those hunks and none looked like a lever, so they stay as
  classified (P0 Ruling 7).
- **Changes outside every family are outside the census.** The two examples the second pass
  found are now inside it: #1080 (deleted `apps/labs/api-docs/docgen.json`) through the
  `:(glob)**/docgen.json` pathspec and #1254 (made direnv a human-only layer) through `.envrc`
  (P0 Ruling 7).
- **Changes applied outside the repository to local checkouts are not rows.** P0 Ruling 6
  dates out-of-repo applies only for hosted capacity. The token-reference correction that
  `8ef3213cbf` records, in 27 checkouts' git-ignored `.env`, is excluded (see Verdicts), so no
  row or caveat marks it in the local series.
- **The P0 Rulings live in the working-tree `decisions.md` until the W1 PR commits it**, so
  every "P0 Ruling n" cite resolves from that commit onward.

## How to re-run

1. Check out the commit being audited and run the census and PR commands above from the
   repository root. To audit only a later window, set `W1_SINCE` to the committer instant of
   the previous census HEAD.
2. Recompute the census digest. The pathspecs and the probe read history, so the digest changes
   only when the window or the families change.
3. Compare the PR list against the ledger rows and the appendix. Any PR in neither is new.
4. Classify and refute only the new PRs (protocol steps 2 to 4), and take contested PRs to the
   steward.
5. Re-verify each new row with `gh pr view <N> --json mergedAt,mergeCommit` and record the
   verification date in its evidence line. When a hosted-capacity change was applied outside
   the repository, take `landedAt` from the runbook's recorded instant and say so in a caveat.

## Appendix: PRs that did not become rows

The table rendered below this page covers all four passes: every census PR that is not a W1
row (155), plus the three pre-existing rows marked "existing row", sorted by PR number, and then
the commit with no PR (159 lines). It includes the four pass-1 PRs the steward excluded under P0
Ruling 3, the three pass-2 contested PRs whose criterion refuter refuted them, and
`8ef3213cbf`, the pass-3 contested entry, excluded the same way, and #911, the pass-4 contested
entry, excluded the same way. #952 and #989 carry their
pass-2 re-review reasons, and #1055 its pass-3 re-review reason.

| PR | Verdict or ruling | Reason |
| ---: | --- | --- |
| #858 | excluded-not-a-lever | Only the yeet monitor's PR-babysitting loop changes (watch `--until-event` exit, per-job red classification, deferred flake reruns); no proof decision. |
| #870 | existing row | iv-870-weighted-admission, recorded before W1; the census boundary is its landing minute. |
| #872 | excluded-not-a-lever (pass 4, package-scripts probe) | The probe hit is the package.json of the new workspace @beep/lejeune-bolt-workbench (name-status A), with the standard audit, beep:*, build, check, lint and test scripts; under the existing `apps/labs/*` workspace glob it joins existing lanes, as #928 did; the root package.json edit adds only an fflate dependency, and the knip.jsonc and fallow-boundary edits cover only the new workspace. |
| #878 | excluded-instrumentation-only | Leases gain nonce and enqueuedAtMillis; a best-effort admission transition journal records admitted and released events. |
| #879 | excluded-instrumentation-only | Journal-lock reaping binds to owner generations; that lock serializes journal writes only. |
| #882 | steward-excluded (P0 Ruling 3) | The @beep/api-docs#build override only silences the no-outputs warning on a noEmit task nothing depends on; the CiLane cache plan adds a `--cache=` flag, not a task input; GateStaleness is a warning surface. |
| #886 | excluded-not-a-lever | The clean-HEAD install preflight writes its temp dir to disk, and an operator `tmpfs-reap` janitor is added; disk hygiene. |
| #888 | excluded-not-a-lever | Admitted work enters a systemd scope with MemoryPeak and TasksCurrent telemetry; who is admitted and when is unchanged. |
| #892 | excluded-instrumentation-only | isTruthyMainPush reads the same keys through the fiber's ConfigProvider instead of a sync read of the default env provider; a config-read refactor with the same production decision. |
| #893 | excluded-not-a-lever | The tmpfs-reap janitor walks /tmp plus a distinct TMPDIR and gains two reap classes; Quality.command.ts changes only report rendering. |
| #902 | excluded-not-a-lever | Security fix: only a verified dead lease authorizes `scheduler reap --apply` to stop a scope; cleanup authority, not admission. |
| #903 | excluded-not-a-lever | LangExtract feature; the only swept edit relaxes the Yeet status merge-ready predicate (diagnostic output). |
| #906 | excluded-not-a-lever | docgen:local's post-Turbo aggregation skips packages whose docgen.json outDir is not the canonical docs tree; it fixes what is written, not what is checked. |
| #911 | excluded (pass 4, package-scripts probe; criterion refuted) | @beep/repo-cli's `beep:audit` gains `beep:test:python` and `beep:lint:python` (packages/tooling/tool/cli/package.json:162 at bfb20e7688), but only package-verify (a standalone handoff command, as ruled for #967) and the ad hoc root `audit` run that script; no hosted workflow, GithubChecks lane or local full proof does, so Ruling 3 does not reach it, and the knip.jsonc `uv` ignore covers only the new script. |
| #913 | steward-excluded (P0 Ruling 3) | Only docgen outputs change (a gitignored private-docs path); inputs stay `$TURBO_DEFAULT$` and `!.beep/**`, so no cache-hit rule changes. |
| #914 | excluded-not-a-lever | Marketing-site feature; RunScope.ts gains type annotations only. |
| #921 | excluded-not-a-lever | Removes the published-PR ownership lease used by PR-babysitting agents, not quality-run admission. |
| #927 | excluded-not-a-lever | Schema codec-static migration; decode calls renamed with identical behavior. |
| #928 | excluded-not-a-lever (pass 3) | A new workspace, @beep/box-provisioning, arrives with its docgen.json, package.json, root workspaces entry and standard `docgen` script, so it joins the Docgen set under the existing discovery rule; no selection rule changes. |
| #929 | existing row | iv-929-origin-lock-retirement, written by the graduation PR (graduation Ruling 6). |
| #936 | excluded-not-a-lever (pass 4, package-scripts probe) | The probe hit is the package.json of the new workspace @beep/ciops (name-status A), with the standard script set plus `docgen` and an `evidence:s7` generator that no lane calls at landing; under the existing `apps/labs/*` workspace glob it joins existing lanes, as #928 did, and the fallow-boundary edit adds only its own zone. |
| #949 | excluded-not-a-lever | Moves the admission and proof-lock root from `/tmp` to a `.beep/runtime` directory under the user home (location cutover, same sharing) and hardens TmpfsReap. |
| #952 | excluded-instrumentation-only (re-reviewed, pass 2) | Re-reviewed under the #1182 rule: affectedUsingTaskInputs is on, but the coverage task is uncached and never runs under `turbo --affected` (Coverage Regression feeds --affected to its own planner), so the explicit inputs decide nothing. |
| #954 | excluded-instrumentation-only | Adds ProofFact and ProofLedger schemas and a disconnected ledger service used only by the test kit. |
| #958 | excluded-not-a-lever | @effect/tsgo 0.35 to 0.39 bump and diagnostics migration; mechanical rewrites. |
| #964 | excluded-instrumentation-only | Threads attemptId and journals v2 eviction and termination facts; claim-path reaping keeps one reaper per entry. |
| #966 | excluded-not-a-lever | Adds an `environment-only` inbox ack kind and fixes hook reminder text; inbox handling. |
| #967 | steward-excluded (P0 Ruling 3) | package-verify is a standalone agent handoff command, not a lane of a measured tier; building the upstream closure first fixes false reds. |
| #971 | excluded-not-a-lever | Per-module import migration vehicle (lint law, exports, aliases); swept edits are import lines. |
| #975 | excluded-instrumentation-only | Restores the PR provenance footer stamp and adds `yeet resume`; PR-body reporting, not a quality lane. |
| #978 | excluded-instrumentation-only | Schema-versioned eviction marker (default off), attempt identity facts and terminal-attempt compaction; journaling. |
| #984 | excluded (pass 2, criterion refuted) | MemoryHigh=64G and a systemd-oomd kill drop-in on agent-runs.slice (installed by hand) throttle or kill work already admitted; no admission, ordering or early-stop decision changes, and local resource control is outside the closed vocabulary. |
| #986 | excluded-not-a-lever | Adds the operator `beep worktree reap` janitor (dry-run unless `--apply`). |
| #987 | excluded-not-a-lever | New driver package; registers @beep/freshbooks in the CI partition table, as the partition proof requires. |
| #989 | excluded-instrumentation-only (re-reviewed, pass 2) | Re-reviewed under the #1182 rule: the package-test-typecheck task is `cache: false` and dispatched only by the test-tsgo aggregate, which selects packages itself, so its inputs decide nothing. |
| #992 | excluded-instrumentation-only | ai-metrics telemetry v2 packet; QualityScheduler.ts and Quality.command.ts only export helpers. |
| #993 | excluded-instrumentation-only | Crash-recovery hardening of admission state files (persisted reap claims, nonce-keyed promotion); admission policy unchanged. |
| #994 | excluded-not-a-lever | Adds the operator `beep quality residue-reap` disk janitor (dry-run by default). |
| #998 | excluded-instrumentation-only | Adds a `--window` census mode to `beep ci lane-timings`; reporting only. |
| #1004 | excluded-instrumentation-only | Fixes the provenance-footer snapshot field (`body,updatedAt`); status output. |
| #1005 | excluded-instrumentation-only | Keeps disabled eviction claims pending while the eviction protocol is off; journal sink bookkeeping. |
| #1006 | existing row | iv-1006-wave-order, written by the graduation PR; W1 rewrites its third caveat as the ladder cross-reference list (P0 Ruling 4). |
| #1009 | excluded-not-a-lever | Commitlint lints only a PR's own commits (merge-base range); a correctness fix inside an existing hosted lane. |
| #1011 | excluded-instrumentation-only | Test-only export plus an equivalent guard rewrite in the journal-lock reaper. |
| #1013 | excluded-not-a-lever | Bun 1.4.1 and dependency sweep; no turbo.json change; swept edits are mechanical. |
| #1025 | excluded-instrumentation-only | Journal v3 `admission-enqueued` and `admission-withdrawn` events and fields; journaling only. |
| #1026 | excluded-not-a-lever | Security and compatibility fixes (raw procfs start ticks restored so live owners are not judged dead); restores intended behavior. |
| #1035 | excluded-instrumentation-only | `scheduler reap --apply` defaults to false so the dry-run report is reachable; what `--apply` removes is unchanged. |
| #1045 | excluded-not-a-lever | Removes staged admission temporaries on interrupt; residue cleanup. |
| #1046 | excluded-not-a-lever | Polls the admission recovery record under a deadline instead of one settle sleep; crash-recovery timing only. |
| #1047 | excluded-not-a-lever | Promotes a memory filesystem; a one-file exception in the effect-diagnostics directive collector. |
| #1055 | excluded-instrumentation-only (re-reviewed, pass 3) | Re-reviewed under P0 Ruling 7: the allocation-strategy edit (price-capacity-optimized to lowest-price) aligned the On-Demand pool's input with the value the deployed Lambda already applied (docs/runbooks/aws-cost-operations.md:74 at 702e815971), and the return to Spot (live 2026-09-15, then #1141) used price-capacity-optimized; the rest is cost guardrails and a warning-only runner manifest freshness check. |
| #1058 | excluded-not-a-lever | Check overlays resolve upstream packages through declarations; a compiler speedup inside unchanged lanes and tasks. |
| #1060 | excluded-not-a-lever | Effect c8349ed snapshot pin and v4 RC API migration; renames. |
| #1062 | excluded-not-a-lever | Rebakes the runner AMI without the baked dependency archive; same runner pool and count. |
| #1063 | excluded-not-a-lever | Adds projection-regeneration write steps to `yeet repair`; prepares inputs for existing checks. |
| #1066 | excluded-not-a-lever | Hosted job-setup reliability (apt source pruning, install retries); no lane or capacity change. |
| #1071 | excluded-instrumentation-only | heavy.yml wraps each lane command in a resource-evidence recorder that preserves the exit status. |
| #1072 | excluded-instrumentation-only | msal-node-extensions becomes an optional peer so keytar leaves the install graph; the only lane-family edit rewrites a comment in setup-monorepo-ci, and the install retry loop is unchanged. |
| #1075 | excluded-not-a-lever | Pins the coverage lane to Node 22.22.3 to avoid a JSON.parse bug; runtime correctness. |
| #1076 | excluded-not-a-lever | Scopes the Float16Array flag to vitest workers; a runtime-flag fix. |
| #1077 | excluded-instrumentation-only | Keeps the journal-lock reap adopter election exclusive; the journal is best-effort. |
| #1082 | excluded-not-a-lever | Declares `lint:laws` and a root task, but no lane calls them at this commit. |
| #1083 | excluded-not-a-lever | Adds the lint-policy sweeps switch, shipped as `shards`, which matches existing full and CI behavior. |
| #1085 | excluded (pass 2, criterion refuted) | Adds a labs-workspace guard to docgen discovery; no lab carried a docgen.json on main at landing (#1080 had deleted apps/labs/api-docs/docgen.json earlier that day, at 07:48:11Z), so no Docgen target changed. |
| #1091 | excluded-not-a-lever | Changes the coverage ratchet comparator (verdict content), not selection, ordering or admission. |
| #1104 | excluded-not-a-lever | Changes the Coverage Regression verdict rule for lowered rows; verdict content. |
| #1110 | excluded-not-a-lever | Retires a TaggedError hook and declares the tsgo directive allowlist; lint content inside an existing lane. |
| #1116 | excluded-not-a-lever | Adds invoker-ancestry exemption to the worktree-retirement fence; not scheduler admission. |
| #1118 | excluded-not-a-lever | A one-line point-free refactor in CoverageRegression.ts; the substance is the ai-metrics forwarder. |
| #1122 | excluded-instrumentation-only | Lane-run records gain `commandText`, and repair hints derive from them; reporting. |
| #1125 | excluded-instrumentation-only | The lane-timings census resolves populations from ruleset history; reporting. |
| #1127 | excluded-instrumentation-only | Rewrites the retire-fence hint string and runbook text. |
| #1130 | excluded-instrumentation-only | Drops the deprecated doctest `--mode` flag metadata; the plan was already mode-independent. |
| #1133 | excluded-not-a-lever | The retire fence exempts the invoking session's subtree; worktree retirement, not admission. |
| #1134 | excluded-not-a-lever | Makes the retirement process table injectable; refactor. |
| #1138 | excluded-not-a-lever | Serializes goal-packet event-store writes by reusing the journal lock; not a CI mechanism. |
| #1143 | steward-excluded (P0 Ruling 3) | deadLeaseScopePlan now stops a recorded proof-job unit on a dead lease; capacity and ordering read only live leases, so admission is unchanged (TTC Ruling 35). |
| #1145 | excluded-instrumentation-only | vitest.shared.ts picks the coverage provider by runtime (Istanbul on Bun, V8 on Node); a measurement-provider change with no gate or selection change. |
| #1148 | excluded-not-a-lever | Turbo catalog bump to ^2.10.13 and `$schema` URL sync; dependency update. |
| #1149 | excluded-not-a-lever | `yeet monitor --until-ready` settle policy and exit codes; changes when the monitor exits, not proof decisions. |
| #1151 | excluded-not-a-lever | Adds a dormant heavy.yml `admitted` input defaulting to true; no caller sets it at this commit. |
| #1153 | excluded-instrumentation-only | Proof-job record bookkeeping (publishedAt stamp, lock scope) and tests. |
| #1158 | excluded-not-a-lever | Fixes cache-warm flags that Turbo rejected to a write-only spec; no task input changes (see open question on the broad cache reading). |
| #1160 | excluded-instrumentation-only | The only lane-family edit rewrites control characters in the effect-vitest introduced-findings report line; the gate predicate is unchanged. |
| #1161 | excluded-instrumentation-only | The inbox treats `pr-merge-ready` rows as observable; docs for the detached until-ready recipe. |
| #1166 | excluded-instrumentation-only | The local labs lane passes `--summarize` to record an input digest; invocation and hashes otherwise unchanged. |
| #1167 | excluded-instrumentation-only | Detached monitor routes record job outcomes so `job wait` reports 0. |
| #1168 | excluded-instrumentation-only | Deletes the write-only laneProofs store that nothing read. |
| #1173 | excluded-not-a-lever | Dependency catalog refresh (effect rc.117, turbo 2.11.2); turbo.json edits are `$schema` URLs only. |
| #1175 | excluded-instrumentation-only | Lint.schemas.ts widens the effect-vitest inventory row schema for L-*-NONE charter rows and adds an invariant filter; evidence-shape validation. |
| #1179 | excluded-instrumentation-only | Bounded retry around `gh api` calls in the lane-timings census. |
| #1180 | excluded-instrumentation-only | A new apps/labs/ciops/turbo.json declares build outputs [] for a noEmit build, silencing a warning; inputs, dependsOn and caching are unchanged. |
| #1184 | excluded-shadow-only | Time-to-certainty C4.1 itself: the verdict writer records shadow reuse facts with reuse off and never changes what runs. |
| #1185 | excluded-not-a-lever | The effect-vitest detector accepts @beep/test-runner modules as instrumented harnesses; lint-rule semantics, not gate selection. |
| #1186 | excluded-instrumentation-only | Ratifies lane-timings census populations by ruleset version. |
| #1188 | excluded-not-a-lever | Extracts the instrumented Vitest runner into @beep/test-runner; mechanical follow-through. |
| #1191 | excluded-not-a-lever | The JSDoc inventory detector recognizes inline schema annotations; lint content. |
| #1192 | excluded-not-a-lever (pass 3) | Edits the existing packages/foundation/capability/mcp-kit/docgen.json (name-status M), adding `src/test/**/*.ts` to its exclude list; the Docgen package set is unchanged. |
| #1200 | excluded-not-a-lever | @effect/tsgo 0.45.0 ratchet and lint migration across 751 files. |
| #1203 | excluded-not-a-lever | Review follow-up merge gate and missed-comment replay; PR-closeout readiness, not a proof mechanism. |
| #1206 | excluded-not-a-lever | tsconfig strictness options and fallout remediation. |
| #1208 | excluded-instrumentation-only | Coverage tests plus an unreachable-filter removal in the advisory ReviewBodySignal. |
| #1217 | excluded-shadow-only | Wires the C5 changed-package tripwire into the C4.1 shadow pass; reuse stays off. |
| #1219 | excluded-instrumentation-only | Guards partial census windows behind `--preview`; reporting. |
| #1227 | excluded-shadow-only | An untrimmed `-z` git capture fixes the C4.1 shadow tripwire's changed set; shadow facts only. |
| #1229 | excluded-instrumentation-only | Extends the isolated cache-qualification pilot harness allowlist and fixtures. |
| #1234 | excluded-not-a-lever | Effect 330b7475e2 snapshot pin and module-move migration across 1291 files. |
| #1237 | excluded-not-a-lever | Extends the operator residue-reap janitor to the shared Turbo cache and other classes. |
| #1238 | excluded-instrumentation-only | Records a preserved concurrent body edit as a passed provenance stamp. |
| #1239 | excluded-instrumentation-only | Adds the read-only `yeet economics` reporting surface. |
| #1250 | excluded-instrumentation-only | Encodes divergence details into an existing pilot error; same failure condition. |
| #1254 | excluded-not-a-lever (pass 3) | The `.envrc` hunk adds a comment and `source_env_if_exists .envrc.local`; the `TURBO_CACHE_DIR` export from #1221 is unchanged, and the comment records that agent tool shells, detached proofs and systemd units never loaded direnv. |
| #1259 | excluded-instrumentation-only | JSDoc only: EnvConfig.ts docs name the TURBO_CACHE_DIR and HOME inputs that #1232 wired. |
| #1268 | excluded-instrumentation-only | Qualification evidence and packet docs; swept edits are JSDoc. |
| #1270 | excluded-not-a-lever | PR monitor and inbox wave surface (`--until-ready`, `job wait` exit 2); not a proof mechanism. |
| #1272 | excluded-instrumentation-only | Hoists an inline UUID decode to a module const in MonitorLoop.ts (lint migration). |
| #1284 | excluded-not-a-lever | Dependency bump (turbo ^2.11.4 and others); turbo.json edits are `$schema` URLs. |
| #1289 | excluded-not-a-lever | A per-package Vite module cache fixes a cache-wipe race, and a libpff PATH is pinned; test-runtime correctness, no gate or cache-input decision. |
| #1307 | excluded-instrumentation-only | Effect Vitest test migrations and dependency additions; the one lane-family edit is a one-line bug fix inside the effect-vitest lint. |
| #1312 | excluded-instrumentation-only | Test canonicalization plus a 9-line journal lock-sidecar sweeper fix. |
| #1313 | excluded-instrumentation-only | Operator notification when an inbox wave lands, and a Status chain collapse. |
| #1318 | excluded-not-a-lever | Post-merge sweep leaves clones on a live branch alone; worktree hygiene. |
| #1321 | excluded-shadow-only | TurboLaneDigest folds failed tasks so the C4.1 ledger key resolves for red lanes; observation only. |
| #1322 | excluded-instrumentation-only | JSDoc and provenance pins in swept files; tests ported. |
| #1323 | excluded-not-a-lever | Effect Vitest migration; the merge-ready verdict change is PR-closeout readiness. |
| #1324 | excluded-instrumentation-only | Adds `!$TURBO_ROOT$/**/.turbo/**` to @beep/identity#lint inputs (a `cache: false` task); re-checked under the #1182 rule, the excluded paths are gitignored Turbo state, so no selection or reuse decision changes. |
| #1330 | excluded-not-a-lever | Dependency bump (turbo 2.11.5, Effect df77fff939); `$schema` URLs and `agentGuidance: false`. |
| #1335 | excluded-not-a-lever | Adds an on-demand `beep lint effect-schema-inventory` command and moves the inventory into a test fixture; the LINT_POLICY_SUBCOMMANDS entry is CLI routing, and no lane runs the command. |
| #1337 | excluded-not-a-lever | Adds the `beep lint schema-parity-codemod` rewrite tool (tooling only); its routing entry adds no lane. |
| #1338 | excluded-not-a-lever | LiteralKit API trim and consumer migration; mechanical. |
| #1341 | excluded-not-a-lever | Schema refactor retiring Timestamp, DateTimeUtcFromValid, Duration and Timezone; the lane-family hit trims the schema-topology lint's root-shim allowlist. |
| #1342 | excluded-instrumentation-only | Splits threadsResolved from a new closeoutGatesPassed criterion in the merge-ready verdict; the readiness decision is unchanged. |
| #1343 | excluded-not-a-lever | Retires the text and misc schemas for upstream Schema; import moves. |
| #1345 | excluded-not-a-lever | New schema-first detector rules inside the existing `lint:schema-first` lane; lint content. |
| #1346 | excluded-not-a-lever | Retires Int for upstream S.Int compositions; 691-file migration. |
| #1347 | excluded-not-a-lever | Retires the Unknown and Json concepts onto effect/Schema; codemod. |
| #1348 | excluded-instrumentation-only | Satisfies the existing lint:jsdoc, lint:effect-vitest and Coverage Regression gates for #1337's files with docs and tests; no gate changes. |
| #1353 | excluded-not-a-lever | Retires the SchemaUtils default helpers onto upstream defaults; codemod. |
| #1354 | excluded-not-a-lever | Adds an instantiation-regression gate to the operator `check-census` command; touches no lane or proof plan. |
| #1362 | excluded-instrumentation-only | A `--report-scanned-files` flag on `beep lint schema-first` prints the scanned file list; status output. |
| #1363 | excluded-not-a-lever | The monitor reads failed job logs mid-run through the per-job endpoint; earlier red classification, not a proof decision. |
| #1365 | excluded-instrumentation-only | CLI test canonicalization; a doc-comment fix and a `--json` flag default. |
| #1366 | excluded-instrumentation-only | Window-3 census verdict and docs; adds one ratified ruleset population. |
| #1367 | excluded-not-a-lever | @effect/tsgo 0.47.2 bump and its new lint rules. |
| #1368 | excluded-instrumentation-only | Effect 4.0.0 snapshot bump with patch re-keys and regenerated fixtures; the Docgen Local.ts edit swaps the A.partition destructure order to keep behavior. |
| #1369 | excluded-instrumentation-only | The lane-timings census refuses windows that a ruleset change straddles. |
| #1370 | excluded-instrumentation-only | Splits a wrapped TSDoc code span; inventory rows refresh. |
| #1371 | excluded-not-a-lever | Codec statics registry retirement; one guard swap in the Yeet inbox. |
| #1373 | excluded-not-a-lever | Retires review-bot gates from the merge-ready verdict; PR-closeout readiness. |
| #1375 | excluded (pass 2, criterion refuted) | Runbook-only record of the 2026-10-01 Pulumi apply; the capacity change is #1364's diff, so the event has one row (iv-1364-spot-pool-spread), whose landedAt is the apply instant this PR recorded. |
| #1376 | excluded-instrumentation-only | The runbook intro restates the October 1 pool spread that #1375 recorded; docs. |
| #1377 | excluded-instrumentation-only | Replaces the early post-apply job sample with a re-measured 12:05-12:45 UTC window and a dated evidence file; evidence. |
| #1379 | excluded-not-a-lever | Widens the matching heuristics of the existing SFV4-codec-static rule in SchemaFirstDetectors.ts; lint content inside an existing lane. |
| #1387 | excluded-not-a-lever | Product feature; registers @beep/xstate in existing Lint and Test Unit partitions. |
| #1392 | excluded-not-a-lever | Dependency refresh (Turbo 2.11.6); `$schema` URLs and the catalog version. |
| #1408 | excluded-not-a-lever | runBunAudit ignores exact OSV IDs; changes what counts as a pass inside the existing bun-audit step. |
| #1410 | excluded-not-a-lever | Dependency refresh (turbo 2.11.7); `$schema` URLs and the catalog version. |
| 8ef3213cbf (no PR) | excluded (pass 3, criterion refuted; P0 Ruling 7) | Its diff changes no decision (`TURBO_TOKEN_REPLACE` is opt-in, default 0; the posture stays `local:rw,remote:r`); the token-reference correction it records edited the git-ignored `.env` of 27 checkouts outside the repository, so iv-953 carries no caveat for it. |
