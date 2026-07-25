# Spike 1 immutable-mode compatibility matrix contract

`a5-writer-surface.sh` generates the adjudication deliverable at
`$SPIKE_P/spike1/compatibility-matrix.md`; this repository file is not an
operator worksheet.

The generator requires exactly one nonblank result for each of:

1. login/bootstrap;
2. pairing / first-owner persistence;
3. `defaultTo` declared;
4. `defaultTo` undeclared;
5. reconnect;
6. token swap;
7. group to supergroup migration.

Allowed classifications are exactly `declarative render`, `graceful skip`,
`HARNESS-ERROR`, `NOT-TRIGGERABLE`, `BLOCKED`, and `INCOMPATIBLE`. Missing,
duplicate, blank, or unknown rows fail generation. Only a genuine writer that
mutates protected config or crashes under the guard is `INCOMPATIBLE`; on an
operationally essential path that fails assertion 6 and re-opens “v1 DM channel
is Telegram.” CLI invocation defects are `HARNESS-ERROR`, absent operator
actions are `BLOCKED`, and a surface or one-time precondition that cannot exist
in this version/run is `NOT-TRIGGERABLE`.
