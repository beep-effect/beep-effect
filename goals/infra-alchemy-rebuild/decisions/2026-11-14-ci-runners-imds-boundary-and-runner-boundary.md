---
title: "Runners keep the live IMDS post-install; the runner permissions boundary is new and narrowed"
date: 2026-11-14
lane: "goals/infra-alchemy-rebuild-p5-ci-runners"
reversal: "Drop postInstall and the two runner policies from declareCiRunners, or point runnerPermissionsBoundaryArn at beep-ci-fleet-boundary."
---

Runners keep the live fleet's post-install unchanged: the toolbelt fallback (git, unzip, zip, jq on an unbaked image), the per-job `ACTIONS_RUNNER_HOOK_JOB_STARTED` IMDS hook, and the fail-closed IMDS workload boundary that wraps `/opt/actions-runner/run.sh`, disables IMDS on the instance before the runner accepts a job and powers the instance off when the runner exits. `src/RunnerBootstrap.ts` holds the three scripts byte for byte as `infra/src/CiFleetController.ts` defines them, before that file's Terraform HCL escaping (the composite passes the script through unescaped). The composite's user data has the same order the module had (extract runner, post-install, fetch the JIT config from SSM while IMDS still works, delete it, start `run.sh` as `ec2-user`), so the shim lands where it did. Because IMDS is off once the runner starts, the composite's exit trap cannot terminate the instance through the API; the shim's power-off and the template's `terminate` shutdown behaviour do it, as on the live fleet.

IAM on each pool's runner role:

- Managed policy `beep-fleet-<stage>-runner-imds-disable`: the live document, `ec2:ModifyInstanceMetadataOptions` on the caller's own instance only while its endpoint is enabled.
- Permissions boundary `beep-fleet-<stage>-runner-boundary`, new and owned by the stack instead of reusing the operator-made `beep-ci-fleet-boundary`: allow `ec2:*`, `ssm:GetParameter`, `ssm:DeleteParameter`, `s3:GetObject`, `kms:Decrypt`, `sts:GetCallerIdentity`; deny `iam:Create*`, `iam:Put*`, `iam:Attach*`, `iam:Delete*`, `iam:Update*`; deny `ec2:ModifyInstanceMetadataOptions` once the endpoint is disabled. The live boundary was a ceiling for every module role (Lambdas included: logs, SQS, events, DynamoDB, metrics, `iam:PassRole` to `beep-ci`/`beep-ovf` roles); in the composite the Lambda roles get least-privilege `bind` policies of their own, so the boundary only needs to cover the runner, and drops `iam:PassRole`, which a runner never uses.

The scripts duplicate the Pulumi source until the old program is deleted at cutover; the duplicate goes away with `infra/`.
