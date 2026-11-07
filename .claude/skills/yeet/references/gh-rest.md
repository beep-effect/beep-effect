# REST-first GitHub operations (`yeet gh`)

Read before any `gh pr` call: these commands spend the right budget. Part of the yeet skill.


GitHub GraphQL is 5,000 points an hour per identity, shared by every session on
the account; `gh pr view|edit|ready|merge|checks|comment` all spend it. REST has
its own budget. Use `bun run beep yeet gh <command>` instead of those `gh pr` commands:

| Need | Command | Budget |
| --- | --- | --- |
| Gate view: draft, head, required checks, review window | `yeet gh pr status <n> [--threads]` | REST (`--threads`: guarded GraphQL) |
| Label | `yeet gh pr label add\|remove <n> <label>` | REST |
| Comment | `yeet gh pr comment <n> --body <text>` | REST |
| Replace the body, keeping the Yeet provenance footer | `yeet gh pr body <n> --body-file <md>` | REST |
| Draft → ready | `yeet gh pr ready <n> [--no-wait]` | guarded GraphQL (no REST equivalent) |
| Re-run failed / cancel queued runs on the head | `yeet gh checks rerun-failed\|cancel-queued <n>` | REST |
| Merge at a pinned head | `yeet gh merge <n> --sha <sha10> [--tolerate <check>] [--force-window] [--dry-run]` | REST + guarded GraphQL thread read |
| Budgets | `yeet gh rate-limit` | REST + one GraphQL point |

- The guard probes `rateLimit { remaining resetAt }` (one point) before a
  GraphQL-only call; below 25 points it waits until `resetAt` (at most 65
  minutes) or, with `--no-wait`, exits 75. REST `/rate_limit` misreports the
  GraphQL bucket, so the probe is the truth.
- `merge` refuses unless the head equals `--sha`, the PR is open, not a draft,
  and not conflicted, every required context's newest run is green, no other
  check is red or pending (unless `--tolerate`d after attribution), the review
  window (20 minutes after the later of "marked ready" and the head commit) has
  passed, and the outstanding thread count is zero. A thread read that failed is
  never zero. Exit 75 means hold (time can clear it); exit 1 means refused.
- S11 merges over attributed reds use the orchestrator's gate instead:
  `bun run beep yeet merge-gate <pr> <sha> --relaxed [--tolerate
  "<check>=<attribution>"]`. Reds and pending checks, required ones included,
  are recorded in the merge line and a PR comment rather than held; head,
  draft, conflict, squash-commitlint, ruleset, review-window and thread holds
  stay, and a head on which no required check has run yet still holds.
- `HOLD squash-commitlint: <rule> at line N (len chars): "<line>"` (strict and
  relaxed alike): the gate predicts the squash commit message GitHub will write
  (`<PR title> (#n)` over one `* <full commit message>` bullet per PR commit,
  mirroring the repository's `squash_merge_commit_message` setting) and runs
  the repo's `bunx commitlint` on it, because `main`'s Commitlint range is
  previous-main..new-main and only the next merge clears a red squash (ep47,
  2026-10-19). A commit subject longer than 98 characters becomes a bullet over
  100, and the header is `<PR title> (#n)` against `header-max-length` 100, so
  the PR title (the first commit subject by default) has 100 minus the suffix,
  about 92 characters for a four-digit PR. The remedy names which one to fix:
  header, type, scope and subject rules point at the PR title, body and footer
  rules at the commits (`git commit --amend` / interactive rebase, then push);
  the orchestrator never merges over it. A commitlint that
  could not run is `unavailable` and holds the same way. `yeet ready` prints the
  same verdict as an advisory before the flip, never a refusal.
- Alternate identity (its own rate-limit budget): `--token-ref op://…` or
  `BEEP_GH_TOKEN_REF`, or a GitHub App installation token from
  `BEEP_GH_APP_ID`, `BEEP_GH_APP_INSTALLATION_ID`, and `BEEP_GH_APP_KEY_REF`
  (an `op://` reference to the PEM key). Tokens stay in-process and are never
  printed. Default: the `gh` login.
- `yeet publish|monitor` already use REST for the PR lookup, the
  `ready-for-heavy` label, the provenance footer read/write, and the Greptile
  re-trigger comment. Still GraphQL: review-thread resolution state and
  replies (`closeout`, `reply`, `status`, `watch`).

## Read a failed job's log without waiting for the run (moved from `AGENTS.md`)

Read a completed red job's log at once with
`gh api --allow-escape-sequences repos/<o>/<r>/actions/jobs/<id>/logs`;
never wait for the run to finish. `gh run view --log` refuses mid-run, and
plain `gh api` prints nothing on ANSI output. Commands: yeet skill, "Read a
failed job's log without waiting for the run".
