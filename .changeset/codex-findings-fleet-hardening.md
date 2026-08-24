---
"@beep/infra": patch
---

Harden CI fleet bootstrap: fail closed before runner registration when the
job-start metadata hook cannot be armed, and require digest-verified root-owned
Bun artifacts on the baked fast path (codex-security-findings-2026-08-24
CSF-003/CSF-009 repo-side remediation).
