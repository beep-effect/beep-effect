---
title: "Step 6 (d) destroyed the whole Pulumi ci-runners stack; P6 retires the AWS cache's credentials"
date: 2026-11-26
lane: "chore/infra-alchemy-p6-retire"
reversal: "Credentials: none needed, they served a destroyed cache. Fleet: the cutover decision's Rollback after (d), from the archived export at a checkout at or before dd10bba5."
---

Cutover step 6 (d) (`2026-11-14-ci-runners-cutover-from-pulumi`) asks for a choice, made from a destroy preview, between a whole-stack and a targeted destroy, with the preview's count on record. This file is that record, plus the receipt and what P6 retires around it.

**Choice: whole stack.** `pulumi destroy --preview-only --stack production` from a checkout at `dd10bba55d35` listed 353 resources to delete. Only the fleet, its network, reaper and controllers, and the AWS turbo-cache leftovers (`CiTurboCache`) remained, and the Turbo cache had moved to the Worker (`@beep/infra-turbo-cache`, stage 2). The CI goals driver ruled "GO, whole stack, including CiTurboCache" on 2026-11-26 at 04:05Z. The program and its state readers were deleted by this PR, so the destroy ran from that pinned checkout and not from this branch.

**Receipt.** The state export was taken at 04:00:21Z, outside the repo (354 resources, step 6 (c)).

- Run 1, 04:04:46–04:12:07Z: 347 deleted and 2 errored. The AWS cache's artifact bucket refused deletion with `BucketNotEmpty`: it held 6111 Turbo artifacts (about 245 MB), the newest written 2026-11-09. Versioning had never been enabled, and nothing in `.github` read the bucket, `vars.TURBO_API` or `secrets.TURBO_READ_TOKEN`. The run stopped there, as the driver's word required.
- The driver ruled at 04:57Z to empty the bucket and re-run the same destroy. The other option, `pulumi state delete` on the bucket, was rejected because it would leave an orphan bucket outside any IaC.
- 04:57Z: a key manifest (key, size and modification time only, no contents) was written outside the repo, and the bucket was emptied. It then listed 0 keys, 0 versions and 0 delete markers.
- Run 2, 04:58:19–04:58:26Z: 6 deleted and 0 errored.
- Across both runs, 353 were deleted, matching the preview. `pulumi stack --show-urns` lists 0 resources and the bucket returns 404.
- 04:58:47Z: no instance of the old fleet is in any state except terminated. Its VPC is gone. The only registered org runners are the new fleet's.
- A `beep-fleet-*` runner picked up a Heavy job at 04:58:50Z.

**Credentials P6 retires.** These belong to the destroyed AWS cache:

- repository variables `TURBO_API` and `TURBO_TEAM`;
- repository secrets `TURBO_READ_TOKEN` and `TURBO_TEAM`;
- the `turbo-cache-write` environment's `TURBO_TOKEN`.

They leave `@beep/infra-github`'s unmanaged lists and census fixture in this PR. The live objects are deleted, one name per command, right before the operator's hand merge, and a names-only list read follows. The `turbo-cache-write` environment stays, because it holds the Worker cache's `TURBO_CACHE_WRITE_TOKEN`. The two Pulumi repository webhooks, 663255260 and 711445970, were deleted at step 6 (b), so the webhook census keeps only 714397446. A workstation `.env` that still points `TURBO_API` at the AWS host only loses its remote cache reads.

**After the merge.** `pulumi stack rm production` runs on its own word once nothing in the repository names the stack. Until then, the stack's history and config stay in the state backend beside the export. Step 6 (f), which covers the old SSM App parameters, the KMS key, the permissions boundary and whether to retire the `beep-ci-fleet-controller` App, takes the operator's word.

**Reversal.** No reversal is needed for the credentials, which authenticated only against a cache that no longer exists. For the fleet, follow the cutover decision's "Rollback after (d)": restore the stack from the export at the pinned checkout, re-deploy it, and re-create the webhooks on its fresh URLs. The bucket's artifacts are rebuildable cache entries, and the manifest records which keys existed.
