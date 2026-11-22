# Cache review for the `lint:comment-law` root task (2026-11-22)

Branch `goals/comment-law-gate`, based on `main` @ 809947c2a5c. Reviewer: Claude Opus 5.5
(comment-law gate wiring lane).

`bun run beep cache audit` reports 44 blocking `configuration-drift` findings: 38 in the root
subject `//` and six in `@beep/repo-cli` (`build`, `check`, `doctest`, `lint:deprecated-apis`,
`test`, `test:property`).

## Cause

- `//` (root): the root `package.json` gains the `oxc-parser` dependency the comment law's scanner
  parses with, and the script
  `"lint:comment-law": "bun run beep laws comments --check --base \"$BEEP_PROOF_BASE\""`. The root
  manifest's bytes are part of the reviewed configuration of every cached root computation, so each
  one drifts. `bun run beep lint policy-fingerprint --write` also reseals the `laws` policy task's
  inputs in `turbo.json`: the comment law (`CommentLaw.ts`, `CommentLaw.model.ts`) imports the
  comment grammar from `@beep/lint-rules`, so the seal now lists that package's manifest, its
  `src/**` glob, `comment-grammar.ts`, the root `.oxlintrc*.json(c)` files and `tsdoc.json`.
- `@beep/repo-cli`: the package manifest gains the `@beep/lint-rules` workspace dependency and the
  `oxc-parser` catalog dependency, which adds the `@beep/lint-rules#build` and `#transit` edges to
  its package tasks.

## Judgement

The new root task `//#lint:comment-law` is `cache: false`, takes `BEEP_PROOF_BASE` as a pass-through
variable and sits in `policyGitDeltaTasks` beside `knowledge:semantic-delta` and
`knowledge:refs-check`, because it diffs the merge base against `HEAD`. No existing task command,
cache flag, output glob or environment variable changed. The seal and dependency edits only add
inputs and upstream edges. Recording the new configuration grants no qualification.

## Reversal

Remove the root script, the `//#lint:comment-law` task, the two repo-cli dependencies and the
comment law sources, rerun `bun install`, `bun run beep tsconfig-sync` and
`bun run beep lint policy-fingerprint --write`, and re-record the two subjects.

## Profile

Re-recorded on 2026-11-22 under the `local-linux-x64-bun1.4.5` toolchain profile after main moved to Bun 1.4.5 (#3460); the first record used `local-linux-x64-bun1.4.4`.
