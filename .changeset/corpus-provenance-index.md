---
"@beep/repo-cli": minor
"@beep/libpff": minor
---

Add the corpus provenance index (`beep corpus provenance messages|attachments|metadata`): a
normalized per-message header index over pffexport trees, attachment clipped-extension repair with
an append-only undo journal, and an exiftool metadata census. `@beep/libpff` gains
`parseInternetHeaders`. `corpus restore-preserve` gains `--expected-collector-present-rows` and the
optional fifth inherited-loss class `operator-deleted-noise`
(`--expected-operator-deleted-destinations`); `restore-verify` now requires the four ratified
inherited-loss classes by name, each exactly once, instead of exactly four rows.
