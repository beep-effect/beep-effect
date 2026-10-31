# Practice review hub: the review queue on the tailnet

The review hub (`apps/practice-review-hub`) keeps the attorney's review queue
on the workstation: the items waiting for a verdict, the questions waiting for
an answer, and the verdicts and answers given. It serves them as one MCP
endpoint on `127.0.0.1`. `tailscale serve` exposes that endpoint on the
tailnet. Every request requires both an allowed tailnet login and an
independent bearer credential.

Three things feed or read the hub's data directory:

- docket intake writes a question for every needs-review message into
  `items.jsonl` when `DOCKET_INTAKE_REVIEW_HUB_DIR` is set;
- the hub reads the items and appends verdicts and answers;
- the daily notice reads the items and answers and, at most once a day,
  emails the attorney how many questions wait. The email holds the count only,
  never a question. When a review folder is configured, it also carries a link
  that opens Claude Code in that folder on the attorney's PC (section 6).

Nothing in the repository installs these units, and the hub never writes the
calendar. This runbook is the manual install.

| Unit | Sample | Environment file |
| --- | --- | --- |
| `practice-review-hub.service` | `apps/practice-review-hub/deploy/practice-review-hub.service` | `$HOME/.config/beep-practice-review-hub/hub.env` |
| `practice-review-notice.service` | `apps/practice-review-hub/deploy/practice-review-notice.service` | `$HOME/.config/beep-practice-review-hub/notice.env` |
| `practice-review-notice.timer` | `apps/practice-review-hub/deploy/practice-review-notice.timer` | none |

## 1. Deploy checkout and data directory

Run the hub from the pinned deploy checkout the practice services use
([practice services](practice-services.md), section 1). An upgrade there
upgrades the hub too (section 9).

Pick the data directory and write its absolute path wherever this runbook
says `<data-dir>`, for example `$HOME/.local/state/beep/practice-review-hub`
spelled out in full. systemd and `op run` do not expand `$HOME`.

```bash
mkdir -p -m 0700 <data-dir>
```

The hub creates `items.jsonl`, `verdicts.jsonl` and `answers.jsonl` there on
the first write, owner-only. The notice keeps one claim file per notice day
in `notice-sent/` beside them. Keep the directory: the verdict and answer
files are the record of what the attorney decided. The claim files are only
a guard and can be pruned once their day has passed.

## 2. The hub unit

```bash
cp apps/practice-review-hub/deploy/practice-review-hub.service $HOME/.config/systemd/user/
# edit the REPLACE_ values: the deploy checkout, $HOME, the bun shim,
# <data-dir>, the attorney's tailnet login (section 4), and a free port
# (the examples below use 8787, the hub's default)
systemd-analyze --user verify $HOME/.config/systemd/user/practice-review-hub.service
systemctl --user daemon-reload
systemctl --user enable --now practice-review-hub.service
journalctl --user -u practice-review-hub.service -f
```

The hub binds `127.0.0.1` only. Other local OS users can reach that port and
forge the proxy login header, so the server also requires an independent
bearer token. Before starting it, create a random token of 32–256 characters,
using only letters, digits and `. _ ~ + / = -` (the Windows client scripts in
section 8 accept nothing else), in the approved secret store. Store its reference as
`PRACTICE_REVIEW_HUB_API_TOKEN` in the owner-only `hub.env` file. The sample
unit uses `op run` to resolve it; do not use systemd `EnvironmentFile=` for
`op://` references. Replace the unit's `REPLACE_WITH_OP_PATH` too.

Provision the same token into the authorized MCP client's protected credential
configuration as `Authorization: Bearer <token>`. Keep it out of command-line
arguments, source control, URLs and diagnostic output. Tailscale forwards that
header; the hub independently checks it before accepting the login header.
A missing or invalid token returns 403, and missing configuration prevents
startup. The default HTTP tracing redaction protects `Authorization`.

Existing installations must provision the token on both the service and its
clients before upgrading. Reverting the code would restore the vulnerable
header-only boundary; keep the service stopped if rolling back. No live
service or secret is changed by this repository update.

## 3. Expose it on the tailnet with `tailscale serve`

`tailscale serve` terminates HTTPS on the workstation's tailnet name and
proxies to the loopback port. For every request from a user's device it sets
`Tailscale-User-Login` to that user's tailnet login, which is what the hub's
allow-list checks. Requests from tagged devices carry no login and get 403.

Running `tailscale serve` as your own user needs the Tailscale operator
permission, granted once by an administrator of the workstation:

```bash
sudo tailscale set --operator="$USER"
```

Give the hub its own HTTPS port on the tailnet name. Check what is served
already first: the bare name (port 443) often proxies another service, and
`--https=443` would replace it. Using the unit's loopback port as the HTTPS
port too keeps the two easy to match; with another port in the unit, change
both numbers:

```bash
tailscale serve status
tailscale serve --bg --https=8787 http://127.0.0.1:8787
tailscale serve status
```

The hub's tailnet address then carries the port:
`https://<workstation>.<tailnet>.ts.net:8787/mcp`.

`--bg` keeps the configuration across reboots. The tailnet must allow HTTPS
certificates; the first `tailscale serve` prints a link to turn them on when
they are off. Never use `tailscale funnel` for the hub: it would publish the
endpoint on the internet.

## 4. Find the attorney's tailnet login and allow it

The allow-list holds tailnet logins, the `LoginName` of a Tailscale user, such
as `<attorney-login>`. To read it from the workstation, find the attorney's
device and its tailnet IP, then ask who owns it:

```bash
tailscale status
tailscale whois <attorney-device-ip>
```

Copy the `LoginName` under `User:`. The Users page of the Tailscale admin
console shows the same value.

Check that this login belongs to the attorney alone. The login identifies the
Tailscale user, not the device: every device signed in as the same user sends
the same `Tailscale-User-Login`. When the attorney's device was set up with
the operator's account, allowing that login lets every one of the operator's
devices, agent workers included, record verdicts and answers as the attorney.
In `tailscale status`, the attorney's device must be the only device of its
user. If it is not, invite the attorney to the tailnet as their own user and
sign their device in with that account. When the tailnet has a custom access
policy, it must let that user reach the workstation on the hub's HTTPS port. Put it in the unit's `--allowed-logins` (several
logins are separated by commas, without spaces), then:

```bash
systemctl --user daemon-reload
systemctl --user restart practice-review-hub.service
```

The match is exact and case-sensitive.

Interim: since 2026-10-20 the deployed hub allows the operator's own login, which the
attorney's device shares, until the attorney has a login of their own. While that holds,
every device on that login reaches the hub. The decision and how to reverse it are in the
[attorney-question-loop Decision Log](../../goals/attorney-question-loop/SPEC.md#decision-log).

## 5. Docket intake writes the questions

Add the data directory to the docket intake environment file
(`$HOME/.config/beep-docket-intake/service.env`). It is a path, not a secret:

```bash
DOCKET_INTAKE_REVIEW_HUB_DIR="<data-dir>"
```

```bash
systemctl --user restart docket-intake.service
```

From the next cycle on, every needs-review message in the docket ledger is in
`items.jsonl` as a question. Each cycle stores only questions that changed, so
the file grows only when something new needs review. A question that could
not be stored is logged (`docket intake questions were not stored`) and
stored again next cycle; the docket entries are written either way. Without
the variable, docket intake runs exactly as before.

Each question says which email it is about: its subject, sender and day
received, a link that opens it in Outlook, a link to its needs-review
calendar entry, and the matter. A date it offers moves the needs-review
entry to that date under the docket item's own title. The docket intake
ledger keeps those for each needs-review message. A ledger record is pruned
in the first cycle after the digest of its day is written, about a day after
the message was processed, and the question stored for it then stays as it
was.

### Questions stored before they named their email

Questions stored before the service ran a revision whose questions name
their email only say "a message". `backfill-questions`
finds each docket intake question that does not name its email, matches it to
a message the write journal marked (by the message-id digest in the
question's id), reads that message's subject, sender, time of receipt and
Outlook link from Graph, and rewrites the question with the email added. The
question keeps its id and its options, so answers already given still match.
It prints one JSON line of counts and never a subject or a sender.

Run it from the deploy checkout once that checkout has the command
([practice services](practice-services.md), Upgrade). It reads the docket
state and journal without taking the state lock, so the service can keep
running. Look first; this writes nothing:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/service.env -- bun run apps/docket-intake/src/bin.ts backfill-questions
```

Then write:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/service.env -- bun run apps/docket-intake/src/bin.ts backfill-questions --apply
```

| Count | Meaning | What to do |
| --- | --- | --- |
| `found` | Docket intake questions that do not name their email. | None. |
| `enriched` | Questions rewritten (or, without `--apply`, that would be). | None. |
| `inLedger` | The message is still a needs-review record in the ledger, which the service republishes every cycle. | Run the command again in a day or two, once the record is pruned. |
| `unmatched` | No message in the write journal digests to the question's id, for example one processed before the journal existed. | Nothing can name it; the attorney opens it from its calendar entry. |
| `unreadable` | Graph no longer has the message under that id, usually because it was moved to another folder. | As for `unmatched`. |

A second run changes nothing: a question that names its email is never
picked again. Exit code 1 with `DOCKET_INTAKE_REVIEW_HUB_DIR is not set` means
the environment file lacks the variable; 3 means Graph throttled the run, so
run the same command again later.

## 6. The daily notice

The notice sends one email from the attorney's mailbox to itself, through
the existing agent outbox registration
([M365 agent outbox registration](m365-agent-outbox-registration.md)). That
registration already holds `Mail.ReadWrite` and `Mail.Send` scoped to the one
mailbox, so the notice needs no new grant. Never use the docket intake
registration here: it must never be able to send.

Create the environment file (mode `0600`) with `op://` references to the
outbox fields:

```bash
PRACTICE_REVIEW_NOTICE_TENANT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_OUTBOX_TENANT_ID"
PRACTICE_REVIEW_NOTICE_CLIENT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_OUTBOX_CLIENT_ID"
PRACTICE_REVIEW_NOTICE_CERT_THUMBPRINT_SHA256="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_OUTBOX_CERT_THUMBPRINT_SHA256"
PRACTICE_REVIEW_NOTICE_CERT_PRIVATE_KEY="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_OUTBOX_CERT_PRIVATE_KEY"
PRACTICE_REVIEW_NOTICE_MAILBOX="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_OUTBOX_MAILBOX"
```

The unit runs the notice under `op run --env-file=<file>`. Do not give the
file to systemd's `EnvironmentFile=`: systemd passes each reference through
as a literal string, and the notice refuses a value that is still an
`op://` reference. Check that it resolves, with no output:

```bash
op run --env-file=$HOME/.config/beep-practice-review-hub/notice.env -- true >/dev/null
```

Install the service and its timer. Replace the REPLACE_ values in the service
(the deploy checkout, `$HOME`, the environment file, the bun shim,
`<data-dir>` and the practice's IANA time zone, such as `America/Chicago`).
The timer runs at 08:30 in the workstation's local time; add the zone after
the time when the practice is elsewhere.

```bash
cp apps/practice-review-hub/deploy/practice-review-notice.service $HOME/.config/systemd/user/
cp apps/practice-review-hub/deploy/practice-review-notice.timer $HOME/.config/systemd/user/
systemd-analyze --user verify $HOME/.config/systemd/user/practice-review-notice.service $HOME/.config/systemd/user/practice-review-notice.timer
systemctl --user daemon-reload
systemctl --user enable --now practice-review-notice.timer
systemctl --user list-timers practice-review-notice.timer
```

Run it once by hand and read its one-line outcome (`sent`, `already-sent` or
`nothing-waiting`):

```bash
systemctl --user start practice-review-notice.service
journalctl --user -u practice-review-notice.service -n 20
```

The notice claims the day before it sends, by creating
`notice-sent/<YYYY-MM-DD>` with an exclusive create. Only one run can claim a
day, so the timer and a hand-started run together still send at most one
email. `Persistent=true` runs a morning missed while the workstation was off
at the next start.

A send that fails keeps the day's claim, so that day gets no email and the
timer tries again the next morning. The claim is not released automatically
because a failed send is not always a missing email: Graph can fail after the
message went out. To resend the same day:

1. Read the failure in the journal (the command above).
2. In the attorney's mailbox, look in Sent Items for today's
   "Claude: N questions waiting" notice. If it is there, stop: it was sent.
   If an unsent copy sits in Drafts, delete it.
3. Release the claim and run the notice again. The file is named for today in
   the time zone the service passes as `--time-zone`:

```bash
rm <data-dir>/notice-sent/$(TZ=<time-zone> date +%F)
systemctl --user start practice-review-notice.service
journalctl --user -u practice-review-notice.service -n 20
```

### Answer link (optional)

The email says how many questions wait. It can also carry an
"Answer them in Claude Code" link. The link opens Claude Code on the
attorney's PC, in a review folder, with this request typed in:
"Walk me through my waiting review questions."

1. On the attorney's PC, create a folder used only for answering review
   questions, for example `C:\Users\<user>\Review`. Put a `CLAUDE.md` in it
   with the rules Claude follows for the walk-through. For example: read the
   waiting questions with `review_open_items`, take them one at a time with
   their options as written, and record an answer with `review_record_answer`
   only after the attorney picks one. Do not use the section 8 working folder
   that holds the token scripts. Claude Code reaches the hub from this folder
   because the hub is registered at user scope (section 8, step 3).
2. Add one line to the notice's environment file. Write the folder with
   forward slashes. It is a plain value, not an `op://` reference, and
   `op run` passes it through unchanged:

   ```bash
   PRACTICE_REVIEW_NOTICE_CLAUDE_FOLDER="C:/Users/<user>/Review"
   ```

   Forward slashes avoid escaping problems: if the folder is passed as
   `--claude-folder` on the unit's `ExecStart=` instead, systemd treats a
   backslash as the start of an escape. The email shows and links the folder
   with backslashes either way. The notice fails at start-up, before it claims
   the day, if the folder is not one the link can open: it must be an absolute
   Windows path, with no `.` or `..` segment and no invisible or control
   characters.
3. Send one notice and click the link on the PC. A notice goes out only when
   at least one question waits; if the run prints `nothing-waiting`, there is
   no email and nothing to click. If today's notice already went out, release
   the claim with the `rm` command above and start the service again. Skip
   the Sent Items check in that procedure: this second email is intentional.
   The first click asks once whether Outlook or the browser may open Claude
   Code: allow it. The first time Claude Code opens in the folder, it asks
   whether to trust the folder: trust it. Before pressing Enter, check that
   the request reads exactly "Walk me through my waiting review questions."
   If it reads anything else, close Claude Code without pressing Enter: a
   forged email could open the same trusted folder with a different request.

   If clicking the link does nothing, Claude Code has not registered its
   link handler on the PC yet. It registers the handler
   (`HKEY_CURRENT_USER\Software\Classes\claude-cli`) only after the first
   prompt is sent in an interactive session; the `claude mcp` commands in
   section 8 do not register it. On the PC, start `claude` in a terminal,
   send any prompt, exit, and click the link again. If it still does nothing,
   check that `disableDeepLinkRegistration` is not set in the user's
   `settings.json` or in managed settings, because it blocks the handler.

The link types the request into Claude Code but does not send it. As the
email says, the attorney checks that the request reads exactly as above and
then presses Enter; anything else means close Claude Code without pressing
Enter. If the link
does not open, for example because the mail client blocks links that are not
web addresses or the handler is not registered yet (step 3), the email's last
sentence names the folder to open Claude Code in and the request to type.

The journal line stays count-only: the folder and the link appear only in the
email. To turn the link off, delete the line from the environment file. The
next notice is plain text again; no reload is needed, because the service
reads the file on every run.

## 7. Verify

On the workstation, a request without credentials gets 403, including one
that forges an allowed `Tailscale-User-Login`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:<port>/mcp \
  -H 'Tailscale-User-Login: <attorney-login>'
```

From the attorney's device, signed in to the tailnet as an allowed login, an
MCP discover through `tailscale serve` succeeds when its independent bearer
credential is supplied too. For the curl probe, provision an owner-only
`hub-auth.headers` file containing the Authorization header using your approved
secret tool; never put the token in shell history or an argument. Save the request body as
`discover.json`:

```json
{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"curl","version":"0.0.0"}}}}
```

```bash
curl -s https://<workstation>.<tailnet>.ts.net:8787/mcp \
  -H @hub-auth.headers \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: server/discover' \
  --data-binary @discover.json
```

The answer is HTTP 200 with `"supportedVersions":["2026-07-28"]` and the
server name `practice-review-hub`. On Windows run the same command as
`curl.exe`, one line. The same request from a device signed in as any other
login, the operator's own devices included, gets 403.
Under the interim identity in section 4, the operator's devices share the allowed login
and get 200 instead.

The hub tolerates in-progress appends: a last line that has no line break yet
is left for the next read, so docket intake can store questions while the hub
reads them.

## 8. Connect Claude Code on the attorney's Windows device

Claude Code sends the bearer token through a `headersHelper`: a command it runs
on every connection, whose output is a JSON object of headers. The token stays
in a DPAPI (CurrentUser) file, so it never sits in `.claude.json`, in shell
history or in a command line. The sample scripts are in
`apps/practice-review-hub/deploy/windows/`. On Windows, Claude Code runs the
helper through `cmd.exe`.

1. Copy `headers.ps1` to `%LOCALAPPDATA%\beep\practice-review-hub\` on the
   device, and copy `receive-token.ps1` and `send-token.ps1` to a working
   folder there. In `headers.ps1`, replace `REPLACE_WITH_HUB_URL` with exactly
   the `url` registered in step 3, port and `/mcp` included, for example
   `https://<workstation>.<tailnet>.ts.net:8787/mcp`. The helper answers only
   when Claude Code asks for that URL, so Claude Code does not send the token
   to another server through it. DPAPI ties the file to the Windows user, not
   to Claude Code: any program running as that user can decrypt it.
2. Store the token. The receiver must run in the attorney's desktop session,
   because an SSH session may not be able to use DPAPI. From an SSH session on
   the device, start it as a one-shot interactive task with a new random pipe
   name, and keep the name:

   ```powershell
   $pipe = "beep-hub-" + [guid]::NewGuid().ToString("N")
   schtasks /create /f /tn beep-hub-token /sc once /st 23:59 /it /tr "powershell.exe -NoProfile -ExecutionPolicy Bypass -File <folder>\receive-token.ps1 -PipeName $pipe"
   schtasks /run /tn beep-hub-token
   $pipe
   ```

   The receiver writes `%LOCALAPPDATA%\beep\practice-review-hub\api-token.dpapi`
   (the path `headers.ps1` reads) and reports to `<folder>\status-recv.txt`,
   which it clears on start (its first line is `starting`). The pipe accepts
   only that Windows user. Send only once the last line is `listening`; a line
   that begins `error:` means stop. If another user created a pipe with that
   name first, the receiver fails with an `error:` line and never reports
   `listening`. The sender also checks the owner SID of the actual connected
   pipe before it reads or writes token bytes. Sender and receiver must run as
   the same Windows user. Expiration or replacement by another user fails
   closed; a readiness check alone does not authenticate the receiver.
   Then send the token from the workstation on SSH standard input:

   ```bash
   op read -n 'op://<vault>/<item>/<field>' \
     | ssh <user>@<device> 'powershell -NoProfile -ExecutionPolicy Bypass -File <folder>\send-token.ps1 -PipeName <pipe>'
   ```

   The status file then reports the token length and the first 12 hex
   characters of its SHA-256. Compare them with
   `op read -n 'op://<vault>/<item>/<field>' | sha256sum`, then remove the task
   with `schtasks /delete /tn beep-hub-token /f`.
3. Register the hub at user scope with the helper and no static `headers`. In
   Windows PowerShell 5.1, escape the JSON's double quotes as `\"`: it drops
   unescaped inner quotes when it calls a native command.

   ```powershell
   claude mcp add-json -s user practice-review-hub '{\"type\":\"http\",\"url\":\"https://<workstation>.<tailnet>.ts.net:8787/mcp\",\"headersHelper\":\"powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/Users/<user>/AppData/Local/beep/practice-review-hub/headers.ps1\"}'
   ```

4. `claude mcp get practice-review-hub` reports `Connected`. Check for leaks
   without typing the token: this reads it from the DPAPI file into a variable
   and must print nothing.

   ```powershell
   Add-Type -AssemblyName System.Security
   $t = [Text.Encoding]::ASCII.GetString([Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes("$env:LOCALAPPDATA\beep\practice-review-hub\api-token.dpapi"), $null, 'CurrentUser'))
   Select-String -SimpleMatch -Pattern $t -Path $HOME\.claude.json, (Get-PSReadLineOption).HistorySavePath
   Remove-Variable t
   ```

To rotate the token, generate one with letters and digits only (or the other
characters section 2 allows), change the 1Password field, restart the hub and
repeat step 2. Nothing in the device's Claude Code configuration changes.
Re-create the section 7 `hub-auth.headers` file too if you keep one.

Claude Desktop's chat does not read this registration. It would reach the hub
through the practice gateway extension, which does not include the hub yet.

## 9. Upgrade

The hub runs from the practice-services deploy checkout, so upgrade it with
the practice services ([practice services](practice-services.md), section 4),
stopping and starting the hub with them:

```bash
systemctl --user stop practice-review-hub.service
# fetch and check out the new commit in the deploy checkout, then bun install --frozen-lockfile
systemctl --user start practice-review-hub.service
```

The notice needs no restart: each run starts from the checkout as it is.
For a rollback to another revision that enforces the independent credential,
use the same stop/update/start sequence. When rolling back to a revision before
this authentication fix, keep `practice-review-hub.service` stopped: restarting
that revision restores the vulnerable header-only authorization boundary.

## 10. Remove

```bash
systemctl --user disable --now practice-review-notice.timer practice-review-hub.service
tailscale serve --https=8787 off
rm $HOME/.config/systemd/user/practice-review-hub.service \
  $HOME/.config/systemd/user/practice-review-notice.service \
  $HOME/.config/systemd/user/practice-review-notice.timer
systemctl --user daemon-reload
```

`tailscale serve --https=8787 off` removes the hub's listener from the example
installation. If you selected a different HTTPS port, use that port here.
Inspect `tailscale serve status` first and preserve listeners used by other services.
Remove `DOCKET_INTAKE_REVIEW_HUB_DIR` from the docket intake environment file
and restart `docket-intake.service`. Keep `<data-dir>`: it holds the verdicts
and answers.
