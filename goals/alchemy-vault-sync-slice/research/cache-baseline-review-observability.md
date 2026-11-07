# Cache-policy baseline re-record for the driver observability fix (2026-11-07)

Reviewer: Claude Opus 5.5 (orchestrator, `fix/alchemy-postgres-spans`).

`@beep/alchemy-postgres` gains one workspace dependency, `@beep/observability`, for
`src/AlchemyPostgres.instruments.ts` (declared span and attribute instruments, D17).
`bun run beep tsconfig-sync` adds the matching project references, which moves the
dependency-edge digest of `@beep/alchemy-postgres#build`, `#check`,
`#lint:deprecated-apis` and `#test` (the four `configuration-drift` rows that
`bun run beep quality cache-policy` reports on this branch, and nothing else).

No command, input glob, output, environment key or cache flag changes, and no
qualification is granted.
