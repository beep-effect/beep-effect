# Workspace Server resource proof

Eighteen fixture-backed registrations now use independent native layer blocks.
Fresh Cuid fixtures preserve per-test generator state, including the yielding and
failure-injection implementations. Separate resolver and vault blocks preserve
per-test state. The cache test uses a private counter service and one resolver
for both reads and the subsequent source-drift rejection. The counting engine
still delegates to the real DOCX extractor. All actual filesystem writes,
symlinks, digest inputs and the 32 MiB plus one byte boundary remain.

Structural conservation preserves all 97 assertions and 24 registrations across
the three touched files, plus every native file/identity/tracing input. The four
PGlite registrations are unchanged. Full package verification passes audit
(14.4 s) and docgen (6.3 s), including native PGlite execution.

A controlled mutation sharing one vault-store layer across the two vault tests
fails the missing-root test's post-failure unconfigured-state oracle when the
tests are explicitly sequential. The first concurrent control passed because
its scheduling did not establish the necessary prior configured state; it is
not credited as isolation proof. The sequential control establishes the witness
and all source bytes are restored. Independent fixtures avoid that cross-test
state regardless of scheduling.

Retain the explicit scoped layer build inside the initialization-failure test:
the failed build is its observed subject, with typed failure and absence-of-defect
checks. Moving that build into suite setup would bypass those assertions.
Existing PGlite layers, rollback behavior and deadlines remain unchanged.
