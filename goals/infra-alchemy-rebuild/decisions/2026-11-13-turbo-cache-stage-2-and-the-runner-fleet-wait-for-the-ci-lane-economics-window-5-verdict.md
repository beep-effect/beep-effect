---
title: "Turbo-cache stage 2 and the runner fleet wait for the ci-lane-economics window-5 verdict"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "Proceed with stage 2 or P5 earlier only if the window-5 owner agrees to restart the measurement window."
---

Agreed 2026-11-13 with the orchestrator and the CI window-5 owner. Repointing heavy.yml, check.yml and the setup-monorepo-ci action to the Worker cache (stage 2) and replacing the runner fleet (P5) both change what window 5 measures, so they release on the window-5 census verdict (scheduled 2026-11-20T20:10Z), not on the clock: on a pass both release; on a denial stage 2 may land as a repair before window 6 and P5 waits for window 6's verdict. Nothing live degrades meanwhile: the AWS Lambda cache and the R2 pilot keep serving and the Worker cache runs beside them. Deploy workflows this packet adds are push-to-main only, one hosted job with `timeout-minutes`, and every PR that adds or edits a workflow is disclosed to the orchestrator and merged by the operator.
