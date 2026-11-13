---
title: "Advance virtual time to prove the two admission deadline contracts"
date: 2026-11-13
reversal: "Replace the manual-clock controls when a harness can assert queue-plus-work deadline placement without advancing virtual time."
---

The new public engine and extractor controls deliberately advance virtual time across an 800 ms queue and 9500 ms resolver subject. The resolver sleep is test-subject work under TestClock, not a wall-clock wait, and the separate advances distinguish the exact deadline boundary. Reviewed EV008 and EV015 judgments receive explicit test-owned exceptions with exit conditions. Both native runtime configurations are exercised for the engine; all these boundary controls assert zero spawned children.
