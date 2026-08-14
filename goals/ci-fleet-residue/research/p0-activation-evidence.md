# P0 activation evidence — first live bake and the activation set

Status: bake **COMPLETE** 2026-08-14; activation set ships with this PR;
deploy + live probes follow the merge.

## Bake report (attempt 12 — first success)

```json
{
  "amiId": "ami-076e22e205ce6a512",
  "lockfileSha256": "f6ddb69a91a4d2bc5a6d64f6ac4cd7725d5ec1a5136a95049a119d9acfe1bc86",
  "bunVersion": "1.3.14",
  "baseAmiId": "ami-07a5b367e8dc8bd92",
  "priorPin": "ami-07a5b367e8dc8bd92",
  "pulumiPinCommand": "cd infra/ci-runners && pulumi config set ciFleetController:amiId ami-076e22e205ce6a512 --stack production",
  "startedAt": "2026-08-14T08:30:34.056Z",
  "completedAt": "2026-08-14T08:44:55.818Z"
}
```

In-guest proof: the serial console carried `BEEP_RUNNERS_BAKE_COMPLETE`
after a full 2490-package warm `bun install` (9.22s from the package
store). Total wall time 14m21s including the AMI snapshot wait.

## What it took (11 failed attempts, all receipted in OPPORTUNITIES.md)

IAM: launcher lacked bake reads/CreateImage (→ managed policy
`beep-ci-bake`, inline quota was full); guardrails deny profiled launches
(→ `--instance-profile` now optional, bake guests are identity-less);
snapshot ARNs evaluate account-less (`arn:aws:ec2:us-east-1::snapshot/*`).
CLI: EC2 describe/console propagation windows now retry as pending; the
bake script narrates to the serial console with an ERR trap naming the
failing line; the verifier attaches the console tail to no-marker errors;
AWS CLI v2 auto-decodes `get-console-output` (no base64 layer); AL2023's
cloud-init lacks `--machine-id` (explicit machine-id reset instead).
Three "failed" bakes had actually succeeded in-guest — the verifier read
the console before EC2 posted it and terminated good instances.

## The activation set (this PR)

- (a) `ciFleetController:amiId` pinned to `ami-076e22e205ce6a512`.
- (b) `runnerToolbeltPostInstall` no-ops behind `/etc/beep-ci/baked-runner`
  (fail-open; IMDS-hook snippet stays unconditional — iptables-nft is not
  baked).
- (c) `setup-monorepo-ci` "Detect baked runner" fast path: marker +
  lockfile sha + bun version must all match the checkout; then the baked
  Bun joins PATH and setup-bun + Bun cache restore/save are skipped.
  `bun install --frozen-lockfile` stays (near-instant from the warm store).

## Post-merge validation ladder

1. `pulumi up --stack production` (pin + toolbelt no-op deploy).
2. `fleet-lane-probe.yml` on `beep-ec2-heavy`: setup summary must show
   `Baked fast path: true` and single-digit install seconds.
3. Gate E stays armed (hook user-data unchanged; see
   `p2-acceptance-evidence.md`).
4. Rollback proof: revert the pin to `ami-07a5b367e8dc8bd92` in config,
   `pulumi preview` must plan the return to the unbaked path; markers
   absent on the base image fail open into per-boot installs.

## Ops residue

- `beep-ci-bake` managed policy and the launcher's bake grants are
  hand-managed IAM — fold into IaC with the fleet.
- `beep-ci-bake-instance` role/instance-profile and the policy's PassRole
  statement are vestigial (guardrails force identity-less bake guests) —
  delete on next IAM touch.
