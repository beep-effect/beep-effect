---
"@beep/infra": patch
---

Add the CiRunners Pulumi stack groundwork for the beep CI ephemeral runner
fleet: an egress-only VPC (default security group pinned empty, VPC flow logs
to CloudWatch with 14-day retention), a zero-ingress worker security group with
a five-rule egress allowlist, a credential-free spot launch template (IMDSv2
required with hop limit 1, no instance profile, beep-ci=runner kill tags on
instances and volumes, Canonical Ubuntu 24.04 via SSM parameter lookup with a
pinnable amiId override), and an AWS-side reaper (EventBridge rate(5 minutes)
to Lambda) that terminates tagged runners older than the configured TTL.
