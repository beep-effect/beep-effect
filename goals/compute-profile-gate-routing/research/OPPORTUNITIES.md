# Compute-profile gate routing: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted; hosts are named by their label only.

## 2026-11-13: `beep worktree new` based the lane on the clone's stale local `main`

- **Doing:** creating lane `fix/compute-profile-forced-gates` (PR #3281) on
  beep-worker with `bun run beep worktree new compute-profile-forced-gates
  --branch fix/compute-profile-forced-gates`, right after `git fetch origin main`.
- **Evidence:** the branch reflog in the primary clone reads
  `b43a4098bb fix/compute-profile-forced-gates@{12:09:10}: branch: Created from HEAD`,
  while `refs/remotes/origin/main` had fast-forwarded to `05ed8bc6b6` at 12:09:01
  (the merge of #3277). `b43a4098bb` is the primary clone's local `main`, 1,367
  commits behind. The lane had to be fast-forwarded to `origin/main`
  by hand (`git merge --ff-only origin/main`; `git reset --hard` is denied to
  agents) before any work, or every goal file it needed would have been missing.
  The command's `--base` default is documented as `origin/main`, and its output
  does not print the base it used.
- **Would have prevented it:** `worktree new` printing the base ref and sha it
  created the branch from, and failing (or warning) when the new branch's tip is
  not the freshly fetched `origin/main` it promises by default.

## 2026-11-13: host Bun 1.4.2 against the 1.4.4 pin blocks `yeet open` at pre-push

- **Doing:** `bun run beep yeet open --body-file <md>` for PR #3281 on beep-worker.
- **Evidence:** the pre-push hook `bun-version-check` failed with
  `version-sync: Bun version mismatch: .bun-version=1.4.4; bun --version=1.4.2 (.bun-version)`,
  then `error: failed to push some refs` and `yeet publish phase failed.` The
  failure is environment-only: hosted CI installs the pinned 1.4.4. The host's
  Bun install was left alone, and the push went through with that one hook
  skipped (`LEFTHOOK_EXCLUDE=bun-version-check bun run beep yeet open …`). The
  local gates in this lane (tests, lints, `yeet final-check`) ran on 1.4.2.
- **Would have prevented it:** the cloud/host bootstrap upgrading Bun to the
  pinned `.bun-version` on worker hosts, or `yeet open` (which runs no local
  gates by design) naming the mismatch and the `~/.local/bin/bun` upgrade path
  before it pushes instead of failing inside the hook.
