# Agent desktop notifications

The Claude Code and Codex `PermissionRequest` hooks invoke the shared
`.claude/hooks/sequence-break-notifier.sh` worker after recording the wait.
Desktop notifications identify the agent, owning clone, and linked worktree.
For example:

```text
Claude Code needs your input
Clone: beep-effect19 · Worktree: notification-origin · Ghostty
A human decision is blocking progress now.
```

The directory comes from the hook event, including when the agent is working
inside a package. Git resolves it to the worktree root and common Git directory.
Unavailable Git metadata falls back to the directory basename. Control characters
and terminal delimiters are removed, and notification markup is escaped.

## Returning to the originating session

- **Ghostty:** when `TERM_PROGRAM=ghostty` and the hook has a controlling terminal,
  the hook retains a terminal descriptor before detaching. The worker emits an
  OSC 777 notification through that descriptor. Ghostty owns its click action and
  selects the originating terminal surface. A short pseudonymous session suffix
  distinguishes simultaneous waits in the same checkout. Hook stdout remains silent. If the
  terminal is unavailable, the worker falls back to a labeled desktop notification.
- **ChatGPT Desktop / Codex:** the hook automatically offers **Open task** when
  `CODEX_INTERNAL_ORIGINATOR_OVERRIDE=Codex Desktop` and `CODEX_THREAD_ID` equals
  the hook's raw session ID. The exact `codex://threads/<UUID>` route opens that
  task. A child CLI session with a different ID cannot inherit the parent task's
  destination accidentally.
- **Claude Desktop:** a launcher that knows the desktop's local session ID can
  supply `BEEP_SEQUENCE_BREAK_OPEN_URI=claude://code/continue?session=local_<id>`.
  The CLI session UUID alone is insufficient to infer the desktop session ID.
- **T3 Code and Grok:** there is no automatic integration in this hook. T3's
  workspace activation does not guarantee the original task, and Grok needs its
  own event adapter. Agents already covered by the Claude/Codex hooks retain
  origin labels when hosted elsewhere.

An explicit `BEEP_SEQUENCE_BREAK_OPEN_URI` also accepts `codex://threads/<UUID>`
for Codex, where the hook also requires that UUID to equal the notifying session.
Routes must match the agent; arbitrary URLs, extra query parameters,
and “last session” destinations are rejected. This override is for a launcher
that already knows the session, not a command to evaluate. An explicit app route
takes precedence over Ghostty terminal notification delivery.

The desktop action listener runs separately from the permission hook and reminder
worker, and expires after one hour. Each wait has at most one live action listener:
while its persistent notification remains actionable, later desktop reminder stages
are damped. Phone escalation continues normally. Dismissing a notification never opens an app.
The listener checks that the wait is still open and honors the hook-pulse disarm
sentinel before opening a destination.
It requires `notify-send`, `stdbuf`, and `xdg-open`; without the action helpers,
delivery falls back to a labeled notification. Desktop focus policy can still
affect whether an application comes to the foreground.

## Evidence and privacy

Clone/worktree names and session destinations are local presentation context.
They are neither added to Hook Pulse / sequence-break evidence nor sent to ntfy.
Phone notifications keep their existing generic text. The worker still never
receives questions, commands, tool inputs, or tool results. Reminder timing,
wait-bracket resolution, storm damping, and the shared kill switch are unchanged.

A successful desktop receipt means the transport accepted the send (or the
terminal accepted the OSC bytes); it does not prove a user saw or clicked it.
Ghostty's surface-bound action is implemented in its
[Linux notification sender](https://github.com/ghostty-org/ghostty/blob/v1.3.1/src/apprt/gtk/class/surface.zig#L1578).
