# Sidebar and intake registry ownership

One sidebar registry and fifteen intake registries now register disposal with
their public Effect test scopes at acquisition. Their success-only disposals were
removed. Reversing those sixteen substitutions reproduces the original source,
ignoring formatting; no other statements changed.

The sidebar retains both non-user and completed-user interaction cases. Intake
retains picker/manual-path cases, concurrent batch accounting, drag/drop behavior,
the explicit input/action mount releases, and the idle-TTL delay and input check.
All fixtures, assertions, failure messages, retry limits and clock choices remain.

Separate-process failure controls injected defects after the first sidebar storage
result and while two intake batches were active. Both original tests observed
zero registry disposal callbacks; both repaired tests observed one. The controls
called the actual registry disposal with its receiver preserved. All probes were
removed. All 21 ordinary Node tests pass.

The full Desktop package audit, including Bun unit tests, and Docgen pass (14.2
and 12.1 seconds respectively). The fifteen enclosing intake EV009 fingerprints
changed. Each was matched to its unique original test-title prefix, with its open
status and obligations preserved. These resource changes do not adjudicate the
live-clock findings. Strict inventory/census validation and diff checks pass.
