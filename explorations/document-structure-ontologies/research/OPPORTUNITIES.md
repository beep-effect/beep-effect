# Opportunities

## 2026-08-11 — monitor raced GitHub check-suite registration

- **Work:** Monitoring PR #662 immediately after a successful full proof and
  push through `beep yeet publish --monitor`.
- **Evidence:** The push succeeded, but `gh pr checks --watch` returned "no
  checks reported" before GitHub registered the new head's check suite. Yeet
  marked the publish failed even though a subsequent remote status found 26
  checks, with no failures and 21 pending.
- **Prevention:** Treat an empty check list immediately after push as a
  bounded propagation state: retry with backoff before classifying the
  monitor phase as failed.

## 2026-08-11 — staged-only restore conflicted with a formatter rewrite

- **Work:** Publishing this exploration from a checkout with unrelated
  scratchpad edits via `beep yeet publish --staged-only --start-pr-early`.
- **Evidence:** Yeet safely parked 131 residue paths, committed the intended
  packet, and ran the clean proof. Its restore then produced an add/add
  conflict in `ops/manifest.json`: the committed side contained Biome's
  one-line rendering of a one-element array while the stash retained the
  pre-hook multiline rendering. The stash was preserved; all 130 tracked and
  one untracked scratchpad paths were recovered without content loss.
- **Prevention:** Staged-only restore should exclude index entries already
  committed, restore residue as unstaged, and auto-resolve when the only
  overlap is the formatter output produced by the commit hook.

## 2026-08-11 — root failure packet selected a passed security lane

- **Work:** Reading the repair route after the same full proof failed in the
  lint composite.
- **Evidence:** `knowledge:semantic-delta` reported two introduced
  `broken-tracked-path` findings, while the generated root packet classified
  the failure as `security-audit` and suggested rerunning OSV. The security
  lane had passed.
- **Prevention:** Composite failure routing should prefer the failed child
  lane's structured issue over broad log matches from an earlier successful
  sibling lane.
