---
title: "P3: the OA codec writes and reads the xsd:dateTime lexical form of every instant a DateTime holds"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Bound Generation.at and the decoder's times to years 0001 to 9999 by a schema check, by a decision file with L2-6"
---

A call the P3 design does not settle, taken in the fix commit after commit 6. `Generation.at` is any `DateTimeUtcFromMillis`, so a stated time can lie outside years 0000 to 9999. Commit 6 wrote `DateTime.formatIso`, which for such years prints `+010000-...` or `-000001-...`; neither is in the xsd:dateTime lexical space, and the decoder refused the first, so `decode(encode(d)) = d` failed for a valid document and a third-party time of `9999-12-31T23:59:59-14:00` was lost on the second decode.

The codec keeps the full range instead of bounding it, since bounding would refuse native documents the schema accepts. The encoder writes the year with no `+` and with four or more digits, negative years signed (`10000-01-01T00:00:00.000Z`, `-0001-01-01T00:00:00.000Z`, `275760-09-13T00:00:00.000Z`). The decoder reads the xsd:dateTime lexical form: a year of four or more digits with no leading zero past four, the date, the clock, an optional fraction and an optional zone. It converts the year to the ECMAScript form, truncates the fraction to milliseconds, reads a missing zone as UTC (as `DateTime.make` already did), and gives no time for a calendar date that does not exist (`2024-02-30`, which ECMAScript rolls to March 1) or an instant outside the range a DateTime holds. Such a literal stays in the residual, as decision `p3-oa-codec-reading-calls` says of any other time literal. Year numbering follows XSD 1.1 and ISO 8601: `0000` is 1 BCE. The `L2-6` generators now draw document times over the whole range, half of them at its edges, and third-party times on both sides of the four-digit year and around year 0.
