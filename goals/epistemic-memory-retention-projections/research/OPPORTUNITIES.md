# Friction receipts

## 2026-10-28 — package verification invocation

While preparing package checks, `quality package-verify --help` displayed a
variadic package argument; passing all three touched packages returned
`expected at most one package argument`. The supported one-package invocation
worked. Verify the current command's cardinality before batching checks; the
runbook for this goal uses one package per invocation. No source or baseline
change was needed to verify the feature.

## 2026-10-28 — filesystem enumeration is not report ordering

The first full server audit exposed a new test assumption: `readDirectory`
returned `report.txt` before `report.json`. Byte comparisons and rebuild answers
had passed; only the artifact-name assertion failed. The assertion now compares
an explicitly sorted name list. Deterministic report ordering is tested
separately using permuted authority records and request keys.
