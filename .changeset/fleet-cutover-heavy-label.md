---
"@beep/infra": patch
---

Cut the CI fleet controller over to the production heavy-lane label. The default
runner label becomes `beep-ec2-heavy`, `job_retry` is enabled so a runner that
dies between launch and pickup re-queues its job instead of stranding it,
`runners_maximum_count` rises to 10 so a full main wave plus an overlapping PR
wave runs without serializing, and `ciRunners:reaperTtlMinutes` moves to 150 so
the tag-based reaper clears the 120-minute Check lane timeout.
