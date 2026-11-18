---
name: plasma-sensitive-entry
description: Requests sensitive human input through a masked KDE Plasma dialog and delivers it directly to an authorized consumer. Use whenever an agent needs a password, OTP, recovery code, token, or other sensitive text from the human. Apply before asking in chat, a question tool, terminal input, or an ordinary form. Existing YubiKey, remote authentication wrappers, and agent 1Password routes take precedence.
compatibility: KDE Plasma with kdialog, Bun, and a reachable user session bus; otherwise stop sensitive collection.
---

# Plasma sensitive entry

This is the default process when an authorized task needs sensitive text from
the human. Announce the purpose and destination without asking for the value in
chat. A dialog collects the value; the agent receives only sanitized status.

## Choose the existing authentication route first

- Local sudo/pkexec uses the canonical `yubi-sudo` / `yubi-pkexec` wrappers in a
  real PTY, including their notification, sound, serialized touch and retry
  rules. Never substitute a password dialog for local YubiKey PAM.
- Remote SSH/YubiKey wrappers remain canonical. Use this skill only for a text
  challenge the approved route actually requires, such as an OTP.
- Agent 1Password operations use `op` from PATH and their existing automation
  backend. On failure run `op-doctor` once and stop a still-failing operation.
  Never request desktop sign-in, unlock, credentials or raw item JSON as repair.
- Prefer an existing authorized secret reference over asking the human again.
  This skill grants no new authority, capture scope, host trust, or privilege.

## Deliver text without exposing it

1. Establish the exact authorized destination, challenge and owning process.
   Use a title naming the host/service and action, and a label identifying the
   requested field and where it goes. Never put a secret in either string.
2. Verify the local Plasma session and `kdialog` are available. Use only the
   selected session's display and bus metadata; never print its environment.
   If the agent lacks user-bus context, use the integration contract's
   [current-user preparation](./references/integration.md#current-user-gui-preparation).
   A missing GUI is a blocker: arrange human entry in the trusted application.
   Never fall back to chat, question tools, terminal typing or plaintext files.
3. Use [the pipe helper](./scripts/prompt.ts) from a trusted adapter, following
   [the integration contract](./references/integration.md). The adapter creates
   a private pipe, inherits only its write descriptor as child fd 3, and consumes
   the read side in memory. The helper refuses standard descriptors and only
   writes a successful, nonempty answer to that inherited pipe. The bundled
   [SSH askpass adapter](./scripts/ssh-askpass.ts) is the concrete SSH consumer;
   never run it directly.
4. Keep answers out of tool arguments/results, stdout/stderr, environment,
   shell history, files, screenshots and telemetry. Do not invoke `kdialog
   --password` directly as an agent tool: its stdout contains the answer.
   Do not use shell command substitution or print the helper's pipe contents.
5. Forward the answer directly to the intended consumer. For a PTY, verify
   echo is disabled and suppress **all** child bytes until independently
   confirmed authentication; echoed input must never reach the transcript.
   Drop answer and capture-buffer references immediately after delivery.
   JavaScript cannot guarantee memory erasure; do not claim otherwise.
6. Report only success, cancellation, timeout or sanitized failure. Never
   return the answer, length, prefix, digest or an untrusted exception message.

## Own the lifecycle

- Serialize sensitive dialogs and physical-key requests. A running session is
  pending; resume that exact session. Never duplicate an uncertain request.
- On explicit cancellation stop immediately. A dialog deadline is 60 seconds
  by default. Close only the adapter's own dialog and authentication process,
  reap them, close pipe/PTY descriptors, restore terminal attributes and remove
  owned temporary helpers. Handle EOF and PTY `EIO` as a closed connection.
- Bound every wait, including shutdown: TERM, timed wait, KILL if necessary,
  then reap. Never broad-kill processes, remove another session's SSH socket,
  or disrupt unrelated authentication prompts.
- Retry only an authentication challenge known to have failed, at most three
  total attempts, announcing fresh attempts. Cancellation is not a retry.
  Never replay an uncertain command or interrupt an active privileged write.
- Preserve existing local YubiKey rules: cancel a password fallback, confirm
  the owned request ended, and retry the wrapped touch without asking for a
  password. A foreign holder requires coordination with its owner.

## Verification

Run `bun test <skill>/scripts/prompt.test.ts`.
Tests use synthetic input and fake dialogs; they never request real credentials.
A live masked-dialog acceptance check must be explicitly described as such and
use disposable synthetic input. Automated tests alone do not prove GUI delivery.
