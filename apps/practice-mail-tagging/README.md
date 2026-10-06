# @beep/practice-mail-tagging

Command line of the practice mail-tagging job. It tags the attorney's Outlook
mailbox with one category per matter and files attachments from routable
senders into the matter's Box folders. The work itself lives in
`@beep/law-practice-server/MailTagging`; this app reads settings, wires the
Microsoft 365, Box, and knowledge-graph drivers, and runs passes.

Operating instructions, including the first-run sequence:
[`docs/runbooks/practice-mail-tagging.md`](../../docs/runbooks/practice-mail-tagging.md).

## Commands

Run from the repository root with `bun run apps/practice-mail-tagging/src/bin.ts <command>`.

| Command | What it does |
| --- | --- |
| `report` | Counts the ledgers and the checkpoint. Calls no provider and needs only the state directory. |
| `dry-run [--since <instant>] [--max-pages <n>]` | One pass that reads, decides, and reports. Writes nothing. |
| `apply --yes [--since <instant>] [--max-pages <n>]` | One pass that writes categories and files attachments. Refuses without `--yes`. |
| `watch --yes [--max-passes <n>] [--since <instant>] [--max-pages <n>]` | An `apply` pass every poll interval until stopped. Refuses without `--yes`. |
| `undo --run <runId> [--dry-run] [--yes]` | Removes the categories one run added. Needs `--yes` unless `--dry-run`. |

`apply`, `watch`, and `undo` without `--dry-run` hold a lock file,
`writer.lock`, in the state directory until they exit, so only one writer
uses a state directory at a time. A lock left by a writer that crashed is taken over: the lock records the boot id and the process start time, so a reused process id never keeps it.
`dry-run`, `undo --dry-run`, and `report` take no lock.

`--since` only matters before the first checkpoint exists; after that a pass
resumes from the checkpoint. Run ids are generated per pass and read
`tag-20260701T093000123Z` (or `undo-…`).

## Output

`report`, `dry-run`, `apply`, and `undo` print one JSON line on standard
output, then the same counts as a table. The JSON line is first, so
`… | head -n 1 | jq .` reads it. Everything is counts: no subject, sender, or
file name is ever printed.

A run report lists adds per category, and matter categories carry the matter
key (`M: <client>.<family>`). That is intended on the terminal of an attended
run. `watch` is the command that runs under systemd, so it prints no report:
it logs totals only (run id, scanned, matched, categories added, attachments
filed), and failures as a kind, a source tag, and status text. Logs go to
standard error.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | The command finished. |
| 1 | It failed: a missing or invalid setting, an unusable private file, a provider or state error, a usage error. |
| 2 | Refused: a writing command ran without `--yes`. |
| 3 | A provider throttled the job (Graph or Box rate limit or quota). `watch` stops; it does not retry. |
| 4 | Another writer holds the state directory (`writer.lock`). The message names the lock path and the holder's process id. |
| 130 | Interrupted. |

## Settings

[`.env.example`](.env.example) lists every variable. Settings under
`PRACTICE_MAIL_TAGGING_` belong to this app. The Microsoft 365 credential
uses the `CLOUD_M365_DOCKET_*` names of the docket-intake registration, and
Box uses `DMS_BOX_*` (client credentials grant) or `CLOUD_BOX_TOKEN`.
Secrets are read as redacted values and are never logged.

Double-quote any value that contains a space or a backslash. The file is read
by systemd's `EnvironmentFile=` and by `set -a; . file`, and only a
double-quoted value reads the same in both. The one-line PEM key in
`CLOUD_M365_DOCKET_CERT_PRIVATE_KEY` (line breaks written as `\n`) must be
quoted: unquoted, systemd turns `\n` into `n`.

`PRACTICE_MAIL_TAGGING_CONTACT_EVIDENCE` decides whether a sender or
recipient address can tie mail to a matter. It is `off` by default: the job
matches on application, patent, and docket numbers only and files only USPTO
mail. `kg` adds the addresses the practice knowledge graph resolves `unique`
to one matter (the attorney's own records link the address's single contact
to that matter alone; role mailboxes and the practice's own addresses never
count), then the optional `matter-contacts.json` overlay in the state
directory. `kg` needs a bundle of store format 4 or later; an older bundle
stops the pass. Turn it on only after the attorney has spot-checked a `kg`
dry run.

## Development

```bash
bun run check
bun run test
bun run coverage
bun run lint
```

Tests use an in-memory filesystem, a fake mailbox, and stub drivers. Nothing
in them reaches Microsoft 365, Box, or a real knowledge-graph bundle.

This workspace is a runtime app, not a public TypeScript package. Keep app internals behind `@/*`; promote reusable contracts and domain code to slice or shared packages.

## License

MIT
