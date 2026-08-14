# P2 acceptance evidence — CSF-003 per-job IMDS hook live validation

Status: **PASSED** 2026-08-14. The validation ladder from
`p2-imds-job-hook-design-brief.md` ran against the deployed hook
(PR #708 + the #717 HCL-escape fix, `pulumi up` applied 2026-08-14,
launch template `beep-ci-action-runner` v7).

## Run

- Workflow: `fleet-shadow-check.yml` with `redteam=true`, dispatched on
  `main` (run 31779611279).
- Worker: `i-048a6141bc4de9daf` (`beep-ci-i-048a6141bc4de9daf`), booted from
  launch template v7 — the first live worker with the hook armed.
- Run conclusion: `success`.

## Gate E (the probe that proves the hook)

The IMDSv2 token PUT from a job step was denied:

```
Runner instance-id: i-048a6141bc4de9daf   (derived from RUNNER_NAME, not IMDS)
DENIED AS EXPECTED: runner could not reach IMDSv2
```

A bare metadata GET proves nothing (`http_tokens: required` rejects it
regardless); the token PUT is the probe, and it failed as required.

## Guest-isolation red-team suite

All gates passed — with IMDS dead the guest has no instance credentials at
all, so every AWS denial degrades to "guest credentials unavailable":

```
GATE A_APP_SECRET_SSM: PASS   (github_app_key_base64 + webhook secret denied)
GATE B_S3: PASS               (list-buckets + put-object denied)
GATE C_TAILNET_LAN: PASS      (100.100.100.100, 192.168.1.1, 10.0.0.1 denied)
GATE D_CONTAINER_IMDS: PASS   (container token PUT denied)
```

## Teardown

- Runner `beep-ci-i-048a6141bc4de9daf` deregistered from the repo roster
  after the run; EC2 instance observed `shutting-down`.
- Asserted manually: the `redteam-verify.sh` wrapper crashed before its
  teardown phase on a zsh gotcha (`status` is a read-only special
  parameter); fixed in this PR alongside the evidence.

## What this retires

The standing P2 residue from the endgame packet (guest-isolation re-run)
and the packet's own Gate E retest requirement. Remaining P2 work: none.
