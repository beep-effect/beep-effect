# effect-drizzle type tests on tstyche 8

Lifecycle: completed-retained. Lane implementation now runs on exact 8.0.0-beta.0 with
`5.9.3 || 6.0.3` in the hosted matrix; TypeScript 7 runs on demand with `--target next`,
which resolved to 7.1.0-dev.20261014.1 on 2026-10-14.
All three targets passed unchanged assertions: 36 tests, 234 assertions.
Full package verification passed (audit 15.0s, docgen 4.0s). Publication is
orchestrator-owned.

The original 7.0.2 blocker was superseded by the orchestrator ruling. The
preferred exact gate-matching dev version is also refused by beta's store
manifest. Next is an authorized moving fallback, six days newer than the
tsc-rs compiler pin. Pin a supported exact 7.1 beta/stable when listed.
Explicit targets download their own compiler APIs/binaries; they do not load
the root TypeScript 6 API or the installed Effect-patched native binary.

Read [SPEC.md](./SPEC.md) for decisions, [PLAN.md](./PLAN.md) for phase status,
and [research/SOURCES.md](./research/SOURCES.md) for migration details.
[history/type-test-exact.log](./history/type-test-exact.log) records the dev
rejection; [history/type-test-next.log](./history/type-test-next.log) records
the successful assertions. The old 7.0.2 error is retained in history.

The handoff is report-C.md in the orchestrator's ts7-exit lane report directory.
This lane does not stage, commit, push, run gh/Yeet, or complete the packet.
