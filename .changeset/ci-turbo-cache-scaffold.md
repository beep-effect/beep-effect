---
"@beep/infra": patch
---

Add the non-deployed `CiTurboCache` component scaffold for the P3 asymmetric
Turbo remote cache: schema-first config, an S3 bucket with a lifecycle rule, a
Lambda authorizer plus reader and writer shims behind one HTTP API, and a
boundaried IAM role. The component is exported but not wired into the runner
stack entry point, so nothing deploys until the artifact-size measurement and
rollout decisions in the P3 design doc are settled.
