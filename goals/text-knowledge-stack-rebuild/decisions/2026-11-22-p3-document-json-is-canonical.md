---
title: "P3: a document has one checked decode and one canonical encode; the decoder refuses a repeated table key"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Encode tables as JSON objects keyed by id, which RFC 8785 sorts, by a decision file; fixtures are regenerated"
---

`S.HashMap` encodes its entries in iteration order and decodes a repeated key by keeping the last (`.repos/effect/packages/effect/src/Schema.ts:16021-16026`, `HashMap.ts:893-894`), so document bytes were not stable and a forged first entry was dropped without notice. The tables stay `S.HashMap`. `makeDocumentCodec(schema, kinds)` returns the one checked `decode` (an envelope decode, `DocumentKeyRepeated { table, key }` for a repeated key in `anchors`, `annotations` or `attribution`, then the schema, then the key verification) and the one canonical `encode` (the schema encode, then every table sorted by encoded key and every generation set sorted by run id). The bare schema stays exported for composition and generators.

A generic sorted-entry carrier was tried and dropped: `S.Tuple` over generic element schemas leaves its optionality conditional unresolved under tsrs, and the record form loses the key brand. Checked in a throwaway on this base: encode then decode round-trips; encode is a fixed point of the canonical sort; a repeated key is refused by the entrypoint and accepted by the bare schema; a consistently forged annotation key (key, attribution key, generation content and re-minted run all replaced) is accepted by the bare schema and refused by the entrypoint with `DocumentKeyMismatch` on `annotations`, the L2-4 case.
