# Run artifacts

Read when you need the verdict, a failure packet, the proof ledger, or the changeset gate's exact rule. Part of the yeet skill.


- Every non-plan Yeet run writes `.beep/yeet/runs/<branch>/verdict.json`
  (`yeet-verdict/v1`): outcome, per-lane status, repair command for each
  failed lane, packet paths, staged-only stash identity, and base-freshness
  data. Read `yeet status` or the verdict before scanning logs. `yeet status`
  is observational and writes `.beep/yeet/runs/<branch>/status.json` instead of
  replacing the latest verdict.
- Failure packets land under `.beep/yeet/packets/` with the quality-issue
  index at `.beep/yeet/quality-issue-index.json`.
- The proof shadow ledger is `<clone>/.beep/yeet/proof-ledger.ndjson` in the
  owning clone, not in the lane: every worktree cut from one clone appends to
  one shared sample, and `yeet sweep --retire` never deletes it (time-to-certainty
  ruling 71). `bun run beep yeet proof-report` (`--json` for
  `proof-shadow-report/v1`) reads it from any lane or the clone and names the
  path it read. A red lane records its input digest as an observation (ruling
  72), so a lane that fails on inputs the ledger would have reused shows up as
  a disagreement; the report is shadow-only and never skips a lane.
  `--since <iso-timestamp>` counts only rows recorded at or after that instant
  toward the enforcement bar (ruling 80's flip condition) and prints the bound.
- The cheap-gates tier includes `beep quality changeset-status --since
  origin/main` (parity with hosted Repo Sanity). It enforces in-process: every
  changed, versioned, publish-enabled (`private !== true`), non-ignored product
  workspace must be named by a changeset **added in-branch** (the base backlog never counts, and empty
  changesets satisfy nothing). Write real `"@pkg": patch` frontmatter for each
  changed publish-enabled package; private workspaces and lab-only change sets
  are ceremony-exempt. The graph guard rejects notes naming private workspaces.
  Publication activation must deliberately establish release/versioning policy,
  audit external contracts, and restore appropriate changeset requirements.
