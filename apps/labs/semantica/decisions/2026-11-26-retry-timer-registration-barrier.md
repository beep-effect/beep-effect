---
title: Register the test retry timer before notifying the observer
date: 2026-11-26
reversal: Schedule the child normally and treat the queue notification as proof that its timer exists.
governs:
  - test/ProviderCache.test.ts#makeCacheWaitProbe
enforcedBy: []
---

Start the clock-sleep child immediately, then record its delay and notify the retry queue.
Reason: rc.117 TestClock registers its timer before its first suspension, so queue notification then serves as a registered-timer barrier.
Rejected: a normally scheduled child, whose notification can race ahead of timer registration.
