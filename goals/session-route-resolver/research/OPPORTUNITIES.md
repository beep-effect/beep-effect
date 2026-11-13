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
