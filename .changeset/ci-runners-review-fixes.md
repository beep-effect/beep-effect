---
"@beep/infra": patch
---

Reject CI-runner network configs whose subnet CIDR blocks fall outside the VPC
CIDR or overlap each other, failing at config decode instead of mid-`pulumi up`;
retag the new ci-runners public surface with canonical JSDoc categories.
