# Adapter contract

The helper is a building block for an authorized consumer, not a command that
returns a credential to the assistant. Exit codes: 0 delivered, 1 cancelled or
rejected by dialog, 2 unavailable/invalid/error, 3 timeout. Treat every nonzero
exit as no usable answer. Never display captured stderr or exception details.

Use the checkout's `scripts/transport.ts` `requestCode(title, label, timeout,
env)` Effect from a trusted adapter. It creates a real Linux FIFO with
`pipe2(O_CLOEXEC)`, launches `bun scripts/prompt.ts --write-fd 3` with only the
write end inherited as descriptor 3, closes the parent's write end, and drains
the read end concurrently. It accepts at most 4096 bytes, bounds the helper's
lifetime, and terminates/reaps only its owned child on cancellation. The secret
never enters argv, environment variables, logs, or temporary files. Do not
replace the FIFO with a socket or redirect helper output to a tool transcript.

An adapter creating its own FIFO must follow the same lifecycle. Never reuse
another agent's pipe or wait for helper exit before draining it: a long answer
can fill the pipe. Before delivery, line-oriented authentication consumers
must reject CR, LF, NUL and every other incompatible control character. The
helper already rejects CR/LF/NUL; adapters still enforce their own protocol
rules and size limits. A remote sudo PTY adapter must never forward multiline
text that could become shell input after authentication. Send successful bytes
directly to the authorized consumer, wipe buffers after use, and close both
descriptors in cleanup. Parent cancellation must terminate its owned helper
and dialog, never leave a background prompt. `runAdapter` provides a silent
SIGINT/SIGTERM boundary for standalone adapters.

For remote SSH text challenges, prefer the existing remote wrapper. An SSH
askpass adapter may call the pipe helper and return the answer to SSH's private
askpass channel only. Never run an askpass helper directly in an agent tool.
Keep host-key verification enabled. Scope any temporary executable helper to a
mode-700 directory in the owned runtime directory and remove it when done.
A connection-only multiplex master can separate authentication from mutations;
verify its socket ownership before use and close only the master you created.

For remote sudo, connect through the established authorized SSH lane. An adapter
must use a unique challenge sentinel and a separate post-authentication ready
sentinel, discard all pre-authentication output, and check terminal echo is off
before sending bytes. A prompt string alone is insufficient evidence of success.
Restrict the remote command to the authorized action; never infer permission to
open an unrestricted root shell. Handle interrupted reads, EOF and Linux PTY
EIO without dumping buffered bytes. Reap owned child PIDs on every exit path;
restore local terminal attributes before reporting sanitized status.

Never retry after a timeout until you know whether the action began. Inspect
state through the authorized connection first. The dialog is a transport for a
human-provided value, not permission to bypass PAM, SSH, 1Password or a failed
approval gate.

## Current-user GUI preparation

An agent tool may lack user-bus metadata even while Plasma is running. Before
launching the pipe helper, a trusted adapter may prepare **its own current
user's** runtime/bus context as below. Preserve an already complete selected
GUI context; do not run this recipe to replace a different selected bus.
Never inspect another UID's session or print a user-manager environment dump.

```ts
import * as Fs from "node:fs";
import * as Effect from "effect/Effect";
// Import runOwned from the reviewed checkout's scripts/prompt.ts.

const currentUserGuiEnv = Effect.gen(function* () {
  const uid = process.geteuid?.();
  if (!uid || uid !== process.getuid?.()) return undefined;
  const runtime = `/run/user/${uid}`;
  const bus = `${runtime}/bus`;
  const [directory, socket] = yield* Effect.try(() => [
    Fs.lstatSync(runtime), Fs.lstatSync(bus),
  ]);
  if (!directory?.isDirectory() || directory.uid !== uid ||
      (directory.mode & 0o077) || !socket?.isSocket() || socket.uid !== uid)
    return undefined;
  const metadata = {
    XDG_RUNTIME_DIR: runtime,
    DBUS_SESSION_BUS_ADDRESS: `unix:path=${bus}`,
  };
  if (Object.entries(metadata).some(([key, value]) =>
      process.env[key] !== undefined && process.env[key] !== value))
    return undefined;
  const env = { ...process.env, ...metadata };
  const reachable = yield* runOwned(["busctl", "--user", "status"], env, 5);
  return reachable.status === 0 ? env : undefined;
}).pipe(Effect.catchCause(() => Effect.succeed(undefined)));
```

Use the returned environment only for the owned helper/authentication lane.
Provide `BunServices.layer` at the adapter's runtime boundary for `runOwned`.
Treat `undefined` as unavailable and stop; never print exception details.
This sets only nonsecret runtime/bus metadata. `prompt.ts` preserves a complete
caller-selected GUI context. Otherwise it resolves display metadata from
`systemctl --user show-environment` as one consistent unit, refusing any
conflicting supplied GUI key, missing bus, or missing display. Do not guess a
display or run `kdialog --password` directly. Ownership, socket and bus probes
qualify infrastructure; only a live masked-dialog acceptance check qualifies
actual dialog delivery.

## Concrete SSH consumer

Use the [SSH askpass adapter](../scripts/ssh-askpass.ts) as `SSH_ASKPASS` only inside the existing approved
remote SSH wrapper when it needs a text challenge. The executable must have an
absolute path. Set `SSH_ASKPASS_REQUIRE=force` for that single SSH invocation;
set `NumberOfPasswordPrompts=1`, restrict `PreferredAuthentications` to the
approved challenge mechanism, and disable password fallback for an OTP-only
flow (`PasswordAuthentication=no`). One prompt per method alone does not
prevent a second authentication method from prompting. The adapter terminates its direct SSH authentication parent after any refused,
cancelled, expired or failed text callback, preventing an empty response or
another method from reopening the dialog.
The owning supervisor must reap that SSH process before any retry. Use a
connection-only foreground `ssh -M -N` under the owning supervisor with
no controlling terminal (`setsid`) and a private owned ControlPath. Retain the
wrapper's exact identity, host-key, FIDO and notification settings. Name the
host/action in the agent's announcement before the SSH call. The trusted
caller must also set command-scoped `PLASMA_AUTH_TITLE` (host and action) and
`PLASMA_AUTH_LABEL` (exact field, such as authenticator OTP, and destination).
The caller must also set `PLASMA_AUTH_SSH_PROMPT` to the complete trusted
OpenSSH callback form: `(remote-user@effective-host) configured challenge`.
Build the prefix from the wrapper's effective remote user and host, substituting
its configured `HostKeyAlias` when set, then append the verified service
challenge. A bare PAM challenge is insufficient. A synthetic example is
`(operator@host-alias.example.invalid) Verification code:`; OpenSSH may append
a trailing space. Matching strips only trailing ASCII spaces/tabs from both
sides; it preserves the entire identity prefix, leading whitespace, punctuation
and all other characters. The callback argument is never copied into the
trusted expected value. These values contain nonsecret metadata only. The adapter refuses missing context or any
callback whose literal prompt differs; an arbitrary "Password:" is never
assumed to mean OTP. Unknown prompts, including a FIDO PIN or key passphrase,
are refused without a dialog. OpenSSH normally converts a nonzero askpass
exit into an empty authentication response, consuming a failed attempt. This
adapter therefore terminates its still-direct verified SSH authentication
parent before returning any text-path refusal or failure, including a prefix
mismatch, missing context, cancellation or timeout. The connection-only lane's
owning supervisor must wait/reap that SSH process and confirm termination
before any retry; an adapter cannot reap its own parent. Keep the one-attempt and
method restrictions above as defense in depth. Notification/confirmation paths
remain separate and never signal SSH. PIN-requiring FIDO stays entirely under
the canonical dispatcher.
Never copy untrusted remote prompt text into these variables merely to make a
mismatch pass. For example, label an OTP
as "Enter the authenticator code for the approved host's SSH sign-in" and a
remote sudo password separately as an account password. The SSH adapter does
not collect remote sudo passwords. Do not use this
for local sudo or to bypass a missing remote-wrapper authorization.

The adapter accepts only a direct `ssh` parent (Linux `/proc` misuse guard),
reads at most 4096 bytes from the helper's private pipe, and sends stdout only
to SSH's internally captured askpass channel after the helper exits 0. Its
stdout must never be independently captured by an agent tool. It compares
SSH's prompt argument only with the trusted exact expected
challenge and never displays that untrusted argument. `SSH_ASKPASS_PROMPT=none`
is notification-only (exit 0), and `confirm` is a permission request (exit 2,
never silently approve). Both return without a text dialog or signalling SSH.
Keep the canonical FIDO wrapper's notifier/confirmation dispatcher in charge
of those callbacks; never replace it with this text adapter. Do not combine
this adapter with FIDO keys requiring PIN entry. An approved wrapper must own
any FIDO notification/PIN dispatch separately before routing only its known
text challenge here. OpenSSH's callback semantics are defined in its
[readpass.c implementation](https://github.com/openssh/openssh-portable/blob/master/readpass.c);
keyboard-interactive prefixing is in
[sshconnect2.c](https://github.com/openssh/openssh-portable/blob/master/sshconnect2.c).
Adapter cancellation closes descriptors and terminates/reaps its owned helper; the
helper kills/reaps its owned dialog. Monitor the same owned SSH process until
connection success or failure; SSH authentication failure must discard the
value, and any retry must respect the three-attempt limit and cancellation.
Never run a remote command that echoes the received value. A successful SSH
master can then carry the authorized operation without another text prompt.

## Workstation discovery installation

Run `bun <skill>/scripts/install.ts` once from the reviewed checkout. It
requires Bun and checkout root dependencies (`bun install --frozen-lockfile`),
then adds discovery links at the current-user installation destinations
`$HOME/.agents/skills` and `$HOME/.claude/skills`, and a
marked default rule to `~/.codex/AGENTS.md`, preserving existing instructions.
It refuses a competing skill directory/link. New Codex chats discover the
rule regardless of cwd; already running chats keep their loaded instructions.
Claude discovers the skill globally through its ambient trigger description.
The repository's AGENTS rule also covers fresh clones without installation.

The links point to this checkout: keep the worktree until merge, then repoint
them to the retained main checkout only after it contains this skill. Do not
retire a worktree that still owns installed discovery links. To roll back,
remove only the two links after verifying their targets, and remove only the
marked block from `~/.codex/AGENTS.md`; preserve the rest of the file.
The links expose the TypeScript prompt, askpass, installer and transport scripts
in that checkout; the installer does not copy a standalone Python executable or
modify SSH wrappers. Invocation uses `bun` (the askpass entrypoint has an env-bun
shebang), so its PATH must resolve Bun. Installation is local activation,
separate from PR publication or merge.
