---
title: "P3: the aligner's codec yields a TextAnchor, langextract ranges give way to Position, and the attempt read codec is exported"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Restore the langextract range types and convertTextOffsetRange, the invalid-offset reason and a source-reading SpanFromMatch encode, by a decision file"
---

Seven calls the design did not settle, taken while writing commit 7.

- `SpanFromMatch` and `spanFromMatch` keep their names and now produce a `TextAnchor`. The anchor carries its own quote, so the codec's encode is pure, `[startChar, quote]`, and no longer reads `CurrentAlignmentSource`; an empty matched slice is refused on decode, since an anchor is never empty.
- `TextOffsetUnit`, `TextOffsetRange`, `Utf16TextRange` and `convertTextOffsetRange` go with no langextract successor; callers use `@beep/text/OffsetUnit` `Position` and `convertPosition`. `VerifiedSpanOffsets.test.ts` goes with `UnitConversionAgreement.test.ts`: every case in it exercised the deleted function, and `@beep/text`'s offset-unit laws cover the conversion.
- `invalid-offset` leaves `VerifiedSpanErrorReason` and the verified-span attempt's location-failure reasons, because no producer of it remains. `VerifiedSpanAttemptRecord` has no store.
- The citation `OccurrenceProjection` maps every `convertPosition` refusal (`split-boundary`, `out-of-range`, `ill-formed-text`) to an unverified row, as it mapped `invalid-offset` and `absent-text` before. None of them names a UTF-16 range the source could prove. The old `limit-exceeded` failure cannot arise, since `convertPosition` has no source-length ceiling of its own.
- `OfficeActionStructureAttemptRead` is exported from `@beep/law-practice-use-cases/OfficeActionStructure`, because the server store reads through it and the package serves no deeper path. The frozen v1 schemas and `convertV1` stay private to `OfficeActionStructure.read.ts`.
- The read union lists the v1 reader first, `S.Union([FromV1, OfficeActionStructureAttempt])`, the reverse of the design. A v2 row never enters the v1 reader, whose `schemaVersion` literal prunes it; an encode enters it first and is refused by its forbidden getter, then falls through to the v2 schema. Every encode through the read codec therefore passes the refusal, and `test/OfficeActionStructure.read.test.ts` in the use-cases package covers the module at 100 percent without exporting the v1 reader.
- The two citation-extraction-engine ops scripts convert through `convertPosition`, which refuses a lone surrogate before the end boundary where the deleted function counted it as a code point. Their fixture texts are well formed.

`apps/labs/lejeune-bolt-workbench/src/workflows/Normalize.ts` and `Rules.ts` need no edit: they build unaligned extractions for the locate input and read the located `TextAnchor`, and neither named `TextOffsetRange`.
