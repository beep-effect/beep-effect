---
title: "Test Integration needs about 100 minutes and fails on two tests the timeout hid"
date: 2026-11-08
lane: "ci/test-integration-budget-120"
reversal: "Lower heavy.yml timeout_minutes for Test Integration again once the law-practice-server integration suite is sharded or trimmed below the previous budget."
---

main's first run after #2915 (42444900312) ran Heavy / Test Integration for the full 90 minutes and still had 5 of 48 law-practice-server integration files left; the 43 finished files total 168.5 minutes of file time on the 8-vCPU heavy runner at two vitest workers, so the lane needs about 100 minutes. Two files fail deterministically regardless of budget: test/integration/CitationInputDocument.test.ts (reservedUnits 0, expected cleanerTextUtf16 5 on both runtimes) and test/integration/CitationDiffWorker.test.ts (the 1005-source-map bun replay hits its own 600 s watchdog at 599.8 s on hosted CI as well as locally). heavy.yml now gives the lane 120 minutes so it reports those failures instead of a cancellation; sharding or trimming the suite and fixing both tests stays with this packet.
