# Docket intake: first live run (operator-attended)

The first time the docket intake service reads the attorney's mailbox and
writes to his calendar, an operator runs it by hand, on a small window, with
the undo command ready. This runbook is that session. It takes about 20
minutes plus model time.

It assumes:

- the Entra registration is done (`docket-intake-entra-registration.md`) and
  the five `CLOUD_M365_DOCKET_*` fields are in 1Password;
- the read and write smoke tests have passed (they did on 2026-10-06);
- the checkout is on `main` with dependencies installed;
- nothing else (no installed `docket-intake.service`) is running against the
  same state directory.

## The bounded window

| Setting | Value | Why |
| --- | --- | --- |
| Start of the window | `2026-10-01T00:00:00Z` | Recent mail only; anything older is out of scope for this run. |
| Messages per run | `10` | Enough to see every outcome type, few enough to check each entry by hand. |
| State directory | `~/.local/state/beep/docket-intake-first-run` | Kept apart from the future service's state, so the first run can be thrown away whole. |

The model runs for every message (two agents, up to three review rounds), so
ten messages cost at most about sixty model calls on the existing API account.

## Environment file

Create it once, outside the repository, readable only by you. It holds
1Password references, not values.

```bash
umask 077 && mkdir -p ~/.config/beep-docket-intake
```

`~/.config/beep-docket-intake/first-run.env`:

```text
DOCKET_INTAKE_TENANT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_TENANT_ID"
DOCKET_INTAKE_CLIENT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CLIENT_ID"
DOCKET_INTAKE_CERT_THUMBPRINT_SHA256="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CERT_THUMBPRINT_SHA256"
DOCKET_INTAKE_CERT_PRIVATE_KEY="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_CERT_PRIVATE_KEY"
DOCKET_INTAKE_MAILBOX="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_M365_DOCKET_MAILBOX"
DOCKET_INTAKE_TIME_ZONE="America/Chicago"
DOCKET_INTAKE_STATE_DIR="/home/<you>/.local/state/beep/docket-intake-first-run"
AI_ANTHROPIC_API_KEY="op://BEEP_SECRETS/BEEP_SECRETS/AI_ANTHROPIC_API_KEY"
```

Check that every reference resolves, with no output:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- true >/dev/null
```

## The run

Every command below is run from the repository root. On standard output,
`smoke` prints `PASS` or `FAIL` lines of text, ending with `PASS smoke` or
`FAIL smoke: …`; `dry-run`, `poll` and `undo` print one JSON line; `runs`
prints one JSON line per run. A command that fails prints no
JSON: it prints `stage <stage>: <cause>` on standard error and exits non-zero.
Logs also go to standard error.

1. **Smoke, read only.** Confirms the connection and the mailbox scope.

   ```bash
   op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts smoke
   ```

2. **Dry run.** Both agents and the review loop run; nothing is written to
   Outlook and the real state is not touched. Read the would-be entries:
   dates, categories, flags.

   ```bash
   op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts dry-run --since 2026-10-01T00:00:00Z --max-messages 10
   ```

   Stop here if any would-be entry is on a date you can see is wrong, or if
   the run fails. Send the JSON line, or on a failure the `stage` line from
   standard error, to the docket intake session.

3. **Live run.** Same window, now writing tentative entries.

   ```bash
   op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts poll --since 2026-10-01T00:00:00Z --max-messages 10
   ```

4. **Note the run id.** The live run's JSON line carries it as `runId`
   (`run-YYYYMMDDTHHMMSSmmmZ`); `runs` lists every run with its counts.

   ```bash
   op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts runs
   ```

## Undo

Removes the calendar entries that run created and the `Docket - entered`
mark it put on messages. An entry is deleted only when every category on it
is one of the service's provisional ones; an entry the attorney changed to or
added `Docket - verified` on, or put in a category of their own, is kept and
reported as kept. Running the same undo again only finishes what an earlier
one left, and a message a later run marked again is left alone.

Use the run id you noted. `--run latest` also works but means the newest run
in the journal, whether or not it has been undone, so the explicit id is safer.

Preview first:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts undo --run <runId> --dry-run
```

Then apply:

```bash
op run --env-file=$HOME/.config/beep-docket-intake/first-run.env -- bun run apps/docket-intake/src/bin.ts undo --run <runId> --yes
```

Undo also clears those messages from the service's ledger and moves its
cursor back, so a later run reads them again. The undo counts appear on the
run's line in `runs`.

To throw the whole first run away afterwards, also remove the state
directory: `rm -r ~/.local/state/beep/docket-intake-first-run`.

## Checklist (one screen)

- [ ] `op run ... -- true` resolves with no output.
- [ ] Smoke prints `PASS smoke`.
- [ ] Dry run: count of would-be entries and needs-review items noted;
      no date looks wrong at a glance.
- [ ] Live run exits 0; JSON line (with `runId`) saved. On a non-zero exit,
      the `stage <stage>: <cause>` line from standard error saved instead.
- [ ] In Outlook (attorney's calendar): each new entry is tentative, in a
      `Docket - *` category, with the source email link in its body.
- [ ] `[UNVERIFIED]` entries: date checked against the linked email.
- [ ] `Docket - needs review` entries: subject prefix matches the reason.
- [ ] Reminder entries sit 30/14/7/1 days before their tentative date.
- [ ] No entry appears for a message that is plainly not a deadline.
- [ ] Run id confirmed with `runs`.
- [ ] Decision: keep the entries (attorney reviews them) or run `undo`.
- [ ] Result line and decision sent to the orchestrator session.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Done. |
| 1 | A step failed. No JSON is printed; standard error carries `stage <stage>: <cause>`. |
| 2 | Refused: a writing command (`undo`) ran without `--yes`. |
| 3 | Graph throttled the run. Wait and run the same command again. |
