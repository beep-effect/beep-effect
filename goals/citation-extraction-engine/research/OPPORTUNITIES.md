# Citation engine friction receipts

## 2026-10-28 — stale prerequisite and source state

- Work: establish P0 prerequisites and the exact official source baseline.
- Evidence: both prerequisite READMEs now say `completed-retained`; the engine
  packet still described both public contracts as unfinished. The shared
  official reference had advanced away from the required commit.
- Resolution: check public export maps and focused contract tests, retain a
  compatibility record, and run the specified source in a detached cache
  worktree without resetting the shared reference.
- Prevention: make prerequisite/source freshness a consumer admission check;
  retain exact commit/tree checks in every oracle exporter.

## 2026-10-28 — npm configuration breaks donor packaging probe

- Work: run the authorized pinned eyecite-ts suite with its frozen lockfile.
- Evidence: 322 files passed; packaging setup failed with `EALLOWSCRIPTS` because
  npm 12 rejects the workstation's user `allow-scripts` setting in this mode.
- Resolution: rerun with process-local `NPM_CONFIG_USERCONFIG=/dev/null` and
  `NPM_CONFIG_IGNORE_SCRIPTS=true`; all 323 files pass. Preserve the initial
  failure and skip/todo counts in the baseline receipt.
- Prevention: document the isolated, install-scripts-disabled npm environment
  for reproducible donor packaging verification.

## 2026-10-28 — packet-local test is outside workspace discovery

- Work: add an executable public-import prerequisite probe.
- Evidence: root Vitest projects include package `test/**/*.test.ts` files;
  `goals/**/ops/*.test.ts` is outside their include patterns.
- Resolution: put the consumer test in law-practice use-cases' existing test
  surface and run it through that package script.
- Prevention: place executable consumer contract tests with the consuming
  package; reserve packet ops for generation and evidence tools.

## 2026-10-28 — packet Markdown gate has inherited failures

- Work: run the packet's declared Markdown verification command.
- Evidence: the unselected tool shim fails with `No version is set`; selecting
  the already installed 0.22.1 tool works. The full packet then reports
  inherited long table rows and unescaped reflection-template placeholders.
- Resolution: new evidence Markdown passes with zero errors; retain the
  existing full-packet failures as open close-gate work, not as a green result.
- Prevention: pin the tool invocation and make the packet's declared command
  green before its final delivery.
