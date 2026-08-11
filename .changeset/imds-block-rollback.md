---
"@beep/infra": patch
---

Roll back the CI fleet controller's host IMDS `iptables` DROP: it keyed on the
`ec2-user` uid, but the runner agent runs as that user, so the rule starved the
agent at start-up and workers failed to register (caught by the Gate E probe
before any cutover). The 64 GB instance types stay. The mitigation returns as a
per-job `ACTIONS_RUNNER_HOOK_JOB_STARTED` hook, re-validated through Gate E.
