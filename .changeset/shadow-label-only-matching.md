---
"@beep/infra": patch
---

Enforce shadow-label-only matching on the CI fleet controller by disabling the
module's default runner labels and requiring an exact bidirectional label
match, so a job requesting `runs-on: self-hosted` can no longer reach the
shadow fleet without naming its dedicated label.
