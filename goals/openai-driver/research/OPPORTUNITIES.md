# Execution opportunities

## 2026-08-27: pin drift in executable packets

- Work: verify the packet's Effect API contract before scaffolding.
- Evidence: `package.json` pins `@effect/ai-openai` `4.0.0-rc.112` and the local
  reference is `dd99ab007e`, while the packet named rc.111 and `02a5146d69`.
- Prevention: executable packets should name the root catalog and current
  reference checkout as authority, then record the observed version and commit
  in phase evidence instead of freezing both in the launcher.

## 2026-08-27: generated identity spelling

- Work: verify the package identity composer produced by `beep create-package`.
- Evidence: the generator registered `$OpenaiId`; the packet expected
  `$OpenAiId`.
- Prevention: packet templates should derive composer spelling from the
  generator's name normalizer or avoid predicting the generated identifier.

## 2026-08-27: new identity composer build ordering

- Work: run the new package's standalone build after scaffold and typecheck.
- Evidence: `bun run --cwd packages/drivers/openai build` reported that
  `@beep/identity/packages` had no exported `$OpenaiId`; `tsgo` had already
  passed against source aliases, but the identity package's prior build did not
  contain the generated composer.
- Prevention: `beep create-package` should rebuild the identity package after
  registration, or its next-step output should direct agents to a dependency-
  aware Turbo build instead of a standalone package build.

## 2026-08-27: new-package docgen launcher mismatch

- Work: run the packet's exact `bun run docgen:local` verification command.
- Evidence: the command exited with `full docgen proof required` because the
  required scaffold changed `bun.lock`, root `package.json`, `tsconfig.json`,
  and `tsconfig.packages.json`.
- Prevention: new-workspace packet templates should use
  `bun run docgen:local -- --full` for their blocking proof and reserve the
  package selector for the edit loop.

## 2026-08-27: generated boundary configuration omitted by repair

- Work: run the canonical full Yeet proof for the generated OpenAI workspace.
- Evidence: `bun run beep yeet verify` stopped at
  `repo-sanity:fallow-boundaries-config` because
  `standards/fallow.boundaries.generated.jsonc` was stale, even though the
  preceding `bun run beep yeet repair` had succeeded.
- Prevention: the package generator or Yeet repair should run the Fallow
  boundary writer whenever a workspace package is added.
