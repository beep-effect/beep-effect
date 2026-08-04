# 1Password refs for the self-hosted runner pilot (opportunity 24 / o6)

Principle: OIDC + instance-profile roles wherever possible; op:// references
only for the credentials that must exist at all. Suggested vault: a dedicated
`beep-ci` vault so runner creds never mix with personal items.

## Auth spine

0. **1Password service account**, scoped to the `beep-ci` vault ONLY
   (read-only is sufficient for runtime; the operator writes items).
   Its token (`OP_SERVICE_ACCOUNT_TOKEN`) is the one bootstrap secret:
   - on the workstation launcher: OS keychain / systemd credential
   - on runner instances (if they ever need op at all): delivered via SSM
     Parameter Store (SecureString) read by the instance role — never baked
     into the AMI
   Everything else resolves at runtime via `op run` / `op read` against the
   op:// refs below, so rotation is a vault edit, not a redeploy.

## Required for the pilot

1. `op://beep-ci/github-runner-registration/credential`
   — GitHub fine-grained PAT scoped to beep-effect/beep-effect with
   **Administration: read+write** (creates runner registration tokens).
   Pilot shortcut; see #4 for the better long-term shape.
2. `op://beep-ci/aws-runner-launcher/access-key-id` and `/secret-access-key`
   — IAM user/key for the launcher that starts/stops the spot runner from
   the workstation. Policy scoped to: ec2 RunInstances/TerminateInstances/
   DescribeInstances (tag-conditioned), iam:PassRole for the runner instance
   role only. (If we later run the controller inside AWS — Lambda/ARC — this
   key disappears in favor of a role.)
3. `op://beep-ci/turbo-cache-s3/access-key-id` and `/secret-access-key`
   — IAM key for DEV MACHINES (workstation + clones) to read/write the S3
   turbo cache bucket. Runner instances do NOT use this — they get an
   instance-profile role with the same bucket policy, so no stored secret
   on runners.

## Optional / phase 2

4. `op://beep-ci/github-runner-app/app-id` and `/private-key`
   — GitHub App (Administration + Actions read) replacing the PAT in #1 with
   short-lived installation tokens once the pilot graduates to an
   autoscaling controller.
5. `op://beep-ci/runner-debug-ssh/private-key`
   — SSH keypair baked into the pilot AMI for debugging a live runner;
   removable once the image is stable.
6. `op://beep-ci/runner-webhook/secret`
   — only if we go webhook-driven autoscaling (workflow_job events) instead
   of schedule/poll.

## Explicitly NOT needed

- No AWS creds in GitHub Actions secrets: workflows that need AWS (cache
  reads) use the runner's instance profile; anything else uses GitHub→AWS
  OIDC role assumption.
- No long-lived runner registration tokens stored anywhere: they're minted
  per-boot from #1/#4 and expire in an hour.
- No Blacksmith/API migration secrets: cutover is per-lane `runs-on` label
  changes only.

## Provisioned (2026-08-04)

- AWS account 832907639880, region default us-east-1.
- S3 cache bucket: `beep-turbo-cache-832907639880` (public-blocked, 14-day expiry).
- Instance role/profile: `beep-ci-runner-role` / `beep-ci-runner-profile`
  (inline policy beep-ci-turbo-cache: bucket RW).
- Launcher: user `beep-ci-runner-launcher` (Describe*, RunInstances,
  CreateTags on RunInstances, Terminate/Stop only where tag beep-ci=runner,
  PassRole → runner role only) → op://BEEP_CI/aws-runner-launcher.
- Dev cache user: `beep-ci-turbo-cache-dev` → op://BEEP_CI/turbo-cache-s3.
- Service account token: op://BEEP_SECRETS/ujpwcbzjz5bf5v2fgnj6seso4y/credential
  (scoped to BEEP_CI).
- Pending: op://BEEP_CI/github-runner-registration/credential (fine-grained
  PAT, Administration RW on beep-effect/beep-effect — operator minting).
