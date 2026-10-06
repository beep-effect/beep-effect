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
   entry instead. It looks the matter up in the practice knowledge graph and,
   when configured, checks the date against the attorney's docket sheet.
4. The entries go on the calendar as all-day events with a `Docket - *`
   category, and the message gets the `Docket - entered` category.

Mail in Sent Items, Drafts and Outbox is ignored. Mail in Junk Email and
Deleted Items is processed like any other, and an entry written for it says
which of the two folders it was found in.

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

- `poll` reads new mail, processes it, and writes every digest that is owed:
  one for each day that is over and not digested yet, earliest first. After
  an outage the missed days each get their own digest (at most 62 per cycle;
  the next cycles write the rest). A digest is a calendar entry (when there
  was anything to report) and a file under `digests/` in the state directory.
- `run` repeats `poll` on a fixed interval. A cycle that fails is logged with
  the stage that failed and the number of failures in a row, and the loop goes
  on to the next cycle. A cycle that succeeds resets that number. When
  `DOCKET_INTAKE_MAX_CONSECUTIVE_FAILURES` cycles in a row have failed, the
  command exits non-zero so its supervisor can restart it and raise an alert.
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
| `DOCKET_INTAKE_MAX_CONSECUTIVE_FAILURES` | no | Poll cycles that may fail in a row before `run` exits non-zero. A positive whole number. Defaults to `6`, which is thirty minutes at the default interval. |
| `DOCKET_INTAKE_REVIEW_NEGATIVES` | no | Whether the secretary also reviews messages the paralegal found nothing in. Defaults to `true`. |
| `DOCKET_INTAKE_REVIEW_MAX_ROUNDS` | no | Rounds of review, from `1` to `10`, after which an item that was not accepted is flagged. A whole number. Defaults to `3`. |
| `DOCKET_INTAKE_REVIEW_ACCEPT_THRESHOLD` | no | Confidence score, from `0` to `1`, a review round must reach for an item to be accepted. Defaults to `0.85`. |
| `DOCKET_INTAKE_KG_BUNDLE_DIR` | no | Directory of the practice knowledge-graph bundle used for the matter lookup. Unset: no lookup, and every entry is flagged `matter-lookup-failed`. |
| `DOCKET_INTAKE_DOCKET_SHEET_CSV` | no | CSV export of the attorney's docket sheet to cross-check dates against. Unset: no cross-check and no flag. |
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

`Restart=on-failure` brings the service back after it exits, including when it
gives up after too many failed cycles in a row. A restart alone tells nobody,
so pair it with `OnFailure=` in the `[Unit]` section, naming a unit of your own
that sends the alert you want, for example
`OnFailure=docket-intake-alert.service`. systemd starts that unit each time the
service enters the failed state. Add `StartLimitIntervalSec=` and
`StartLimitBurst=` there too if a service that keeps failing should stop
restarting and stay failed until someone looks.

Only one process may use a state directory. The service holds `state.lock`
there while it runs and a second copy refuses to start. A lock left behind by
a process that was killed is taken over on the next start, so no cleanup is
needed after a crash or a reboot.

## What lands in Docket - needs review

Each docket item is reviewed in rounds: the paralegal agent enters it, the
secretary agent reads the source for itself and criticises the entry, and the
paralegal revises or defends what is disputed. An item is accepted, and gets
its `[UNVERIFIED]` entry and reminders, only when the automatic checks pass
and the confidence score reaches the threshold. The score is half "the
secretary has no serious objection left" and half "the share of fields the two
agents read the same way"; the agents' own statements of confidence are shown
but not counted.

Both agents read a due date the source states outright, each for itself, and
neither works one out. When the source states one due date while its own mail
date and response period give another, the item is not accepted: the entry
goes on the earlier of the two and shows both.

An item that is not accepted is never entered as a deadline and never
dropped. It gets one entry in the category `Docket - needs review`, with no
reminders, on the earliest date either agent read (or the day after receipt
when neither read one). The body gives the score, the threshold, the rounds
used, what is still open, and a link to the message. Nothing on such an entry
is confirmed. The subject says why it is there:

| Subject starts with | Meaning | What to do |
| --- | --- | --- |
| `[LOW CONFIDENCE]` | The round limit was reached with the score under the threshold. The agents still read some fields differently, but no serious objection is open and no single field stayed in dispute through every round. | Open the message, read the dates and the matter yourself, and enter the deadline by hand. The body lists the fields the agents differ on. |
| `[REVIEW LIMIT REACHED]` | The round limit was reached with a serious objection still open, or with the agents disagreeing on the same field in every round. | Treat it as a standing dispute about the item: read the listed objection first, then the message, and enter the deadline by hand. |
| `[CHECK FAILED]` | An automatic check still failed on the last round: a due date that does not match the mail date plus the period, a due date before the mail date, or a date or period that is not in the text the agent that reported it quoted. | Do not rely on the dates on the entry. Read the source document and enter the deadline by hand. |

`[NEEDS REVIEW]` entries are the older cases: no usable date was found, the
agents disagree on whether the message is a docket item at all, or the
message could not be processed.

## Matter lookup

With `DOCKET_INTAKE_KG_BUNDLE_DIR` set, every reference the two agents copied
from the message is looked up in the practice knowledge-graph bundle. The
current bundle is
`~/data-home/oppold-corpus/staging/practice-kg-bundle-2026-10-06-03`. The
service reads only `bundle.manifest.json` and `practice.duckdb`, opened
read-only, so it runs beside the practice-KG host; it never opens `kg.pglite`.
It refuses to start when the directory, the manifest or the database is
missing, or when the bundle's DuckDB store format is not `3`.

What the entry says about the matter:

| Result | Flag | Entry line |
| --- | --- | --- |
| One matter, with a client and not resting on a recycle-bin stub | none | `Matter: family …` with the client, its name, dockets and numbers |
| One matter without a client, on a recycle-bin stub, or matched on the bare family number only | `matter-unverified` | the same, marked `unverified; needs attorney` |
| Several matters | `matter-ambiguous` | `Matter: ambiguous between …; needs attorney` |
| No matter owns the number, but the documents of some matters cite it | `matter-suggested` | `Matter: not attached in the records; suggested candidates: …; needs attorney` |
| Nothing | `matter-not-found` | `Matter: not found in the practice records; needs attorney` |
| The lookup failed, or no bundle is configured | `matter-lookup-failed` | `Matter: lookup unavailable; needs attorney` |

The attorney's own `<client>.<0NNNN>` matter number is never looked up as a
docket family, and a bare client number names no matter.

## Docket sheet cross-check

With `DOCKET_INTAKE_DOCKET_SHEET_CSV` set, the service compares each entry
with the tracked dates on the attorney's docket sheet. It reads a CSV export
of the sheet, never the spreadsheet itself, and it never writes to the sheet.
To make the export, open the sheet and choose File > Save As > CSV UTF-8, and
save it at the configured path. Export again after editing the sheet; the
service reads the file again when it changes.

The sheet is asked about the dockets of a uniquely found matter (only those
the message named, when it named any) and every docket the message itself
names. Only `Due Date` and `Final Date` rows dated no more than a week before
the message arrived count. When there is one, the entry goes on the earliest
of the email's date and the sheet's date, the body shows
`Docket sheet: <date> (<Date Type>: <Tracked Date Name>)`, and a difference
is flagged `tracked-date-differs`. The sheet can move an entry earlier and add
a flag; it never accepts a flagged item or clears a flag. A sheet that cannot
be read is flagged `tracked-dates-unavailable` and the entry is written all
the same.

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
