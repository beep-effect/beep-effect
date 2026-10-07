---
"@beep/docket-intake": minor
"@beep/law-practice-server": minor
"@beep/law-practice-use-cases": minor
---

Add first-run tooling to the docket intake service. Every calendar entry it
creates and every message it marks is appended to a write journal
(`journal.jsonl`) under a per-cycle run id. New commands: `dry-run` runs one
full pass over a throwaway copy of the state and writes nothing, `runs` lists
the journal's runs, and `undo --run <runId|latest>` deletes a run's
provisional entries, unmarks its messages and clears them from the ledger
(`--dry-run`, or `--yes` to write). `poll` gains `--max-messages` and `--since`
and prints its run id and counts. Exit codes: 2 for a refused undo, 3 when
Graph throttles. `DocketIntake.pollOnce` takes optional `DocketPollOptions`
with `maxMessages`; the server adds the journal, the journaling port layer, a
read-only Graph layer, the undo plan and apply, and a lock-free state reader.
