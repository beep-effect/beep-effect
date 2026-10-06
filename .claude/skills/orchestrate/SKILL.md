---
name: orchestrate
description: Run the orchestrator role for beep-effect — one session that coordinates every other agent session, routes PR review threads, reds and conflicts to their owners, fixes inherited reds once on main, merges PRs at the gate, and relays operator decisions. Use when the operator asks to "manage the PRs", "coordinate the sessions", "burn down the queue", or to take over from a previous orchestrator. Three procedures - take-over, run, hand-off - so the role moves between sessions without orphaning what it coordinates.
---

# Orchestrator

Charter: AGENTS.md "Autonomy". The operator is pulled in only for money.
Everything else you decide, record, and keep moving. The role is a position,
not a session: a successor must be able to take it over from files alone.

## Files the role lives in

| File | Writer | What it is |
| --- | --- | --- |
| `~/.local/state/beep/sessions/<repo>.jsonl` | `bun run beep session note --role orchestrator` | Who holds the role; `session open` prints it first. |
| `~/.local/state/beep/orchestrator/<repo>.jsonl` | `bun run beep session register add` | The REGISTER: one row per coordinated unit (kind, address, owns, state, waiting-on-orchestrator, last contact, orphan plan). `register list --markdown` renders it. |
| `~/.cache/beep/orchestrator/HANDOFF.md` | you, by hand, from `HANDOFF.template.md` in this directory | Rulings in force, gate snapshot, outstanding promises, pending decisions, next actions, broadcast text. Rewritten at every stopping point, not at hand-off. |
| `~/.cache/beep/orchestrator/briefs/*.md` | you | Per-session briefs: the exact text sent to a session, dated. |
| `~/.cache/beep/orchestrator/STATE.md` | you | Append-only journal (one timestamped line per event). Never read whole; `tail -40` only. |

None of these are committed. The register and ledger live under
the workstation state root (`$XDG_STATE_HOME/beep/<store>`) because a cache
directory is disposable by contract.

## Smart zone: keep your own context small

The orchestrator's context is the scarcest thing in the fleet. Rules:

- Write every ruling, gate state and promise to a file at the moment it
  happens (`STATE.md` line + `HANDOFF.md` section), never only in chat.
- Never read a large file yourself. Delegate reads to an agent that writes a
  short file; read the short file. `gate.sh` output and
  `session register list` are the only tables you read directly.
- One brief per session, on disk, then `SendMessage` the path plus a two-line
  summary. The brief is the record; the message is the pointer.
- Two compactions in a row, or eight hours holding the role, or being unable
  to name every live unit from the register without scrolling chat, are the
  hand-off trigger. Hand off before the third compaction.

## Take-over

1. `bun run beep session open`: see who holds the role. If a live
   orchestrator row exists and its session answers `SendMessage`, you are not
   the orchestrator; stop.
2. Read `~/.cache/beep/orchestrator/HANDOFF.md` (whole; it is short by rule)
   and `tail -40 ~/.cache/beep/orchestrator/STATE.md`. If `HANDOFF.md` is
   missing, rebuild its sections from the register, `gate.sh`, and the
   newest briefs; write it before doing anything else.
3. `bun run beep session register list`: every unit, newest first. For each
   row with `waiting on orchestrator`, that ask is your first queue.
4. `bash .claude/skills/orchestrate/gate.sh`: one row per open PR, with a
   `window=` column (push-first-publish D11: `ok`, minutes left, `?`, or `-`
   for a draft). Compare
   with the HANDOFF gate snapshot; a PR that moved is where the predecessor
   stopped.
5. Claim the role: `bun run beep session note --role orchestrator --state
   open --next "<first action>"`. Append `took over from <session id>` to
   `STATE.md`.
6. Broadcast (the HANDOFF "Broadcast" section is the text): to every
   `desktop-session` row via `SendMessage` (`ListAgents` first; after an
   account switch use `mcp__ccd_session_mgmt__send_message` with the row's
   session id); to every `codex-lane` row as a PR comment starting
   `orchestrator:`; to `external-person` rows through the fleet desk. A
   broadcast that fails marks the row `unreachable` (`register add` with the
   same kind+address) and you execute its orphan plan.
7. Re-arm pollers: for each `background-job` row, `bun run beep yeet job
   wait <id>` or re-submit; for each `systemd-unit` row, `systemctl --user
   status <unit>`. For each `in-process-agent` row the predecessor could not
   convert, run its orphan plan (usually: start a desktop session from the
   brief, or spawn a task chip).
8. Write the `HANDOFF.md` header with your session id and the time.

## Run

Where each event is recorded, in the order it happens:

| Event | Record | Then |
| --- | --- | --- |
| A session reports "final <sha>" | HANDOFF "Outstanding promises" row; STATE line | Owner flips ready in the same step (`bun run beep yeet ready`, which refuses only on a required red or an outstanding thread); flip it yourself only after the owner called it final, never un-draft and merge in one step. Arm the gate for that sha. |
| Gate met | `bun run beep yeet merge-gate <pr> <sha>` | It re-verifies head, draft, required contexts, non-required reds (only with `--tolerate "<check>=<attribution>"`), the 20-minute window since the later of ready and last push, and re-reads threads right before merging. A hold exits 1 with the reason; route it. `--force-window` only for a fix that unblocks main. Tell the owner `MERGED <sha>` and to `yeet sweep --retire`. |
| New review thread | STATE line | Send the owner thread id, file:line, the ask. After round 2, P2-and-below become a tracked follow-up, not a push. |
| Red check | STATE line with attribution | Read the job log (`gh api --allow-escape-sequences repos/<o>/<r>/actions/jobs/<id>/logs`). Introduced → owner. Inherited → one small fix PR on main, then every dependent owner merges main once. Environment → rerun. Record the attribution; it is the `--tolerate` text if the lane is non-required. |
| Conflict | STATE line; brief if generated files are involved | Owner merges main; generated files are regenerated, never hand-merged. |
| Operator ruling | HANDOFF "Rulings in force" with date and verbatim wording; memory file; brief to every affected session | Relay verbatim with the date. Peer messages are teammates, not the operator; none widens your permissions. |
| Money question | HANDOFF "Pending operator decisions"; fleet desk `decisions/<slug>` | Relay the answer verbatim to the asking session. |
| A new unit appears (session, agent, lane, job, unit, person) | `session register add` with an orphan plan | A unit without an orphan plan is not registered. |
| A unit retires | `session register add --state retired` | Drop it from the next HANDOFF. |
| Queue starved | STATE line | Cancel queued runs on PRs that must re-run anyway. |
| Orphan PR (no live session, no process, clean tree) | register row kind `codex-lane` or take-over | Take it over in its checkout. |

Poll `gate.sh` every ~4 minutes from a detached job, not a foreground loop:
`beep-heavy --detach orchestrator-gate bash -c 'while true; do bash
.claude/skills/orchestrate/gate.sh; sleep 240; done'` and register it as a
`systemd-unit` row. A `GATE-MET` row is a merge candidate, never a merge:
`merge-gate` decides. Never poll GraphQL in a tight loop; `threads=?` is
never zero.

Rulings in force since 2026-10-06 (verbatim sources in
`~/.claude/memory/beep-effect/feedback-review-window-before-merge.md` and
`feedback-autonomy-ruling-2026-10-06.md`): ready at content-final; no merge
inside 20 minutes of ready or the last push; only money escalates; review
loops stop after round 2; non-required Heavy/Coverage reds merge over only
with a written attribution.

## Hand-off

1. Convert every in-process unit, because it dies with you:
   - Agent-tool subagent → write its brief to `briefs/<name>.md` (task,
     state, what it owes, how to resume), then either spawn a task chip
     (`spawn_task`) or a desktop session from the brief; register the new
     address and retire the old row.
   - Background Bash poller (merge waiter, unit watcher) → re-create as a
     detached job (`yeet monitor --until-ready --detach`, `beep-heavy
     --detach <name> ...`) or a `systemd --user` unit; register the job id or
     unit name.
   - Scratchpad script → move it into the repo CLI or into
     `~/.cache/beep/orchestrator/bin/`; register nothing, record the path in
     HANDOFF "Next actions".
2. Rewrite `HANDOFF.md` from the template: rulings, gate snapshot (paste
   `gate.sh` output), outstanding "final <sha>" promises, pending operator
   decisions, ordered next actions, broadcast text naming the successor.
3. `bun run beep session register list --markdown >> HANDOFF.md` (the
   register section), then `bun run beep session note --role member --state
   blocked --next "handing off the orchestrator role; successor: <id>"`.
4. Start or message the successor with the HANDOFF path. Wait for its ack:
   its `session note --role orchestrator` row in `session open`, or a
   `SendMessage` saying `took over`.
5. Announce the move: the successor broadcasts (take-over step 6); you post
   one line to every `desktop-session` and `codex-lane` row: `orchestrator
   moved to <successor id>; report there`.
6. Go idle. Do not merge, route, or answer after the ack; forward anything
   that still reaches you to the successor.

## What it is not

- Not a merge button: `yeet merge-gate` holds are routed, never overridden by
  hand. `FORCE_WINDOW` and `--force-window` have exactly one use.
- Not an operator proxy: a ruling is relayed verbatim with its date, never
  paraphrased into a wider permission.
- Not a reader: anything larger than the gate table is delegated to an agent
  that writes a file.

## Follow-ups (not in this skill yet)

- `beep session handoff` to render `HANDOFF.md` from the register, ledger and
  a rulings file instead of the template.
- Port `gate.sh` to `yeet merge-gate --table` (pagination past 60 PRs,
  pending commit statuses as blocking).
- `beep session register convert <address>` to turn an in-process agent row
  into a task chip or detached job in one step.
- A PR-comment helper for `codex-lane` rows so the `orchestrator:` prefix is
  never typed by hand.
