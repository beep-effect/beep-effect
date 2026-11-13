# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: a cache-baseline re-record has to review root drift inherited from `main`

- **Doing:** P3 Storybook stack (lane `goals/infra-alchemy-rebuild-p3-storybook`); a new script in
  `apps/storybook/package.json` drifted eight `@beep/storybook` computations.
- **Evidence:** `bun run beep cache baseline --request <request.json>` with `subjects: ["@beep/storybook"]`
  answered `Baseline review does not cover the changed subjects. Unreviewed: //.` The lane does not touch
  `turbo.json`; four PRs merged after the last record (#3242) had regenerated ten root-declared
  `@beep/repo-cli#lint:policy-fingerprint:*` input lists, which `main` reports only as
  `REVIEW configuration-source-drift: turbo.json`. The next lane to re-record inherits the review.
- **Would have prevented it:** the PR that regenerates root `turbo.json` input lists re-records `//` itself
  (make the source drift a BLOCK there), or the baseline command names inherited subjects apart from the
  lane's own so the reviewer knows which diff to read.

## 2026-11-13: `final-check` coverage replays the whole repo when `bun.lock` changes

- **Doing:** the same lane; the diff adds three dependencies to one app, so `bun.lock` gains four lines.
- **Evidence:** `final-check:coverage` selected the full workspace (`coverage:full`, shard 2 of the run) and
  was killed after 36 minutes with exit 143; the other gates took under seven minutes each. The receipt for
  the pushed head records the gate as skipped and hosted CI measures it.
- **Would have prevented it:** scope the coverage replay by the workspaces whose resolved dependencies
  changed in the lockfile diff, not by the lockfile path alone.
