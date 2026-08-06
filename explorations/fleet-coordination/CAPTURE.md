# Capture — fleet coordination

Append-only. Never interrogated, never reorganized.

## 2026-08-04 — the operator's framing

> One thing I noticed a while back was something broken getting merged into main
> and several agents each working in their own beep-effect clone solving the same
> problem resulting in merge conflicts. I'm curious what solutions there might be
> out there for some kind of message board that agents working in different
> clones could use to coordinate or give updates on the work being done so we
> don't do it twice.
>
> Another opportunity for something like this is agents that are changing stuff
> like lint policies & other items which once merged would cause subsequent PRs
> to fail; agents could use the message board to relay this information so that
> we reduce the churn of things in flight.
>
> I'm not sure if existing solutions to this exist in some fashion but we would
> need either something that sends essentially a "push notification" to other
> agents working in beep-effect clones, or that we incorporate the messaging into
> /yeet somehow such that all agents can be informed about what is coming down
> the pipe.

Operator rulings at open: cross-machine is **not** in scope; nothing is decided;
merge queue may be recommended *instead of* a board.

## Live state at open (2026-08-04, ~10:45)

Thirteen clones plus linked worktrees on one workstation. Three concurrently
dirty, invisible to each other:

| Clone | Branch | Dirty |
| --- | --- | --- |
| `beep-effect11` | `security/codex-findings-2026-08-04` | 57 |
| `beep-effect2` | `chore/effect-jsdoc-quality` | 5 |
| `beep-effect` | `chore/knowledge-surface-unmerged-followup` | 3 |

The first concrete symptom appeared inside two minutes of opening the
investigation: `goals/speed-loop/research/OPPORTUNITIES.md` was **294 lines** in
this clone and **539** in `beep-effect3-pra`. A session pointed at "the
opportunities ledger" in the wrong clone reasons from a document 245 lines out of
date. That is a third failure mode — clones drifting on shared authored state —
and it was deliberately ruled out of scope here because `yeet sweep` (#39)
already owns it.

## Initial framing bet (recorded before research, partly wrong)

1. Three problems wearing one coat: mutual exclusion (A), pub/sub of impending
   base state (B), replication (C — out of scope).
2. **The store is easy; the delivery vector is the whole problem.** Agents do not
   poll; an LLM receives nothing unless something injects it into context.
3. **Derive, don't declare.** Ground truth already sits on disk — worktree list,
   branch, dirty set, diff-vs-merge-base, open-PR file sets. Voluntary claim
   posting fails the way every voluntary agent protocol fails.
4. `law-pulse.sh` proves a push channel already works here.

Bet 4 was **false** — see `RESEARCH.md`. Bets 2 and 3 survived and became the
spine of the recommendation. Bet 1's Mode-A framing survived but was
substantially undercut by measurement: four of five live collisions turned out to
be intra-wave, not cross-fleet.

## 2026-08-05 — a Mode B specimen, observed live

Publishing this packet tripped one. `bun run beep yeet publish --pr` completed
fully — full proof green, push landed, PR #562 open — and then exited 1 with
`Failed to decode pull request number for yeet monitor.`

`runMonitorPhase` is invoked unconditionally (`Handler.ts:662`) while the planner
emits monitor steps only under `--monitor` (`Planner.ts:595`/`:605`/`:614`). On an
empty step list the phase decodes `Str.empty` as JSON and hard-fails. The
regression landed in `aee2664b91` (#551) on **2026-08-04**, one day earlier, from
a parallel clone. Every `yeet publish` without `--monitor` — the documented
default — has exited non-zero on success since.

Three properties make it a clean specimen:

- **No textual conflict.** Nothing in this branch touches `Handler.ts`. A
  conflict-based detector — signal 2, `merge-tree`, a merge queue — sees nothing,
  which is K8 in the wild and the reason D3 keeps signal 3.
- **Detection was by collision, not by notice.** It surfaced a day later because
  someone ran the command, which is the Mode B cost function exactly: the tax is
  paid by whoever trips it, not by whoever landed it.
- **The landing session could not have known.** #551 was shipped with
  `--fast --monitor`, the one flag combination that plans monitor steps and
  therefore never reaches the failing branch. The change was green on the author's
  path and broken on everyone else's.

Handed to speed-loop as item 3 of
[`research/HANDOFF-2-pre-push-and-guard.md`](./research/HANDOFF-2-pre-push-and-guard.md)
rather than fixed here, per D2.

Also observed while measuring liveness that day: `/proc/<pid>/cwd` is **not**
universally readable. Root-owned processes return `EACCES` on the symlink read
even though the entry is listed. D5's scan must degrade on unreadable entries
rather than throw, and cannot claim completeness across users.

## Loose threads not yet placed

- Mode A may be **correlated salience** rather than collapsed degrees of freedom:
  13 agents reading identical `CLAUDE.md`, identical red CI, and identical goals
  packets will rank the same option first. Neither a lock nor a wider work
  surface fixes identical ranking functions — a deterministic per-clone tiebreak
  would.
- Resource contention may be the dominant single-machine failure: 13 clones share
  one 32-core box, one turbo cache, one GitHub rate limit. That is admission
  control and cache partitioning, not work-item claims.
- Claude Code shipped **Agent Teams** (v2.1.32) with file-locked task claiming,
  auto-delivered per-agent mailboxes, and `TaskCreated`/`TaskCompleted`/
  `TeammateIdle` hooks. Wrong shape for this fleet (one team per session, lead
  owns the lifecycle) but it is the first-party reference design.
