---
title: "Step 6b deletes the Pulumi repository webhooks and keeps the fleet's"
date: 2026-11-25
lane: "feat/ci-runners-6b-webhook-switch"
reversal: "Re-create repository webhooks 663255260 and 711445970 on the Pulumi controllers' recorded execute-api URLs with their events and secrets, and restore the App webhook's workflow_job delivery if step 6b stopped it."
---

Cutover step 6b (`2026-11-14-ci-runners-cutover-from-pulumi`, step 6 (b)) takes the Pulumi controllers off `workflow_job` delivery. Three repository webhooks deliver it today: 663255260 and 711445970 point at the Pulumi heavy and overflow controllers' `execute-api` URLs, and 714397446 is the overlap hook on the new fleet's function URL. The CI goals driver ruled option B on 2026-11-25. At T = 2026-11-26T16:00Z, hooks 663255260 and 711445970 are deleted, and 714397446 stays as the fleet's only delivery path. The runner App's webhook is not pointed at the function URL.

**Why B.** The missed-event check reads repository hook deliveries with the fleet-watch App's `repository_hooks: read`. App webhook deliveries can be read only with the App's JWT. Moving delivery to the App (option A, the cutover decision's original step) would leave the check with no delivery evidence from T onward: its `MissedDelivery` and `Delivered` verdicts would end, and only `Gate` evidence would remain. B keeps them live. B also has fewer moving parts at T: no App URL change, no JWT, no overlap window. Repository and App webhooks use the same delivery machinery, and the fleet serves this one repository. Option C, keeping both paths onto the function URL, would deliver every event twice. The fleet's webhook path has no dedupe and its queued check is off in production, so C would need new dedupe code, and it was rejected. No code changes: the check's hook timeline keeps naming repository hook 714397446, and `ci shard-overflow-preflight` keeps requiring a live repository hook to the function URL.

**The App webhook.** The runner App's settings page was read on 2026-11-25 at about 21:45Z, with the operator's sudo-mode access. The `beep-ci-fleet-controller` webhook is active, its URL host is the Pulumi fleet's `execute-api`, "Workflow job" is ticked under Subscribe to events, and "Workflow run" is not. The driver ruled at 21:40Z that at T, in the same step as the hook deletions, the operator sets this webhook inactive by unticking Active on the settings page. Deactivating it stops its deliveries and leaves the App's API use (installation tokens, JIT runner configs) unchanged. Re-ticking Active reverses it. The webhook is never pointed at the function URL. `beep github app` only mints an App, so the change goes through the settings page.

**Preconditions at T.**

- The driver's word naming T.
- This PR merged by 2026-11-26T15:00Z, in a slot of its own. The infra-github README is in `deploy-infra-github.yml`'s push paths, so the merge opens a deploy first hour, which must end before T.
- One green `fleet-missed-event-check` run at a `main` commit that contains #3539, within its request budget and with its token revoked. A scheduled run counts. If none has run by 2026-11-26T12:00Z, the driver may word one read-only `workflow_dispatch` on `main`.
- An hour of its own: nothing merges, and the hour overlaps no other CI-behaviour change.
- The Pulumi fleet idle (step 6 (a)), checked at T-5 min: `aws ec2 describe-instances --filters Name=tag:ghr:environment,Values=beep-ci,beep-ovf Name=instance-state-name,Values=pending,running` returns none, and `gh api orgs/beep-effect/actions/runners` lists no `beep-ci-` or `beep-ovf-` runner.
- The `deploy-infra-github.yml` run that this PR's merge starts has finished, and its first hour has ended.
- Each deleted hook's configuration (`gh api repos/beep-effect/beep-effect/hooks/<id>`: URL, events, content type, active; no secret is returned) is captured into the 6b log before the deletion, so a rollback uses the exact configuration.

**Proof, in the hour after T.**

- The next fleet job's queued delivery on 714397446 returns 2xx, and a `beep-fleet-*` runner picks the job up.
- `gh api repos/beep-effect/beep-effect/hooks` lists only 714397446.
- The App's settings page shows its webhook inactive.
- Delivery on 714397446 for a fleet job queued after T: the hook's recent deliveries show a 2xx `queued` delivery whose payload names that job. If a job stays queued for five minutes or more, the next missed-event check prints `delivery <id> (2xx)` for it; a run with no such job prints no delivery line, so the hook's delivery list is the proof.

**Rollback.** Before the Pulumi destroy (step 6 (d)): re-create the deleted hooks from the configuration captured at T, with the same secrets, and tick Active on the App webhook again. After the destroy the recorded `execute-api` URLs no longer reach anything: follow the cutover decision's "Rollback after (d)" (restore the stack from the archived export, read the recreated `controllerWebhook` and `shardOverflowWebhook` outputs), then re-create the hooks on those fresh URLs and re-activate the App webhook on `controllerWebhook`.
