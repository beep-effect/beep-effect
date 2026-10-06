# @beep/docket-intake

The docket intake service. It watches one mailbox and makes sure every
deadline that arrives by mail ends up on the attorney's calendar as a
tentative entry.

For each new message:

1. A paralegal agent decides whether the message carries a deadline or a
   required action with a date, and enters what the message states.
2. A secretary agent reviews that entry and reads the mail date and the
   response period for itself, from the attached PDF when there is one.
3. The pipeline works out the due date from what the two agents read. It never
   guesses a date. When the two dates differ it uses the earlier one and says
   so on the entry. When there is no usable date it writes a needs-review
   entry instead.
4. The entries go on the calendar as all-day events with a `Docket - *`
   category, and the message gets the `Docket - entered` category.

Every calendar entry carries an idempotency key, so processing a message again
creates nothing new. The service adds `Docket - *` categories only, and it
keeps every other category on a message as it found it.

The pipeline lives in `@beep/law-practice-use-cases/DocketIntake` and its live
adapters in `@beep/law-practice-server/DocketIntake`. This app only reads the
configuration, wires the layers and runs the commands.

## Commands

```bash
bun run src/bin.ts poll                        # one cycle, then exit
bun run src/bin.ts run --interval-minutes 5    # repeat forever
bun run src/bin.ts smoke                       # read-only connection check
bun run src/bin.ts smoke --write               # also create, find and delete one test event
```

- `poll` reads new mail, processes it, and writes yesterday's digest if it has
  not been written. The digest is a calendar entry (when there was anything to
  report) and a file under `digests/` in the state directory.
- `run` repeats `poll` on a fixed interval. A cycle that fails is logged with
  the stage that failed, and the loop goes on to the next cycle.
- `smoke` lists one page of messages and the master categories and prints
  counts. With `--write` it also creates one all-day event tomorrow with the
  subject `[beep live smoke] safe to delete`, finds it by its key and deletes
  it. Each step prints `PASS` or `FAIL` with ids and counts only.

Logs carry ids, counts and stage names. They never carry subjects, senders,
bodies or attachment names.

## Configuration

All settings come from the environment.

| Variable | Required | Meaning |
| --- | --- | --- |
| `DOCKET_INTAKE_TENANT_ID` | yes | Entra tenant id. |
| `DOCKET_INTAKE_CLIENT_ID` | yes | Entra application id. |
| `DOCKET_INTAKE_CERT_THUMBPRINT_SHA256` | yes | Hex SHA-256 thumbprint of the registered certificate. |
| `DOCKET_INTAKE_CERT_PRIVATE_KEY` | yes | Private key of that certificate, in PEM form. Never printed. |
| `DOCKET_INTAKE_MAILBOX` | yes | User id or address of the watched mailbox. |
| `DOCKET_INTAKE_TIME_ZONE` | yes | IANA time zone of the practice, for example `America/Chicago`. There is no default. |
| `DOCKET_INTAKE_START_AT` | no | UTC ISO-8601 time to start reading from on a first run. Defaults to the time of the first run. |
| `DOCKET_INTAKE_STATE_DIR` | no | State directory. Defaults to `$XDG_STATE_HOME/beep/docket-intake`, else `~/.local/state/beep/docket-intake`. |
| `DOCKET_INTAKE_REVIEW_NEGATIVES` | no | Whether the secretary also reviews messages the paralegal found nothing in. Defaults to `true`. |
| `AI_ANTHROPIC_API_KEY` | yes for `poll` and `run` | Key for the model both agents use. |
| `AI_ANTHROPIC_MODEL` | no | Model id; the Anthropic driver's default applies when unset. |

A missing or invalid required setting stops the command before it touches the
mailbox, and the error names the variable.

The start time is saved in the state file on the first run, so a restart
continues from where the service left off. Each poll re-reads a two-hour
window behind its cursor to catch mail that arrives late, so the first poll
also reads the two hours before the start time.

### Secrets

Keep the values in 1Password and give the service references, not values. An
env file for `op run` looks like this:

```dotenv
DOCKET_INTAKE_TENANT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_TENANT_ID"
DOCKET_INTAKE_CLIENT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CLIENT_ID"
DOCKET_INTAKE_CERT_THUMBPRINT_SHA256="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256"
DOCKET_INTAKE_CERT_PRIVATE_KEY="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CERT_PRIVATE_KEY"
DOCKET_INTAKE_MAILBOX="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_MAILBOX"
DOCKET_INTAKE_TIME_ZONE="America/Chicago"
AI_ANTHROPIC_API_KEY="op://beep-dev-secrets/beep-ai/AI_ANTHROPIC_API_KEY"
```

Check the references resolve, then launch through the same wrapper:

```bash
op run --env-file=<path> -- true >/dev/null
op run --env-file=<path> -- bun run apps/docket-intake/src/bin.ts smoke
op run --env-file=<path> -- bun run apps/docket-intake/src/bin.ts run
```

## Running as a user service

A sample systemd user unit. Replace the three placeholders, save it as
`~/.config/systemd/user/docket-intake.service`, then run
`systemctl --user daemon-reload` and
`systemctl --user enable --now docket-intake.service`.

```ini
[Unit]
Description=Docket intake service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=<repo checkout>
ExecStart=<path to op> run --env-file=<env file> -- <path to bun> run apps/docket-intake/src/bin.ts run
Restart=on-failure
RestartSec=60

[Install]
WantedBy=default.target
```

`journalctl --user -u docket-intake.service` shows the cycle counts.

## Matter lookup

The practice knowledge-graph lookup is not wired in yet. Until it is, every
entry is written with the `matter-lookup-failed` flag, which tells the
attorney the matter was not resolved.

## Development

```bash
bun run check
bun run test
bun run lint
```

This workspace is a runtime app, not a public TypeScript package. Keep app
internals behind `@/*`; reusable contracts belong in the law-practice packages.

## License

MIT
