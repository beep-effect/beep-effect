# Reviewed root lint plan re-record (2026-10-06)

The warm `bun run lint` plan changed in four reviewed ways, recorded in
`docs/runbooks/turbo-cache-inputs.md` ("Local full-scope lint plan"):

1. `//#jsdoc:inventory:check` is cached. Its scanner reads workspace manifests,
   `docgen.json`, `tsdoc.json` and the `{packages,apps,infra}` TypeScript sources;
   the inputs add the artifact-directory exclusions every cached root task
   carries, and the declared `.beep/ci/jsdoc-documentation.inventory.*` outputs
   restore on a hit. A two-pass lane run (4m20s cold, 156 ms warm, 6/6 cached)
   restored both inventory files.
2. Four new cached root computations replace repo-cli subprocess steps:
   `//#lint:tsconfig-overlay`, `//#lint:package-test-typecheck`,
   `//#lint:effect-vitest` and `//#jsdoc:ratchet:check` (depends on the inventory
   task). Each input set follows the command's own scan scope; the tripwire
   (`root-tasks-turbo-inputs.test.ts`) pins one direct input per row, the
   fingerprint edge, and artifact exclusion.
3. The four new root scripts change the complete-workspace-script digest of every
   cached root computation. That digest intentionally binds all root scripts;
   no other root command, input, output, environment key, dependency edge or
   cache flag changed. This review attributes those shared digest changes to the
   four added scripts.
4. The git-delta knowledge checks keep `cache: false`; only the local full-scope
   plan stops scheduling them. No projection node changes.

Refresh the baseline through the canonical writer with the exact prior baseline
digest. Preserve the existing scope, profile `local-linux-x64-bun1.4.2` and
epoch `qualification-v2`. No qualification tuple is granted or changed; the new
computations are reviewed configuration, not cache-qualification evidence.

## Wave 2 (review round 1)

Review found three input gaps and this re-record attributes the resulting
configuration changes: `//#lint:effect-vitest` inputs are now exactly the D9
scanner globs plus the inventory and primitives graph; `//#jsdoc:ratchet:check`
no longer excludes `test/fixtures` sources the zero-legacy gate reads; and
`//#jsdoc:inventory:check` adds the `scratchpad` and `tools` workspace sources.
No command, output, environment key, dependency edge or cache flag changes.
