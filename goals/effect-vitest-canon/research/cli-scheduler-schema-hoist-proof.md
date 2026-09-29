# Scheduler schema compiler scope repair

Root Oxlint identified 15 inline-schema compiler violations in the current
follow-up: 12 JSON codecs inside the quality-scheduler suite callback and
three version-specific event guards inside synthetic-scenario assertions.
Move the same codec expressions and schema-derived guards to module scope.
Keep every schema, projection, assertion and test registration unchanged.

Verification on the edited source:

- `bun run lint:oxlint`: exit zero.
- Node Vitest, quality-scheduler and quality-scheduler-synthetic-scenario:
  135 tests passed across two files, 23.74 seconds.
- Bun Vitest, the same two files: 135 tests passed, 20.21 seconds.
- `git diff --check`: exit zero.

These timings are observations, not controlled performance comparisons.
Full `bun run beep quality package-verify @beep/repo-cli` passed with exit
zero: audit 655.8 seconds and docgen 20.2 seconds. No goal ledger finding
is closed merely by this policy repair.
