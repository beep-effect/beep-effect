---
title: "The missed-event check stops reading a job's delivery details at its first 2xx"
date: 2026-11-24
lane: "fix/ci-missed-event-check-request-budget"
reversal: "Restore readDetails in FleetMissedEvent.command.ts to read every candidate id concurrently and drop the four delivery detail budget tests."
---

The first run of the standing check (run 45297774933, 2026-11-24) spent 5m36s in its check step: the 300-second gap between the runner reads plus about 36 seconds of reads, 275 GitHub requests in all. A live measurement of the same reads without the gap counted 281 requests, 197 of them delivery details: every `queued` delivery inside any due job's seven-minute window was read, though only the one naming the job decides it.

The check now reads each job's candidate details nearest the job's creation first, four at a time, and stops at the first 2xx delivery whose detail names the job. Details already read for an earlier job are reused. A job with no such delivery still reads every candidate, so `DeliveryFailed`, `NotDelivered` and `Unreadable` are judged on the same reads as before; only `Delivered` can now name a different delivery id when a job has two 2xx deliveries. The same live measurement after the change counted 83 requests in 14 seconds, 4 of them details.

The 300-second gap and the job listings (one per run created in the last two hours, about 70) are unchanged: the gap is the specified stuck-runner test and the listings feed launches, progress and the p95. With the gap and about 40 seconds of setup, a run leaves roughly four minutes of the ten-minute cadence for reads; they now make about a third of the requests, so each request in a slow API hour can take about three times as long before a run outlasts the cadence.
