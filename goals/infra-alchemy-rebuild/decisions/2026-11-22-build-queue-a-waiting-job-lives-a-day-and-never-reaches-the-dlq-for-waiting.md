---
title: "Build queue: a waiting job lives a day and never reaches the DLQ for waiting"
date: 2026-11-22
reversal: "drain the build queues, then set the 2-minute visibility timeout, the 5-receive redrive and messageRetentionPeriod 4 days explicitly on BuildQueue and redeploy; removing the retention property does not restore the default, and a message already received five times would go to the DLQ"
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

- **No redrive policy.** The DLQ stays for the dead letters scale-up sends itself, which the SSM fix (#3454, merged before
  this) adds with the DLQ URL and the send grant. Nothing else reaches it, so a nonzero build-DLQ depth still means a
  deliberate dead letter. A message whose DLQ send fails is acknowledged with an error line, not returned: with no
  redrive it would relaunch an instance once a minute for the retention. An ERROR line in a scale-up log is a STOP in
  every proof and post-check. SQS allows at most 1,000 receives, which would need a visibility timeout of at least 87
  seconds to cover 24 hours; a redrive that the retention always beats protects nothing.
- **One-day retention**, as on the live fleet. The source set none, so the queues had SQS's default four days. It also bounds how long a cancelled
  job's message is retried.
- **One-minute visibility timeout**, down from two. It equals the scale-up function's timeout, the lowest value Lambda
  accepts for the mapping without redelivering a batch that is still being handled. A freed slot idles at most a minute
  when one message waits, against 30 seconds on the live fleet, whose function timeout is 30 seconds. The new
  function's longest run is 5.9 seconds so far, on few runs, so its timeout is not lowered here.

**Other messages.**

- A body that does not decode is acknowledged and dropped, now with one warning that names the message id and never the
  body.
- Scale-up returns a message whose event is not `workflow_job`, which now lives a day instead of five receives. The
  webhook cannot enqueue one: it answers 202 to any other event before it builds a message, and writes the checked
  event type into the message.
- A message whose handler keeps failing as a whole (configuration, GitHub or AWS outage) is retried for a day and then
  expires, as on the live fleet.
- The job-retry and deregister-retry queues keep their redrive of three receives and their retention.

**Plan expectation.** Alchemy replaces a queue only for a new name or FIFO flag, and declares the name, URL and ARN
stable, so both `BuildQueue` rows update in place and no dependent row is expected to change.

- Planned together with the SSM fix: 73 rows, 13 update and 60 noop, its accepted table plus the two `BuildQueue` rows.
- Planned after the SSM fix is deployed: 73 rows, 4 update and 69 noop, the two `BuildQueue` rows and both scale-up
  functions (code), unless the bundle diff shows another function that carries `scale-up.ts`.

A replace, or a dependent row with a new label, goes to the CI goals driver before a digest is accepted. The post-check
adds exactly two `SetQueueAttributes`, each confirmed by reading the attributes back: no redrive policy, retention 86400,
visibility 60, both DLQs unchanged, and both event source mappings still enabled.

**Order.** This must be deployed before the new fleet goes primary and before the webhook switch.
