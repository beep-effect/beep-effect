# Storybook declaration-context observations

The unmodified schema-resolution path passed a fresh hosted Storybook check on the dependency-refreshed source. The proposed source aliases have no demonstrated necessity in that observed profile. This PR therefore withdraws the aliases and the temporary diagnostic formatting option, leaving the Storybook configuration identical to accepted main.

## Observed checks

The earlier [failed Check](https://github.com/beep-effect/beep-effect/actions/runs/42314750102/job/128225577677) executed the #2826 source on base b0c9bab1. It reported missing TaskItem.make and TaskList.make members and unknown conversion requirements. Identity, schema and Markdown builds reported cache hits. Replayed build-command lines did not mean those builds ran fresh.

The [candidate Check](https://github.com/beep-effect/beep-effect/actions/runs/42316703391/job/128234151275) passed with the proposed aliases on base b0c9bab1. It reported the same three prerequisite cache keys as the earlier failure and a fresh Storybook check.

The [original-resolution control Check](https://github.com/beep-effect/beep-effect/actions/runs/42322719277/job/128253098816) passed on base d8f335ca, after the dependency refresh. It reported new identity, schema and Markdown cache keys and fresh editor and Storybook checks. The companion JSON retains the task keys, source hashes and immutable log digests.

## Limits and disposition

These hosted profiles do not match. Their actual bases have different root manifests and lockfiles, even though local branch-only native plans differed only in the Storybook configuration. The event's base-SHA field did not identify the base that checkout actually executed. Use the executed merge and resolved workflow records when joining evidence.

Native cache-hit lines alone do not identify remote reads versus local or Actions-archive restoration. Task-key equality does not authenticate restored bytes. The observations prove neither cache corruption nor the historical root cause.

Retain the historical divergence as an explicit qualification case. Current-profile fresh/hit equivalence, semantic invalidation, portable outputs, concurrency and safe logs still require their own evidence before adoption. No task is promoted and no whole-goal criterion or observation window is completed by this report. Restore the alias candidate from 63f21c77 only if a matched current-profile reproduction establishes its need.
