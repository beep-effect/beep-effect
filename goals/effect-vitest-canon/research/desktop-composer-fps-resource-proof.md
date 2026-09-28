# Composer and frame-loop registry ownership

The composer lifetime test now registers registry disposal before mounting the
draft or delegated handler. It retains the zero idle TTL, delayed runtime build,
exact document comparison, live clock and bounded retry schedule.

The FPS test uses the public Effect tester and acquires its registry in the test
scope. Its explicit early disposal remains before the assertion that the latest
frame ID was cancelled. The scope also cleans up if an earlier assertion fails.
The registry's disposal resets its nodes, so later scope cleanup does not restart
or recancel a disposed frame loop. All frame timestamps and publication assertions
remain unchanged.

Separate-process controls injected failures immediately after mounting. The old
composer test observed zero disposal callbacks; the corrected test observed one.
The old FPS test did not cancel its scheduled frame; the corrected test cancelled
that exact frame. All probes were removed. Both ordinary Node tests pass.
Structural comparison preserves the original assertion call expressions and all
string/numeric literals, excluding the new Effect module import.

The preceding browser registry control was also rerun with its intercepted
dispose method explicitly bound to the real registry. Both original cases still
fail the cleanup assertion and both corrected cases pass.

The full Desktop package audit, including Bun unit tests, and Docgen pass (20.8
and 18.9 seconds respectively). One enclosing composer EV009 fingerprint changed;
its unique test-title prefix was matched to the existing finding and its open
status preserved. Live-clock adjudication remains part of the continuing batch.
