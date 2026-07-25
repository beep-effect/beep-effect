# Spike 1 immutable-mode compatibility matrix contract

`a5-writer-surface.sh` generates the adjudication deliverable at
`$SPIKE_P/spike1/compatibility-matrix.md`; this repository file is not an
operator worksheet.

The generator requires exactly one nonblank result for each of:

1. login/bootstrap;
2. pairing / first-owner persistence;
3. `defaultTo` target writeback;
4. reconnect;
5. token swap;
6. group to supergroup migration.

Allowed classifications are exactly `declarative render`, `graceful skip`, and
`INCOMPATIBLE`. Missing, duplicate, blank, or unknown rows fail generation.
Any `INCOMPATIBLE` result fails assertion 6 and re-opens “v1 DM channel is
Telegram.” An untriggered group migration is recorded as the contract-permitted
conditional `graceful skip`, not `INCOMPATIBLE`.
