# Research friction receipts

## 2026-09-03: headless research lane died after 126 turns with an empty report

- **Work:** the G2 lane (grok-4.6, xhigh, headless claude on the local proxy) researching Grok Bot
  use cases and practitioner practices for this packet.
- **Evidence:** the stream ended with `API Error: The response stopped arriving. The response
  above may be incomplete.` after 126 API turns; the report file held only the 3.7 KB section
  skeleton although the stream contained 29 x.com post URLs and about 90 fetched pages.
- **Cost:** one full lane budget lost; a salvage pass had to extract every URL, search query, and
  the last 60 text blocks from the raw stream into a hints file, and a second lane (G2b, 83 turns)
  re-ran the task before synthesis could start.
- **Prevention:** the "create the file early, append as you go" contract is not enough for long
  lanes. Pin "append after every three tool calls; an empty file is a failed run; stop researching
  at turn 45 of 55" in every research-lane prompt, and keep raw streams as the recovery layer.

## 2026-09-03: Codex workspace-write sandbox cannot create a worktree or stage files

- **Work:** delegating the packet scaffold, decision entry, and SPEC amendment to a Codex lane that
  was asked to work in a fresh worktree and stage its files.
- **Evidence:** inside `codex exec -s workspace-write`, `bun run beep worktree new …` failed with a
  branch-ref lock error under the read-only common `.git` directory, `git fetch` could not write
  `.git/FETCH_HEAD`, and the lane exited without authoring anything.
- **Cost:** one wasted lane; the worktree had to be created by the orchestrating session, the
  brief rewritten to forbid git writes, and the lane relaunched. Staging moved to the operator.
- **Prevention:** document in the delegation recipe that the Codex sandbox keeps `.git` read-only
  even for the working directory: create worktrees before launch, forbid git writes in the brief,
  and stage by explicit path afterwards. A `beep worktree new` preflight that names this sandbox
  limitation would save the first failed attempt.

## 2026-09-03: `yeet publish --staged-only` commits before admission, so stopping a queued run does not undo it

- **Work:** recovering from a stale-base refusal (`git diff --name-only … output exceeded the
  repo-run capture limit` because `origin/main` had moved 9 commits and 5,246 files since the
  worktree was cut) by fast-forwarding and republishing.
- **Evidence:** the relaunched publish had already created its commit when it was stopped while
  waiting in the admission queue; a conflict fix intended for the same commit became a second
  commit with an identical message.
- **Cost:** a two-commit history for a one-change PR and a second full proof.
- **Prevention:** print the commit step explicitly before admission wait so operators know the
  commit exists; consider committing only after admission is granted, or offer
  `--amend --no-edit --reuse-verified` guidance in the admission-wait banner. Also have the
  stale-base refusal print the commit count and overlapping files instead of a capture-limit
  error, since the 5,246-file diff exceeded the runner's output buffer.

## 2026-09-03: `yeet monitor --watch --until-event` exits instantly on tolerated Vercel rate-limit reds

- **Work:** babysitting PR #969 for the Greptile burst and required-check results.
- **Evidence:** every watch run ended within a second with `watch-ended … reason: "event",
  failing: 3`; the three failures were `Vercel – oip-web`, `Vercel – oip-web-staging`, and
  `Vercel – todox`, each reporting "Deployment rate limited — retry in 24 hours", the one failure
  class the mergeability rule tolerates. Acknowledging their inbox capsules as won't-fix did not
  change the watch's exit behavior.
- **Cost:** the documented babysit loop was unusable; the PR had to be polled with `gh pr checks
  --required` and comment counts instead.
- **Prevention:** let the watch treat optional, won't-fix-acknowledged, or rate-limited Vercel
  contexts as non-actionable so `--until-event` waits for the next real event, and expose the
  "optional check" distinction that `yeet status --remote` already prints.
