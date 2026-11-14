# Cache baseline review: @beep/oip-web gains an Alchemy stack (2026-11-14)

Reviewer: Claude Opus 5.5 (`goals/infra-alchemy-rebuild-p4-oip-web`). No qualification is granted.

The `OipWeb` stack (`apps/oip-web/alchemy.run.ts`, `apps/oip-web/stack/`, tests under
`apps/oip-web/test/stack/`) changes the `@beep/oip-web` manifest and default inputs, so
`bun run beep quality cache-policy` reports `configuration-drift` on five cached computations:
`build`, `check`, `lint:deprecated-apis`, `test` and `test:property`.

What changed in the package:

- dev dependencies `alchemy`, `@alchemy.run/aws`, `@alchemy.run/cloudflare`, `@alchemy.run/test` and the
  workspace edge `@beep/alchemy-vercel` (the scripts block is unchanged);
- `tsconfig.json` includes `stack` and `alchemy.run.ts` and gains the `@beep/alchemy-vercel` project reference
  (`config-sync`); `tsconfig.check.json` gains the same reference;
- `tsconfig.next.json` excludes `alchemy.run.ts` and `stack`, so `next build` type-checks exactly what it did
  before;
- new source files `alchemy.run.ts` and `stack/*.ts` and new test files `test/stack/*.ts`, all inside the
  package's default inputs; `README.md` is excluded from `build` inputs already.

Real input changes: `check` type-checks the stack, `test` and `test:property` run the stack tests,
`lint:deprecated-apis` scans the new files, and `build` hashes the new files through `$TURBO_DEFAULT$` (its
output is unchanged because the Next build never imports them). No command, output, environment variable or
task changes, and no task becomes cacheable.

Re-recording `@beep/oip-web` adopts the new digest. No exception row is added; scope, profile and epoch are
unchanged. `@beep/alchemy-vercel` changes only source, tests and its README, which the audit does not report.
