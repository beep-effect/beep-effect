---
"@beep/acp": patch
"@beep/ai-provider-cli": patch
"@beep/onepassword-cli": patch
"@beep/openclaw": patch
"@beep/professional-desktop": patch
"@beep/repo-docgen": patch
"@beep/tailscale": patch
"@beep/tika": patch
"@beep/utils": patch
---

Harden Effect child-process ownership across drivers, desktop tooling, and the
repository CLI. Commands now explicitly own stdin and output streams, bounded
operations escalate termination after a grace period, output capture drains
stdout and stderr concurrently, and repo CLI subprocesses share one execution
boundary.
