# Cache-policy baseline re-record for the vault-sync observability final PR (2026-11-08)

Reviewer: Claude Opus 5.5 (`goals/vault-sync-observability`, #2933).

`@beep/documents-server` and `@beep/documents-use-cases` each gain the workspace dependency
`@beep/observability`, for their declared span and attribute instruments
(`src/aggregates/Sync/VaultSync.instruments.ts` and
`src/aggregates/VaultSync/VaultSync.instruments.ts`, D17). documents-server also gains
`@beep/memfs` as a test-only dependency. `bun run beep tsconfig-sync` adds the matching
project references. That moves the dependency-edge digest of `#build`, `#check`,
`#lint:deprecated-apis` and `#test` for those two packages: the eight `configuration-drift`
rows that `bun run beep quality cache-policy` reports on this branch, and nothing else.

No command, input glob, output, environment key or cache flag changes, and no
qualification is granted.
