# Friction receipts

## 2026-10-06: `package-verify` green, five hosted lanes red

- Doing: handing off P1 after `bun run beep quality package-verify @beep/repo-cli` reported
  `ok audit`, `ok docgen` and both `yeet publish` cheap-gate runs were green.
- Evidence: hosted run on PR #1488 failed Heavy / Check and Heavy / Lint Policy
  (`quality:test-tsgo`: TS377032 `Effect.provide with a Layer` in two new test files, and
  `knowledge:refs-check`: one home-relative path in a skill), Heavy / Docgen (`docgen:local`:
  `Unknown @category value rendering`), JSDoc Ratchet (`missingExportExamples: 14 > 5`), and
  Heavy / Coverage Regression (two baseline rows). All introduced; none surfaced locally.
- Would have prevented it: a `package-verify --hosted-parity` mode (or the default) that also runs
  `quality test-tsgo`, `docgen local --base origin/main`, `ci lane jsdoc-ratchet`,
  `knowledge refs --check` on the commit, and a scoped per-file coverage read for baseline rows the
  diff touches. Until then the orchestrate skill tells owners to run those five before "final".

## 2026-10-06: `gh pr ready` refused while `rate_limit` showed quota

- Doing: flipping PR #1488 ready after calling it final.
- Evidence: `gh pr ready` and `gh pr view` returned `API rate limit already exceeded` while
  `gh api rate_limit` reported `graphql 4984/5000`; `yeet ready` then reported `no open pull
  request was found for this branch`.
- Would have prevented it: `yeet ready` distinguishing "GraphQL refused" from "no pull request",
  and falling back to REST for the lookup as `yeet publish` does since #1468.

## 2026-10-06: a stacked base changed a reader's `--jq` output under a scripted test

- Doing: merging the review-window branch's new head into this lane.
- Evidence: five `yeet-merge-gate` tests failed because the reader's timeline query changed from
  one instant per line to `<event>\t<instant>`; the scripted `gh` answered the old shape.
- Would have prevented it: a shared scripted-`gh` fixture for the review-window reads, exported
  from the review-window test kit, so dependants do not re-encode its wire shape.
