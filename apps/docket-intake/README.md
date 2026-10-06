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

Run from the repository root with `bun run apps/docket-intake/src/bin.ts <command>`.

| Command | What it does |
| --- | --- |
| `poll [--since <instant>] [--max-messages <n>]` | One cycle: reads new mail, processes it, writes every digest that is owed, and prints its run id and counts. |
| `run [--interval-minutes <n>] [--since <instant>]` | Repeats `poll` on a fixed interval until it is stopped. Prints nothing; it logs. |
| `dry-run [--since <instant>] [--max-messages <n>]` | One full pass that writes nothing, and prints what it would have written. |
| `runs` | Prints one line per run in the write journal, newest first. Calls no provider. |
| `undo --run <runId> [--dry-run] [--yes]` | Takes back one run's writes. Needs `--yes` unless `--dry-run`. `--run latest` picks the newest run. |
| `smoke [--write]` | Read-only connection check; with `--write` it also creates, finds and deletes one test event. |

- `poll` reads new mail, processes it, and writes every digest that is owed:
  one for each day that is over and not digested yet, earliest first. After
  an outage the missed days each get their own digest (at most 62 per cycle;
  the next cycles write the rest). A digest is a calendar entry (when there
  was anything to report) and a file under `digests/` in the state directory.
  `--max-messages <n>` processes at most `n` pending messages, oldest first.
  The rest stay pending, and the cursor stops before the first one left, so
  the next `poll` picks them up.
- `--since <instant>` (UTC ISO-8601) is where a first run starts reading. It
  overrides `DOCKET_INTAKE_START_AT`, and like it, it only seeds the cursor
  when none is saved; once a cursor exists the flag is ignored.
- `run` repeats `poll` on a fixed interval. A cycle that fails is logged with
  the stage that failed and the number of failures in a row, and the loop goes
  on to the next cycle. A cycle that succeeds resets that number. When
  `DOCKET_INTAKE_MAX_CONSECUTIVE_FAILURES` cycles in a row have failed, the
  command exits non-zero so its supervisor can restart it and raise an alert.
- `dry-run` runs both agents and the review loop, so it costs model calls.
  The calendar and the mailbox only read: building it creates no master
  category, a create is recorded instead of written, and no message is
  marked. It works in its own throwaway state directory, `dry-run/` under the
  state directory, which is emptied at the start. The real `state.json` is
  copied into it first, so the pass previews exactly what the next `poll`
  would do, but the real cursor, ledger, journal and `state.lock` are never
  touched, and it runs while the service runs. No digest is written.
- `undo --run <runId>` reads the run's lines from the journal. Each calendar
  entry the run created or adopted is deleted only if every category it
  carries is one of the service's provisional categories
  (`Docket - unverified`, `Docket - needs review`, `Docket - reminder`,
  `Docket - digest`); an entry with no category, or with `Docket - verified` or a
  category of the attorney's own beside or instead of ours, is kept and
  counted as kept; an entry already deleted counts as gone. `Docket - entered` is taken
  off each message the run marked, and every other category stays; the write
  is conditional on the message's change key and is retried once when the
  message changed in between. The run's messages are removed from the ledger
  and the cursor moves back to the earliest of them, so a later `poll`
  processes them again. Each event and message gets an `undo-` line in the
  journal, so an undo that stopped halfway can be run again: what already has
  a line is not touched again and counts as `alreadyUndone`. A message a later
  run marked again is left alone, with its mark and ledger record, and counts
  as `messagesKept`. Undo needs the
  Graph settings only, not the model key. It holds `state.lock` while it
  writes, so stop the service first; `undo --dry-run` reports the same counts,
  writes nothing and takes no lock.
- `smoke` lists one page of messages and the master categories and prints
  counts. With `--write` it also creates one all-day event tomorrow with the
  subject `[beep live smoke] safe to delete`, finds it by its key and deletes
  it. Each step prints `PASS` or `FAIL` with ids and counts only.

A first run on a real mailbox:

```bash
docket-intake smoke                                   # the connection works
docket-intake dry-run --since 2026-10-01T00:00:00Z --max-messages 5
docket-intake poll --since 2026-10-01T00:00:00Z --max-messages 5
docket-intake runs                                    # note the run id
docket-intake undo --run <runId> --dry-run
docket-intake undo --run <runId> --yes                # the way back works
```

`docket-intake` there stands for `bun run apps/docket-intake/src/bin.ts`.

## The write journal

Every calendar entry the service creates and every message it marks
`Docket - entered` is appended to `journal.jsonl` in the state directory, one
line per write, after the write succeeded:

```json
{"runId":"run-20300109T100000123Z","kind":"event-created","at":"2030-01-09T10:00:01.234Z","eventId":"AAMk…","idempotencyKey":"docket:0f3a…","category":"Docket - unverified"}
{"runId":"run-20300109T100000123Z","kind":"message-marked","at":"2030-01-09T10:00:02.345Z","messageId":"AAMk…","receivedAt":"2030-01-09T09:58:00.000Z"}
```

A run id is minted at the start of every poll cycle, `poll` or each cycle of
`run`: `run-` and the UTC start time to the millisecond. An entry the service
finds already on the calendar by its key is not a write and gets no line when
a journal line already names it; one no line names, left by a cycle that
stopped between the create and its line, gets an `event-adopted` line under
the current run, so `undo` of that run reaches it. A create that timed out but
did land is found by its key and recorded. Lines are
only appended, under `state.lock`, and each append is synced to disk. A final
line a crash left without its line break is cut off when the journal is next
opened for writing, so the next line starts cleanly. If a
line cannot be written the cycle stops with an error rather than leave a
write that `undo` could not find. An undo adds `undo-event-deleted`,
`undo-event-kept`, `undo-event-gone`, `undo-message-unmarked` and
`undo-message-gone` lines under the undone run's id.

## Output and exit codes

`poll`, `dry-run`, `runs` and `undo` print JSON lines on standard output;
logs go to standard error, so `… | head -n 1 | jq .` reads a report. Output is
ids, dates, categories and counts. It never carries the text, sender or
subject of a mail message. A `dry-run` entry carries the subject the service
would write on the calendar entry.

| Command | Line |
| --- | --- |
| `poll` | `runId`, `seen`, `processed`, `entered`, `needsReview`, `notDocket`, `failed`. |
| `dry-run` | The same counts, `dryRun: true`, and `entries`: one `{ messageId, kind, category, date, flags, subject }` per entry it would create. |
| `runs` | One line per run: `runId`, `startedAt`, `eventsCreated`, `messagesMarked`, and what undos did: `eventsDeleted`, `eventsKept`, `eventsGone`, `messagesUnmarked`, `messagesGone`, and `eventsAdopted`: events the run found by key that no journal line named, such as one a crashed cycle created. |
| `undo` | `runId`, `dryRun`, `deleted`, `kept`, `gone`, `unmarked`, `messagesGone`, `ledgerCleared`, `messagesKept` (a later run marked them again) and `alreadyUndone` (an earlier undo of the run handled them). |

| Code | Meaning |
| --- | --- |
| 0 | The command finished. |
| 1 | It failed: a missing or invalid setting, a state or journal error, a run id the journal does not have, a Graph or model error. |
| 2 | Refused: `undo` ran without `--yes` or `--dry-run`. Nothing was read or written. |
| 3 | Microsoft Graph throttled the command. |

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
| `AI_ANTHROPIC_API_KEY` | yes for `poll`, `run` and `dry-run` | Key for the model both agents use. |
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
AI_ANTHROPIC_API_KEY="op://BEEP_SECRETS/BEEP_SECRETS/AI_ANTHROPIC_API_KEY"
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
there while it runs and a second copy refuses to start; so does `undo --yes`,
so stop the unit before an undo and start it again afterwards. A lock left behind by
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
