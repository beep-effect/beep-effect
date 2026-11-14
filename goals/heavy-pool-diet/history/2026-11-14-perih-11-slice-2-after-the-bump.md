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

Not yet seen: a closure change after a merged bump opening a new pull request. #3326 was opened as
the catch-up bump and then updated in place for the next release. The next bump starts from a
different state: the branch is gone (deleted at merge) and the lookup finds the merged #3326. That
state has not run on main yet. It will be read on the next release.

The cadence question in the earlier note is still open with the CI goals driver.
