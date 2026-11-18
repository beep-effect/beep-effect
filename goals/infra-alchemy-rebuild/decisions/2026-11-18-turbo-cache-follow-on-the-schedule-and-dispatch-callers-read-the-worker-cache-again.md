---
title: "Turbo-cache follow-on: the schedule and dispatch callers read the Worker cache again"
date: 2026-11-18
lane: "goals/infra-alchemy-rebuild-turbo-cache-inputs-restore"
reversal: "Revert this PR: data-sync.yml and property-laws-nightly.yml go back to passing no cache inputs and run local-only; job-env and every other caller are unchanged."
---

Last PR of the turbo-cache stage-2 follow-on chain (packet gate GO after #3385 merged the `job-env` read grant and #3389 bumped the pin to `beep-ci-69e898ef9350`). `data-sync.yml` (dispatch only) and `property-laws-nightly.yml` (schedule and dispatch), the only remote-cache callers that run on schedule or dispatch alone, pass `turbo-remote-cache`, `turbo-api` (`vars.TURBO_CACHE_API`), `turbo-team` (`vars.TURBO_CACHE_TEAM`) and `turbo-read-token` (`secrets.TURBO_CACHE_READ_TOKEN`) again, never a write token and no R2 inputs, and the "local-only until" comments are gone. This supersedes the local-only part of the stage-2 decision. Proof: the pinned `beep-linux-x64` from `beep-ci-69e898ef9350` (checksum verified) and the source command both write `TURBO_CACHE=local:rw,remote:r`, the read token and mode `read-only (main schedule or dispatch)` for `schedule` and `workflow_dispatch` on `refs/heads/main`, and `local:rw` / `local-only` for a dispatch on another branch, byte-identical between the two; the #3385 test in `ci-runner-security.test.ts` pins the same cases. `certainty-nightly.yml` is untouched, and the change does not gate window 6.
