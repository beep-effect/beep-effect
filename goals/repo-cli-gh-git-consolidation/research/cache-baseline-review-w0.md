# Cache baseline review: W0 (`Git.isAncestor`, `Git.worktreePrune`, the runtime-edge `Git.layer`)

Reviewed 2026-11-02 for W0 of `goals/repo-cli-gh-git-consolidation` (SPEC D-03 to D-07).

`bun run beep quality cache-policy` reported 7 blocking findings, all introduced by this branch and all of one kind,
configuration drift, on the root's policy-fingerprint seals: `//#lint:policy-fingerprint:shared`,
`:goals-doctor`, `:goals-index`, `:holds`, `:knowledge`, `:lint-roadmap-refs` and `:quality`.

The cause is one import edit. `packages/tooling/tool/cli/src/internal/dispatch/Dispatch.manifest.ts`, which every
policy command path imports, now names `Git` from `@beep/git/Git` in its `BaseServices` type because
`bin-main.ts` provides `Git.layer` once at the runtime edge (D-06). `@beep/git` therefore moves from the six
per-command seals that already reached it (`goals-doctor`, `goals-index`, `holds`, `knowledge`, `lint-roadmap-refs`,
`quality`) into the `:shared` seal they all chain to: `bun run beep lint policy-fingerprint --write` removes the ten
`packages/drivers/git/**` inputs from each of the six `turbo.json` tasks and adds them once under `:shared`, and
`standards/policy-tools.fingerprint.json` records the same move. No package manifest changes: `@beep/repo-cli`
already depended on `@beep/git`, no dependency is added or removed anywhere, and `tsconfig-sync --check` reports no
drift. The set of files the policy tools depend on is unchanged; only which seal owns them moves.

Recording the root subject accepts the existing posture for the re-sealed tasks. No qualification is granted, and
no other subject changes.
