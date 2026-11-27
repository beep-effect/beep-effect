---
title: The shared queue suite crosses a TTL with a small virtual jump plus a real wait
date: 2026-11-26
reversal: Replace the TestClock.adjust("2 seconds") plus liveSleep(1500) pair in advancePastTtl with one large TestClock.adjust past every TTL the suite uses.
governs:
  - test/shared/PersistedQueueTest.ts#suiteWithImpl
enforcedBy: []
---

`advancePastTtl` moves the virtual clock only two seconds past the one-second TTL and lets real time cross it too.
Reason: SQL stores read the TTL from the database clock, and a large virtual jump also fires the SQL clients' pool timers, which time out connection acquisitions still in flight.
Rejected: one large virtual jump (minutes or more), which is simpler and still clears the TTL on virtual-time stores but fails SQL stores with acquisition timeouts unrelated to cleanup.
