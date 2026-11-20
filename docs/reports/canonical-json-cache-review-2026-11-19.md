# Cache review for the canonical JSON copy retirement (2026-11-19)

Branch `goals/text-knowledge-stack-rebuild-p1-l0-identity` (text-knowledge-stack-rebuild
P1, PR A commit 4, `refactor(epistemic,execution-authority): import canonical JSON from
its owner`). Reviewer: Claude Opus 5.5 (P1 L0 identity lane).

`bun run beep cache audit` reports 4 blocking findings in one subject:

- `@beep/execution-authority-domain`: `configuration-drift` on `build`, `check`,
  `lint:deprecated-apis` and `test`.

## Cause

The slice-local copy `packages/execution-authority/domain/src/internal/CanonicalJson.ts`
aliased `canonicalDetectionJson` from `@beep/epistemics/ContradictionDetection` and was
the package's only import of `@beep/epistemics`. The commit deletes it, the two seal
modules import `JsoncFingerprint` from `@beep/jsonc` (the canonical JSON owner), and
`@beep/jsonc` moves from `devDependencies` to `dependencies`. The now unused
`@beep/epistemics` dependency is removed and `bun run beep tsconfig-sync` prunes its
three project references. The drift is the removal of the `@beep/epistemics#build` and
`@beep/epistemics#transit` dependency edges from those four tasks. The
`@beep/jsonc#build` and `@beep/jsonc#transit` edges were already recorded, because the
development dependency already reached the owner, so no edge is added.

## Judgement

The tasks keep the root task definitions with no package `turbo.json` override: no
command, cache flag, input, output or environment changes. Removing an upstream edge
only stops these tasks from rerunning on `@beep/epistemics` changes they no longer
read. Recording the subject grants no qualification.

## Reversal

Restore `"@beep/epistemics": "workspace:^"` in
`packages/execution-authority/domain/package.json` (and `@beep/jsonc` to
`devDependencies` with the copy restored), rerun `bun install` and
`bun run beep tsconfig-sync`, and re-record the `@beep/execution-authority-domain`
subject.
