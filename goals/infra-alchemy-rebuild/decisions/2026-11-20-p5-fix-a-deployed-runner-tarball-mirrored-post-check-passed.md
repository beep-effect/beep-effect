---
title: "P5 fix A deployed: runner tarball mirrored, post-check passed"
date: 2026-11-20
kind: checkpoint
lane: "docs/infra-alchemy-p5-fix-a-checkpoint"
reversal: "none: a checkpoint; the code reverts with #3443 and #3442, the boundary with set-default-policy-version v1"
---

Fix (A) deployed to the CiRunners stack on 2026-11-20, and its post-check passed. The CI goals driver closed it.

- **What deployed:** #3443 (`eb68bf2edf3`). The runner-binaries syncer now mirrors the runner tarball by multipart
  upload, and the syncer role gains `s3:AbortMultipartUpload`. #3442's memory change (256 MB for the SSM housekeeper
  and the termination watcher) rode the same dispatch.
- **Boundary:** before the dispatch, the gate published fleet boundary version v2 (`+s3:AbortMultipartUpload` in
  `CeilingFleetBinaries`). It is byte-identical to the generated document. v1 is kept for rollback.
- **Plan:** plan_only run 44697391034 printed digest `14cd803c…42ab` over 73 rows: 11 function updates and 62 noop.
- **Dispatch:** run 44697771513, armed from 07:49:09Z to 07:49:22Z. The deploy step re-planned to the same digest and
  applied it, and the webhook still answered an unsigned event with 401.
- **Code and memory:** all 11 functions updated successfully, each with the code hash the bundle build predicted. The
  housekeeper and the watcher are at 256 MB, and the pool instance-type lists are unchanged.
- **CloudTrail:** two reads of the deploy role's management events (07:49 to 08:00Z), 411 events each, identical.
  - The webhook URL permission was read once with GetPolicy, with no RemovePermission or AddPermission.
  - No AccessDenied errors, and no writes to the old fleet.
  - 22 log-group writes and 22 IAM writes, all on the 11 functions' own roles. The syncer role's policy changed by
    exactly `+s3:AbortMultipartUpload`; the other 10 were byte-identical to the previous deploy.
- **Announced one-off invokes:**
  - The first syncer run took 8.3 s and 41% of its 1024 MB. It uploaded the 228,071,396-byte tarball, tagged with its
    release name, and left no multipart upload in progress.
  - A second syncer run skipped on the tag.
  - The housekeeper used 53% of its 256 MB.
- **Role simulation:** the live syncer role is allowed abort, put and put-tagging on the tarball key. It is still
  denied abort on any other key.
