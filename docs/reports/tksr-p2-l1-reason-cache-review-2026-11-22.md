# Cache baseline review: P2 re-records the L1 move without the retired package name

Date: 2026-11-22. Lane: P2 of `goals/text-knowledge-stack-rebuild` (L1 text), recorded on top of
`8aaaff47f51`.

## What changed

Nothing in the task graph. `8aaaff47f51` recorded the move of the former provenance package to
`@beep/text` with the request `docs/reports/tksr-p2-l1-move-cache-baseline-request-2026-11-22.json`
and the review `docs/reports/tksr-p2-l1-move-cache-review-2026-11-22.md`. The command copies the
request's review reason into every subject file it stamps, and that reason spelled the retired
package name. The `delete-package` doctor reads `standards/cache-baseline/` as live, so the 22
stamped files were residue of the retirement and `delete-package --check` could not print
`clean`.

## Review

This request re-stamps the same 22 subjects with a reason that names the move without spelling
the retired package name or its path. `bun run beep cache audit` read 0 blocking findings before
the re-record, so no node, edge, command, input, output or environment entry changes; only the
`review` block of each file does. The earlier review stays the basis of the recorded edges. The
record grants no qualification.

## Subjects

`//`, `@beep/agent-memory-store`, `@beep/epistemic-domain`, `@beep/epistemic-server`,
`@beep/epistemic-tables`, `@beep/epistemic-ui`, `@beep/epistemic-use-cases`, `@beep/epistemics`,
`@beep/file-processing`, `@beep/langextract`, `@beep/law-practice-domain`,
`@beep/law-practice-server`, `@beep/law-practice-use-cases`, `@beep/lejeune-bolt-workbench`,
`@beep/md`, `@beep/party-domain`, `@beep/professional-desktop`, `@beep/rdf`, `@beep/repo-cli`,
`@beep/semantica`, `@beep/text` and `@beep/workspace-server`.
