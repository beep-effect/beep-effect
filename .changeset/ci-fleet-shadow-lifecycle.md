---
"@beep/infra": patch
---

Make the CiFleetController actually serve jobs on the shadow label. The
controller now resolves its own Amazon Linux 2023 image from
`/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`
instead of inheriting the manual burst fleet's Ubuntu AMI, which the pinned
module's `dnf`-based user-data template could never provision, and
`runner_run_as` moves from `ubuntu` to `ec2-user` so the agent can exec on
that image. Adds an `amiSsmParameterName` config value with a schema default,
and extends the fleet shadow-check workflow with an input-gated red-team mode
whose gates invert: reading the GitHub App secrets from SSM, touching S3, or
reaching tailnet and LAN addresses must all fail from inside a worker.
