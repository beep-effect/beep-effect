# Review threads, review bodies, comment replay, and reply drafts

Read when closeout or `status --remote` reports threads, follow-ups, or bot advisories, and when you answer reviewers with `bun run beep yeet reply`. Part of the yeet skill.

## Review thread states

Closeout, `yeet status --remote`, `yeet monitor` and `yeet reply` read every
thread's newest comment — selected as `comments(last: 1)`, so a thread longer
than one comment page is classified from what was actually said last, not from
whoever ended the first hundred — and classify each
thread into one of four states by structure alone — who resolved it, who spoke
last, and whether that speaker was a bot. No rule reads comment prose.

- `unresolved` — gates. The thread was never resolved.
- `resolved-answered` — nothing owed. A reviewer resolved their own thread, or
  the author resolved it and the author spoke last, or the PR author or the
  resolver is unknown (unknown is never a named blocker).
- `resolved-follow-up` — **gates**. The author resolved the thread and a human
  reviewer commented afterwards without an answer. `bun run beep yeet reply`
  answers these: it posts the reply and leaves the thread resolved, because the
  thread is already closed and re-resolving it would be a second write.
- `resolved-acknowledged` — advisory. The last word after the author resolved
  the thread came from a review bot confirming the fix. It is printed and
  counted, never gating, and nothing is owed.

`yeet status --remote` prints `review follow-ups: N …` (gating) and
`review acknowledgements: N …` (advisory). Closeout carries the matching gate
rows: `review-follow-ups` is blocked while the count is non-zero and emits one
`pr-review` quality issue per thread, so `yeet closeout` exits non-zero;
`review-advisories` always passes and only reports a number. `merge-ready`'s
`threads-resolved` criterion is unresolved **plus** follow-ups, plus closeout
issues a thread raised, and the `next command` it prints is
`bun run beep yeet reply` only when live threads are the *only* thing holding
the PR — every other merge-ready criterion holding. A red pipeline or a stale
closeout keeps the command on that instead, because answering reviewers would
not make the branch mergeable.

No review bot's verdict gates `merge-ready`. The bots reviewing a PR rotate
with the operator's quota (CodeRabbit, Greptile, ChatGPT, the openclaw
reviewer, the operator's own Grok reviewer), so a bot that never posts must
not hold a merge. Every reviewer, human or bot, gates the same way: through
its review threads, which `threads-resolved` covers. Closeout's Greptile score
and issue-count gates (`--require-greptile-*`, off by default) are advisory:
they set `yeet closeout`'s own exit code and print on the
`review-bot advisories (never block merge-ready)` line of `yeet status`. The
`closeout-gates-passed` criterion that briefly held merges on them is retired;
verdicts written while it existed decode against their remaining criteria.

## Review bodies and advisories

A review body — CodeRabbit's summary, a Greptile-format review — is read for its
structural markers only: CodeRabbit's `Actionable comments posted: N`, its
nitpick and outside-diff `<summary>` counts and its fix-prompt file/line items;
Greptile's confidence score and its new findings. A Greptile-format body is
recognised by a *named marker* — an author login containing `greptile`, a
heading or bolded line naming Greptile, or the tokens `Greptile-format` /
`Greptile-style` — or, failing that, by its *structure*: a confidence fraction
together with a `P0:n P1:n P2:n` triplet or a `**NEW:**` marker, because the
operator writes that format by hand and does not always name the tool. The word
in running prose never counts; the marker rules are line-anchored so an aside
like "greptile scored this 5/5" stays a plain body. Its new findings are the
*maximum* per severity of the triplet and the `N×Pk` items listed after
`**NEW:**` — never their sum, because the two notations are two readings of one
round. A body
finding that already opened an inline thread at the same path and line is not
counted twice, and closeout reads only the newest body per author, so an older
round is superseded rather than summed. Every one of these counts is advisory:
they are printed with `(advisory)` and they never gate a merge.

CodeRabbit's body format drifts, so the parser reads the spellings a census of
real bodies showed plus the older ones the tests pin:
`**Actionable comments posted: N**`; `Nitpick comments (N)` and
`Nitpick comments: N`; `Outside diff range comments (N)`; `Minor comments: N`;
fix-prompt items under `` In `@path`: ``, `Review comments at @path:` or a
hard-wrapped `Review comment at @path at line N:` / `... around lines N - M:`,
with `- Line N:` / `- Around line N-M:` beneath. The current format lists each
finding twice (its own "Prompt for AI Agents" and the "Prompt to fix all
issues" block), so items are deduplicated by path and line; a finding listed
under a body-only section (`Nitpick`, `Outside diff`, `Minor comments:`) is the
same finding its count summarises and is not added to it.

A CodeRabbit body that shows findings (a "Prompt for AI Agents" block, a
fix-prompt marker or section heading, or a `<summary>` with a positive comment
count other than "Additional comments") but parses to zero counts and zero
items is format drift, not a clean round. The stream and the replay print

```text
coderabbit: body has findings Yeet could not parse (fix-prompt) and must be read: <review url>
```

and closeout counts it as one advisory. Read the review. A rate-limit notice, a
walkthrough or a body with only "Additional comments" stays quiet.

Under `--until-ready`, a bot's review body that raises advisories no review
thread carries (resolved threads included), or that trips the drift line, arms
one P1 `pr-comment` row linking the review. Its excerpt names the body's counts,
how many findings no thread carries, and the first such finding's path and line,
for example
`coderabbit: 0 actionable, 1 nitpick(s), 0 outside diff (advisory); 1 not on a review thread; first: src/a.ts:57`.
A CodeRabbit body whose every finding already has a thread arms nothing: a
finding matches a thread on the same file when the finding's line range overlaps
the thread's `startLine..line` (GitHub anchors a multi-line thread at its last
line, CodeRabbit names a ranged finding by its first). A Greptile-format body
lists no locations, so its new-finding counts arm a row without a thread check. The row is the
same kind as a person's comment row: it wakes `yeet job wait` and the inbox hook
injects it, so the owner looks, but no merge verdict reads the inbox — merge
readiness, `yeet merge-gate` and `yeet ready` read GitHub state alone — so the
row never holds `merge-ready` or a merge. Ack it the usual way once handled,
for example `bun run beep yeet inbox ack <id> --thread-url <review url>` or
`--wontfix --reason "<why>"`.

## Comment replay

Every read-first surface replays the PR's comment stream before it reports:
`yeet status --remote` (once it has a PR number), `yeet closeout`, and the first
cycle of `yeet monitor --until-merged`. Replay prints each review comment, issue
comment and review body newer than the saved position, then advances that
position — so a reboot, a killed monitor or a session change no longer loses
comments that arrived while nothing was watching. It prints
`comment replay: N comment(s) since <watermark>`, or
`comment replay: no watermark for #N; starting at <now>` on the first open,
which spawns nothing and only records the position. Writing that cursor is the
one write a read-first closeout makes; a failed read prints
`comment replay unavailable: …` and leaves the position untouched rather than
failing the closeout.

Each consumer mode keeps its own position in `.beep/yeet/runs/<branch>/`:
`--until-ready` in `monitor-comments.until-ready.json`, `--until-merged` in
`monitor-comments.until-merged.json`, and every other reader (plain
`yeet monitor`, `--watch`, `status --remote`, `closeout`) in the shared
`monitor-comments.json`. A mode's first position starts at the later of its
window start and the shared position, so its first run replays no history.

`--until-ready` never prints the backlog. Each poll turns top-level comments
(issue comments and review bodies) into P1 `pr-comment` rows when a person
wrote them — not a bot, not the login the monitor runs as, not a deleted
account — or when a bot's review body raises findings no thread carries (see
Review bodies and advisories), after the window start: the job's submit time for a detached run,
the loop's start for an attached one. Older comments only advance the
position; a comment posted between an earlier monitor's exit and this submit
is the accepted miss. Inline review comments reach the inbox as
`review-thread` rows instead.

## Reply drafts flow

1. Read the outstanding threads out of `bun run beep yeet status --remote` —
   both the `unresolved` list and the `review follow-ups` list. Each line carries
   the GraphQL thread id, the REST comment id, the file location, the author, and
   a first-line excerpt, so drafts are writable straight from that output without
   a second REST pass. A follow-up line excerpts the reviewer's follow-up, not
   the thread's opening comment, because that is what is unanswered.
2. Write `.beep/yeet/reply-drafts.json` (`yeet-reply-drafts/v1`): `prNumber`
   plus one draft per thread with a non-empty `body` and either the GraphQL
   `threadId` (`PRRT_...`) or the numeric `commentId`; `resolve` defaults to
   true. Declare `disposition` on every draft, how you disposed of the finding:
   `fixed`, `rejected`, `intentional` (correct, kept on purpose) or
   `immaterial` (true, did not matter). It is what `yeet economics` measures
   reviewer precision from (ruling 81); a draft without one records `unknown`,
   and nothing reads the body to guess.
3. Run `bun run beep yeet reply`. Drafts are validated against the live threads
   first, and each one is routed by the thread's state: an `unresolved` thread is
   posted and resolved; a `resolved-follow-up` thread is posted with resolve
   forced false, whatever the draft's `resolve` flag says, so the already-closed
   thread is not re-resolved; a `resolved-answered`, `resolved-acknowledged` or
   deleted thread is recorded `stale` and nothing is written for it. Each surviving draft is posted and resolved one at a time,
   and a denied scope or rate limit becomes that draft's `failed` outcome with a
   retry command rather than aborting the pass.
4. Read `.beep/yeet/reply-report.json` (`yeet-reply-report/v1`) for the per-draft
   outcomes, each carrying the disposition it recorded. Either party can run the
   command; when the agent session lacks the write scope, hand the operator the
   one command instead of pasted bodies. The pass also appends one row per
   written thread to the owning clone's `.beep/yeet/review-lane.ndjson`, the
   ledger `bun run beep yeet economics` reads for rounds-to-ready and reviewer
   precision; a failed append is one warning line and never fails the pass.
