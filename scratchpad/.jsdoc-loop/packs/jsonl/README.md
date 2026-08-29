# Pack jsonl

- modules: 11
- owning exports: 45
- re-exports: 11
- open modules: 10
- open owning exports: 45

## Files

- `jsonl/Envelope.ts` owning=6 moduleFindings=missing-packageDocumentation
- `jsonl/Journal.ts` owning=7 moduleFindings=missing-packageDocumentation
- `jsonl/JsonlError.ts` owning=9 moduleFindings=missing-packageDocumentation
- `jsonl/JsonlEvent.ts` owning=6 moduleFindings=missing-packageDocumentation
- `jsonl/Line.ts` owning=2 moduleFindings=missing-packageDocumentation
- `jsonl/LineSlice.ts` owning=1 moduleFindings=missing-packageDocumentation
- `jsonl/Slice.ts` owning=3 moduleFindings=missing-packageDocumentation
- `jsonl/index.ts` owning=0 moduleFindings=none
- `jsonl/internal/merge.ts` owning=4 moduleFindings=missing-packageDocumentation|missing-module-since
- `jsonl/internal/tail.ts` owning=6 moduleFindings=missing-packageDocumentation|missing-module-since
- `jsonl/internal/utf8.ts` owning=1 moduleFindings=missing-packageDocumentation|missing-module-since

## Open modules

- `jsonl/Envelope.ts`: missing-packageDocumentation
- `jsonl/Journal.ts`: missing-packageDocumentation
- `jsonl/JsonlError.ts`: missing-packageDocumentation
- `jsonl/JsonlEvent.ts`: missing-packageDocumentation
- `jsonl/Line.ts`: missing-packageDocumentation
- `jsonl/LineSlice.ts`: missing-packageDocumentation
- `jsonl/Slice.ts`: missing-packageDocumentation
- `jsonl/internal/merge.ts`: missing-packageDocumentation, missing-module-since
- `jsonl/internal/tail.ts`: missing-packageDocumentation, missing-module-since
- `jsonl/internal/utf8.ts`: missing-packageDocumentation, missing-module-since

## Open owning exports

- `jsonl/Envelope.ts:42` `EnvelopeFrame` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/Envelope.ts:59` `Envelope` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Envelope.ts:78` `EnvelopeOf` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/Envelope.ts:88` `EnvelopeUnion` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/Envelope.ts:95` `EnvelopeWithTag` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/Envelope.ts:180` `Envelope` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/Journal.ts:48` `JournalWriteError` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:63` `JournalReadError` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:70` `AppendOptions` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:80` `JournalShape` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:216` `JournalConfig` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:1108` `JournalClass` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Journal.ts:1163` `Journal` (value/const) missing=@category|@since findings=legacy-example|missing-required-tags
- `jsonl/JsonlError.ts:50` `MalformedLine` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `jsonl/JsonlError.ts:71` `UnknownEvent` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:98` `InvalidData` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:124` `TerminalViolation` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:147` `JournalNotFound` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:178` `UnserializableData` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:207` `JournalClosed` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlError.ts:244` `JournalResync` (value/class) missing=@category|@since|@example findings=legacy-remarks|missing-required-tags
- `jsonl/JsonlError.ts:268` `JsonlError` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/JsonlEvent.ts:32` `DataSchema` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/JsonlEvent.ts:39` `JsonlEventTypeId` (type/type) missing=@category|@since findings=missing-required-tags
- `jsonl/JsonlEvent.ts:46` `JsonlEventTypeId` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlEvent.ts:59` `JsonlEvent` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/JsonlEvent.ts:86` `JsonlEvent` (value/namespace) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/JsonlEvent.ts:154` `JsonlEvent` (value/const) missing=@category|@since findings=legacy-example|missing-required-tags
- `jsonl/Line.ts:26` `ParsedLine` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/Line.ts:47` `Line` (value/class) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/LineSlice.ts:36` `LineSlice` (value/class) missing=@category|@since findings=legacy-example|missing-required-tags
- `jsonl/Slice.ts:24` `Slice` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Slice.ts:52` `CursoredSlice` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/Slice.ts:73` `matchesFrame` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/merge.ts:44` `isRecordLike` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/merge.ts:52` `isPlainRecord` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/merge.ts:77` `canMerge` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/merge.ts:109` `shallowMerge` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/tail.ts:38` `DEFAULT_WINDOW` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/tail.ts:45` `TailWindow` (type/interface) missing=@category|@since findings=missing-required-tags
- `jsonl/internal/tail.ts:78` `probeBomBytes` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/tail.ts:116` `readTail` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/tail.ts:164` `readTailUntil` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/tail.ts:202` `readRangeText` (value/const) missing=@category|@since|@example findings=missing-required-tags
- `jsonl/internal/utf8.ts:25` `utf8Length` (value/const) missing=@category|@since|@example findings=missing-required-tags
