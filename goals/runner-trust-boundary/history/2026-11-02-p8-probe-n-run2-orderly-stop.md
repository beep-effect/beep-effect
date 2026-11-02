# P8 Probe N run 2: orderly stop, both legs rejected, 2026-11-02

Operator-approved post-release replay probe, dispatched from `main` at
`c8c116f9a9` (after #2544) with
`goals/runner-trust-boundary/ops/post-release-replay.sh main`. Acceptance is
counted only on "Listening for Jobs", the line runner 2.338.2 prints after the
server grants a session. No JIT value, key material or host address appears
below; runner names are instance ids.

## Same host (original worker)

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 09:44:37 | run `41422745680` job `Shadow Probe` starts on `beep-ci-i-02f1d08ee1a9dff04` in group `beep-ec2-heavy` | GitHub job record |
| 09:44:40 | root reads the JIT configuration from listener argv (length 4096) | serial console |
| 09:44:40 | poweroff helper shadowed with `/bin/true`, as a root job can | serial console |
| 09:44:54 | listener stopped with SIGINT; the job completes `failure` at the same second | console, job record |
| 09:45:40 | replay from a scratch copy of the runner on the same host | serial console |
| 09:45:41 | **rejected:** "Failed to create a session. The runner registration has been deleted from the server, please re-configure." | serial console |

## Second host

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 09:49:14 | original worker `terminated`; 0 organization-roster entries for its runner name | operator script |
| 09:49:16 | disposable `i-0a3bf4e6f1fe43cf9` launched: t3.small, no instance profile, fleet subnet, worker security group (0 ingress rules) | operator script |
| 09:50:03 | official runner 2.338.2 tarball verified against the release-notes SHA-256; replay starts | its serial console |
| 09:50:0x | **rejected:** same server message as the same-host leg | its serial console |
| 09:50:56 | terminate requested; instance `terminated` on re-read | operator script, `describe-instances` |

The configuration reached the second host only through AWS-private user-data,
after being unwrapped in memory from the RSA-OAEP-SHA256 wrap Probe N wrote to
the original worker's serial console. Both probe hosts of the day, this one
and run 1's `i-01c787c9100a31cec`, are `terminated`. No job ran on the
original or a replayed registration after the probe read the value.

## What this proves

When the original listener ends the way an ephemeral runner normally ends,
GitHub deletes the registration, and a leaked JIT configuration is refused
server-side from the original host and from another host. The SIGKILL case,
where a root job kills the listener without releasing its session, is
covered by run 3.
