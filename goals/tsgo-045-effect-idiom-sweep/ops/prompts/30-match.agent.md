# Match lane — restore idiomatic combinators and ship the `match-shapes` law

You own every `Match.*` call site in packages, apps and scratchpad, and the
new repo lint law `match-shapes`. No other lane rewrites Match combinators.

## Inputs

- `ops/rule-cards/match-combinators.md` (complete it first; its shape table
  is the law's specification and the audit's checklist).
- The PR #1060 diff for the 66 regressed files:
  `git diff 6b1ebc8d33^1 6b1ebc8d33 -- '*.ts' '*.tsx'` (read-only use of git
  is allowed for this diff only).
- effect clone `$HOME/YeeBois/dev/effect/packages/effect/src/Match.ts` (rc.115)
  and its tests for `tagsExhaustive`, `discriminatorsExhaustive`, `typeTags`,
  `valueTags`, `whenAnd`, `tagStartsWith`, `discriminatorStartsWith`.
- Prior detector shape: `packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestDetectors.ts`
  and its fixtures; law registration in `Lint.command.ts`
  (`tooling-schema-first` is the model).

## Procedure

1. Complete the card: one before/after pair per shape row, including a
   handler map whose handlers are `Effect.fn` (contextual typing fixed
   upstream in `8d1e97a`; verify it compiles with the installed pin).
2. Census: for every shape row, list matching sites repo-wide
   (`ops/inventory/M01-match.json`), separating "regressed in #1060" from
   "pre-existing".
3. Rewrite every site where the card's idiomatic form applies without
   changing behavior. Where a chain is genuinely partial or needs the full
   value, keep it and record the reason.
4. Implement `match-shapes` in the repo-cli `Lint` family: syntax-level
   detector, positive/negative fixtures under
   `packages/tooling/tool/cli/test/fixtures/match-shapes/`, an empty
   committed baseline, tests, and the `lint:policy` hosted seat wiring used
   by the effect-vitest ratchet (#1098). Follow schema-first: the finding
   row is an `S.Class`, shape ids are a `LiteralKit` domain.
5. `bun run beep quality package-verify @beep/repo-cli` plus package-verify
   for every package whose Match sites you rewrote. `bun run beep lint
   match-shapes` must be green on the rewritten tree and red on the fixtures.

## Output

`ops/inventory/M01-match.report.md` with touched files, per-shape counts
(regressed vs pre-existing vs residual with reasons), the law's fixture list,
and the exact verification commands with their status lines. No git.
