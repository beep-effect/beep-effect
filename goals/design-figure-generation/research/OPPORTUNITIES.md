# Opportunities & friction receipts

## 2026-10-05 — hosted queue saturation expires the monitor's settle budget

- **Doing:** babysitting PR #1420 (docs-only) with `yeet monitor --until-ready --detach`.
- **Evidence:** at 20:50Z the `Check` workflow was `queued`/`pending` with zero
  started jobs for 15 branches (oldest since 19:50Z); the head's run
  `37368989712` was `pending` with 0 jobs; the monitor ended
  `settle: required-pending → settle-timeout` after 30m listing every required
  context as missing. `gh pr checks` showed 0 failing.
- **Cost:** one wasted monitor job, a manual diagnosis, and a re-submit with
  `--settle-timeout "3 hours"`.
- **Would have prevented it:** the monitor distinguishing "run exists but has
  no jobs after N minutes" (queue saturation, environment-only) from a missing
  context, and either holding the budget like `heavy-not-admitted` does or
  printing a `queue-saturated` gate line with the repo-wide queued count.
  Related: the ci-lane-economics branch-cap governor.

## 2026-10-05 — effect-vitest ratchet is red on a file this lane never touched

- **Doing:** running `bun run beep lint effect-vitest` before publishing the slice-1 lane.
- **Evidence:** after merging `origin/main` (`6547603030`), the gate still reports
  `packages/tooling/tool/cli/test/yeet-sweep-retire.test.ts: 3 new finding(s)`; the lane
  only added rows for its own five test files (spliced, not `--write`, because `--write`
  rewrites the whole inventory).
- **Cost:** a second ratchet run and a merge to rule the lane out as the cause.
- **Would have prevented it:** the gate attributing a finding to the commit that
  introduced the file's current text (`git log -1 -- <file>`), so an inherited red reads
  as inherited at first sight. Attribution here: inherited from main.

## 2026-10-05 — rsvg-convert refuses multiple inputs with a versioned PDF format

- **Doing:** converting eight sheet SVGs into one `pdf1.6` with `rsvg-convert`.
- **Evidence:** `rsvg-convert --format pdf1.6 --output out.pdf a.svg b.svg` →
  `Multiple SVG files are only allowed for PDF and (E)PS output.` (librsvg 2.62.4);
  `pdfunite` merges but stamps a random `/ID`, so two merges never hash alike.
- **Cost:** a prototype round and a driver redesign (per-page convert, pdf-lib merge,
  header rewrite to the requested version).
- **Would have prevented it:** nothing in-repo; recorded so the next PDF driver starts from
  the per-page route.
