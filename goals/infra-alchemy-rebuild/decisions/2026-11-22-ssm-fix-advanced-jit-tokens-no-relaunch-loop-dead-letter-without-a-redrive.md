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

**Cost.** Advanced parameters bill per parameter-month, prorated, on the line the live fleet already pays per runner. Two
deletion paths bound each token:

- The runner's start script deletes its own token parameter right after reading it at boot.
- The SSM housekeeper runs once a day and deletes token parameters last modified more than one day ago. A token whose
  instance dies before boot therefore lives at most about two days.
- A configuration that fails after the put also deletes the token, then the JIT runner, then terminates the instance.

**Job-queued check on in production.** Scale-up now checks that the GitHub job is still queued before it launches. The
check existed but was off in the production configuration. The failed message was redelivered to scale-up after the
build queue's two-minute visibility timeout, so a launch followed the cancelled run. The check is fail-open on a GitHub
error, as upstream. A test decodes both deployed runtime configurations and pins it on.

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
