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

## 2026-08-27: reviewer guidance conflicted with TSGo Layer policy

- Work: apply the Effect reviewer's suggestion to replace a scoped test Layer
  helper with direct `Effect.provide(layer)` calls.
- Evidence: `bun run --cwd packages/drivers/openai check` rejected every such
  call with `effect(strictEffectProvide)` and rejected chained configuration
  provision with `effect(multipleEffectProvide)`.
- Prevention: Effect reviewer prompts should require a focused package
  typecheck before recommending Layer-valued `Effect.provide` inside test
  bodies, and should distinguish application entry points from test-local
  acquisition helpers.

## 2026-08-27: Yeet review-fix tier invocation

- Work: transition from the confirmation reviewer round to the bounded Yeet
  proof for review fixes.
- Evidence: `bun run beep yeet review-fix` exited with `Unknown subcommand
  "review-fix"`; the command help instead lists `review-fix` as a `--tier`
  choice for `yeet verify`.
- Prevention: quality-loop instructions should spell out
  `bun run beep yeet verify --tier review-fix` rather than referring to the
  tier name without its operator syntax.

## 2026-08-27: concurrent checkout ownership during publication

- Work: preserve the verified driver branch through publication.
- Evidence: the original checkout moved to another feature branch with active
  edits while the driver proof was running, so publication continued from a
  clean linked worktree dedicated to `feat/openai-driver`.
- Prevention: long-running goal workflows should claim a linked worktree before
  the first full proof when the source checkout is shared with other agents.

## 2026-08-27: proof coordinator starvation

- Work: publish an exact commit immediately after its full Yeet proof passed.
- Evidence: multiple sibling in-process waiters reacquired the repository-wide
  coordinator ahead of a shell-level push-only waiter; publication could
  compete only after using the same in-process acquisition path.
- Prevention: the coordinator should provide FIFO tickets or an atomic wait
  mode so verified publication cannot starve behind newly queued full proofs.

## 2026-08-27: reusable-proof publish flag coupling

- Work: push an already verified, clean commit and open its PR.
- Evidence: `yeet publish --push-only --pr --monitor` was rejected because this
  CLI version also requires `--reuse-verified`.
- Prevention: publish help and workflow guidance should present the accepted
  form as `yeet publish --push-only --reuse-verified --pr --monitor`.

## 2026-08-27: non-required deployment check stopped monitoring

- Work: monitor PR #864 after its first publication.
- Evidence: Yeet's fail-fast watch stopped on Vercel deployment rate limits,
  while `gh pr checks --required` excluded both Vercel contexts and showed the
  repository's required checks passing or still running.
- Prevention: Yeet monitor should classify required checks separately from
  informational deployment contexts and report, rather than fail on, the
  latter when mergeability does not depend on them.
