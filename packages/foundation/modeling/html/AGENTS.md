# @beep/html Agent Guide

Exhaustive, schema-first AST of the WHATWG HTML specification (effect/Schema).

## Surface Map
| Surface | Key exports | Notes |
| --- | --- | --- |
| `Html.model` | `HtmlNode`, `HtmlChildren`, one `TaggedClass` per element (`Div`, `Span`, `Input`, `Marquee`, …), `Fragment`, `Document`, category sub-unions (`Flow`, `Phrasing`, …) | GENERATED. `HtmlNode = S.Union([...]).pipe(S.toTaggedUnion("_tag"))`; `_tag` = tag name |
| `Html.nodes` | `Text`, `Comment`, `Doctype` | hand-authored leaf nodes (`#text`/`#comment`/`#doctype`) |
| `Html.attributes` | `GlobalAttributes`, value enums (`Dir`, `InputMode`, …) | hand-authored global-attribute overlay |
| `Html.meta` | `ELEMENT_META`, `HtmlElementMeta` | GENERATED metadata (interface, conformance, void/raw-text, categories) |

## Generation
- `Html.model.ts` / `Html.meta.ts` are GENERATED — edit `scripts/generate.ts`, then `bun run generate` (reads pinned `data/`; see `data/SOURCES.md`).
- Restricted-name element classes get an `Element` suffix (`<s>`→`SElement`, `<object>`→`ObjectElement`).
