---
title: "Prepare the shard overflow cutover without applying anything"
date: 2026-11-13
lane: "ci/shard-overflow-cutover"
reversal: "Revert the pull request: the caller returns to the local path with --callee local, the binary pin to beep-ci-202927595d64 and ciShardOverflow leaves the stack config; nothing live changed, so nothing else to undo."
---

Enablement step 4 of the shard overflow list (#3256), prepared as one pull request the operator merges by hand, after steps 2 and 3 exist.

- **Caller.** `check.yml`'s `test-unit-overflow` calls `beep-effect/beep-effect/.github/workflows/shard-overflow.yml@main`, the one definition the `beep-shard-overflow` runner group admits, and the routing step passes `--callee pinned` so pull requests from this repository route too. `ci-shard-overflow.test.ts` now requires the pinned pair; going back means both lines together.
- **Binary pin.** Test Plan's routing step runs the pinned CI binary, and `beep-ci-202927595d64` predates `ci shard-overflow`. The pin moves to `beep-ci-a56516d6d309`, which `Publish Beep CI Binary` compiled from #3256's merge commit (`a56516d6d30`), sha256 `6dfe082d...`. The asset was downloaded, its sha256 checked against the release digest and the pin, and `beep-linux-x64 ci shard-overflow --help` answered. The release is built from `main`, not from this pull request's head, as the pin rule requires.
- **Stack config.** `infra/ci-runners/Pulumi.production.yaml` gains `ciShardOverflow:enabled: "true"` and the overflow webhook secret's parameter ARN; `ciShardOverflow:heavyBurstCap` stays at its default of 8. No workflow applies the stack, so merging creates nothing; the next attended apply of `infra/ci-runners` creates the overflow controller, which is why the runner group (step 2) and the parameter (step 3) come before this merge.
- **Preview fix.** The first read-only `pulumi preview --refresh` of the enabled pool failed with six errors: `CiFleetController` looked up the `beep-ci-ovf-*` termination-watcher functions for its KMS decrypt grants, and in a preview `dependsOn` did not defer the lookup of functions only the apply creates, so no plan could be saved for step 5. The lookup's name now waits on the module's build-queue ARN, unknown only while the module is being created. With it the preview exits 0: 142 creates (the overflow controller and its six grants), one provider version update, no change to the heavy pool's 141 resources, and one unrelated re-create, the turbo-cache throttle alert's e-mail subscription, which is gone from AWS.
- **Still off.** `BEEP_SHARD_OVERFLOW` stays unset; until it is `on`, Test Plan skips the routing step and every partition runs hosted, so the pinned caller changes nothing on its own.
