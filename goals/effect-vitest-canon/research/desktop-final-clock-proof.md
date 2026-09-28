# Remaining live-clock judgments

Browser listener logging now completes a Deferred from the logger callback after
recording its annotations. The listener test awaits that signal with the same
three-second live bound and original failure message, instead of polling the
annotations array. Its original sanitization and source assertions remain.

The intake idle-expiry case now writes an unmounted witness atom from zero to
one and observes one before the original fifty-millisecond wait. After the wait,
it requires the witness to read zero before asserting that the hidden file input
survived and still opens the picker. The registry's ten-millisecond TTL and all
original input/picker assertions remain. A temporary control extended only the
TTL to ten seconds: the old case passed, while the strengthened case failed on
the witness. The control was restored.

Dock persistence now uses it.effect with an otherwise byte-identical body. Its
host-side bounded storage wait and independent registry still exercise the real
debounce. A temporary probe confirmed the test starts with virtual time zero and
completes the original persistence assertion without advancing that clock.

The four retained live judgments are narrow: browser listener completion needs
a three-second watchdog around the independent logger runtime; intake expiry
compares a host registry's real TTL with the original fifty-millisecond wait;
and the two confirmation cases join the production detached confirmation fiber,
whose real fifty-millisecond sleep is outside the test context, under their
original two-hundred-millisecond live bound. Production dispatchTurnWithConfirm
uses Effect.runFork directly, so the test clock cannot advance that fiber.

Node and Bun each passed all 29 cases across the affected suites plus confirmation
coverage. AST comparison preserves the 25 original titles and all original
assertion expressions in the three edited files, excluding only the two added
idle-witness assertions from comparison. No original assertion was weakened.

Full Desktop package verification passed audit and docgen. Schema-first and
strict packet validation passed. The final ratchet reports zero introduced
findings, 227 resolved against the retained baseline, and 4,775 live findings.
Four live-clock reasons are recorded in baseline and ledger; the existing
independent logger-delay exception is reanchored without changing its judgment.
Across the original 24 EV009 candidates, 13 wrappers have been converted and
11 retained live wrappers have individual documented reasons. Final converted-
row closure, package ledger reconciliation, and after timings remain pending.
