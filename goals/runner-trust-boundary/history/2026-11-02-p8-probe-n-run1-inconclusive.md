# P8 Probe N run 1: inconclusive on both legs, 2026-11-02

Operator-approved post-release replay probe (Decision Log 2026-11-02),
dispatched from `main` at `e0b14ca413` with
`goals/runner-trust-boundary/ops/post-release-replay.sh main`. No JIT value,
key material or host address appears below.

## Timeline (UTC)

| Time | Event | Source |
| --- | --- | --- |
| 09:10:53 | `beep-ci-scale-up` launches worker `i-040d588c12eb2e715` | CloudTrail `RunInstances` |
| 09:11:34 to 09:11:41 | four `ModifyInstanceMetadataOptions` calls (self disable plus the lock dry-runs) | CloudTrail |
| 09:11:43 | run `41417188112` job `Shadow Probe` starts in group `beep-ec2-heavy` | GitHub job record |
| 09:11:44 | probe reads the configuration from listener argv as root (length 4096) and kills `run-helper.sh` | serial console |
| 09:13:19 | termination notification: runner busy, deregistration queued | `beep-ci-spot-termination-notification` |
| 09:18:24, 09:23:26 | deregistration retries: runner still busy | `beep-ci-deregister-retry` |
| 09:26:43 | GitHub cancels the job: "exceeded the maximum execution time of 10m0s" | job annotation |
| 09:27:01 | worker `terminated`; 0 organization-roster entries for its runner name | operator script |
| 09:27:05 | disposable second host `i-01c787c9100a31cec` (t3.small, no instance profile, fleet subnet, ingress-free worker security group) launched | operator script |
| 09:27:49 | second host verifies runner 2.338.2 (SHA-256 from the release notes) and replays | its serial console |
| 09:28:28 | deregistration retry: "Runner not found in GitHub" | `beep-ci-deregister-retry` |
| 09:28:44 | second host terminated | operator script |

No job ran on either the original or the replayed registration after
09:11:44: the only job recorded for the runner name is the probe job itself.
The second host's kill used `pkill -f /root/rtb/bin/Runner` against a
listener started as `./bin/Runner.Listener`, so it did not match (review on
#2552). That listener could have kept retrying until its 120 s timeout. The
registration was already deleted (09:28:28 "Runner not found"), no job was
recorded for it, and the host terminated at 09:28:44. #2552 starts the
listener by absolute path and also kills its `timeout` parent by PID.

## Why each leg is inconclusive

- **Same host.** Killing the runner-user wrapper chain bottom-up let the shim
  reach its poweroff before the probe stopped the listener. The console ends
  after the first kill. The VM went down holding the session, and GitHub only
  released the job on its 10-minute timeout.
- **Second host.** The verdict printed `accepted`, but the classifier treated
  "Connected to GitHub" as acceptance. Runner 2.338.2 prints that line in
  `BrokerMessageListener.CreateSessionAsync` after building its HTTP
  connection and *before* `_brokerServer.CreateSessionAsync`. The probe killed
  the listener at that line, so the server never answered the session request.
  "Listening for Jobs" (`Runner.cs`) is the only line that follows a granted
  session.

## Fixes

PR #2544: acceptance only on "Listening for Jobs"; "Failed to create (a)
session" classifies a refusal; the poweroff helper is shadowed with a bind
mount instead of killing the wrapper chain; scratch moved off a literal host
path. The same marker flaw existed in P4's Probe M acceptance branch and is
fixed there too; P4's recorded result was a rejection, so it is unaffected.
