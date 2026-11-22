---
title: "SSM fix: Advanced JIT tokens, no relaunch loop, dead-letter without a redrive"
date: 2026-11-22
lane: "fix/ci-runners-scaleup-jit-token-tier"
reversal: "revert the SSM-fix commits and redeploy the previous CiRunners head; nothing is migrated, and tokens already in the Advanced tier are removed by their own deletion paths"
---

The new fleet's heavy proof failed on 2026-11-20: scale-up launched an instance, registered a JIT runner for it, failed
to store the runner's token in SSM, terminated the instance, and relaunched every two minutes (three times in all). The
CI goals driver ruled the fix and this record.

**Advanced tier.** Both token writes (the JIT config and the `config.sh` arguments) use the Advanced parameter tier. A
Standard parameter holds at most 4 KB, and a JIT config carries an RSA key and can exceed that. The live fleet writes
the same token at Advanced. This is the probable cause: the rejected calls recorded no error code, so the new log line
has to confirm it on the heavy re-proof, and a different SSM error there is a new ruling, not a retry.

**Cost.** Advanced parameters bill per parameter-month, prorated, on the line the live fleet already pays per runner. Three
deletion paths bound each token:

- The runner's start script deletes its own token parameter right after reading it at boot.
- The SSM housekeeper runs once a day and deletes token parameters last modified more than one day ago. A token whose
  instance dies before boot therefore lives at most about two days.
- A configuration that fails after the put also deletes the token, then the JIT runner, then terminates the instance.

**The job-queued check stays off in production.** The failed message was redelivered to scale-up after the build queue's
two-minute visibility timeout, so a launch followed the cancelled run. This fix first turned scale-up's check on, and
turned it off again before the merge:

- The live fleet keeps it off because GitHub's jobs API answered "not queued" for queued jobs. With the check on, two of
  seven pickup probes sat queued for over 25 minutes (`goals/ci-fleet-endgame/research/OPPORTUNITIES.md`).
- The not-queued branch acknowledges the message with no launch, no retry and no dead letter. It is fail-open only on a
  GitHub error.
- The relaunch is closed without it: a failed configuration goes back to the build queue only when the DLQ send itself
  fails. A cancelled job whose message SQS redelivers for another reason (over the cap, a launch shortfall) costs one
  VM, as on the live fleet.

A test decodes both deployed runtime configurations and pins the check off for both pools.

**What "not queued" means.** Job-retry always asks GitHub for the job's status, as the live fleet's does, and drops the
message when the job needs no runner. The live fleet reads every status except `queued` that way, and so did this port.
Now only `in_progress` and `completed` do: a lagging read normally shows an earlier state (requested, waiting, pending), not a later one. That is an
inference. The status the two stranded probes got was never recorded. Every status other than `queued` is logged with
the job and the answer, and job-retry logs the message it drops with its retry counter.

**What remains.** A transient configuration failure has lost its runner and relies on job-retry alone. A wrong
`in_progress` or `completed` at 120 seconds still drops that job, now with a log line. The live fleet instead redelivers
such a failure to scale-up, unchecked. In every proof and post-check, each drop line must be `in_progress` or
`completed`, with the job's start or completion time before the line; one that is not is a STOP.

**Failure classification.**

- A throttling code is transient whatever the status. Otherwise the AWS layer's fault reading decides, then the HTTP
  status. A GitHub 403 or 429 rate limit is transient.
- A conflict in the two steps that create under an instance-unique name reads as the first attempt having landed after
  a lost response: SSM `ParameterAlreadyExists` or a 409 on the token put, and a GitHub 409 on `generateJitConfig`. Both
  are transient, bounded by the two job-retry attempts. Every other conflict stays deterministic. A GitHub 409 carries
  no runner id, so its cleanup cannot delete that registration: an offline JIT registration remains, not a running
  machine.
- A transient failure goes through job-retry (120 s, then 240 s). When no retry can be published, it is dead-lettered
  like a deterministic one.

**Dead-letter semantics.** When a message is dead-lettered, its instance is terminated once, its JIT runner and token are
deleted, and the message is sent to the pool's own build DLQ and acknowledged. Only a failed DLQ send returns it as a batch item failure.

- **Nothing redrives a dead-lettered message.** No consumer and no automatic redrive exist, so that job stays queued
  until GitHub times it out.
- **A nonzero build-DLQ depth is therefore a STOP** in every proof and every post-check of this stack, next to the
  other build and job-retry queue counts.
