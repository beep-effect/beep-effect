# Filing identity authority decision

Date: 2026-08-13

## Decision

Do not convert or equate normalized USPTO application numbers with WIPO ST.13
numbers. Require the ST.3 office code on the ST.13 union member and reject `US`
there, because current U.S. practice is the separate eight-digit series/serial
system.

## Evidence

- WIPO ST.13 requires a type, filing year, and serial in the machine-readable
  15-character number.
- USPTO MPEP § 503 defines the eight-digit number as series code plus serial.
  Its dated series table shows a series spans more than one filing year, so the
  series code cannot supply ST.13's four-digit year.
- WIPO's current office-practice table marks the U.S. type and year
  designations as not applicable.

Primary URLs and retrieval dates are recorded in `SOURCES.md`.

## Observable boundary

`CitingApplicationIdentity` now accepts an ST.13 identity only with a non-U.S.
`officeCode`. Focused domain tests accept `EP`, reject `US`, reject an absent
office code, and keep the USPTO member unchanged. Repository reads continue to
use exact schema-encoded equality; this is the correct terminal behavior, not a
deferred reconciliation engine.
