# P2 design brief — CSF-003 per-job IMDS DROP hook

Status: design grounded in the live rails (2026-08-13). Implementation not
started. The deploy and the Gate E / red-team re-run are operator-gated.

## Why the host-level DROP was rolled back (and why that proof is void)

The post-install iptables OWNER-match DROP on the `ec2-user` uid was blamed
for `runner-start-failed`, but the toolbelt post-install later reproduced
the identical failure with NO firewall: the terraform module INLINES
`userdata_post_install` into one user-data bash script, and a leaked
`set -u` kills the downstream runner-start section on its own unset
variables. The DROP's culpability is unproven — the retest MUST use
subshell-scoped options `( set -eu; ... )` exactly like the current
`runnerToolbeltPostInstall` in `infra/src/CiFleetController.ts`, and no
failure story about the DROP is believed until reproduced in that form.

A uid-scoped DROP at post-install time is still structurally wrong, though:
agent and job steps share `runner_run_as: ec2-user`, so a uid DROP starves
the agent too, and root config-time IMDS is needed for JIT registration.

## The rework: per-job hook

`ACTIONS_RUNNER_HOOK_JOB_STARTED` runs a script inside the runner process
after the agent is registered and a job has been assigned — after every
agent-side IMDS need, before any job step executes.

The hook process runs INSIDE the runner process as `runner_run_as`
(`ec2-user`), so it has no `CAP_NET_ADMIN`: a root-owned 0755 script still
executes with the caller's uid, and bare `iptables` calls would fail —
under `set -e` that aborts the hook with the DROP never installed. The
privilege transition is explicit: the hook is a thin wrapper that `exec`s
the DROP installer through narrowly scoped passwordless sudo.

Mechanics (all inside `userdata_post_install`, subshell-scoped):

1. Write `/opt/beep/imds-job-started.sh` (root-owned, 0755, NOT writable
   by the runner user): installs the iptables OWNER-match DROP for the
   runner uid toward 169.254.169.254 (and the IPv6 IMDS `fd00:ec2::254`),
   idempotent (`iptables -C || -A`), logs via `logger -t beep-imds-hook`.
2. Write `/etc/sudoers.d/beep-imds-hook` (0440):
   `ec2-user ALL=(root) NOPASSWD: /opt/beep/imds-job-started.sh` — exactly
   that one root-owned script, nothing else. A malicious job step invoking
   it again is harmless: the script only re-asserts the DROP (idempotent,
   tighten-only), so the escalation surface is "block IMDS harder".
3. Write `/opt/beep/imds-job-started-hook.sh` (the value wired into the
   runner env): `exec sudo /opt/beep/imds-job-started.sh`.
4. Optionally `/opt/beep/imds-job-completed.sh` via
   `ACTIONS_RUNNER_HOOK_JOB_COMPLETED` — NOT needed for ephemeral
   one-job-one-VM workers (VM dies after the job); keep the surface
   minimal and skip it.
5. Append
   `ACTIONS_RUNNER_HOOK_JOB_STARTED=/opt/beep/imds-job-started-hook.sh`
   to the runner's `.env` file before the runner-start section brings the
   agent up (the module's user-data layout determines the exact path —
   verify against the pinned module version's templates, do not assume).
6. The hook scripts themselves are defensive: `set -eu` INSIDE a script
   file is fine (own process); what must stay subshell-scoped is the
   user-data snippet that writes these files.

Defense-in-depth layers that stay live regardless: IMDSv2 hop limit 1,
permissions-boundary-capped instance role, ephemeral one-job-one-VM, JIT
config with no registration token on disk.

## Validation ladder (operator-gated)

1. Gate E probe with the hook active: worker registers, picks up a job,
   agent completed registration normally, and job steps cannot obtain an
   IMDSv2 token — the probe is the token PUT itself
   (`curl -sf -m 2 -X PUT -H "X-aws-ec2-metadata-token-ttl-seconds: 60"
   http://169.254.169.254/latest/api/token` must FAIL from a step). A bare
   metadata GET is already rejected by `http_tokens: required`, so it
   passes even with no DROP installed and proves nothing.
2. Full guest-isolation red-team suite re-run on a live ephemeral worker —
   all must FAIL from the guest: IMDS credential reachability, S3 cache
   write, east-west/LAN/tailnet reach. This retires the standing P2
   residue from the endgame packet.
3. Rollback: remove the `.env` line + hook file from user-data and
   redeploy (same pulumi recipe); the DROP never outlives the VM anyway.

## Interaction with P0 (baked AMI)

If the baked AMI lands first, the hook file can be baked into the image
and user-data only appends the `.env` line; the hook design does not
depend on bake order either way.
