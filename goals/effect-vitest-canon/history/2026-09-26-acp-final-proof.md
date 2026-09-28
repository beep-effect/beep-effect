# ACP final package evidence

At source commit 237412d589859ae72bf36e6318b8636fe88d8580, configured Node
and Bun runs each passed all 39 cases with zero failures or skips. Whole-command
times were 4.522 and 2.468 seconds respectively, compared with the preparation
observations of 5.422 and 3.219 seconds. These are single observations under
recorded workstation load, not a performance improvement claim. Source, manifest
and lockfile hashes remained stable; load, pressure, limits and runtime versions
accompany both public timing receipts. Ambient mock-peer switches and property
run overrides were absent for these whole-package runs.

All three existing property registrations passed again at 400 runs and seed
20260708 after instrumentation. The focused run excluded 23 nonselected cases;
the configured whole-package runs above provide their execution evidence.

Three TestConsole controls prove trace-enabled runner starts and actual phase
messages for agent cancellation, client notifications and native protocol exit.
Each corresponding trace-disabled control failed as intended. Temporary probes
were restored exactly before final timing and property runs.

Full package audit and docgen passed on final source (11.2 and 4.0 seconds).
The reviewed cache refresh changes only eleven ACP dependency lists to include
the declared runner; cache audit reports zero blocking findings and eleven
inherited source-drift advisories. No qualification state was promoted.

The lens audit remains the six existing paths. The configured runs also execute
the later json.test.ts suite, whose separate lens inventory is deferred to the
remainder pass. Hosted PR checks and full Yeet proof remain separate gates.
