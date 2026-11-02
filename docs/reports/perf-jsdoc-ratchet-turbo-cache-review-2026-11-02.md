# Cache baseline review: cheap-gates JSDoc ratchet on the cached root chain (2026-11-02)

Branch `claude/perf-jsdoc-ratchet-turbo-9766f2`. The re-record covers the one subject
`bun run beep quality cache-policy` reported as drifted: the root `//`
(`configuration-drift` on `//#jsdoc:inventory:check`, `configuration-source-drift` on
`turbo.json`).

## What changed

- **`turbo.json`** widens one input glob of `//#jsdoc:inventory:check` from
  `scratchpad/**/*.ts` to `scratchpad/**/*.{ts,tsx}`. The inventory scanner reads `.ts` and
  `.tsx` files under the `scratchpad` workspace (srcDir `.`), so a scratchpad `.tsx` file
  could change the inventory without changing the task hash. No tracked scratchpad `.tsx`
  file exists today, so no current verdict changes. Outputs, dependencies, cache flag and
  environment are unchanged.
- **`turbo.json`, review round 1 (CodeRabbit).** `//#jsdoc:inventory:check` drops
  `!**/test/fixtures/**`: fixture trees are not gitignored, so a fixture file under a
  source root is scanned but was not hashed. `//#jsdoc:ratchet:check` drops every directory
  exclusion except `!**/node_modules/**` (`.beep`, `.turbo`, `dist`, `build`, `coverage`,
  `.next`, `storybook-static`): its zero-legacy listing applies no directory filter, so a
  force-tracked file under such a directory was read but not hashed. Both changes only widen
  inputs; no tracked file in the repository matches either removed exclusion today.
- **Scanner file set.** The inventory scan (`JSDocDocumentationInventory.ts`) and the
  ratchet's zero-legacy scan (`JSDocRatchet.ts`) now count tracked and
  untracked-but-not-ignored files (`git ls-files --cached --others --exclude-standard`)
  instead of tracked files only. Turbo hashes untracked files: measured on this branch, the
  task hash for an untracked new source file and for the same file after `git add` was
  identical (`410d14e9c1cad4c7` both times), so a hit after `git add` replayed an inventory
  that never counted the file. Both scans are covered by the policy fingerprint seal, so
  this is a tool change, not a Turbo definition change.
- **Yeet plan (`@beep/repo-cli`).** The cheap-gates lane `quality:jsdoc-ratchet:regenerated`
  runs the existing cached `//#jsdoc:ratchet:check` task (which depends on
  `//#jsdoc:inventory:check`) instead of the in-process `jsdoc-ratchet --regenerate` scan.
  No Turbo task is added.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. This review records
the legacy posture of the root subject only. It grants no qualification, widens no
qualification scope, and adds no exception row.

## Reversal

Return the glob to `scratchpad/**/*.ts`, restore the removed exclusions, return the cheap-gates lane to
`repoCliLane(..., ["jsdoc-ratchet", "--regenerate"])`, then re-record the root subject.
