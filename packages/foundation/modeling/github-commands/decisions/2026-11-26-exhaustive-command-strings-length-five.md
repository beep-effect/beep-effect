---
title: The exhaustive neutralizer suite walks every string up to length 5
date: 2026-11-26
reversal: Raise EXHAUSTIVE_STRING_LENGTH to 6 and give the exhaustive describe a timeout that covers the larger walk.
governs:
  - test/CommandNeutralizer.test.ts#EXHAUSTIVE_STRING_LENGTH
enforcedBy: []
---

The exhaustive describe walks every string up to EXHAUSTIVE_STRING_LENGTH over COMMAND_TRIGGER_ALPHABET: the colon, hash and bracket, ordinary and .NET whitespace (space, tab, NEL), the three line break characters and a letter.
Length 5 is enough. The longest trigger is three characters (`##[`, or whitespace then `::`), so five holds a one-character line break, a whole trigger and one character before it: every way a trigger meets a single break or what precedes it.
A CRLF break with a character before it and a three-character trigger needs six; the targeted CRLF cases earlier in the same file cover it.
Rejected: length 6, which is 597,871 strings walked by four tests (length 5 is 66,430) and ran past the runner's per-test timeout.
