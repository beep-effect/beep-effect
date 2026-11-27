# effect/Schema index

Generated from effect 4.1.5 by `bun run beep schema-idioms index --write`. Do not edit by hand.

What the installed `effect/Schema` ships, grouped by the wire (encoded) type a schema reads, so a field that arrives as a number is one lookup: `bun run beep schema-idioms lookup number`. Topics: `string`, `number`, `bigint`, `date`, `other`, `collections`, `constructors`, `getters`.

`bun run beep schema-idioms index --check` fails when these files differ from what the installed effect would generate, and the repo-cli test `schema-idioms-index.test.ts` makes the same comparison. No CI lane runs `--check` itself: after an Effect bump, run `bun run beep schema-idioms index --write` and commit the result.

| Slice | Entries | Holds |
| --- | --- | --- |
| [wire-string.md](wire-string.md) | 82 | Schemas that read a string, and checks on strings. |
| [wire-number.md](wire-number.md) | 19 | Schemas that read a number, and checks on numbers. |
| [wire-bigint.md](wire-bigint.md) | 8 | Schemas that read a bigint, and checks on bigints. |
| [wire-date.md](wire-date.md) | 7 | Schemas that read a JavaScript Date, and checks on Dates. |
| [wire-other.md](wire-other.md) | 84 | Schemas whose encoded side is any other shape, with that shape shown. |
| [checks-collections.md](checks-collections.md) | 20 | Checks whose input is a collection, a sized or lengthed value, or another non-primitive. |
| [takes-a-schema.md](takes-a-schema.md) | 84 | Constructors and combinators whose result depends on the schema passed in. |
| [getters.md](getters.md) | 100 | Named `effect/SchemaGetter` and `effect/SchemaTransformation` values for `S.decodeTo` and friends. |
