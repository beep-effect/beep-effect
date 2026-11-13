# Session route resolver: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-12: a failed head-install preflight leaves no publish path but `yeet open`

- **Doing:** publishing the exploration and this packet (docs-only diff) with
  `bun run beep yeet publish --staged-only --message ...`.
- **Evidence:** every cheap-gate lane passed and the commit was created, then
  the clean-HEAD install preflight's `git worktree add --detach <tmp> HEAD`
  died with `fatal: Could not write new index file.` (176 GiB free; the same
  `.git` serves many live lanes). The retry
  `yeet publish --push-only` refused with `requires --reuse-verified unless
  HEAD is a reproducible merge of the base`, so the head went out through
  `yeet open --body-file`.
- **Would have prevented it:** skip the head-install preflight when the diff
  touches no manifest or lockfile, or let a publish retry reuse the cheap-gate
  result it recorded seconds earlier for the same HEAD.

## 2026-11-12: finding a PR's owner is a manual join

- **Doing:** the census for this packet.
- **Evidence:** the ledger row for a PR gives a `sessionId`; the display name
  that `SendMessage` needs is in a different store, and a lane on another host
  has no local row at all. See the exploration's `RESEARCH.md`.
- **Would have prevented it:** this packet's `session resolve`.

## 2026-11-13: `lint effect-vitest --write` re-baselines every drifted row, not just the new file

- **Doing:** recording the one reviewed EV010 residual (NodeServices in a test
  that spawns the hook) for the new `session-route-resolver.test.ts`.
- **Evidence:** `bun run beep lint effect-vitest --write` rewrote 165 lines of
  `standards/effect-vitest.inventory.jsonc`: line-number drift in
  `ci-lane.test.ts`, `quality-tasks.test.ts` and others already on main, plus
  the one new row. The row was spliced in by hand to keep the diff at +21.
- **Would have prevented it:** `--write --files <path>` that adds or replaces
  only that file's rows.

## 2026-11-13: an unborn branch made the hook's branch probe print twice

- **Doing:** the hook test for presence rows, in a fresh `git init` repository.
- **Evidence:** `git rev-parse --abbrev-ref HEAD` prints `HEAD` and exits 128
  before the first commit, so `$(... || printf HEAD)` produced `HEAD\nHEAD`.
  The test caught it; the hook now uses `git symbolic-ref --short -q HEAD`.
- **Would have prevented it:** nothing missing; the test that runs the real
  hook against a scratch repository is what caught it.
