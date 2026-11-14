# PERIH-11 slice 2: the first pin-bump pull request, read on main

Slice 7 (#3299) merged on 2026-11-14 at 05:31Z as `c2de80d2a0`. Its checkpoint left three things to
read on main after the merge. This note records what was read on the day; the times are UTC and come
from `gh run view`, `gh release list` and the pull request's timeline.

## Reading 1: the first run re-records and opens the catch-up pull request

Run [43561962054](https://github.com/beep-effect/beep-effect/actions/runs/43561962054) on
`c2de80d2a0`, the merge commit itself:

| step | result |
| --- | --- |
| Compare the closure digest with the latest release | success (the digest moved: the workflow file is a closure input) |
| Compile the CI binary | success |
| Compare the compiled binary with the latest release | success (byte-identical) |
| Re-record the closure digest on the byte-identical release | success |
| Publish the release asset | skipped |
| Rewrite the pin to the newest release | success |
| Check the pin-bump App credential, Create pin-bump App token | success |
| Open or update the pin-bump pull request | success |

No `beep-ci-c2de80d2a0*` release exists, so the run cut none. It opened #3326 from
`ci/beep-ci-pin-bump`, authored by the knowledge-mint App, labelled `ready-for-heavy`, with one
changed file: the `BEEP_CI_RELEASE_TAG` and `BEEP_CI_SHA256` values in
`.github/actions/fetch-beep-ci/action.yml`, from `beep-ci-a56516d6d309` to `beep-ci-ae70a0c0a3f8`.
The body names the release tag, closure digest, sha256, the commit the release was built from and
the commit the pull request was opened at.

## Reading 2: a newer release updates the same pull request

#3322 landed at 05:35Z as `00e2e35dba` and changed the closure. Run
[43562275988](https://github.com/beep-effect/beep-effect/actions/runs/43562275988) published
`beep-ci-00e2e35dbaee` at 05:35:28Z. At 05:38Z the App force-pushed `ci/beep-ci-pin-bump` and
retitled #3326 for the new tag. No second pull request was opened.

## Reading 3: the pull request's own Check

Check run [43562483230](https://github.com/beep-effect/beep-effect/actions/runs/43562483230) on the
force-updated head `2337e7bee7b3` started because the App opened the pull request; a `github.token`
pull request would have started none. At 05:56Z it stood at 48 passed, 12 skipped and none failed.
Heavy Admission passed at 05:44:43Z and admitted the five heavy lanes, which were still queued for a
heavy runner twelve minutes later. The result of those lanes is not read in this note; it belongs
with the readings below, in the note written when the bump merges.

## Not read yet

- After the bump merges, a main push with an unchanged closure must open no pull request.
- The next real closure change after that merge must open one.

## Cadence

`gh release list` counts 27 `beep-ci-*` releases on 2026-11-09, 21 on 2026-11-10, 15 on 2026-11-12
and 21 on 2026-11-13. A pending bump is replaced on every release, so at that cadence the pull
request's Check and its review window restart about hourly, each restart is a heavy-admitted run,
and each merge is an operator hand merge of a `.github` edit. No rule limits when a pending bump is
replaced. That is an open question for the driver, recorded in `research/OPPORTUNITIES.md`; the
automation is unchanged.
