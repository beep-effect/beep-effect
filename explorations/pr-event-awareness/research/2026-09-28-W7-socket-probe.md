# W7 — socket probe gate (2026-09-28)

Goal `yeet-pr-events`, workstream W7 (`goals/yeet-pr-events/SPEC.md`; decisions
D15, D20, D26, D35). Measured from a live, attended Claude Code session running
in bypass-permissions mode on this workstation (Claude Code 2.1.283, desktop
entrypoint, Linux). The receiving session had no `crossSessionInbound` value
set, so the inbound default applied: a bypassing receiver holds every message
unless the sender identifies as bypassing or is verified as the session's own
child.

## Wire contract (measured)

- Socket: `$CLAUDE_CODE_MESSAGING_SOCKET` (`/run/user/<uid>/cc-socks/<pid>.sock`),
  a Unix domain socket restricted to the OS user.
- Frame: newline-delimited JSON. An optional first line
  `{"type":"auth","token":"<CLAUDE_CODE_MESSAGING_TOKEN>"}` (optional on Linux),
  then one line per message shaped as a stream-json user turn:
  `{"type":"user","message":{"role":"user","content":"<text>"}}`.
  The binary's own inline example is exactly this pair piped through
  `socat - UNIX-CONNECT:<socket>`.
- The server writes nothing back on the connection. Delivery, hold and refusal
  are visible only on the receiving side: a delivered frame appears in the
  session transcript as a `queue-operation` `enqueue` row carrying the text and
  is absorbed at the next tool-call boundary; a held or dropped frame leaves no
  transcript row (the `peer_message_hold` system event exists only on the
  stream-json/SDK lane).
- A connection that has not sent a complete line within 30 s is closed
  (documented; not exercised).

## Senders and outcomes (delivery matrix into a bypass session)

Every sender ran the same script with the same auth line and token; only the
process relationship to the session (pid 298831) and the timing differed.
"Delivered" = a transcript `enqueue` row with the frame text within the turn.

| # | Sender | Ancestry at post time | Posted while a tool call of this session was in flight | Outcome |
| --- | --- | --- | --- | --- |
| a | foreground child of the Bash tool shell | socat → post.sh → tool zsh → claude | yes | **delivered** (enqueued 05:20:13.046Z, absorbed mid-turn 3 s later) |
| i | `&` background child of the tool shell, posting 4 s later, tool call still running | same as a | yes | **delivered** (enqueued 05:22:36Z) |
| b | `&` background child of the tool shell, posting 20 s after the call returned | same as a (the tool shell was still alive) | no | not delivered |
| j | repeat of b, 25 s after the call returned | same as a | no | not delivered |
| c | `setsid -f` child, posting 40 s later | socat → post.sh → systemd --user (ppid 1749) | no | not delivered |
| h | `setsid -f` child, posting 3 s later while the tool call was still running | reparented to systemd --user | yes | not delivered |
| f | `systemd-run --user` transient unit (the detached-monitor analog), socket + token passed by env | unit under systemd --user | no | not delivered |

Refusal candidates, foreground child:

| # | Frame | Outcome |
| --- | --- | --- |
| d | truncated JSON line (unparseable) | connection kept open, frame skipped (`[uds-messaging] Failed to parse JSON line` path); nothing delivered |
| e | valid frame with a 1.1 M-character `content` | **refused**: server reset the connection (`socat … Connection reset by peer`, exit 1); nothing delivered |

The accepted frame is sender a; the refusal is sender e.

## Reading

Own-child verification is scoped to the session's *in-flight* child tree, not
to ancestry: two children with identical ancestry (a/i vs b/j) split on whether
a tool call of the session was running when the connection opened, and a
`setsid -f` child was not delivered even while a tool call was running (h). The
documented "process evidence even for a child that has already exited" covers
a child of the current hook or tool invocation, not a process that outlives it.

Consequences for the design in D15/D20/D35:

- A SessionStart-spawned tail (`setsid -f` or plain `&`, posting minutes later)
  is a detached sender in this matrix (rows c, h, b, j): its frames are held
  for the operator's approval in a bypass session and expire at `dialogExpiry`
  (10 m here), so the wake never reaches the model. This is exactly the D15
  rejected option "accept the hold".
- The detached monitor unit (row f) is likewise held. Nothing short of
  `crossSessionInbound: accept` (rejected, D15/D38) or a sender that is itself a
  bypassing Claude session changes the outcome.
- Frames posted from a hook or Bash child *during* the invocation are delivered
  unconditionally, which is the mechanism the existing `PreToolUse` injection in
  `yeet-inbox.sh` already exploits with plain stdout.

## Verdict

**Probe failed for every detached sender; slice 2 closes as cut.** W8 (the
session-owned inbox tail) is closed as cut in
`goals/yeet-pr-events/ops/manifest.json` (phase status `complete` with a cut
reason, since the manifest phase domain has no `skipped`) with this record as
the reason. Per
`SPEC.md`, no rejected D15 option is revived: idle-owner wake stays hook
injection at the next tool call plus the desktop `set_monitor` switch, and
dead-owner escalation is W9 (monitor-side notifier).

The exact in-hook child was not run (the hook wiring lives in the operator-owned
`.claude/settings.json` and the clone's hooks belong to another branch); the
Bash-tool child is the same process class (a direct child of the session
process, delivered while the invocation runs), and the documentation names both
as the own-child case. A hook child that returned before posting would be row b.

## Artifacts

Sender script and per-sender logs (pid, ppid, session id, timestamps, socat
exit) were kept in the session scratchpad (`w7/post.sh`, `w7/*.log`); the
transcript rows cited above are in the session JSONL. Socket and token values
never entered any log.
