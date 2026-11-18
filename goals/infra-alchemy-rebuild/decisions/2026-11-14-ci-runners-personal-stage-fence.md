---
title: "Personal ci-runners stages launch nothing and register repository runners only"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Give personalConfig the production caps, runnerType Org and allow list, and let stageCredentials read the environment in every stage."
---

A personal stage (`dev-$USER`; since 2026-11-18 the stage name must be canonical, so `dev_$USER` is refused by `requireDistinctStage`) deploys the same graph as `prod` under its own names, but by default it cannot run or register a runner anywhere:

- Every pool cap is 0, so scale-up never launches; the webhook's repository allow list is empty, so it drops every event.
- Runners register as repository runners (`runnerType: "Repo"`), never organization runners, so even a rehearsal cannot put a runner into the org groups `beep-ec2-heavy` or `beep-shard-overflow` that production jobs use.
- The App credentials are placeholders (`unset`) whatever the environment holds; `stageCredentials` reads the three `CI_RUNNERS_GITHUB_*` variables only for `prod` and for a rehearsal, so a stray variable on a workstation never reaches a personal fleet.
- The names are fenced from the live fleet (physical-names decision). The reaper and the termination watcher both match the stage's own pool environments exactly (`beep-fleet-<slug>-heavy`, `beep-fleet-<slug>-overflow`). The watcher matched by prefix until 2026-11-18, which would have let `dev-a`'s watcher act on `dev-a-b`'s runners; it now takes the exact list, and its retry path re-reads the instance and checks the same list before deregistering.
- The account guard (`requireDeployTarget`) and the `CI` guard on `prod` run first.

Rehearsals that launch runners are deferred (amended 2026-11-18). During the overlap the Spot budget reserves the whole quota (live fleet at burst cap 6 plus the `prod` overlap caps), so a launching rehearsal is refused at decode, and the procedure below cannot run until an approved configuration explicitly allocates rehearsal capacity, after the live fleet is destroyed. The no-rehearsal plan (`bunx alchemy plan --stage "dev-$USER"`) stays available. When enabled, a rehearsal opts in with `CI_RUNNERS_REHEARSAL_REPOSITORY=<owner>/<repo>`, a sandbox repository other than `beep-effect/beep-effect` (the schema refuses that one). It then needs the App credentials, each pool may launch one repository runner for that repository alone, and the Spot budget still reserves the live fleet and the `prod` overlap caps. The credentials come only through `op run` from references, never files or arguments, for example:

```sh
eval "$(aws configure export-credentials --profile elpresidank-vault --format env)"
export AWS_REGION=us-east-1
cd packages/tooling/infra/ci-runners
CI_RUNNERS_REHEARSAL_REPOSITORY=<owner>/<sandbox> \
CI_RUNNERS_GITHUB_APP_ID=op://<vault>/<item>/<app-id field> \
CI_RUNNERS_GITHUB_APP_KEY_BASE64=op://<vault>/<item>/<base64 key field> \
CI_RUNNERS_GITHUB_WEBHOOK_SECRET=op://<vault>/<item>/<rehearsal webhook secret field> \
  op run -- bunx alchemy deploy --stage "dev-$USER" --env-file /dev/null
```

The App must be installed on the sandbox repository, and the sandbox needs a repository webhook (`workflow_job`) pointing at the stage's function URL with the rehearsal secret. Which App and which references to use is an open question for the gate (cutover decision); no rehearsal was run by this lane.
