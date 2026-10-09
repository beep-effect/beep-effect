# Installed Codex Desktop ownership and daemon discovery

2026-10-09. Read-only discovery. No thread creation, enumeration, resume, message,
model turn, UI action, daemon start/restart or configuration change occurred.

## Current result

The currently running local Desktop app owns a **separate bundled app-server
using the default stdio transport**, not the normal shared CLI control daemon.
A supported-by-installed-code opt-in to a shared daemon exists, but is inactive
on the measured current setup and was not exercised.

Evidence:

- Direct child of the Desktop executable runs the bundled resources `codex`
  executable with `app-server --analytics-default-enabled`; no `--listen`
  argument. Installed app-server help documents stdio as the default transport.
  Additional app-server processes belonged to the computer-use runtime and
  explicitly used `--listen stdio://`; these are distinct from the Desktop child.
- Both PATH CLI and bundled CLI `app-server daemon version` failed with ENOENT
  for the normal control socket under `~/.codex/app-server-control/`.
  This was a bounded read-only version query, not a startup action.
- PATH CLI version: `0.162.0`; bundled Desktop CLI: `0.162.0-alpha.17.2`.
  Managed CLI spike evidence must not silently qualify this different binary.
- Desktop app-server fd metadata showed unnamed Unix sockets and one named
  abstract Unix socket. No normal named control endpoint was discovered.
  Socket names were not contacted; their protocol/purpose is unknown. Anonymous
  socketpairs are consistent with a process-owned stdio transport but are not
  treated as a peer enrollment endpoint.

## Installed source path for an opt-in shared daemon

Inspected installed `app.asar` source, extracted into private cache. In
`.vite/build/application-network-startup-CfAQmSYg.js`, class `Ws.connect` chooses
WebSocket transport to the normal control socket only if all conditions hold:

1. Non-Windows, local host.
2. No per-host config overrides returned by `getConfigOverrides`.
3. `CODEX_APP_SERVER_USE_LOCAL_DAEMON` equals `1`.
4. `CODEX_APP_SERVER_FORCE_CLI` does not equal `1`.
5. No `CODEX_CLI_PATH` or host `codex_cli_command` override.
6. No bundled Git override relevant on macOS.
7. The selected CLI's `app-server daemon version` succeeds within 2.5 seconds
   and returns an app-server version accepted by the installed app.

The chosen path is `CODEX_HOME` (or normal home `.codex`) plus
`app-server-control/app-server-control.sock`. Installed source explicitly
constructs a WebSocket connection over that Unix socket. If eligibility/version
fails, it falls back to `Us`, whose `spawnProcess` launches the selected CLI with
piped stdio. This evidence establishes transport semantics from implementation,
not from the filename or socket metadata.

Bundle SHA-256 for the inspected network/startup module:
`cd6e8a8fbc4354a6e6ff19c6e4bf6fc1fb3960c63708c83871357c6238f516a8`.
The source is shipped/minified implementation evidence, not a public stable API
or an app-session enrollment proof.

## Disposable visible-app candidate

Installed `.vite/build/bootstrap-Du6FqCuH.js` implements explicit
`CODEX_ELECTRON_USER_DATA_PATH` as the Electron `userData` directory and uses
single-instance locking after selecting it. A new, owned directory therefore
provides an implementation-supported candidate for a separate disposable app
profile without restarting the live app. This was not launched or UI-verified.

A root-owned experiment could combine a distinct user-data directory with the
process-only local-daemon opt-in, provided the eligible selected CLI can already
reach an owned daemon and the app host's override list is empty. Do not infer
that a CLI `--listen` socket can be substituted for the daemon path; the app's
code uses the daemon location and version gate. Do not inject into current
anonymous stdio fds or attach a second conversation writer.

Still unresolved before any launch:

- Existing subscription auth continuity with a separate owned `CODEX_HOME`.
  No auth files were read, exported, copied or symlinked in this investigation.
- Whether the disposable app's local host generates config overrides that
  disable the daemon branch, and whether bundled alpha.17.2 accepts the owned
  daemon version.
- Actual UI-visible session ownership, input delivery, reply tools and permission
  continuity. Metadata and source discovery do not satisfy these gates.

## Concrete blocker and next decision

The live Desktop process cannot currently be enrolled through the default CLI
shared-daemon socket because that daemon is absent and the app already owns a
stdio child. A disposable separate app profile plus owned shared daemon is a
viable **candidate experiment** grounded in installed source; exact auth and
host-policy setup must be resolved before claiming that route usable. The root
owns UI/launch actions. No live app needs to be restarted for this read-only
finding, and none was.

Private process IDs, executable paths, fd/socket identities and static source
extracts remain outside the packet in the workstation cache at mode 0600. No
proprietary source extracts or live identifiers are included in this subtree. Discovery used only executable/allowlisted transport flags, fd and
socket metadata, installed help/version and static bundled sources; no process
environments, bearer tokens or credentials were dumped.

## Visible-app evidence boundary

This discovery did not operate a native app. Native computer-use APIs are
unavailable in this session: the inventory returned no enabled native apps, and
the tool namespace states native apps are disabled. Existing browser conversation
proofs belong to their own experiment reports; a Claude web conversation cannot
be relabelled a native Claude Desktop or Codex Desktop enrollment. The current
Desktop stdio process remains separate from both a managed CLI and browser chat.

## Provenance and reproduction

Public artifacts here are the sanitized report and `results.json` only. Installed
source provenance is recorded by bundled module basename and SHA-256; source
bytes were inspected privately, never copied into this public packet:

- `application-network-startup-CfAQmSYg.js`: local transport-selection class
  `Ws.connect`, daemon-version gate `Gs`, stdio transport `Us.spawnProcess`,
  home resolver `xr`, and selected-binary arguments `tc`. SHA-256:
  `cd6e8a8fbc4354a6e6ff19c6e4bf6fc1fb3960c63708c83871357c6238f516a8`.
- `bootstrap-Du6FqCuH.js`: explicit Electron user-data resolver `oD`,
  `app.setPath` before instance locking, and single-instance condition `iD`.
  SHA-256 is retained in the accompanying structured provenance receipt.

On the same installed build, read-only help/version and allowlisted process
transport metadata can refresh these observations. Daemon start/restart, app
launch, thread enumeration/creation/resume and model messaging are separate
actions and were not part of discovery. Environment variables described above
are installed-source candidates, not public stable configuration guarantees.
