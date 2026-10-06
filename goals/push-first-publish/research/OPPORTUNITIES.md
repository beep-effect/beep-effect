# Opportunities

## Publish titled the draft PR after a merge commit instead of `--message`

- **Work:** Opening draft pull requests with
  `bun run beep yeet publish --message "<title>"` on 2026-10-06 (PRs #1464,
  #1480, #1481), then squash-merging them.
- **Friction:** `publish` titled the pull request from the head commit's
  subject (`git log -1 --pretty=%s`), not from `--message`. When the head
  commit already existed (no new commit was created by publish) the title was
  whatever that commit said; on #1481 the head was a merge commit, so the PR
  was titled `Merge remote-tracking branch 'origin/main' into
  feat/corpus-extract-cpu-ocr`. The squash-merge commit takes its subject from
  the PR title, so every owner had to PATCH the title through REST before the
  orchestrator could merge.
- **Evidence:** PRs #1464, #1480, #1481 (title fixed by hand before merge);
  `createPullRequest` in `commands/Yeet/internal/PullRequest.ts` read
  `log -1 --pretty=%s` and never saw the `--message` value, and the planned
  step placeholder said `<head-commit-subject>`.
- **Proposal:** Landed with this receipt: the title is the `--message` first
  line, else the branch's first non-merge commit subject (typed error naming
  `--message` when the branch has only merge commits); a re-publish renames an
  open PR whose title is still a git default merge subject; `GhPrView` decodes
  `title`. Follow-up worth considering: `yeet ready` could refuse to flip a PR
  ready while its title is a merge-commit subject, since the title is the
  squash-merge subject.
