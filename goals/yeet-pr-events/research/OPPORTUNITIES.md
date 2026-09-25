# Opportunities and friction receipts — yeet-pr-events

Receipts recorded at the moment friction happens (AGENTS.md "Friction is a
first-class output"). Redacted: no secrets, no absolute home paths, no session
ids.

## 2026-09-25 — failure packet named the wrong red

- **Doing:** publishing this packet's graduation PR (#1236) through
  `bun run beep yeet publish --start-pr-early --monitor --pr --detach`; the
  post-push local proof went red in `quality:lint-policy`.
- **Evidence:** the verdict's repair hint and the `@beep/root` packet both
  said "Run the typos checker on the flagged files … `_typos.toml`", and
  `full:01-pre-push … failed in typos with exit code 1`. `typos` over the
  lane exits 0, and the job log shows `//:lint:typos: $ typos` with no
  finding. The actual red was `//#knowledge:semantic-delta` exiting 1 with
  eight `introduced … broken-tracked-path` findings — backticked paths in
  the packet prose that do not exist yet (a promotion-trigger package name
  and a rejected runbook name).
- **Cost:** one extra attribution pass reading a 7,000-line job log before
  the right fix (rewording the paths as prose).
- **Would have prevented it:** the lint-policy wrapper's hint should be
  selected from the inner Turbo task that actually failed
  (`//#knowledge:semantic-delta`), not from the first tool named in the
  lane; and the semantic-delta gate's "introduced" block should be surfaced
  in the packet as the finding text, since it already prints the file and
  the missing path.
