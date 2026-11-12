# Hosted Setup Tax

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Remove duplicate hosted CI work and the per-job setup tax with no proof-depth change: owner rows for generated standards files, the Property Laws oracle census and the residual file split, one hosted lint:shadcn owner, Fallow folded into Labs, Nix, Security and SAST without the workspace install, an explicit trustedDependencies list, PR Size folded into Change Profile and job-level lane-relevance skips, proven by the certainty scorecard's runner-minutes per green code run.

Goal 5 of 6 from [`explorations/ten-minute-certainty`](../../explorations/ten-minute-certainty/README.md);
requires certainty-scorecard (`ci/certainty-scorecard`, the acceptance number) and route-soundness-repair
(`ci/route-soundness`, the classifier differential the narrowing levers wait on).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/hosted-setup-tax/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P0 Research and P1 Implement, in progress. The P0 lever re-check at `origin/main` 5e09d90a6da is done
(#3041 merged; #3056's four Property Laws slices recorded as a decision); the scorecard re-baseline waits on
certainty-scorecard. P1: TURB-01 slice 1 (owner rows for generated standards inventories) merged as #3063
(b757bd0400f). Slice 2 (PERIH-02 with PERIL-04: one hosted `lint:shadcn` owner in Repo Sanity, one
`changeset-graph` run) merged as #3117 (10ed12d4410); slice 3 (TEST-01 oracle census) runs separately.

## Latest Evidence

- PERIH-02 and PERIL-04 (slice 2): `packages/tooling/tool/cli/test/ci-repo-sanity-owners.test.ts` holds
  exactly one hosted `lint:shadcn` owner (Repo Sanity, on pull requests and pushes) across the `check.yml`
  jobs and the hosted Lint Policy plan, proves an earlier Repo Sanity red cannot mask the step, and plans
  `changeset-graph` once. A planted `bg-zinc-100` turned `turbo run lint:shadcn` red locally and green once
  removed. Hosted: Repo Sanity failed on the plant at pushed head bec729b71ee (run 42778378836, job
  129702702080) and passed with it removed at 2c988a91828 (job 129705325011), before the merge.
- TURB-01 slice 1: [`research/turb-01/REPLAY.md`](./research/turb-01/REPLAY.md). Over 727 first-parent
  commits rebuilt from git, 67 shrink from a full Test Unit plan to owner-scoped, with 0 violations; the
  reader-scan drift check holds all six rows on @beep/repo-cli.

## Notes

- **First slice:** TURB-01 slice 1, "feat(quality): derive coverage owners for generated standards
  inventories" (M), in `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageScope.ts` with planner
  fixtures, a token- and segment-aware reader drift check and a policy fingerprint reseal. It is ready to open
  as soon as the graduation merges. Its "15-19% of PR runs" figure has no repo artifact; the skeptic's sample
  says about 8%, and the replay corpus must be rebuilt in-repo first.
- **Startable now, no selector change:** PERIH-02 (one `lint:shadcn` owner), PERIL-04 (`changeset-graph`
  once), PERIH-05 (Nix without the install), DEPS-01 (`trustedDependencies`), the TEST-01 oracle census,
  PERIH-06 slice 1, the HOST-09 CLI change. TEST-01's remainder is the oracle census, then a file split
  where the census and its per-file collection and hook timings show module-scope or hook cost still dominating, its outcome
  recorded either way (D26); HOST-05's gate is read only after that. Three open PRs at most.
- **Waits:** PERIH-04 and the ROUT-01 residual on route-soundness-repair's ROUT-07 differential; PERIH-04,
  HOST-09's fold and PERIH-06 slice 2 on heavy-pool-diet's pin-bump chain (PERIH-11) and route-soundness-repair's
  base-ref patterns (PERIH-10); PERIL-01 on PERIH-04; HOST-09's
  rerun slice on `goals/yeet-monitor-app-identity`; the acceptance claim on certainty-scorecard.
- **Already landed:** #3030 (f818c6e52bf) shipped ROUT-01 as the Test Plan job and the selection half of TEST-01 as
  test-level property selection. Property Laws ran as two slices from #3030 (D26) and as four since #3056
  (741b1492b2a, ci-lane-economics), accepted as landed by a decision file; no further shard before the census
  and the split slice. The goal keeps only the residual gates and measurement.
- **Order rules that cost red runs:** guards `!= 'false'`; `heavy.yml` at `@main` means two PRs per heavy
  input; `turbo.json`, `bun.lock`, root `package.json` or workflow edits freeze coverage rows and need the
  cache-qualification baseline re-recorded in the same PR, so batch them; reseal or re-record after merging `main`,
  never hand-merge generated files.
