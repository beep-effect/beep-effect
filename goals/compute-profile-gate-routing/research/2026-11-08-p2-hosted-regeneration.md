# P2: hosted catalog regeneration and docs

Recorded 2026-11-08 from the P2 lane, before commit.

## The `Catalog Regeneration` job

Job id `regenerate-catalogs` in `.github/workflows/catalog-regeneration.yml`, its own workflow so
it fires on `labeled` (see the decision file). It runs on `pull_request` types `labeled`,
`synchronize` and `reopened`.

| Event | Draft | `compute-profile-worker` label | Head repo | Job runs |
| --- | --- | --- | --- | --- |
| `pull_request` | yes | yes | same repo | yes |
| `pull_request` | yes | no | same repo | no |
| `pull_request` | no (after `yeet ready`) | yes | same repo | no (D9) |
| `pull_request` | yes | yes | fork | no |

`yeet open` adds the label after the PR exists; the `labeled` event starts the first run, and
every later push to the draft (`synchronize`) starts another, so the job sees each commit
before the flip.

Steps: check out `pull_request.head.sha` with `fetch-depth: 0` and `persist-credentials: false`,
fetch the base and run `setup-monorepo-ci` (the `verify` matrix bootstrap, without app
secrets). The job runs only `bun run beep`, so it does not fetch the pre-toolchain beep CI
binary. The writers take the PR diff from the merge base,
`--no-renames --diff-filter=ACMD`, filtered to the lefthook globs and excludes:

- `beep lint schema-catalog --write`: `{apps,packages,infra}/**/*.{ts,tsx}` minus `docs/`,
  `*.d.ts` and `node_modules/`;
- `beep observability catalog --write`: `{apps,packages}/**/src/**/*.{ts,tsx}` minus `test/`,
  `*.d.ts` and `node_modules/`.

An empty list skips that writer. A clean `standards/schema-catalog` and
`standards/instrumentation-catalog` ends the job. Otherwise `github-actions[bot]` commits
`chore(catalogs): regenerate shards for the worker-profile lane` and pushes to
`HEAD:refs/heads/<head ref>` on an explicit token URL, the `skills-update-train.yml` relock
pattern, with `LEFTHOOK=0` so the hooks `bun install` installed stay out of the bot commit. A lane push that lands first makes the push non-fast-forward and fails the job.
Concurrency group `regenerate-catalogs-<pr number>` cancels an older run.

`bun run beep ci workflow-lint` reports clean. actionlint is not installed in this checkout.

## Palantiri host-pressure line

`HostMemoryInput` and the `HostMemory` item carry optional `ceilingGib` and `computeProfile`.
The repo-cli source fills them from `MemoryStats.ceilingGib` and `ComputeProfileProbe`; an
unreadable override drops only the profile. The line reads, for example,
`memory  77.9 of 125.1 GiB available (ceiling 125.1 GiB, workstation)`.

## Docs touched

- `AGENTS.md`, Quality Operator: the 10-minute rule is the `workstation` profile's rule.
- `docs/runbooks/agent-pools.md`: new "Compute profiles" section with the per-host table, the
  dankserver RSS evidence (4.18 GB catalog hook, 4.97 GB `cheap-gates` step) and the D6 table.
- `.claude/skills/remote-development-agents/SKILL.md`: "What a worker lane may run".
- `.claude/skills/yeet/references/gates-and-proof.md`: `Worker profile` column and the
  `compute-profile=worker` skip paragraph.

## Takeover, 2026-11-13

The P2 lane's owner session ended on 2026-11-08 before a PR was opened. Its single commit
(574c4b77212) was cherry-picked onto `main` in a takeover lane ([decision](../decisions/2026-11-13-p2-lane-taken-over-and-rebased-onto-main.md)). The rebase dropped the unused beep CI binary fetch, added `LEFTHOOK=0` to the commit step, exempted
the job in the CI job-to-descriptor test, re-applied the AGENTS.md amendment as one appended
sentence and pointed the runbook's dankserver evidence at the archived exploration.
