# P8 Probe N run 3: SIGKILL stop, same-host replay accepted, 2026-11-02

Operator-approved post-release replay probe, dispatched from `main` at
`1791686c50` (after #2552) with
`goals/runner-trust-boundary/ops/post-release-replay.sh main KILL`.
Acceptance is counted only on "Listening for Jobs", which runner 2.338.2
prints after `CreateSessionAsync` succeeds (`Runner.cs`); the probe kills the
replayed listener at that line. No JIT value, key material or host address
appears below; runner names are instance ids.

## Same host: the attacker's stop

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 10:38:14 | run `41429667965` job `Shadow Probe` starts on `beep-ci-i-0f737154859450ed6` | GitHub job record |
| 10:38:16 | root reads the JIT configuration from listener argv; poweroff helper shadowed | serial console |
| 10:38:18 | `Runner.Listener` and `Runner.Worker` killed with SIGKILL: no session release, VM kept up | serial console |
| 10:38:20 to 10:40:55 | attempts 1 to 6, every ~31 s: refused, "A session for this runner already exists." | serial console |
| **10:41:26** | **attempt 7: accepted ("Listening for Jobs"); replayed listener killed at the marker** | serial console |
| 10:49:39 | deregistration retry: "Runner still busy" | `beep-ci-deregister-retry` |
| 10:53:14 | GitHub cancels the job: "exceeded the maximum execution time of 10m0s" | job record, annotation |
| 10:54:40 | deregistration retry: "Runner not found in GitHub" | `beep-ci-deregister-retry` |

## Second host

| Time (UTC) | Event | Source |
| --- | --- | --- |
| 10:53:32 | original worker `terminated`; 0 organization-roster entries | operator script |
| 10:53:34 | disposable `i-0e8e932a065527a90` launched (t3.small, no instance profile, worker security group with 0 ingress rules) | operator script |
| 10:54:20 | verified runner 2.338.2 replays | its serial console |
| 10:54:2x | refused: "Failed to create a session. The runner registration has been deleted from the server" | its serial console |
| 10:55:12 | terminate requested; `terminated` on re-read | operator script, `describe-instances` |

The only job ever recorded for `beep-ci-i-0f737154859450ed6` is the probe job.
No other job reached the accepted session in the second it lived.

## What this proves

- A sudo-capable job that SIGKILLs its listener leaves the session held. The
  server expires it in about three minutes, and from then until GitHub
  finishes the job and deletes the registration, the leaked JIT configuration
  opens a new session: **post-release replay is accepted.** The window here
  was 10:41:26 to about 10:54 (job timeout 10 minutes plus GitHub's cancel
  grace); for a heavy lane it runs to that job's `timeout-minutes`.
- Nothing binds the configuration to the original host, so a second host
  replaying inside that window would be expected to succeed as well; this run
  replayed from the second host only after deletion, where it was refused.
- The registration stays busy with the original job throughout, so the
  termination watcher and its deregistration retries cannot delete it; only
  the job's end does.
- Not established: whether GitHub would assign a different job to the
  replayed session while the original job is still open. Testing that means
  holding a hijacked session open against the live queue.

E1 therefore stays open, and the packet's stop condition "a credential path
reachable by job privilege" applies.
