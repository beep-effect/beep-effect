# T6 — Cross-Session Messaging (Claude Code 2.1.224+)

Addendum track, opened 2026-08-09. Re-measures [`T3`](./T3-delivery-vector.md)
against a harness capability that did not exist when T3 was written, and
specifies the rung-1.5 liveness upgrade that falls out of it.

Source: [Message your other Claude Code sessions](https://code.claude.com/docs/en/cross-session-messaging).

---

## 0. Bottom line

Claude Code 2.1.224 shipped `ListAgents` + `SendMessage`. Same-machine delivery
travels over a per-session Unix socket — the docs are explicit that it goes
**"over a per-session socket, never through Anthropic servers"**.

Four findings, in descending order of how much they change:

1. **T3 §4.4 is DEAD.** "Is there a non-hook external push? Honestly: no, with
   three partial exceptions." There is one now, and it clears all three of that
   section's objections at once. §2 below.
2. **The mirror is not obsoleted, and the reason is measurable.** Messaging is
   transport; nothing in it derives a collision. A sender must already know
   there is one and already know whom to tell — which is the entire fleet
   mirror. §6.
3. **Rung 1's liveness probe was built on the wrong primitive.** T3 §4.5 already
   found the on-disk session registry and rung 1 used `/proc` scanning instead,
   where it hit the root-owned wall that made `dormant` unreachable. The registry
   is readable by construction and *supplies* the `cwd` the restricted probe was
   reaching for. §3–4.
4. **The exploration's one open question is unblocked.** Rung 2's delivery no
   longer waits on speed-loop PR-I landing `AgentBrief.fleet`. A transport
   exists today. It is not the same shape as ambient delivery and does not
   replace it. §5.

**The specimen that carries this track.** The session most needed as a message
target in this fleet — `beep-effect3-e3`, the CI/infra session that hand-relayed
the runner-migration notice on 2026-08-08 — is alive, `busy`, interactive, on
2.1.226, and **binds no messaging socket**. The registry sees it. `ListAgents`
does not. Had rung 1 derived liveness from peer discovery, that checkout would
read as not-live: a falsely-negative field, which is the exact silent miss the
packet's binding law exists to forbid.

---

## 1. Capability delta since T3

T3 §3's matrix was measured against **2.1.221**. Local binary is now **2.1.226**;
messaging requires **≥ 2.1.224**.

| Property | Value |
| --- | --- |
| Tools | `ListAgents` (discovery), `SendMessage` (delivery) |
| Slash command | `/list-agents`, alias `/peers` |
| Same-machine transport | per-session Unix socket, never via Anthropic servers |
| Cross-machine transport | through Anthropic servers, over Remote Control |
| Cross-machine direction | **reply-only** — cannot originate |
| Payload | plain text only; never conversation history or files |
| Discovery backing | `~/.claude/sessions/<pid>.json` + `/run/user/<uid>/cc-socks/<pid>.sock` |
| Socket env var | `CLAUDE_CODE_MESSAGING_SOCKET`, exported before any hook incl. `SessionStart` |
| OS | macOS + Linux (incl. WSL 2); **not** native Windows |

Two capability notes that matter downstream:

- The socket is **restricted to the operating-system user**, so on a shared
  machine another user's sessions cannot reach it. This fleet is single-user by
  operator ruling, so the restriction is free.
- A hook or Bash command can post **into its own session's socket**, and on
  Linux the harness can verify own-child provenance even for a child that has
  already exited. That is a second, non-model-driven injection path worth its
  own probe; not measured here.

---

## 2. T3 §4.4 is dead — the fourth vector

T3 looked for a non-hook external push and found three near-misses. Messaging
clears every objection T3 raised against them:

| T3's near-miss | Why T3 rejected it | Messaging |
| --- | --- | --- |
| `asyncRewake` | "requires a hook to be configured up front and a tool call to arm it" | No hook, no arming. On by default when the version and provider allow. |
| `--input-format stream-json` | "only for sessions launched that way. The fleet's interactive TUI sessions cannot use it" | Reaches interactive TUI sessions directly. |
| Remote Control | "routes the transcript through Anthropic servers… **forbidden in any session touching OIP material**" | Same-machine delivery never leaves the box. See §7 for the cross-machine half, which does. |

So the honest restatement of T3's law: **model-context injection in a live
session is hook-only *for content the session did not choose to receive*.**
Messaging is not an injection into a running turn — the receiver reads it
between tool calls, or starts a new turn when idle. A running tool is never
interrupted. That is a weaker primitive than `PreToolUse` `deny` (still the only
pre-write enforcement vector) and a stronger one than anything T3 found for
words.

**What replaces the old constraints.** Delivery is explicitly *not* guaranteed:
every message is checked against the receiver's inbound controls and ends as
**delivered**, **held**, or **refused**. Plus: plain text only, per-sender rate
limits, identical repeats dropped inside a short window, and a cap of 50
accepted messages waiting to be read. The loop-safety story is good; the
guaranteed-delivery story does not exist. §5 has the rules that decide which
outcome a fleet message actually gets.

---

## 3. The registry — T3 §4.5 was right, and rung 1 did not use it

T3 §4.5 called `claude agents --json` an "unexpected find, directly useful" and
noted the backing store at `~/.claude/sessions/<pid>.json`. Rung 1 shipped
`/proc` cwd attribution instead. Measured on this host, 2026-08-09:

| Probe | Readable | Total | Share |
| --- | ---: | ---: | ---: |
| `/proc/<pid>/stat` | 1430 | 1435 | **99.7%** |
| `/proc/<pid>/cwd` | 189 | 1435 | **13.2%** |

`/proc` is mounted without `hidepid`. The asymmetry is structural, not local
policy: `stat` is world-readable, while `cwd` is a symlink gated on
ptrace-level access, so it resolves only for our own processes. Rung 1's
`dormant` state was unreachable because a complete negative scan requires
reading `cwd` for **every** process, and 86.8% of them refuse.

The registry dissolves the problem rather than working around it: **it supplies
`cwd` directly**, so the only thing left to measure is whether the recorded PID
is still the process that wrote the file — and that is `stat`, which is
99.7% readable.

Registry entry shape, verbatim from this session's file:

```json
{"pid":244216,"sessionId":"56137bb3-…","cwd":"…/beep-effect5","startedAt":1786330687412,
 "procStart":"220635","version":"2.1.226","peerProtocol":1,"kind":"interactive",
 "entrypoint":"cli","messagingSocketPath":"/run/user/1000/cc-socks/244216.sock",
 "name":"COORDINATE_MULTI_AGENT_WORK_TO_REDUCE_DUPLICATE_EFFORT","status":"busy",
 "updatedAt":1786331211648,"statusUpdatedAt":1786331211648,"bridgeSessionId":"session_01Su…"}
```

`procStart` is `/proc/<pid>/stat` field 22 (`starttime`, clock ticks since
boot). Verified exact for every live session on the host:

| PID | `/proc` starttime | registry `procStart` | match |
| --- | ---: | ---: | --- |
| 244216 | 220635 | 220635 | yes |
| 236768 | 212979 | 212979 | yes |
| 239469 | 216118 | 216118 | yes |
| 128725 | 98884 | 98884 | yes |

That field is the PID-reuse guard. A registry file whose PID is alive but whose
`starttime` differs is a stale file over a recycled PID, and must read `unknown`
rather than `live`.

### 3.1 The socket is a strictly weaker signal than the registry

Four registry entries; three bound sockets. The gap is the specimen from §0:

| PID | cwd | kind | status | socket | version |
| --- | --- | --- | --- | --- | --- |
| 244216 | `beep-effect5` | interactive | busy | yes | 2.1.226 |
| 236768 | `beep-effect2` | interactive | — | yes | 2.1.226 |
| 239469 | `beep-effect` | interactive | — | yes | 2.1.226 |
| **128725** | **`beep-effect3`** | **interactive** | **busy** | **`null`** | **2.1.226** |

`beep-effect3-e3` records `messagingSocketPath: null` and `peerProtocol: 1` on a
current binary, started ~20 minutes earlier in the same boot. **Why it binds no
socket is not established.** The documented candidates are the feature-flag
evaluation being disabled for that session (`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`,
`DISABLE_TELEMETRY`, `DO_NOT_TRACK`, `DISABLE_GROWTHBOOK`), bare mode, or a
provider that does not offer the feature. Recording it as measured-and-unexplained
rather than guessing which.

The consequence stands regardless of cause: **peer reachability and liveness are
different facts, and only one of them is what the mirror needs.**

---

## 4. Rung 1.5 — the liveness upgrade

Bounded change to `classifyFleetLiveness` in
[`goals/fleet-mirror`](../../../goals/fleet-mirror/README.md). Not a new rung of
capability; a better probe for a field rung 1 already ships.

**Add a probe** — for each registry file under `~/.claude/sessions/`:

1. Read `pid`, `procStart`, `cwd`, `status`, `statusUpdatedAt`.
2. Confirm `/proc/<pid>/stat` field 22 equals `procStart`. Mismatch or missing
   ⇒ contributes nothing (not a negative).
3. Join to a checkout when the registry `cwd` is **at or under** that checkout's
   path — a session started in a subdirectory still belongs to the checkout.
4. On a confirmed join, the checkout is **`live`**, carrying a new
   `claude-session` evidence member.

**This is not evidence-free.** `FleetLivenessVerdict.evidence` is
`S.Array(FleetLivenessProbe)`, and `FleetLivenessProbe` is a **closed**
`LiteralKit(["process-cwd", "transcript-mtime", "worktree-mtime"])`
(`Worktree.schemas.ts`), so a free-form `claude-session:<pid>` string cannot be
stored — it would fail at the schema boundary. Rung 1.5 must therefore carry, in
schema-first order: (1) a fourth `FleetLivenessProbe` member `claude-session`;
(2) a decision on whether the PID is carried at all — the terse option keeps
`evidence` a closed literal domain and drops the PID, the faithful option
promotes `evidence` to a tagged union so the probe can carry its `pid` and
`procStart`, at the cost of touching every existing evidence reader; (3) the
renderer's `livenessLabel` join in `Fleet.command.ts`; and (4) the liveness
tests. The terse option is the recommended default — the PID is a debugging
convenience, not a fact the mirror's consumers act on — but it is a real
schema change either way, not a classifier tweak.

**Do not** derive a negative from it. Absence of a registry entry is not absence
of activity: the registry covers Claude Code sessions only, never `codex`
sessions, editors, test runners, or a human with a dirty tree. So a checkout
with no registry hit falls through to the existing probes and, failing those,
reads `unknown` exactly as it does today.

Net effect: a pure `unknown → live` conversion backed by a 99.7%-readable
measurement, with the binding law untouched. `dormant` stays unreachable on this
host, and stays honest about it.

**Explicitly rejected:** deriving liveness from `ListAgents` or socket presence.
§3.1 is the counter-example — it would have marked the busiest session in the
fleet not-live.

**Second, smaller win.** `status` / `statusUpdatedAt` are a measured freshness
signal the mirror currently has no equivalent of. Worth a follow-up probe;
out of scope for 1.5.

---

## 5. Delivery-class mechanics that constrain rung 2

Anyone specifying ambient delivery needs these four, all documented and none
obvious:

1. **The default holds messages for bypass-mode receivers.** When no
   `crossSessionInbound` value applies, the harness decides from the two
   sessions' permission-mode classes. A receiver that bypasses permission
   prompts **holds** every message, delivering only when the sender also
   bypasses. `auto`, `acceptEdits`, and `dontAsk` all count as *prompting*.
   This fleet runs long-lived `--dangerously-skip-permissions` sessions
   ([`T5`](./T5-derivation.md) §evidence), so the default outcome for a warning
   sent from an `auto` session to a working fleet session is **held**.
2. **A held dialog expires and the message is dropped.** `dialogExpiry` defaults
   to `"5m"`; past the deadline the harness "cancels the dialog and continues
   with its no-action default. For a held message, that drops the message."
   Accepts `"60s" | "5m" | "10m" | "never"`, and is read from **user, managed,
   and `--settings` only** — project and local settings cannot set it.
3. **`-p` workers hold forever.** A headless session cannot show the approval
   dialog, so a held message stays held until a mode or settings change releases
   it. Unattended `-p` workers need `crossSessionInbound: "accept"` in their
   `--settings`.
4. **`accept` cannot be set from project settings.** Precedence is managed →
   `--settings` → user, and a project or local value applies **only when it is
   stricter** on the `accept < hold < refuse` ladder. So the natural instinct —
   scope `accept` to this repo via `.claude/settings.json` — silently does
   nothing. Per-worker `--settings` or user settings are the only paths.

Design consequence for rung 2: **delivery outcome is a property of the receiving
session's permission mode, which the sender cannot see or control.** Any ambient
design that assumes a warning arrives is unsound. Either the receiver opts in
ahead of time, or the bulletin must remain pull-derivable — which is the mirror.

---

## 6. What this does not change

- **Detection is still unsolved by transport.** `SendMessage` requires a sender
  who already knows there is a collision and already knows whom to tell. That
  derivation is the entire packet.
- **Push does not cover the fleet.** Messaging reaches live Claude Code sessions
  that bound a socket. The mirror covers checkouts with no session at all, `-p`
  workers, `codex` sessions, containers (the registry is filesystem-scoped, so a
  container session and the host cannot see each other), and the session that
  made the change and then exited. Pull reaches everything; push reaches
  volunteers.
- **Broadcast is still the wrong shape.** A delivered message "counts toward
  usage like a prompt you type." At the 17-clone / 75-checkout scale measured in
  rung 1, pushing to everything is unaffordable noise. Derivation is what makes
  a push targeted enough to be worth sending — the mirror is what makes
  messaging affordable, not the other way round.
- **The README's closing line is now false and should stay on the record.**
  "The negotiation had to be relayed by hand through the operator, because the
  capability this packet is about does not exist yet." It exists. And §0's
  specimen is why the 2026-08-08 CI notice *still* came by hand.

---

## 7. OIP boundary

Cross-machine messages travel **through Anthropic servers**, arriving over the
target machine's Remote Control connection. `ListAgents` on this host currently
returns 14 Remote Control rows alongside the local peers, so the surface is
live, not theoretical.

`~/.claude/rules/oip-confidentiality.md` already forbids Remote Control in any
session touching OIP material. Messaging adds an adjacent path: a **reply** to a
message that arrived from another machine ships text off-device, and does so
even from a session that never enabled Remote Control itself.

**Applied 2026-08-09**, user settings: `isolatePeerMachines: true`, which
requires explicit approval before any `SendMessage` reaches a session beyond
this machine, and holds "even in `bypassPermissions` mode". A `true` from any
scope applies, so a lower scope can turn it on but never off. Same-machine
messages do not prompt.

Deliberately **not** set: `crossSessionInbound`. Leaving the per-message default
keeps the human gate in front of messages arriving at bypass-mode fleet sessions;
a blanket `accept` in user settings would remove it everywhere, including in
sessions running with no permission prompts at all. `dialogExpiry` raised to
`"10m"` instead — same gate, twice the window before a silent drop.

---

## 8. Evidence appendix

All commands run on this host, 2026-08-09, Claude Code 2.1.226.

```bash
# Version and own socket
claude --version                      # 2.1.226 (Claude Code)
echo "$CLAUDE_CODE_MESSAGING_SOCKET"  # /run/user/1000/cc-socks/244216.sock

# /proc readability across the full PID space
tot=0; sr=0; cr=0
for p in $(ls -1 /proc | grep -E '^[0-9]+$'); do
  tot=$((tot+1))
  [ -r "/proc/$p/stat" ] && sr=$((sr+1))
  readlink -e "/proc/$p/cwd" >/dev/null 2>&1 && cr=$((cr+1))
done
echo "pids=$tot stat_readable=$sr cwd_readable=$cr"
# pids=1435 stat_readable=1430 cwd_readable=189

grep -E ' /proc ' /proc/mounts
# proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0   (no hidepid)

# Registry vs sockets
ls -1 ~/.claude/sessions/            # 4 entries
ls -1 /run/user/1000/cc-socks/       # 3 sockets

# procStart == /proc/<pid>/stat field 22, for every live session
# (parse after the last ')' so a comm containing spaces cannot shift fields)
```

Rung-1 baseline for comparison: 1285 of 1816 `/proc` entries unreadable on
2026-08-06, recorded in
[`goals/fleet-mirror/research/OPPORTUNITIES.md`](../../../goals/fleet-mirror/research/OPPORTUNITIES.md).

Settings semantics in §5 and §7 are quoted from the
[settings reference](https://code.claude.com/docs/en/settings) and the
[cross-session messaging page](https://code.claude.com/docs/en/cross-session-messaging).
