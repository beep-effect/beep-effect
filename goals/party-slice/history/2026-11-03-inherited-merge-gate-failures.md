# Inherited merge-gate test failures — 2026-11-03

Final-check at `0bc39665ac00c1d9c1c2f800e8a5bbfe70692781` completed all gates.
The coverage run's repository CLI suite had 8,898 passing tests, 5 skipped tests
and four failures. One failure was the party branch's policy-fingerprint input
inventory; the canonical generator fixes it by adding the two new manifests.
The other three are inherited and were reproduced in a detached checkout of
merge base `8fe07d3eed947c146448d1e469af4bb06148c7c3`.

## Reproduction

- Checkout: `/home/elpresidank/YeeBois/projects/beep-effect-worktrees/party-slice-base-proof`.
- Frozen install: `bun install --frozen-lockfile` passed.
- From `packages/tooling/tool/cli`:
  `bunx vitest run test/yeet-merge-gate.test.ts --maxWorkers=2`.
- Result: 79 passed, 3 failed (82 tests), exit 1.
- `git diff 8fe07d3eed..0bc39665ac -- packages/tooling/tool/cli` is empty:
  this PR changes no CLI source or tests relative to that merge base.

## Matching failures

All three are in `test/yeet-merge-gate.test.ts` under
“yeet merge-gate against recorded gh payloads”.

| Test | Same failure at the PR head and merge base |
| --- | --- |
| relaxed merges still hold without the required reviewer's successful current-head run | expected true to be false |
| holds after one empty reviewer page with an inflated total count | expected true to be false |
| a met gate squash-merges at the pinned head with `<title> (#n)` | expected a merge request containing `-X PUT`; recorded command is the owner merge-reservation check |

These findings are not attributed to party behavior. The merge-gate implementation
and tests are left unchanged. This receipt supports an explicit inherited-failure
attribution under the repository's S11 workflow; it does not claim the CLI suite
passed or waive any party-owned finding. Nine other coverage shards passed, and
the party domain/server suites are rerun after the source-style fixes.

## Local raw receipts

- `/home/elpresidank/.cache/party-final-check2.log`
- `/home/elpresidank/.cache/party-base-proof-install.log`
- `/home/elpresidank/.cache/party-base-merge-gate-tests.log`
- `.beep/yeet/final-check/0bc39665ac00c1d9c1c2f800e8a5bbfe70692781.json`

## Reproduction after the next main sync

The detached baseline was advanced to `41c9e36157` and its frozen install
passed. The same focused command again produced 79 passing tests and the
same three failures. This branch adds no merge-gate implementation or test
changes to that base. Raw receipts are
`/home/elpresidank/.cache/party-base-proof-install2.log` and
`/home/elpresidank/.cache/party-base-merge-gate-tests2.log`.

After the party fixes, domain (62 tests), server (76 tests), and coverage for
all three party packages pass. The focused policy-fingerprint suite passes
all six tests. The full deprecated-API scan passes with no unmatched source
files, and both party package audits/docgen pass. Full coverage remains an
explicit inherited-failure attribution; this is not a claim of a green
repository-wide CLI suite.
