# Slice D pilot record: two-layer stacks, 2026-11-13 to 2026-11-26

The record the slice D row in [`SPEC.md`](../SPEC.md) asks for. It lists
every two-layer stack a lane runs through Yeet during the pilot and what the
stack cost, and it holds the evidence on whether GitHub restacks a layer when
the trunk moves. A later session files the continue-or-stop decision from it.

Times are UTC. Every fact was read from this repository through the GitHub
API or printed by the command named.

## Clock

- The pilot runs for fourteen days, from 2026-11-13, the day
  `yeet publish --stack-on` reached `main` (#3224), to the end of 2026-11-26.
  Week 1 is 2026-11-13 to 2026-11-19 and week 2 is 2026-11-20 to 2026-11-26.
- The clock does not wait for a first stack. When this record opened, at
  07:00Z on 2026-11-13, the stack listing held only the test, probe and
  acceptance stacks, and none of the 12 open pull requests had a base other
  than `main`. A fortnight in which nobody opens a stack is a result for
  criterion 1, not a reason to keep waiting.
- The verdict is due on or after 2026-11-27. It is a decision file, and the
  PR that carries it flips the slice D row in `PLAN.md` and the checkbox in
  `SPEC.md`.

## Kill criteria

From `SPEC.md`. Any one ends routine stack use and closes the goal at
slice B.

| # | Criterion | Measured as | Fires when |
| --- | --- | --- | --- |
| 1 | Fewer than two stacks a week get used | pilot stacks in the census | fewer than four in the fourteen days |
| 2 | The median stack waits more than two review windows | each pilot stack's window wait | the median is above 40 minutes, two windows at the 20-minute default |
| 3 | A stack needs an agent-side force-push to land | a pilot stack that landed only after a lane force-pushed or rebased a published branch, ran `gh stack rebase`, `sync`, `modify`, `submit` or `push`, or after someone pressed the browser's "Rebase stack" for it | one stack |

**Census.** `GET /repos/beep-effect/beep-effect/stacks` (API version
`2026-03-10`) is the count of record. A pilot stack is one created inside the
clock on base `main` whose two layers each carry a lane's own change. The
test stack (#3052), the probe stacks (#3150, #3156, #3159, #3238, #3239) and
the acceptance stack (#3190) do not count, and neither does this record's
own stack, whose two layers are the record itself. A stack that is unstacked
or closed with nothing merged is listed with its reason and does not count
as used.

**Window wait.** The minutes during which a review window was the only thing
holding the stack. It runs from the moment every other gate criterion was met
on both layers (required checks complete on the final heads, no draft, no
unresolved thread except the lane's own hold thread) to the moment the later
of the two windows elapsed. It is zero when both windows had already elapsed
by then. `yeet merge-gate <top> <sha> --dry-run` prints each layer's window
age, and the hold reason `review-window` when the window is what holds.

## Add a row

The lane that opens a stack adds its row to **Pilot stacks** in the layer's
PR, before it gates the top. The row carries what only the lane can see: why
the change was stacked instead of folded, every hold `merge-gate` printed,
every rewrite and its cause, the window wait, and anything that went wrong.
The verdict session fills the merge instants and the `main` Check runs from
the API, and adds a row for any stack in the census whose lane left none.

| Field | Read it from |
| --- | --- |
| Stack and PRs | `yeet publish --stack-on` prints `linked #<parent> and #<layer> as stack #<n>` |
| Why stacked | what the layer needed from the parent, and why folding was not possible |
| Landed | `from the top` (one `merge-gate <top>`), `bottom-up` (`--alone`, or someone merged the parent alone) or `unstacked` |
| Rewrites and cause | `head_ref_force_pushed` on each PR's timeline; the cause is `cascade` (seconds after the lower layer merged alone), `lane` (never allowed) or `unattributed` |
| Window wait | as defined above, in minutes |
| `main` Check runs | Check workflow runs that the stack's landing started on `main`: one from the top, two bottom-up |
| Gate holds | every `HOLD <reason>` line, `stack-*` reasons included |

Two rows that land at the same time conflict on the table. Keep both.

## Pilot stacks

None as of 07:00Z on 2026-11-13.

| Stack | Parent, layer | Why stacked | Opened to merged | Landed | Rewrites (cause) | Window wait | `main` Check runs | Gate holds | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## Reference stacks, not counted

| Stack | Parent, layer | Opened to merged | Landed | Rewrites (cause) | Window wait | `main` Check runs | Gate holds | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #3190, slice C's acceptance run | #3188, #3189 | 2026-11-13 03:23Z to 04:40Z, 77 minutes | from the top, one push, `238dc10536` and `b634505651` | 0 | 0: the windows elapsed at 04:05Z and 04:11Z, hosted CI finished at 04:39Z | 1 | `stack-below-top` (a dry run on the parent), `required-pending`, `threads-unresolved` (the lane's own hold threads) | both layers were code; each lane pushed once after review, which restarted both windows; record in [`../history/2026-11-13-slice-c-stack-landed.md`](../history/2026-11-13-slice-c-stack-landed.md) |
| this record's own stack | #3241 and the layer that carries this row | opened 2026-11-13 07:08Z | bottom-up: the parent merges with `--alone`, so GitHub cascades the layer onto `main` | completed after the cascade | completed at the gate | 2 | completed at the gate | a probe, not a pilot stack: it exists to watch a partially merged stack on `main` while `main` moves |

## Does GitHub restack a layer when the trunk moves?

**No, on every case that could be reproduced.** The only rewrite GitHub
makes by itself is the cascade, seconds after a lower layer merges alone.
After that the layers stay where they are while the trunk moves, as an
unmerged stack does.

| Case | Stack | Trunk | Trunk moves watched | Rewrites that followed |
| --- | --- | --- | --- | --- |
| Unmerged, two layers, ready | #3190 | `main` | 11 pushes in 77 minutes | 0 |
| Unmerged, two and three layers, drafts | #3238, #3239 | throwaway | 1 direct push, watched for 3 minutes | 0 |
| Lower layer merged alone, one layer left: the `--alone` shape | #3238 | throwaway | 4: a pull request merge 1 second after the cascade, a second pull request merge, 2 direct pushes | 0 |
| Lower layer merged alone, two layers left: the stack test's shape | #3239 | throwaway | 3: a pull request merge, 2 direct pushes | 0 |
| Lower layer merged alone, one layer left | #3150 (#3149) | throwaway | 1: stack #3159 merged into the base 105 seconds before #3149 did | 0 |
| Lower layer merged alone, two layers left | #3052 (#3050, #3051) | `main` | 1: #3041 at 02:53:40Z on 2026-11-10 | 1, at 02:54:20Z, not attributed |

### The probe, 2026-11-13

- A throwaway base, `probe/stack-d-base`, cut from `main` at `90f65cef7b`.
  No ruleset targets it and no workflow runs on a pull request to it, so
  nothing reached `main` and no runner was spent.
- Six docs-only draft pull requests, one commit each through the contents
  API: #3232 and #3233 (stack #3238), #3234, #3235 and #3236 (stack #3239),
  and #3237, unstacked, to move the base the way a landing pull request does.
- 06:51:59Z: one direct push to the base with both stacks unmerged. Three
  minutes later no layer had a `head_ref_force_pushed` event.
- 06:55:13Z and 06:55:18Z: #3232 and #3234 were merged alone through
  `merge-async`. The cascade followed each in 4 to 5 seconds, on drafts as on
  ready pull requests: `automatic_base_change_succeeded` and then
  `head_ref_force_pushed` on the layer above, and `head_ref_force_pushed`
  alone on the third layer. Cascade commits are unsigned and committed under
  the author's own no-reply address, as in the stack test.
- #3234's merge moved the base one second after #3233's cascade. The base
  then moved three more times: #3237 merged at 06:55:52Z, and direct pushes
  landed at 06:57:42Z and 06:59:50Z. The three remaining layers were flipped
  ready at 06:57:38Z, so the last two moves found them ready.
- Each layer still showed exactly one `head_ref_force_pushed`, the cascade,
  when the probe closed. The second rewrite in the stack test came 40 seconds
  after its trunk move.

### What that leaves of the second rewrite in the stack test

- It is the only rewrite that followed a trunk move in any case above, and
  that move was the only one its stack saw while partially merged.
- Its commits differ from a cascade's. They are committed by GitHub and
  signed, where a cascade's are unsigned and committed under the author's
  address. So it was a different server-side operation from the cascade. The
  timeline credits the shared login.
- GitHub's troubleshooting page for stacked pull requests gives two remedies
  when the trunk has moved ahead: `gh stack rebase` followed by
  `gh stack push`, or the "Rebase stack" button in the merge box. It
  describes no automatic rebase for that case.
- The organization's audit log is not available on this plan
  (`GET /orgs/{org}/audit-log` answers 404), so no person or session can be
  named. The likeliest cause is "Rebase stack" pressed on the shared login.
  That stays an inference.

Not yet watched: a layer that `--alone` cascaded onto `main`. Every partially
merged case above ran on a throwaway base, except the one that was rewritten.

What this means for a lane: a layer's head moves only when the lane pushes
or when the layer below merges alone. After `--alone` the layer is an
ordinary pull request on its trunk, and the trunk moving does not restart
its CI or its window.

## The two items slice C left for the pilot

| Item | State | Reason |
| --- | --- | --- |
| A base-conflict row on a layer says "merge `origin/main`" | fixed in its own PR | the row is an instruction, and on a layer it is the wrong one |
| A docs-only layer on a code parent is labelled `ready-for-heavy` | left as is | it costs one Heavy Admit run whose jobs skip |

**The base-conflict row on a layer.** The monitor builds the row from the
run's base, and for a layer that is the trunk, because Yeet's `--base` keeps
meaning the trunk. The row therefore reads `base conflict with origin/main`
and the settle line reads `merge origin/main and push`. GitHub computes a
layer's conflict against the parent's branch. Merging `main` into the layer
does not clear that conflict. It puts `main`'s changes into the layer's diff
until the parent catches up, and the next poll writes the row again on the
new head. `references/merge-loop.md` tells the owner that the row is the
instruction, and `AGENTS.md` makes it unconditional. No pilot stack has hit
the row yet. It is fixed before one does: the first hit would cost a lane a
polluted layer and a second P0 row, and the pilot would then be measuring a
wrong sentence in the tool instead of stacks.

**The label on a docs-only layer.** `yeet publish` decides the label from the
whole range above `main`, so a docs-only layer on a code parent gets it. In
hosted CI the label does not start a Heavy matrix on such a layer: Change
Profile reads the layer's own diff, because a layer's `pull_request.base` is
its parent's head, and both the Check run and the label's Heavy Admit run
then set `verdict=skip-satisfied`. The stack test's three hand-labelled
docs-only layers showed exactly that, and all three merged through the
ruleset. The cost is one Heavy Admit run whose jobs skip. Deciding the label
from the layer's own paths would save that run and add a second diff range
to the label step. Revisit it if a pilot row shows a labelled docs-only layer
running a Heavy lane or holding on a required `Heavy / *` context.
