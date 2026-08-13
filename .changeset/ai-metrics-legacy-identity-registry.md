---
"@beep/repo-ai-metrics": patch
---

Migrate populated pre-fingerprint identity registries when a stable salted
identity digest proves namespace continuity. Unprovable legacy registries and
confirmed hash-salt rotations remain hard failures. Retry transient OTLP queue
saturation without replaying acknowledged chunks, and expose the sanitized
collector failure in forwarder status.
