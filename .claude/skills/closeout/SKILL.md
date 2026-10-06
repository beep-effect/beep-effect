---
name: closeout
description: Guided session closeout for beep-effect. Use at every stopping point (task done, blocked on the operator, PR merge-ready, post-merge closeout, before yielding on a question) to hand the operator a structured next-step prompt through AskUserQuestion (Claude Code) or request_user_input (Codex) instead of a prose list of options.
---

# Guided Closeout

The operator runs many sessions and clones in parallel and does not read long
final messages. A stopping point is handed back as a short recap plus one
structured prompt whose options are the concrete next steps. The law is the
"Guided Closeout" section of `AGENTS.md`; this skill is the shape.

## When

Every stopping point, not only the end of a task:

- the requested work is done and verified;
- the work is blocked on something only the operator can decide or do;
- a PR reached `merge-ready: yes` (hand-off, never a merge unless authorized);
- a merge landed and the lane was retired;
- any moment you would otherwise end the turn with a question.

If the harness has no question tool (headless `-p` runs, a detached job), write
the same options as a numbered list with the recommended item first and say
which tool the operator should use to answer.

## Shape

1. **Recap, three lines at most, above the prompt.** What landed (PR numbers,
   commits), what is verified, what is not. Numbers in a short table if more
   than two.
2. **One prompt call.** Claude Code: `AskUserQuestion`. Codex:
   `request_user_input`. At most four questions per call; most closeouts need
   one.
3. **The question carries the state.** One line: clone, lane or branch, PR,
   where it stopped. The operator must be able to answer without scrolling up.
4. **Two to four options, each a real next step.** Recommended option first,
   labelled "(Recommended)", with the trade-off in its description. Always
   include a "stop here" or "park it" option so a `no` is one click.
5. **Multi-select only when the options are independent** (several lanes to
   retire, several packets to close). Decisions between alternatives stay
   single-select.
6. **Act on the answer in the same turn** when it is reversible and in scope;
   otherwise open the next prompt.

## Option vocabulary

Prefer these, so prompts read the same across sessions:

- `Continue with <next step> (Recommended)` — the work that follows naturally.
- `Open the follow-up PR for <x>` — when the next step is a separate branch.
- `Run /grill-with-docs on <decision>` — when direction, not execution, is next.
- `Retire the lane` / `Sweep the clone` — post-merge closeout.
- `Park it: record state and stop` — writes the state to memory or the packet
  and ends the turn.

## What it is not

- Not a substitute for `/grill-with-docs`: direction-setting decisions are
  grilled first; the closeout prompt carries the remaining frontier.
- Not a permission laundering path: an action the harness denied is reported
  as denied, never offered as an option for the operator to "approve" on your
  behalf.
- Not a reason to skip the on-disk handoff: packet state, memory, and the
  yeet inbox are still written before the prompt.
