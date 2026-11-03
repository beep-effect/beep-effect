# Cache baseline review: W6 (the Yeet `gh` sites D-13 deferred, onto `@beep/github`)

Reviewed 2026-11-02 for the W6 PR of `goals/repo-cli-gh-git-consolidation` (SPEC D-15).

`bun run beep lint policy-fingerprint` reported drift on three seals after the W6 sources changed:
`@beep/repo-cli#lint:policy-fingerprint:goals-doctor`, `:knowledge` and `:quality`. The cause is the new edges, not a
task configuration change. `MonitorComments.ts` and `ReviewWindow.ts` (already in the goals-doctor and knowledge
closures) and `ProvenanceFooter.ts` (already in the quality closure) now take their GitHub services from the gh-login
edge in `commands/Yeet/internal/GhOps.ts`, and read through `@beep/github`. So `GhOps.ts`, the `Provenance.ts` it
imports, and the kit modules it reaches (`GitHubCommit.ts`, `GitHubRepository.ts`, `PullRequest.ts`, `Rest.ts`,
`ReviewThread.ts`) join those closures. `bun run beep lint policy-fingerprint --write` adds those inputs to the three
seals in `turbo.json` and `standards/policy-tools.fingerprint.json`, and changes nothing else.

`bun run beep cache audit` and `bun run beep quality cache-policy` report 0 blocking findings and one
`configuration-source-drift: turbo.json` review note. Commands, outputs, cache flags and environment are unchanged,
and no manifest changes. Recording the `//` and `@beep/repo-cli` subjects accepts the new input lists. No
qualification is granted, and no other subject changes.

## Re-stamp after beep-cli-composition W1b (#2645)

W1b merged first and split shared Yeet vocabulary out of tool files. W6 then moved its two gh-login
wrappers, `readYeetReviewWindowAsGhLogin` and `recordMonitoredPrSessionAsGhLogin`, out of the library
files `ReviewWindow.ts` and `ProvenanceFooter.ts` into the tool file `GhOps.ts`. That keeps W1b's edge
census at zero library-to-tool edges. The move changes which files the `//` and `@beep/repo-cli` policy
closures reach, so `lint policy-fingerprint --write` re-sealed them. The baseline is main's copy,
re-stamped for those same two subjects. No qualification is granted, and no other subject changes.
