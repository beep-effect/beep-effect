---
title: "Build queue: a waiting job lives a day and never reaches the DLQ for waiting"
date: 2026-11-22
reversal: "drain the build queues, restore the 2-minute visibility timeout and the 5-receive redrive on BuildQueue and redeploy; attributes update in place, and a message already received five times would go to the DLQ"
---

The new fleet's build queues moved a message to their DLQ after five receives at a two-minute visibility timeout, about
ten minutes. Scale-up returns a message over the pool's cap as a batch item failure, so every wait for a free slot costs
one receive. Nothing redrives the DLQ, so a job that waited ten minutes for capacity would stay queued until GitHub
times it out. The CI goals driver found this before the cutover and ruled the bar: a message waiting on the cap or on
capacity lives at least 24 hours and does not reach the DLQ for waiting alone.

**Measured on the live fleet's queue**, which has no redrive, a 30-second visibility timeout and one-day retention:

- Seven days: 2,113 messages sent and 1,502,086 received.
- Waiting is the normal state: in six hours on 2026-11-20 between 170 and 210 messages were in flight on average.
- The redelivery interval is the visibility timeout: receives per waiting message give 30.0 to 30.1 seconds in each of
  those hours.
- `ApproximateAgeOfOldestMessage` does not show this. It stayed at or under 140 seconds, because SQS leaves out messages
  received more than three times.

**Change**, on the build queue only:

- **No redrive policy.** The DLQ stays, and only scale-up's own sends reach it, so a nonzero build-DLQ depth still means
  a deliberate dead letter. SQS allows at most 1,000 receives, which would need a visibility timeout of at least 87
  seconds to cover 24 hours; a redrive that the retention always beats protects nothing.
- **One-day retention**, as on the live fleet (it was SQS's default four days). It also bounds how long a cancelled
  job's message is retried.
- **One-minute visibility timeout**, down from two. It equals the scale-up function's timeout, the lowest value Lambda
  accepts for the mapping without redelivering a batch that is still being handled. A freed slot idles at most a minute
  when one message waits, against 30 seconds on the live fleet, whose function timeout is 30 seconds. The new
  function's longest run is 5.9 seconds so far, on few runs, so its timeout is not lowered here.

**Other messages.** A body that does not decode is acknowledged and dropped. A message whose handler keeps failing as a
whole (configuration, GitHub or AWS outage) is retried for a day and then expires, as on the live fleet. The job-retry
and deregister-retry queues keep their redrive of three receives.

**Plan expectation.** Two rows, `BuildQueue` of each pool, go from noop to update in place. Alchemy replaces a queue only
for a new name or FIFO flag, and declares the name, URL and ARN stable, so no dependent row is expected to change. The
plan-only run confirms the rows before any dispatch.

**Order.** This must be deployed before the new fleet goes primary and before the webhook switch.
