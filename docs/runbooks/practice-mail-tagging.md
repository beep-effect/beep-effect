# Practice mail tagging: first run and operation

How to run the mail-tagging job (`apps/practice-mail-tagging`) for the first
time, what its numbers mean, and what to do when it stops.

The job reads the attorney's mailbox, matches each message to a matter through
the practice knowledge graph, adds one Outlook category per matched matter,
and files attachments from routable senders into the matter's Box folders. It
never moves, deletes, or flags mail. The only mailbox change is adding
categories, and `undo` takes them back.

Every command below runs from the repository root:

```bash
bun run apps/practice-mail-tagging/src/bin.ts <command>
```

The examples shorten that to `practice-mail-tagging <command>`.

## 1. Prerequisites

1. **Entra registration with mailbox write access.** The job shares the
   docket-intake app registration
   ([docket intake registration](docket-intake-entra-registration.md)). Its
   Exchange role assignments for the attorney's mailbox must include
   `Application Mail.ReadWrite` (read messages and attachments, set a
   message's categories) and `Application MailboxSettings.ReadWrite` (add the
   `M: ...` and `P: ...` names to the mailbox's category list). Without them
   `dry-run` works and `apply` fails on its first write.
2. **The practice knowledge-graph bundle.** A built bundle directory
   containing `practice.duckdb`. The job opens that file read-only.
3. **The Box folder-id map.** The JSON file the Box onboarding run writes: one
   row per provisioned matter with the ids of its two filing folders. A
   matter missing from the map is tagged but its attachments are not filed.
4. **The known-files index.** The JSONL index of files already in Box, also
   from the onboarding run. It stops the job from uploading a document the
   migration already placed.
5. **Box credentials.** The client credentials grant (`DMS_BOX_CLIENT_ID`,
   `DMS_BOX_CLIENT_SECRET`, and one of `DMS_BOX_ENTERPRISE_ID` or
   `DMS_BOX_USER_ID`). A developer token (`CLOUD_BOX_TOKEN`) lasts about an
   hour: enough for one attended run, not for the watch loop.
6. **The environment file.** Copy
   [`apps/practice-mail-tagging/.env.example`](../../apps/practice-mail-tagging/.env.example)
   to a private location outside the repository, mode `0600`, and fill it in.
   It is the same file the docket-intake service reads. The four paths in
   items 2 to 4, plus the Box call ledger path, have no default: the job
   fails at start when one is missing.

Optional: `matter-contacts.json` in the state directory, an attorney-curated
list of contact addresses and domains per matter. Without it the job matches
on application, patent, and docket numbers only, and files only USPTO mail.

Load the environment for an attended shell session:

```bash
set -a; . /path/to/the/shared.env; set +a
```

## 2. First-run sequence

Do these in order. Do not enable the unit before step 6.

1. **Report.** Confirms the state directory is readable and shows what
   exists. On a new install every count is zero.

   ```bash
   practice-mail-tagging report
   ```

2. **Dry run.** Reads the mailbox from 2026-07-01 (or
   `PRACTICE_MAIL_TAGGING_SINCE`), decides every message, and prints counts.
   It writes nothing: no category, no ledger line, no checkpoint, no upload.
   Bound the first one:

   ```bash
   practice-mail-tagging dry-run --max-pages 4
   ```

   Then run it unbounded and keep the JSON line; that is the record for
   `goals/practice-mail-tagging/history/`.

3. **Attorney spot-check of the counts.** Go through the report with the
   attorney before anything is written. See [what each count means](#3-what-each-count-means).
   The questions are: is `matched` plausible for the period, and do the
   per-category adds name the matters he expects mail for? A matter with a
   surprising count is checked in Outlook by searching for its application or
   docket number. Stop here if the numbers look wrong.

4. **Attended apply on a bounded slice.** The attorney is present and Outlook
   is open.

   ```bash
   practice-mail-tagging apply --yes --max-pages 2
   ```

   Note the `run` id in the output. Look at a few tagged messages in Outlook.
   The checkpoint now records how far the job got, so the next pass continues
   from there.

5. **Undo drill on that run.** Prove the way back works before trusting the
   job with the whole mailbox.

   ```bash
   practice-mail-tagging undo --run <runId> --dry-run
   practice-mail-tagging undo --run <runId> --yes
   practice-mail-tagging report
   ```

   The dry run shows what would be removed. After the real undo, the tagged
   messages have their earlier categories back and `report` shows the entries
   under `undone`.

   An undone message is settled: the job skips it from then on and counts it
   as `undone skipped`. Tagging it again is a deliberate later operation, not
   something the next pass does. Pick a small run for the drill for that
   reason.

6. **Finish the backfill, then enable the unit.** Run `apply --yes` without a
   page bound, attended, until `scanned` reaches the end of the mailbox. Then
   install the sample unit by hand:

   ```bash
   cp apps/practice-mail-tagging/deploy/practice-mail-tagging.service ~/.config/systemd/user/
   # edit the three REPLACE_ values in the copy
   systemctl --user daemon-reload
   systemctl --user enable --now practice-mail-tagging.service
   journalctl --user -u practice-mail-tagging.service -f
   ```

   Nothing in the repository installs or starts this unit.

## 3. What each count means

Run report (`dry-run`, `apply`):

| Count | Meaning |
| --- | --- |
| `scanned` | Messages read in this pass. |
| `matched` | Messages matched to exactly one matter with enough evidence. |
| `unmatched no-signal` | No matter identifier or known contact. These get no category. |
| `unmatched below-threshold` | Some evidence, not enough. Tagged `P: Unmatched - review`. |
| `unmatched ambiguous` | Two matters too close to call. Tagged `P: Unmatched - review`. |
| `unmatched needs-attorney` | Refers to a matter that cannot be tagged safely (no client number, or an unverified recycled number). Tagged `P: Unmatched - review`. |
| `already tagged` | The ledger covers the message and its categories are present. |
| `undone skipped` | An undo settled the message; it is not decided again. |
| `repaired` | The ledger had the message but a category was missing after an interrupted write; written again. |
| `added <category>` | Messages that received that category in this pass. |
| `attachments filed` | Files uploaded to Box. |
| `attachments deduped` | Same content already filed for the matter, or already in Box per the known-files index. |
| `attachments reconciled` | An earlier interrupted upload was found and recorded as done. |
| `attachments skipped <reason>` | Not filed: `inline` image, `not-a-file` item, `empty` part, `too-large`, `no-folder` (matter not in the folder-id map), `sender-not-routable` (neither USPTO nor a known contact of that matter). |
| `wrote` | Whether the pass changed anything. Always `false` for a dry run. |

State report (`report`):

| Count | Meaning |
| --- | --- |
| `tagged` | Ledger entries still in force. |
| `undone` | Ledger entries an undo retired. |
| `filed` | Attachments recorded as stored in Box. |
| `pending intents` | Uploads that were started and have no completion line yet. |
| `abandoned` | Upload attempts given up because the file name was taken; the attachment was then stored under a name with a short hash. |
| `processed` | Messages the checkpoint has passed. |
| `last checkpoint` | Received time of the last checkpointed message. |

## 4. How undo works, and what it does not do

`undo --run <runId>` reads the tag ledger, and for each entry of that run
removes only the categories the run added that are still on the message.
Categories the attorney added, categories from another run, and categories
from the docket service stay. A message that no longer exists is counted as
`messages missing` and retired. A second undo of the same run finds nothing.

Undo does **not** un-file documents. The job has no way to delete from Box, by
design. To reverse a filing, read `filing-ledger.jsonl` in the state
directory: each completed line gives the run id, the Box folder id, the file
id, and the stored name. A person moves or removes those files in Box.

## 5. The Box call ledger

Box usage is not visible in the admin console on this plan, so every
workstream writes its call count to one shared private file
(`PRACTICE_MAIL_TAGGING_BOX_CALL_LEDGER_PATH`). A pass that called Box appends
one line when it ends, also when it failed:

```json
{"workstream":"email-tagging","runLabel":"practice-mail-tagging:tag-20260701T093000123Z","calls":3,"at":"2026-07-01T09:30:04.000Z","exact":true}
```

The label is the configured prefix, a colon, and the pass's run id, so a line
can be joined to the tag and filing ledgers. A pass with no Box call writes no
line. A dry run uploads nothing and therefore writes none.

## 6. Failure modes

| What you see | What happened | What to do |
| --- | --- | --- |
| Exit code 3, `kind=throttled` | Graph or Box refused with a rate limit or quota response. The pass stopped; `watch` exited and systemd does not restart it. | Wait. Check the Box call ledger against the monthly ceiling. Start the unit again by hand when the limit has cleared. Do not loop it. |
| Exit code 2 | A writing command ran without `--yes`. | Add `--yes` when the write is intended. |
| `MailTaggingStateError`, `matter-folders` or `known-documents` | The folder-id map or the known-files index is missing or does not decode. The pass stops before reading any message. | Regenerate the file with the Box onboarding run, or fix the path in the environment file. |
| `MailTaggingStateError`, `matter-contacts` | The contacts overlay exists and has an invalid row. | Fix or remove `matter-contacts.json`. |
| `ConfigError` naming a variable | A required setting is missing or invalid. | Fix the environment file. |
| `watch` logs `mail-tagging pass failed` and keeps running | A pass failed for another reason (network, a provider error). | Nothing at once: the next attempt comes after the poll interval, then twice that, up to `PRACTICE_MAIL_TAGGING_MAX_BACKOFF`. Investigate if it repeats. |
| `Mailbox.setCategories` failure after a retry | Someone changed the message's categories twice while the job was writing. The job retries a stale write once from a fresh read and never overwrites. | The next pass repairs the message (`repaired`). |
| `pending intents` above zero in `report` | An upload was interrupted. | Run a pass: it retries the upload under the same folder and name. A taken name is abandoned and the file is stored under a short-hash name; a duplicate in Box is possible, a lost attachment is not. |
| `attachments skipped no-folder` grows | Matters are matched that the folder-id map does not list. | Provision those matters through Box onboarding and regenerate the map; the job re-reads it on every pass. |

The folder-id map, the known-files index, and the contacts overlay are read
again at the start of every pass, so a regenerated file takes effect on the
next pass without a restart.

## 7. Stopping and removing

```bash
systemctl --user disable --now practice-mail-tagging.service
rm ~/.config/systemd/user/practice-mail-tagging.service
systemctl --user daemon-reload
```

The state directory (default `~/.local/state/beep/practice-mail-tagging`)
holds the ledgers that make undo possible. Keep it.
