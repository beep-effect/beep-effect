# Round 1 fixer — remainder-microdata

## Changed files

- `scratchpad/microdata/Microdata.model.ts` (JSDoc only; one implementation `//` comment folded into the module Gotcha and removed. No schema / codec behavior change. No `$I` edits.)

## Items closed

All 9 accepted findings from `remainder-microdata.md`:

| Id | Symbol | Fix |
| --- | --- | --- |
| remainder-microdata-R1-001 | `Microdata.model` (module) | Fileoverview lead (WHATWG HTML / Microdata-to-RDF XSD / RFC 6350 vCard + `*String` vs `MicrodataXsd*` vs `*FromString` choice), `@packageDocumentation`, `@since 0.0.0`. Never `@module`. |
| remainder-microdata-R1-002 | `Microdata.model` (module) | Module `**Gotchas**`: unbounded lexical spaces; payload-size budgets belong at the transport layer. Did not clone the sentence onto every string schema. Removed the line-28 `//` comment after folding it here. |
| remainder-microdata-R1-003 | choice clusters | One described `@see` (sometimes two `{@link}` targets in the purpose phrase) on each value-level sibling: duration ISO/human/union/value/codec; HTML global date-time vs `MicrodataDateTimeFromString`; each `Html*String` vs its `MicrodataXsd*` subset; `XsdInteger*` vs `VCardInteger*` (bigint vs Int64); `XsdDoubleFromString` vs `VCardFloatFromString`; `makeHtmlUrlFromString` vs already-absolute microdata URL; `HtmlUrlTokenString` vs whitespace strip; numeric vs data-value; RDF time vs runtime vs contextual; `VCardValueType*` / declared token; timestamp / zoned / UTC codec; `VCardUriString` vs `VCardUrlFromString`. Type-alias `@see` tags left as-is. No extra Examples. |
| remainder-microdata-R1-004 | `VCardIntegerFromString` | `**Gotchas**`: overflow lexemes pass `{@link VCardIntegerString}` and fail only at this Int64 codec; `{@link XsdIntegerFromString}` for unbounded xsd:integer. One-line pointers on `VCardIntegerString` and `VCardIntegerValue`. Existing `+42` Example kept. |
| remainder-microdata-R1-005 | `HtmlHumanDurationString` | `**Gotchas**`: only `S` may carry a `.` fraction (≤3 digits); duplicate scales still fail. `1h 30m` Example kept. |
| remainder-microdata-R1-006 | encode canonicalization | `**Gotchas**` on `MicrodataDurationFromString` (human → `PT1H30M`), `VCardBooleanFromString` (`TRUE`/`FALSE`), `VCardUtcOffsetFromString` (`+05` → `+0500`), `VCardTimestampFromString` (offsets dropped to `Z`), `XsdDoubleFromString` (`n.0` / `-0.0`). Touched fences now observe encode for duration, boolean, UTC offset, and xsd:double. |
| remainder-microdata-R1-007 | `VCardUrlFromString` | `**Gotchas**`: `urn:example:item` remains valid `{@link VCardUriString}` and fails WHATWG URL parsing here. Described `@see` both ways. Both Examples kept. |
| remainder-microdata-R1-008 | `HtmlTimeZoneOffsetString` | `**Gotchas**`: `-00:00` / `-0000` rejected; use `Z` or `+00:00`. `@see` `{@link VCardUtcOffsetString}` for RFC 6350 `±HHMM` without `Z`. |
| remainder-microdata-R1-009 | `VCardTypedScalarFromString` | Details extended: only `boolean` / `integer` / `float` / `utc-offset` decode to runtime values; `timestamp` stays `{@link VCardTimestampString}`. `@see` `{@link VCardTimestampFromString}` and `{@link VCardUrlFromString}`. Existing Example kept. |

## Mechanical census (module)

Applied `scratchpad/.jsdoc-loop/census.ts` predicates to the current fileoverview:

- `hasFileoverview`: file starts with `/**`
- `hasUsefulLead`: first paragraph before `**Gotchas**` is well over 12 characters
- `hasPackageDocumentation`: `@packageDocumentation` present
- `hasSince`: `@since 0.0.0` present
- no `@module` / `@remarks` / `@example` on the module or anywhere in the file

Owning-export mechanicals were already closed (131/131) and were not regressed: value leads, titled Examples, `@category` (`schemas` / `constructors` / `models`), `@since 0.0.0` remain. No `$I` or same-name-alias churn.

## Residual risk

- `scratchpad/.jsdoc-loop/census.json` is a shared generated artifact. This fixer did not overwrite it (other packs share the file). Re-run `bun scratchpad/.jsdoc-loop/census.ts` to persist the closed module row.
- Encode Gotcha spellings were traced from `formatHtmlDuration` / boolean encode / `formatVCardUtcOffset` / `isoUtcToVCardTimestamp` / `formatXsdDouble`, not executed in this session.
- `@beep/scratchpad` has no `check` script. Typecheck is `tsgo -p scratchpad/tsconfig.json --noEmit`.
- Docgen Examples still use the file's existing relative `./Microdata.model.ts` imports (scratchpad `docgen.json` path map has no `@beep/scratchpad/microdata` alias).

## Commands run

This subagent surface had no shell tool, so these were **not** executed here. Parent / next hop should run:

```bash
zsh -ic 'bun scratchpad/.jsdoc-loop/census.ts'
zsh -ic 'bun run docgen:local -- --package @beep/scratchpad'
zsh -ic 'bunx tsgo -p scratchpad/tsconfig.json --noEmit --pretty false'
```

After census, confirm `modules[file=microdata/Microdata.model.ts].findings` is `[]`.
