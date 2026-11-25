# P7 cut-over cache input review

Date: 2026-11-25. Lane: P7 of `goals/text-knowledge-stack-rebuild` (cut-over and retirement),
recorded on top of `f33d6beede1`.

## What changed

P7 deletes two workspaces through `bun run beep delete-package`. Their names are reserved in
`standards/changesets.retired-packages.json` and are spelled nowhere in this review or in the
request reason, because the `delete-package` doctor reads `standards/cache-baseline/` as live.
Neither workspace had an importer or a dependent, so no live task loses an edge.

The deletions strip one policy input line per workspace from `turbo.json` and rewrite the policy
tools fingerprint, which changes the root digest that `bun run beep cache audit` reports as
`configuration-drift` on `//#lint:policy-fingerprint`. Rows 1 to 6 also edit hashed inputs of
`@beep/nlp-processing`, `@beep/wink` and `@beep/nlp-mcp` (JSDoc, README and the manifest
description), and of `@beep/identity`, `@beep/repo-cli` and `@beep/repo-cli-kit` (the identity
segments, the ci lane partitions, the coverage scope and the delete-package fixtures).

## Review

The reviewed projection keeps computation commands, outputs and declared environment. The two
retired subject files are dropped and their current digests go in `previous`, so the record names
the retirement only by digest. The root and the six live subjects are re-recorded on the live
`.bun-version` profile, `local-linux-x64-bun1.4.5`, under the existing `qualification-v3` epoch
and lint scope. The record grants no qualification.

## Subjects

`//`, `@beep/identity`, `@beep/nlp-mcp`, `@beep/nlp-processing`, `@beep/repo-cli`,
`@beep/repo-cli-kit`, `@beep/wink`.
