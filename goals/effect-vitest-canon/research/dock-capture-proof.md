# Dock capture completion proof

The three reactive minima tests now use native `it.effect`. Their fixture layer
is decorated at the public PretextCapture service boundary: each invocation
records its actual running fiber, delegates to the original fixture capture,
and exposes completion through `Fiber.await`. A queue keeps the two independent
geometry registry reads paired with their respective capture invocations.
The mounted registry is read after capture completion, then its mount is
released and the registry disposed through the original acquire/use/release
boundary. No fixed scheduler yields, polling, sleeps or retries remain.

The failed-capture case extracts the actual typed failure, decodes it against
`S.toType(PretextMeasurementError)`, and checks operation `fixtureCapture` and
the fixture's missing-word message for `wyvern` before accepting the empty
record. This checks the error value without depending on tracing annotations
in the full Cause. Positive cases also require successful capture exits.
The module fixture uses the public Result decoder for the same encoded snapshot.

All 11 original assertions and eight registrations are preserved, along with
font, line height, chrome and geometry-container inputs and registry cleanup.
Full package verification passes audit (7.1 s) and docgen (3.4 s).

A temporary asynchronous-boundary control passes all eight Minima tests. A
never-completing capture fails the new test at its unchanged 30-second deadline;
the former four-yield check passes the same empty-record case while capture is
still waiting. The first JSON-only diagnostic omitted the timeout message, so a
second run included the default reporter and confirmed the timeout explicitly.
All control edits were restored. This is fixture-backed, headless capture proof,
not a browser/font-measurement claim.
