# LEDGER_PATCH — stamp.json for publisher

Replace `research/ledger/stamp.json` with the contents of `stamp.json` in this packet.

Pattern (same as prior drafts):
- `lastSuccessful*` stays on previously-merged **#1403** / research/2026-10-02
- `lastAttempted*` points at this draft packet research/2026-10-03
- `lastAttemptedPr` null until publisher fills after PR open
- note: Draft until human merge… Never auto-merge. Do NOT promote lastSuccessful* until human merges.

No excluded-packets append (no new closed-unmerged). Saturday — no tombstones reaper.
