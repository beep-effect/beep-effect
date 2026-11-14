# Cache baseline review: @beep/oip-web gains an Alchemy stack (2026-11-14)

Reviewer: Claude Opus 5.5 (lane goals/infra-alchemy-rebuild-p4-oip-web). No qualification is granted.

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

## Root subject `//`, inherited from `main` (re-review after merging `origin/main`, 2026-11-14)

The lane merged `origin/main` at `5aeb4416e70`. Since this review's first recording (merge base `b65f4b56249`),
#3296, #3317, #3310 and #3304 regenerated root `turbo.json`, which the audit reports as
`REVIEW configuration-source-drift: turbo.json`. Comparing `turbo.json` at `b65f4b56249` with `5aeb4416e70`, only
the generated `inputs` lists of eight root-declared tasks differ: `//#lint:policy-fingerprint` and
`@beep/repo-cli#lint:policy-fingerprint:shared`, `:quality-bun-audit`, `:quality-changeset-graph`,
`:quality-jsdoc-inventory`, `:quality-jsdoc-module-tags`, `:quality-jsdoc-ratchet` and `:quality-tsgo-rules`. The
lists follow the manifests of the two new infra packages (`cost-controls`, `turbo-cache`) and the Cache command
sources those PRs added under `packages/tooling/tool/cli/src/commands/Cache`. No task was added or removed, and no
command, output, environment or dependency edge changed; everything outside `tasks` is identical. This lane's diff
does not touch `turbo.json`. Re-recording `//` and `@beep/oip-web` adopts both digests; no qualification is granted.

## Root subject `//` again, after merging `origin/main` at `00e2e35dbae` (2026-11-14)

#3322 changed root `turbo.json` after `1f34884a98c`: it adds the root task `//#lint:no-tracked-python`
(`cache: false`, no outputs, env `BEEP_CACHE_TOOLCHAIN_DIGEST`, depending on
`@beep/repo-cli#lint:policy-fingerprint:laws`), and regenerates the `inputs` lists of
`@beep/repo-cli#lint:policy-fingerprint:laws` and `:lint-laws`. The new task is uncached, so it grants no reuse;
nothing outside `tasks` changed, and this lane's diff does not touch `turbo.json`. Re-recording `//` and
`@beep/oip-web` on `main`'s baseline adopts both digests; no qualification is granted.

## `@beep/oip-web` only, after merging `origin/main` at `6d366333e22` (2026-11-14)

#3325 (infra-hosts) changed `standards/cache-qualification-baseline.json` and root `turbo.json` on `main`, which
conflicted with this lane's recording. The lane took `main`'s baseline verbatim and re-recorded only its own
subject. On `main`'s baseline the audit reports configuration drift for `@beep/oip-web` alone (`build`, `check`,
`lint:deprecated-apis`, `test`, `test:property`), the same stack inputs described above; it reports nothing for
`//`, because `main` already recorded #3325's `turbo.json` change. Re-recording `@beep/oip-web` adopts its digest;
no exception row is added and no qualification is granted.
