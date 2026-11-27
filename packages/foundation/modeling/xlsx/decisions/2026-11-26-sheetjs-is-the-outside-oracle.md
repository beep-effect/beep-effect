---
title: SheetJS, the reader this package replaced, is the outside oracle of its property tests
date: 2026-11-26
reversal: Delete test/oracle.property.test.ts and the xlsx dev dependency, leaving the round-trip laws of test/Xlsx.property.test.ts as the only property check.
governs:
  - test/oracle.property.test.ts#formatted
enforcedBy: []
---

`test/oracle.property.test.ts` is the only file that imports SheetJS. SheetJS reads what the package writes, the package reads what SheetJS writes, and the text the package displays for a number or a date is the text SheetJS displayed, except where an assertion message there says the old text was wrong.

Rejected: round-trip laws alone, which, run by one reader and one writer, prove only that the two agree with each other.

Accepted limit: generated text is printable, since SheetJS does not keep every control character.
