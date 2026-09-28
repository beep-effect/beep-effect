# Lint-rules native process observability

The Biome lint, oxlint lint, and oxlint fix paths now validate their native
subprocess results before reading reports or returning fixed source. Ordinary
lint exits zero and one remain accepted, including advisory stderr. Other exit
codes, signals, timeouts, and truncated output fail with `LinterProcessError`,
retaining status, stdout, stderr, signal, and the two termination flags. The fix
path now captures stdout rather than discarding it. Commands, fixture lifecycle,
rule selection, and production sources remain unchanged.

Six additional process-boundary cases cover accepted exits zero and one, an
actual exit-two subprocess with both streams, and explicit timeout, buffer-limit,
and signal metadata applied to a real successful subprocess result. The latter
three are boundary-input controls, not claims that a native timeout or signal
was induced.

All 78 cases pass on both runtimes with stable before/after source hashes:
Node whole-command 13.287069833 seconds; Bun 7.427224877 seconds. Timing receipts
also record load, CPU/memory/IO pressure, runtime versions, and process limits.
The first Node run exposed null signal absence in the repo's compatibility shim;
normalizing nullish absence fixed that introduced error without changing the
shim or weakening the outcome guard.

Full package verification passed audit (12.2 seconds) and docgen (2.1 seconds).
A negative control bypassing the process validator caused all four abnormal
process cases to fail while both accepted-exit cases passed; the helper was
restored byte for byte afterward. No production files were changed.
