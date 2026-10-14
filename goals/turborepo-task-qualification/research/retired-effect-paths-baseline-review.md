# Retired Effect path law baseline re-record (2026-10-14)

Reviewer: Claude Opus 5.5 (`chore/retire-effect-unstable-paths`).

## What changed

One root computation is added: `//#lint:retired-effect-paths`, running
`bun run beep laws retired-effect-paths --check`. The law scans every
git-tracked text file for an Effect module path that the upstream top-level
module move retired, and fails with the current path as the suggestion. The
mapping and the decision log live in `.patterns/effect-module-paths.md` (D5,
D6, D9).

The task follows the `//#lint:typos` posture because it reads the whole tree:
`cache: false`, inputs `**/*` minus `.git`, `graft`, `.repos` and the
generated-artifact directories (`node_modules`, `.beep`, `.turbo`, `dist`,
`coverage`, `.next`, `storybook-static`), and the `//#lint:policy-fingerprint`
edge. It joins the medium policy phase next to
`//#lint:effect-imports-markdown` and runs as its own cheap-gates lane in the
preflight wave.

## Why the baseline needs a new record

The new root script changes the complete-workspace-script digest of every root
computation; that digest intentionally binds all root scripts. No other root
command, input, output, environment key, dependency edge or cache flag
changes, and no qualification is granted: the new computation is uncached.

## Evidence

- `bun run beep laws retired-effect-paths --check` on this branch: 39,509
  tracked text files scanned, 775 binary files skipped, 0 findings, exit 0,
  about 3 seconds wall time. A whole-tree hash per run would cost about as
  much as the scan it would skip, which is why the task stays uncached.
- `root-tasks-turbo-inputs.test.ts` pins `explorations/fixture/c3-probe.json`
  as the direct input, the uncached flag, the fingerprint edge and artifact
  exclusion for the new row.
