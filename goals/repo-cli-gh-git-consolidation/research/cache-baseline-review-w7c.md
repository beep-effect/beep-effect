# Cache baseline review: W7c (the Worktree group on `@beep/git` and `@beep/github`)

Reviewed 2026-11-03 for the W7c site lane of `goals/repo-cli-gh-git-consolidation` (SPEC D-20).

`bun run beep lint policy-fingerprint` reported drift on six seals after W7c moved the Worktree group's
`gh pr list` reads onto the kit's `PullRequest.list`: `@beep/repo-cli#lint:policy-fingerprint:quality-bun-audit`,
`:quality-changeset-graph`, `:quality-jsdoc-inventory`, `:quality-jsdoc-module-tags`, `:quality-jsdoc-ratchet` and
`:quality-tsgo-rules`. The cause is a new import, not a task configuration change. Those closures already reach
`commands/Worktree/Worktree.service.ts`, which now imports `@beep/github/PullRequest` and `@beep/github/Rest`
(`Rest.ts` imports `GitHubCommit.ts`), so `packages/drivers/github/src/PullRequest.ts`, `Rest.ts` and
`GitHubCommit.ts` join the six seals. `bun run beep lint policy-fingerprint --write` adds those three inputs to the
six seals in `turbo.json` and `standards/policy-tools.fingerprint.json`, and changes nothing else.

`bun run beep quality cache-policy` reports 0 blocking findings and one `configuration-source-drift: turbo.json`
review note. Commands, outputs, cache flags and environment are unchanged, and no manifest changes. Recording the `//`
and `@beep/repo-cli` subjects accepts the new input lists. No qualification is granted, and no other subject changes.
