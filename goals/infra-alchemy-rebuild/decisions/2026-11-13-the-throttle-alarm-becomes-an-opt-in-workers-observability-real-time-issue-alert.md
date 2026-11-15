---
title: "The throttle alarm becomes an opt-in Workers Observability real-time-issue alert"
date: 2026-11-13
lane: "goals/infra-alchemy-rebuild-p3-turbo-cache"
reversal: "Remove the NotificationPolicy and the observability flag from the stack; re-add a CloudWatch-style alarm only if Workers start throttling."
---

The AWS cache alarmed on Lambda throttles because a throttled read is a silent miss and a throttled write a lost upload. A Worker has no reserved concurrency to exhaust; the equivalent failure is the Worker erroring. The account's available-alerts listing (read 2026-11-13 with the Alchemy token) offers `workers_observability_real_time_issue` (no filters), `workers_observability_alert` and `billing_usage_alert`; the stack enables Workers Logs on the Worker and adds a `Cloudflare.Alerting.NotificationPolicy` of the first type when `TURBO_CACHE_ALERT_EMAIL` is set, the same opt-in the AWS alarm had (`throttleAlarmRecipients`). No rate-limit binding: per-token throttling would turn a busy CI wave into cache misses, the failure the alarm existed to catch. Creating the policy needs Notifications Write on the stack's Cloudflare token; until the recipients secret is set no policy is planned.
