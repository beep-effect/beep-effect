# Pretext runtime profile fence

The non-browser profile case now controls the navigator boundary for its five
original expected values. It saves the exact property descriptor, detects the
profile and restores the descriptor in one synchronous Effect.sync try/finally.
This avoids exposing the temporary environment to concurrent test bodies. The
live capture case retains its original version and line-height assertions and
also compares the captured profile with the actual runtime profile.

All original assertions, runtime skip conditions and native canvas behavior are
preserved. No production code, shared config, timeout, retry or test floor changed.
The existing configured Node and Bun suites pass 24 cases with one browser-only
skip. Full package audit and docgen pass. Whole-command observations are 3.921373
and 1.566890 seconds; these are load-dependent observations, not a speed claim.

A controlled Chromium user-agent probe under Node reproduces exactly the old
non-browser fence failure and passes with this change. The original source was
restored byte-for-byte after the counterexample probe. This is profile portability
proof, not live browser coverage. A separate local Chromium attempt encountered a
Vite optimizer failure; a scoped no-discovery probe exited 1 with zero registered
cases. Neither counts as native browser proof. These private probe configs do not
change the committed Vitest configuration.
