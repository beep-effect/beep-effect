---
"@beep/utils": patch
---

Fix curried mapPrefix and mapPostfix calls while preserving their two-argument
APIs. Migrate utility tests to scoped Effect fixtures and the instrumented test
runner, retain native runtime conformance, and restore file isolation for tests
that change runtime globals.
