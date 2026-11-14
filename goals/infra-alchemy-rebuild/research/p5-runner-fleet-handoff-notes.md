# P5 runner fleet: handoff notes from the runner composite lane

Recorded 2026-11-14 for whoever builds `@beep/infra-ci-runners` (P5). They come from the lane that built
`@beep/alchemy-github-runners` (#3314) and are not in that lane's decision files or the runbook.

1. `RunnerFleet` takes `RunnerFleetProps.make({...})` (an opaque schema). The App id, App key and webhook secret
   are `Redacted`. Build each pool with `RunnerPool.make`.
2. `launchTemplate` carries only the AMI, security groups, the public-IP setting, disks, EBS optimisation and
   tags. The composite always sets the instance profile, user data, IMDSv2 with instance metadata tags (hop
   limit 1) and shutdown behaviour `terminate`.
3. The live fleet's post-install step disables IMDS, so an instance cannot terminate itself through the API
   afterwards; it relies on the `terminate` shutdown behaviour.
4. Destroying the fleet runs the runner sweep first: it retries busy runners for about two minutes, then fails
   with `RunnerSweepIncomplete` if any runner is still registered. Drain the fleet first, or allow for this at
   cutover.
5. Non-ephemeral pools ignore `jitConfig` and register with `config.sh`. A runner that exits non-zero
   terminates its instance.
6. One function-URL webhook serves every pool, so one GitHub App webhook replaces the live fleet's two.
7. Nothing is deployed. The only live-shaped check is the destroy-order test against recording fakes, so read
   P5's first plan with dependency ordering in mind.
