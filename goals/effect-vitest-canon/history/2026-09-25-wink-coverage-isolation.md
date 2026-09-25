# Wink coverage isolation correction

Hosted coverage job 107991558825 on merged PR #1235 failed 12 Wink tests
with runtime initialization `RangeError: Invalid string length`. The same
full-package, single-worker coverage run reproduced 12 failures locally.
Enabling file isolation passed all 47 tests across 11 files.

This driver-only prerequisite preserves the package test boundaries during
coverage, where the shared configuration otherwise disables isolation. It
changes neither public runtime behavior nor assertions. It does not discharge
Wink inventory rows or count as its topological migration wave.

The committed configuration passes full package verification (audit 15.7s,
docgen 5.0s) and full package coverage with CI=true and maxWorkers=1. Hosted
checks and review closure remain required before merge readiness.
