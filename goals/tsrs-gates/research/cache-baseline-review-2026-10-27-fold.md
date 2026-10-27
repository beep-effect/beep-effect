# Cache baseline review: fold the Effect diagnostics lane into Check (2026-10-27)

Reviewer: Claude Fable 5.1 (tsrs-gates PR 2, `feat/tsrs-gates-fold`).

## What changed

`standards/effect-diagnostics.profile.json` is deleted: its eleven rules now live in
`tsconfig.base.json` and the copied compiler profiles, and the standalone
`quality effect-diagnostics` lane is removed (`goals/tsrs-gates`, decision log
2026-10-27). The profile was a declared input of four tasks, so those tasks'
recorded input lists lose one path each:

- `//#lint:policy-fingerprint` and `//#lint:tsgo-rules` (root `turbo.json`;
  `standards/policy-tools.fingerprint.json` regenerated with
  `beep lint policy-fingerprint --write`).
- `@beep/repo-cli#test` and `@beep/repo-cli#test:property`
  (`packages/tooling/tool/cli/turbo.json`).

Task names, commands, outputs, `cache` flags and dependency edges are unchanged.
The two `configuration-source-drift` rows are the same two `turbo.json` edits.
No qualification is granted or widened.

## Evidence

- `bun run beep quality tsgo-rules`: 130 installed rules configured (5 declared
  off), copied profiles match the root map.
- `turbo run check --continue` with the ignore flags false: 336/337 before the
  repo-cli test edits landed, 337/337 after (recorded in the PR body).
- `@beep/repo-configs` `EffectTsgoEffectFnPolicy.test.ts` 5/5: an Effect-only
  finding now fails `tsrs`.

## Stack merge (2026-10-27)

Merging the updated `feat/tsrs-gates` (which had merged `origin/main` 8b1da02360)
took that branch's baseline and re-applied this review on top: the audit names
the same four tasks and two `turbo.json` source rows, and nothing else.

