# GOAL: effect-drizzle type tests on tstyche 8

Outcome: run @beep/effect-drizzle's existing assertions on exact tstyche
8.0.0-beta.0 with a hosted `5.9.3 || 6.0.3` matrix plus an on-demand
`--target next` TypeScript 7 run, independent of the root
TypeScript 6 compiler API for these explicit targets.

Read SPEC.md, PLAN.md, README.md, ops/manifest.json and research/SOURCES.md.
Before compiler changes, read AGENTS.md, docs/runbooks/typescript-toolchain.md
and goals/tsc-rs-gates/SPEC.md Decision Log.

The orchestrator withdrew 7.0.2 on 2026-10-14. Preferred exact target
7.1.0-dev.20261008.1 was refused by the beta's store manifest. Authorized
fallback next resolved to 7.1.0-dev.20261014.1. All three targets passed with
unchanged assertions: 36 tests, 234 assertions. This is a moving target;
pin an exact supported 7.1 version when beta/stable is listed and re-run.
If next cannot run, the authorized final fallback is explicit 5.9.3 / 6.0.3
with the exact TS7 error and an open follow-up. Never use tstyche 7.2.5.

Scope: package dependency/config/tests, bun.lock, syncpack hold, toolchain
runbook, historical graduation receipt, packet and report-C.md.
The Claude orchestrator owns git and publishing. This lane does not stage,
commit, push, run gh/Yeet, or complete the packet. Heavy commands use
beep-heavy; dependency dists must be built before typechecking.

Finish full package verification, attribute failures, and overwrite report-C.md
for orchestrator review. Packet stays active until orchestrator closeout.
