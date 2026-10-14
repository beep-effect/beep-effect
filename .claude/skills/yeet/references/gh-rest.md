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
  draft, conflict, ruleset, review-window and thread holds stay, and a head on
  which no required check has run yet still holds.
- Alternate identity (its own rate-limit budget): `--token-ref op://…` or
  `BEEP_GH_TOKEN_REF`, or a GitHub App installation token from
  `BEEP_GH_APP_ID`, `BEEP_GH_APP_INSTALLATION_ID`, and `BEEP_GH_APP_KEY_REF`
  (an `op://` reference to the PEM key). Tokens stay in-process and are never
  printed. Default: the `gh` login.
- `yeet publish|monitor` already use REST for the PR lookup, the
  `ready-for-heavy` label, the provenance footer read/write, and the Greptile
  re-trigger comment. Still GraphQL: review-thread resolution state and
  replies (`closeout`, `reply`, `status`, `watch`).
