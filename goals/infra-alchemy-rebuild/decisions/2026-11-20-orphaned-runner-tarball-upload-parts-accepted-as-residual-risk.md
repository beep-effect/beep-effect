---
title: "Orphaned runner-tarball upload parts accepted as residual risk"
date: 2026-11-20
lane: "fix/runner-binaries-s3-upload"
reversal: "give the CiRunners deploy role s3:PutLifecycleConfiguration on the binaries bucket and add an AbortIncompleteMultipartUpload rule of 1 day"
---

The CI goals driver accepted a residual risk on 2026-11-20 for the runner-tarball mirror, which is now a multipart
upload: orphaned parts in the new fleet's binaries bucket.

- **When it happens:** an upload's `AbortMultipartUpload` never runs, because the binaries-syncer function is killed
  by its 5-minute timeout or by running out of its 1024 MB, or the abort itself fails. The upload's parts then stay in
  the bucket, stored and billed.
- **Bound:** the syncer runs once a day and uploads only when a new runner release appears. So at most one orphaned
  part set of at most 228 MB a day (the v2.338.2 asset is 228,071,396 bytes).
- **Why no lifecycle rule:** an `AbortIncompleteMultipartUpload` rule would clean these up automatically. But the
  CiRunners deploy role has no `s3:PutLifecycleConfiguration`, and adding it would be a new deploy-role write.
- **Cleanup:** by hand. List with `aws s3api list-multipart-uploads --bucket <binaries bucket>`, then abort each with
  `aws s3api abort-multipart-upload`.
- **Watch:** the post-deploy check after every CiRunners deploy confirms `ListMultipartUploads` is empty after the
  announced one-off syncer invoke.
