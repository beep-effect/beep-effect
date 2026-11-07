# Cache-policy baseline re-record for scripts-to-beep-cli PR 1 (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/scripts-to-beep-cli`, PR #2860).

## What changed

- Root `package.json` `prepare` now runs `bun run beep toolchain prune-tsgo-backups` instead of
  `node scripts/prune-tsgo-backups.mjs`. A root script edit moves the scripts digest of every cached
  root (`//`) task, which accounts for the 40 `//#*` `configuration-drift` rows. No root task's
  command, inputs, outputs, environment keys or cache flags change.
- `@beep/repo-cli` gained `@changesets/changelog-github` and `@changesets/cli` as catalog dev
  dependencies (they back `@beep/repo-cli/ChangesetChangelog`). Its `beep:check` script also drops
  ` && tsrs -p scripts/tsconfig.json` because `packages/tooling/tool/cli/scripts/` is deleted.
  Together these account for the ten `@beep/repo-cli#*` rows. Each task still type-checks, lints,
  tests and documents the same sources.
- The regenerated policy-fingerprint seals edit `turbo.json` task inputs; that is the root
  `configuration-source-drift` row.
- The `packages/foundation/modeling/identity/turbo.json` and
  `packages/foundation/primitive/types/turbo.json` source rows are inherited from `main`; this
  branch does not edit either file. They are re-stamped here as reviewed.

No qualification is granted and the qualification scope is unchanged.

## Evidence

- Before this record, `bun run beep quality cache-policy` reported 50 blocking `configuration-drift`
  findings, all on `//#*` and `@beep/repo-cli#*`, plus the three `configuration-source-drift` review
  rows above.
- `bun run beep quality package-verify @beep/repo-cli --quick` passes.
