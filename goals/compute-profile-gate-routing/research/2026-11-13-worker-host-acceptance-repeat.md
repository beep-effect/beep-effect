# Worker-host acceptance repeat on dankserver

Recorded 2026-11-13 on dankserver (15 GiB installed, worker profile) from the lane
`test/compute-profile-worker-acceptance-2` (sibling `-worktrees` root, base `origin/main` at
`7f997261b6`, the merge of #3276), PR
[#3277](https://github.com/beep-effect/beep-effect/pull/3277). This repeats
`2026-11-13-worker-host-acceptance.md` (PR #3267) after #3276 repaired its findings. The agent ran
inside the T3 agents slice, one substantive command at a time. Home paths are written as `~`.

## Verdict per acceptance criterion

| # | Criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Probe prints `worker`; `--is worker` exits 0/1 in under a second | pass | `worker`, `ceilingGib: 7`; `--is worker` exit 0 three times, `--is workstation` exit 1 three times, 0.71 to 0.77 s wall, 200 MB or less |
| 2a | Worker `final-check` defers hosted-only gates and prints the `yeet open` route | pass | six gates skipped with `compute-profile=worker`, the scoped `effect-vitest-files` gate ran locally, route printed, receipt `computeProfile: worker`, `forceLocal: false` |
| 2b | `--force-local` runs a forceable gate at concurrency 1 and the receipt records it | not proven | `fallow` and `coverage` both printed `runs … one task at a time (concurrency 1)`, and both were stopped by the pressure watchdog (slice `some avg10` above 15) after 523 s and 565 s with the 2G/3G scope at 2.15 GB. Neither completed, so no forced receipt with a forced step exists. The `check` refusal works: a reason is printed and an `admission-routed` refusal row is written |
| 3 | edit → commit (hooks skipped by profile) → `yeet open` → hosted regeneration commit → hosted green → `yeet ready`, no process above 1.5 GB | pass except the lane's own flip, which is not proven | the hooks were skipped by condition; `yeet open` opened a draft labelled `compute-profile-worker`; the App-token push `d4f93e123a` started Check, Storybook and Catalog Regeneration on its own (triggering actor `beep-knowledge-mint[bot]`), and every deferred gate was green 17 minutes after the push. The draft was flipped to ready at 16:54:07Z by the `kriegcloud` account from outside this host's Yeet tooling, not by the lane. Every lane command peaked at 609 MB or less |
| 5 | Attempt and admission facts carry `computeProfile` beside the env profile; receipts name auto-skipped gates | pass | `admission-routed` rows (`computeProfile`, `forceLocal`, `gateRoute`, `outcome`) for every routed gate of every run; the attempt journal carries `computeProfile: worker`; `quality scheduler history` shows `worker routes: 21 (8 bypass, 13 refusal; 3 forced)` |

Criterion 4 (workstation commit) belongs to DankStation and was not part of this run.

## First-run findings

| # | First-run finding | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Regeneration push as `github.token`; follow-up runs `action_required` | closed | push job 132027742538 minted a `beep-knowledge-mint` token (`actions/create-github-app-token`, client id set) and pushed `61accb81e0..d4f93e123a`; runs 43466828951, 43466829061 and 43466829370 started at 16:50:55Z with actor and triggering actor `beep-knowledge-mint[bot]`, and all three concluded `success` |
| 2 | `OpReference` rejects item names with spaces | closed | `yeet gate-table --json` with `BEEP_GH_TOKEN_REF` set to the wrapper's reference as configured (item name with spaces) exited 0 and read every open PR; without the variable the same call fails `gh did not return a gh login token`. No item-ID workaround was used in this run |
| 3 | Forced `fallow` does not finish under about 3 GB | still open | now serial, but its first sub-lane (`fallow:audit:check`, 204 packages) alone kept the scope at the 2G `MemoryHigh` until slice pressure passed 15 at 523 s. Forced `coverage` is also stuck: its prebuild runs `turbo run build --concurrency=4 --filter=@beep/repo-cli`, which ignores the concurrency 1 and was stopped at 565 s at 2.15 GB |
| 4 | No admission journal row for worker runs | closed | `~/.beep/runtime/beep-admit-uid-1001/journal.ndjson` holds 21 `admission-routed` rows from this lane (below) |
| 5 | Interim `lefthook-local.yml` still in the primary clone | still open (host owner) | the primary clone still has `lefthook-local.yml` (dated 2026-11-07) and its line in `.git/info/exclude`. The lane has none, and `LEFTHOOK` and `LEFTHOOK_EXCLUDE` were unset, so the skips below come from the profile |
| 6 | Test-file findings visible only after a hosted round trip | closed for effect-vitest | `lint effect-vitest --files <test>`: 0 findings, 2.95 s, 417 MB. A positive control (dropping the `it.layer` timeout) reported `EV014 resource-layer-without-hook-timeout` at line 150 and exited 1. `final-check` ran it as `lint:effect-vitest-files`. Hosted Lint Policy and Check were green on the first push. The test-file type check stays hosted-only, as the runbook says |
| 7 | Regeneration covers only draft pushes | unchanged by design | not exercised; no merge of `main` was needed. The runbook now documents the post-flip path |
| 8 | Host has no git identity | still open (host owner) | `git config --global user.name` is unset; commits used `GIT_AUTHOR_*` and `GIT_COMMITTER_*` per command |

## Step 2: 1Password reference with spaces

The `gh` wrapper's reference still names its item with spaces. Every character is a letter, digit,
`-`, `_`, `.`, `/`, `:` or a space, so it matches the #3276 pattern. With
`BEEP_GH_TOKEN_REF` set from the wrapper's `REF` line exactly as configured:

```text
$ bun run beep yeet gate-table --json      # exit 0, 6.1 s, 323 MB; yeet-gate-table/v1 report
$ (BEEP_GH_TOKEN_REF unset) bun run beep yeet gate-table --json
GitHub access failed (gh did not return a gh login token (exit 1)).
```

Every later Yeet GitHub call in this run (open, ready, the monitor) used the same reference.

## Criterion 1: the probe

```text
$ bun run beep compute profile
worker
$ bun run beep compute profile --json
{"profile":"worker","source":"probe","ceilingGib":7,"envelopeGib":20,"overrideRequested":null}
```

| Command | Exit | Wall | Peak RSS |
| --- | --- | --- | --- |
| `compute profile` (first, cold) | 0 | 1.80 s | 194 MB |
| `compute profile --json` | 0 | 0.74 s | 194 MB |
| `compute profile --is worker` (3 runs) | 0, 0, 0 | 0.73, 0.77, 0.71 s | 196 MB |
| `compute profile --is workstation` (3 runs) | 1, 1, 1 | 0.75, 0.74, 0.77 s | 200 MB |

Measured with `/usr/bin/time -f '%e s %M KB'` around `bun run --silent beep …`.

## Step 3: the source change

`readCgroupMembership` in `packages/tooling/tool/cli/src/internal/repo-run/MemoryStats.service.ts`
(the `/proc/<pid>/cgroup` read behind the admission budget) now runs as
`Effect.fn("MemoryStats.readCgroupMembership")` instead of `Effect.fnUntraced`.
`test/compute-profile.test.ts` shares a span recorder between the existing
`reservationCapacity` test and a new test that asserts the child span. The layer is provided through
`it.layer(ceilingMemoryStats, { timeout: "30 seconds" })`. With the span reverted, the new test
fails (1 failed, 11 passed); with it, 12 pass (6.6 s, 623 MB).

```text
$ bun run beep lint effect-vitest --files packages/tooling/tool/cli/test/compute-profile.test.ts
[effect-vitest] files=1 findings=0 scanMs=292.5 (scoped, no repository scan)
[effect-vitest] introduced=0 resolved=0
# 2.95 s, 417 MB, exit 0
```

## Criterion 3: the lane

### Commit `61accb81e0` (`LEFTHOOK_VERBOSE=1 git commit`)

```text
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  schema-catalog (skip) by condition
│  [lefthook] skip/only: bun run beep compute profile --is worker
│             result:    true
│  instrumentation-catalog (skip) by condition
│  cache-profile (skip) no matching staged files
│  jsdoc (skip) no files for inspection
│  instructions-drift (skip) no matching staged files
✔️ biome (4.51 seconds)
✔️ gitleaks (6.54 seconds)
✔️ typos (12.41 seconds)
✔️ commitlint (1.40 seconds)
```

14.8 s, 184 MB. The commit did not touch the shard: `MemoryStats.readCgroupMembership` was absent
from `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc` at `61accb81e0`.

### `bun run beep yeet final-check` (no `--force-local`)

```text
  passed final-check:expectation-rewrite (51s 410ms)
  skipped final-check:cheap-gates (0): … — compute-profile=worker
  skipped final-check:lint-policy (0): … — compute-profile=worker
  passed final-check:lint (38s 953ms): Lint (package Biome, GritQL laws)
  passed final-check:lint:changed-files (207ms)
  passed final-check:lint:effect-vitest-files (2s 371ms): Heavy / Lint Policy (lint:effect-vitest over the diff's test files; the rest of Lint Policy is hosted-only on worker)
  passed final-check:repo-sanity (1s 363ms): Repo Sanity
  skipped final-check:check (0): Heavy / Check — compute-profile=worker
  skipped final-check:docgen (0): Heavy / Docgen — compute-profile=worker
  skipped final-check:fallow (0): Fallow Advisory Envelopes — compute-profile=worker
  skipped final-check:coverage (0): Heavy / Coverage Regression, Test Unit (affected packages) — compute-profile=worker
[yeet] final-check deferred to hosted CI (compute-profile=worker): cheap-gates, lint-policy, check, docgen, fallow, coverage
[yeet] worker profile: hosted-only gates deferred; publish with `bun run beep yeet open --body-file <md>` and let hosted CI prove them
```

150 s, 609 MB. On the bot head `d4f93e123a` the same run took 96.5 s at 606 MB.

### `bun run beep yeet open --body-file <md> --title "test(compute-profile): worker acceptance repeat on dankserver"`

```text
[yeet] --pr: created draft pull request through REST -> https://github.com/beep-effect/beep-effect/pull/3277
[yeet] applied compute-profile-worker to PR #3277
[yeet] applied ready-for-heavy to PR #3277
[yeet] pull request: https://github.com/beep-effect/beep-effect/pull/3277 (draft)
[yeet] readiness monitor job: 1d2629e2-54a6-4b5c-a741-03d45c7dbe5e
```

19.9 s, 381 MB. Pushed at 16:48:25Z.

### Hosted regeneration with the App token

| Run | Event | Head | Result |
| --- | --- | --- | --- |
| 43466464064 | `pull_request` (`labeled`) | `61accb81e0` | cancelled (concurrency group, superseded by the second `labeled` event) |
| [43466467630](https://github.com/beep-effect/beep-effect/actions/runs/43466467630) | `pull_request` (`labeled`) | `61accb81e0` | success: job `Catalog Regeneration` 16:48:50Z–16:50:21Z, job `Catalog Regeneration Push` 16:50:29Z–16:50:52Z |
| [43466828951](https://github.com/beep-effect/beep-effect/actions/runs/43466828951) | `pull_request` (`synchronize`, the App push) | `d4f93e123a` | started 16:50:55Z on its own; success (push job skipped, nothing to push) |

Push-job log (job 132027742538): `actions/create-github-app-token` with the
`KNOWLEDGE_MINT_APP_CLIENT_ID` client id set ("Creating token for this repository"), then
`[detached HEAD d4f93e12] chore(catalogs): regenerate shards for the worker-profile lane`, 1 file
changed, 1 insertion, and `git -c core.hooksPath=/dev/null push` to the PR branch.

Pushed head `d4f93e123ad5bea12b0c745741f4da79fec824ff`:

- commit author and committer: `github-actions[bot]` (the job's git identity; the push credential is
  the App token);
- one file, `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc`, +1 line
  `{"name":"MemoryStats.readCgroupMembership",…}`.

Follow-up runs on that head. None was approved by hand, and none sat at `action_required`:

| Run | Workflow | Actor / triggering actor | Started | Conclusion |
| --- | --- | --- | --- | --- |
| [43466829370](https://github.com/beep-effect/beep-effect/actions/runs/43466829370) | Check | `beep-knowledge-mint[bot]` / `beep-knowledge-mint[bot]` | 16:50:55Z | success (17:07:39Z) |
| [43466829061](https://github.com/beep-effect/beep-effect/actions/runs/43466829061) | Storybook | `beep-knowledge-mint[bot]` / `beep-knowledge-mint[bot]` | 16:50:55Z | success |
| [43466828951](https://github.com/beep-effect/beep-effect/actions/runs/43466828951) | Catalog Regeneration | `beep-knowledge-mint[bot]` / `beep-knowledge-mint[bot]` | 16:50:55Z | success |

The lane pulled `d4f93e123a` fast-forward (4.0 s, 253 MB).

### Hosted green on the bot head

Each worker-deferred gate on `d4f93e123a` (run 43466829370):

| Deferred gate | Hosted check | Conclusion | Completed |
| --- | --- | --- | --- |
| cheap-gates | Repo Sanity | success | 16:55:59Z |
| fallow | Fallow Advisory Envelopes | success | 16:56:15Z |
| docgen | Heavy / Docgen | success | 16:56:53Z |
| check | Heavy / Check | success | 16:56:59Z |
| coverage | Heavy / Coverage Regression | success | 17:02:48Z |
| lint-policy | Heavy / Lint Policy | success | 17:07:38Z |

Every other check on the head was success or skipped. The runner queue was short this time:
17 minutes from the App push to the last deferred gate, against 36 minutes to the first red in the
first run.

### `yeet ready` and the ready flip

- 16:53:41Z, PR a draft, `final-check` receipt for `d4f93e123a` complete, hosted Repo Sanity
  pending: `yeet ready refused: blocked on final-check: wait for hosted Repo Sanity (worker profile
  defers cheap-gates). Re-run `bun run beep yeet ready` once it passes.` Exit 1, 10.1 s, 381 MB. The
  PR stayed a draft.
- **External event:** `issues/3277/events` shows `ready_for_review` by `kriegcloud` at
  2026-11-13T16:54:07Z, 16 s after that refusal. The lane did not flip it. `kriegcloud` is the
  account this host's Yeet calls act as, but the host's GitHub ledger
  (`~/.local/state/beep/github/ledger/rows/2026-11-13T16.jsonl`) shows no call from any Yeet
  command between the refusal's last read at 16:53:51.9Z and 16:55:00Z. The readiness monitor's log
  holds only `merge-ready: no` reads. The flip came from outside this host's Yeet tooling (the
  operator or another session on that account). As in the first run, this run cannot show
  `yeet ready` flipping a draft itself.
- The result of `yeet ready` on the final head, after hosted green, is recorded as a PR comment so
  the head does not move again.

## Step 8: `--force-local` (criterion 2b)

Runbook table: `fallow` (serial sub-lanes) and `coverage` (one package at a time) are forceable on
`worker`; `check`, `docgen`, `lint-policy` and `cheap-gates` are refused; `repo-sanity` is reduced to
changeset status. Each forced run used

```sh
systemd-run --user --scope -q -p MemoryHigh=2G -p MemoryMax=3G -p MemorySwapMax=0 --unit=<unit> \
  /usr/bin/time -f 'FORCED %e s %M KB' bun run beep yeet final-check --force-local --gates <gate>
```

with a watchdog that polled `user-1001.slice` `memory.pressure` every 5 s and stopped the scope above
`some avg10=15` or after 20 minutes. Before each run the slice's `some avg60` was below 2.

| Gate | Printed | Outcome | Wall | Scope `memory.peak` | Slice peak `some avg10` |
| --- | --- | --- | --- | --- | --- |
| `fallow` | `final-check --force-local on the worker profile runs fallow one task at a time (concurrency 1)`; ran `ci lane fallow … --validate-envelopes --serial` | stopped by the watchdog (pressure 15.39) during the first sub-lane, `fallow:audit:check` over 204 packages; exit 143 | 523 s | 2.15 GB | 15.39 |
| `coverage` | `… runs coverage one task at a time (concurrency 1)`; ran `bun run coverage --affected --concurrency=1` | stopped by the watchdog (pressure 15.53) still in `coverage:prebuild`: `op run -- bunx turbo run build … --concurrency=4 --filter=@beep/repo-cli` | 565 s | 2.15 GB | 15.53 |
| `check` | `final-check --force-local refused check on the worker profile: one package's tsgo check held 4.07 GB on dankserver, above the 1.5 GB worker bar` | refused; gate skipped with `compute-profile=worker`; exit 0 | 3.5 s | — (328 MB process) | — |

Both forceable gates sat at the scope's 2G `MemoryHigh`. The throttling raised pressure on the whole
user slice, which also hosts `t3 serve`, and the watchdog stopped them. `/usr/bin/time` printed no
per-process peak for either, because both were stopped. The attempt journal shows
`attempt-started` with `forceLocal: true`, then `attempt-terminated` with `reason: interrupted`.
No receipt holds a forced step that ran.

Two defects for main:

- forced `coverage` is not one task at a time end to end: its prebuild builds `@beep/repo-cli`
  with `--concurrency=4`, and that TypeScript build is the kind of work the table refuses for
  `check`;
- the refused `check` run still writes the head's receipt with `forceLocal: true`, `complete: false`
  and a single skipped step. That overwrote the complete receipt of the plain `final-check` on the
  same head, so the plain run had to be repeated. A refusal that forced nothing should not record
  `forceLocal: true`.

## Criterion 5: facts

Admission journal `~/.beep/runtime/beep-admit-uid-1001/journal.ndjson` (absent on this host in the
first run). The plain `final-check` on `61accb81e0` wrote one row per gate route, all with
`schemaVersion: yeet-admission-journal/v3`, `command: bun run beep yeet final-check`,
`envProfile: local`, `computeProfile: worker`, `forceLocal: false`:

| `gateRoute` | `outcome` |
| --- | --- |
| `expectation-rewrite`, `lint`, `repo-sanity` | `bypass` |
| `cheap-gates`, `lint-policy`, `check`, `docgen`, `fallow`, `coverage` | `refusal` |

`final-check` on `d4f93e123a` wrote the same nine. The forced runs wrote:

```text
{"gateRoute":"fallow","outcome":"bypass","forceLocal":true,"computeProfile":"worker"}
{"gateRoute":"check","outcome":"refusal","forceLocal":true,"computeProfile":"worker"}
{"gateRoute":"coverage","outcome":"bypass","forceLocal":true,"computeProfile":"worker"}
```

The commit's hook skips (`hook:schema-catalog`, `hook:instrumentation-catalog`) and the
`effect-vitest-files` step inside `lint` write no rows of their own.

```text
$ bun run beep quality scheduler history
admission history: 21 rows from no archive segments and the live journal
- rows read: 0 archived, 21 live; 0 duplicate(s) dropped, 0 undecodable
- admissions: 0
- worker routes: 21 (8 bypass, 13 refusal; 3 forced)
```

Attempt journal (`.beep/yeet/runs/test_compute-profile-worker-acceptance-2-*/attempts.ndjson`):
every row carries `envProfile: local` and `computeProfile: worker`. The forced run's row also has
`forceLocal: true`:

```text
{"_tag":"attempt-started","mode":"final-check","envProfile":"local","computeProfile":"worker"}
{"_tag":"attempt-started","mode":"publish","envProfile":"local","computeProfile":"worker"}
{"_tag":"attempt-started","mode":"final-check","computeProfile":"worker","forceLocal":true}
{"_tag":"attempt-terminated","reason":"interrupted","computeProfile":"worker"}
```

Final-check receipt keys (`.beep/yeet/final-check/61accb81e0….json`): `base`, `complete`,
`computeProfile`, `expectationRewrites`, `finishedAt`, `forceLocal`, `gateSetDigest`, `headSha`,
`mergeBase`, `route`, `schemaVersion` (`yeet-final-check/v2`), `startedAt`, `steps`, `verdict`.
Values: `complete: true`, `verdict: pass`, `computeProfile: worker`, `forceLocal: false`. The six
deferred steps carry `reason: compute-profile=worker`.

## Peak RSS per command

`/usr/bin/time -f '%M'` reports the largest single process in the command's tree. Scope figures are
cgroup `memory.peak`, page cache included.

| Command | Wall | Peak RSS | Step |
| --- | --- | --- | --- |
| `beep worktree new` (includes its `bun install`) | 59.9 s | 599 MB | setup |
| `bun install` (rerun in the lane) | 13.4 s | 334 MB | setup |
| `compute profile …` | 0.71 to 1.80 s | 200 MB | 1 |
| `yeet gate-table --json` (spaced reference) | 6.1 s | 323 MB | 2 |
| `vitest run test/compute-profile.test.ts` | 6.6 s | 623 MB | 3 |
| `lint effect-vitest --files <test>` | 2.95 s | 417 MB | 3 |
| `git commit` (all hooks) | 14.8 s | 184 MB | 4 |
| `yeet final-check` on `61accb81e0` | 150.1 s | 609 MB | 4 |
| `yeet open` | 19.9 s | 381 MB | 4 |
| `git pull --ff-only` (bot commit) | 4.0 s | 253 MB | 6 |
| `yeet final-check` on `d4f93e123a` | 96.5 s | 606 MB | 6 |
| `yeet ready` (draft, refused) | 10.1 s | 381 MB | 6 |
| `final-check --force-local --gates fallow` (scope) | 523 s, stopped | scope 2.15 GB | 8 |
| `final-check --force-local --gates check` (refused) | 3.5 s | 328 MB | 8 |
| `final-check --force-local --gates coverage` (scope) | 565 s, stopped | scope 2.15 GB | 8 |
| `quality scheduler history` | 1.7 s | 305 MB | 9 |

Every lane command in the criterion-3 window stayed under the 1.5 GB bar, at 609 MB or less. No
whole-package type check or whole-repo scan was run locally. The only scope above 1.5 GB was the two
forced gates, each measured as a cgroup aggregate.

## Host notes

- The primary clone still has the interim `lefthook-local.yml` and its `.git/info/exclude` line.
  Host configuration was not changed.
- The host still has no git identity.
- `beep worktree new` copied `.env` and `.claude/settings.local.json` only, not
  `lefthook-local.yml`.
