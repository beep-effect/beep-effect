---
title: The OA codec maps xsd:dateTime years to and from the ECMAScript expanded-year form by hand
date: 2026-11-23
reversal: Write `DateTime.formatIso` output unchanged and read literals through `DateTime.make` directly, accepting that years outside 0000..9999 round-trip as invalid xsd:dateTime.
governs:
  - src/rdf/OaCodec.ts#ExpandedIsoYear
  - src/rdf/OaCodec.ts#DateTimeLexical
  - src/rdf/OaCodec.ts#ecmaYear
  - src/rdf/OaCodec.ts#instantOf
enforcedBy: []
---

`toISOString` writes a year outside 0000..9999 with a sign and six digits (`+010000`, `-000001`), which the xsd:dateTime lexical space does not admit. Writing drops the `+` and every leading zero past four digits.
Reading accepts the xsd:dateTime lexical form: a year of four or more digits with no leading zero past four, the date, the clock, an optional fraction and an optional zone. The year is rewritten to its ECMAScript form (four digits inside 0000..9999, else a sign and six digits) before `DateTime.make` reads it.
The fraction is truncated to milliseconds and a missing zone reads as UTC. A calendar date that does not exist (`2024-02-30`), or an instant outside the range a `DateTime` holds, is no instant: the day is checked by formatting its midnight back.
Rejected: trusting `DateTime.make` alone, which rolls a nonexistent date over and cannot read a four-digit year past 9999.
