---
title: The test HTML normalizer is a literal port of normalize.py's HTMLParser callback sequence, quirks included
date: 2026-11-26
reversal: Replace normalizeHtml with a normalizer written from the intent, then re-run the 652-example differential against the real normalize.py and accept the new divergences.
governs:
  - test/support/normalizeHtml.ts#normalizeHtml
  - test/support/normalizeHtml.ts#Normalizer
  - test/support/normalizeHtml.ts#NAME_TO_CODEPOINT
  - test/support/normalizeHtml.ts#unescapeAttributeValue
  - test/support/normalizeHtml.ts#ATTRIBUTE_ORDER
  - test/support/normalizeHtml.ts#CHUNK_HANDLERS
  - test/support/normalizeHtml.ts#feedComment
enforcedBy: []
---

The stripping rules of the spec suite's `test/normalize.py` depend on the exact sequence of `html.parser.HTMLParser` callbacks, so the port reproduces that sequence rather than the intent. Two upstream oddities stay: `normalize.py` tests the attribute VALUE against `['href','src']` where it meant the name, so its percent-normalizing branch is dead (and would crash on Python 3) and only the `else` path is ported; and `</pre>` sits in an `elif`, skipping the rstrip every other block end tag performs.

Python's behaviour is matched where it is not obvious: `name2codepoint` is the HTML 4 table, the only one `normalize.py` decodes, so an HTML5-only name stays literal text. `HTMLParser` unescapes attribute values with the full HTML5 table where this port uses HTML 4 plus numeric references, a gap that is inert because both sides of every comparison pass through the same function. Attributes sort as Python's `list.sort()` sorts `(name, value)` tuples, with `None` before any string, and values re-escape as `html.escape(v, quote=True)`, so `'` becomes `&#x27;`.

Chunking follows `normalize.py`: the input is chunked first so CDATA survives `HTMLParser`, a trailing unclosed `<` is dropped, and markup chunks are tested in its order. Any other `<!` opener is an HTML5 bogus comment carrying the raw text (`<!X>` becomes `<!--X-->`, `<!>` an empty one); a processing instruction keeps its trailing `?` as data. A comment may contain `>`, which the chunker splits on, so its terminator is searched in the whole source, the equivalent of `HTMLParser` buffering across feeds; the abrupt-closing forms are empty comments, and an unterminated comment takes the rest of the chunk, closing `>` included, as `HTMLParser`'s final flush does.

Rejected: a normalizer written from the intent, and the full HTML5 entity table.
