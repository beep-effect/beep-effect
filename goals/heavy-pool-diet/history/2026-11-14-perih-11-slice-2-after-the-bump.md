# PERIH-11 slice 2: the first pin bump merged, and what main did next

This continues `2026-11-14-perih-11-slice-2-on-main-reading.md`, which stopped while #3326's heavy
lanes were still queued. Times are UTC, read from the pull request, check-run and job records.

## Reading 3: the pin-bump pull request passed its own Check

Check run [43562483230](https://github.com/beep-effect/beep-effect/actions/runs/43562483230) on
#3326's head `2337e7bee7b3` (the pin for `beep-ci-00e2e35dbaee`): 55 check runs succeeded, 13 were
skipped and none failed. Every hosted job that fetches the CI binary ran the new pin on that head.

| heavy lane | result | ran |
| --- | --- | --- |
| Heavy / Check | success | 06:00:45 to 06:01:44 |
| Heavy / Build | success | 06:00:53 to 06:01:57 |
| Heavy / Doctest | success | 06:03:46 to 06:06:21 |
| Heavy / Docgen | success | 06:03:54 to 06:04:16 |
| Heavy / Lint Policy | success | 06:05:21 to 06:09:29 |

Heavy Admission finished at 05:44:43, so the lanes waited 16 to 21 minutes for a heavy runner. The
pull request had no review thread; the reviewer bot's second-round summary found the pinned tag and
sha256 equal to the published release. It merged on 2026-11-14 at 07:05:48 as `76238b4c11`, and
`main` pins `beep-ci-00e2e35dbaee`.

## Reading 4: a main push with an unchanged closure opens nothing

The pin file is not in `beep-ci-binary.yml`'s path filter, so the bump's own merge commit started no
run. The next two main pushes that matched the filter both left the closure unchanged:

| main commit | run | closure compare | compile, publish | pin step | pull-request steps |
| --- | --- | --- | --- | --- | --- |
| `f73dc7470e` (#3331), 07:44:40 | [43572516713](https://github.com/beep-effect/beep-effect/actions/runs/43572516713) | success | skipped | success | skipped |
| `b71a0d7050` (#3332), 08:24:25 | [43575683212](https://github.com/beep-effect/beep-effect/actions/runs/43575683212) | success | skipped | success | skipped |

Neither run cut a release (the newest is still `beep-ci-00e2e35dbaee`), and no pull request is open
on `ci/beep-ci-pin-bump`.

## What this settles, and what it does not

The SPEC acceptance line for PERIH-11 holds on these readings: releases follow a closure-digest
change only (readings 1, 2 and 4), a closure change produced a reviewed pin-bump pull request that
passed its own Check and merged (readings 2 and 3), and the closure mutation fixtures are in
`ci-binary-closure.test.ts` since #3145.

The case this note first listed as not yet seen was read later the same day; see readings 5 and 6.

The cadence question in the earlier note is still open with the CI goals driver.

## Reading 5: a closure change after a merged bump opens a new pull request

#3325 landed at 08:48:39 as `6d366333e2` and changed the closure. Run
[43577567105](https://github.com/beep-effect/beep-effect/actions/runs/43577567105) compiled, published
`beep-ci-6d366333e222` at 08:50:05 and ran the pull-request steps. The branch had been deleted when
#3326 merged, and the lookup found only that merged pull request. The App opened a new one, #3334,
at 08:50:17 with one commit, and labelled it `ready-for-heavy` at 08:50:19.

#3334's head `53642ee055` finished with 61 check runs succeeded, 17 skipped and none failed. It had
no review thread and was never force-pushed. It merged at 10:18:16 as `b7d3c9d99a`, and `main` pins
`beep-ci-6d366333e222`.

## Reading 6: a main push leaves an open, current pull request alone

Two more main pushes reached the workflow around #3334's merge. The pin step's own summary is not in
the job log, so the state each one read is taken from when its pin step ran.

| main commit | run | closure compare | compile | publish | pin step ran | pull-request steps |
| --- | --- | --- | --- | --- | --- | --- |
| `b894a89306` (#3330), 10:05:21 | [43583598511](https://github.com/beep-effect/beep-effect/actions/runs/43583598511) | unchanged | skipped | skipped | 10:06:34, #3334 open and labelled, branch pinning the newest release | skipped |
| `62a108a97e` (#3323), 10:17:50 | [43584597812](https://github.com/beep-effect/beep-effect/actions/runs/43584597812) | changed | success | skipped (byte-identical, digest re-recorded) | 10:19:04, 48 seconds after #3334 merged | skipped |

The first run neither pushed the branch nor edited the pull request, so it did not restart #3334's
Check. The second ran from a checkout that still held the old pin while live `main` already pinned
the release; it opened nothing, which is the stale-checkout case the #3299 review asked for.

## Found while reading: #3334 ran its heavy lanes twice

On `53642ee055` the five heavy lanes ran in two runs created in the same second (08:50:21):
`Check` run 43577694802 and `Heavy Admit` run 43577695303, ten heavy jobs for one head.

| lane | Heavy Admit run | Check run |
| --- | --- | --- |
| Heavy / Lint Policy | 09:18:05 to 09:22:11 | 09:32:10 to 09:36:16 |
| Heavy / Build | 09:20:45 to 09:21:35 | 09:29:18 to 09:30:12 |
| Heavy / Doctest | 09:23:36 to 09:26:09 | 09:27:44 to 09:30:21 |
| Heavy / Check | 09:23:39 to 09:24:38 | 09:31:40 to 09:32:34 |
| Heavy / Docgen | 09:26:24 to 09:26:45 | 09:27:32 to 09:27:53 |

The pull request was labelled two seconds after it was opened. `Check` saw the label and admitted
the lanes, and the `labeled` event started `Heavy Admit`, which admitted them again. The other heads
read today ran them once: on #3326's head only `Check` ran them, and on #3330's first head and
#3332's head (opened by `yeet open`, labelled after `Check`'s admission had run) `Check` skipped its
Heavy call and only `Heavy Admit` ran them. The fix would sit in `check.yml` or `heavy-admit.yml`,
which this goal changes only with the CI goals driver's word, so it is recorded here and in
`research/OPPORTUNITIES.md` and not changed.
