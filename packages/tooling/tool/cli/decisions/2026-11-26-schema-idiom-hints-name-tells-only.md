---
title: Schema idiom hints fire only on definition-site name tells, once per field per session, from an index of the installed effect
date: 2026-11-26
reversal: Add rows to SCHEMA_IDIOM_TELLS in src/commands/SchemaIdioms/SchemaIdiomHints.model.ts for any further tell, and drop the seen-hint filter in schemaIdiomHookOutput (src/commands/SchemaIdioms/SchemaIdioms.hook.ts) to repeat hints on every edit.
governs:
  - src/commands/SchemaIdioms/SchemaIdiomHints.model.ts#SCHEMA_IDIOM_TELLS
  - src/commands/SchemaIdioms/SchemaIdiomHints.ts#schemaIdiomHints
  - src/commands/SchemaIdioms/SchemaIdioms.hook.ts#schemaIdiomHookOutput
  - src/commands/SchemaIdioms/SchemaIdioms.extract.ts#extractSchemaIndex
enforcedBy:
  - test/schema-idioms-hints.test.ts#an interface member is not a schema field
  - test/schema-idioms-hints.test.ts#every suggested schema and primitive head exists in the generated index
  - test/schema-idioms-hints.test.ts#a field overridden later in its object literal is not hinted
  - test/schema-idioms-hints.test.ts#a container whose fields are rewritten hints none of them
  - test/schema-idioms-hook.test.ts#a hint is shown once per field per session
  - test/schema-idioms-hook.test.ts#a MultiEdit payload does not decode, so a transient edit hints nothing and consumes no key
  - test/schema-idioms-index.test.ts#indexes the installed effect with the type checker and matches the committed index
---

The hint fires only when a schema field's name reads as a richer value (an instant, duration, byte size, URL, network address, port or version) while its schema, followed through at most one same-file `const`, decodes to a primitive. It is advisory: hints never fail `beep schema-idioms hint` (only an unreadable file does), the PostToolUse hook always exits 0, and the hook shows each `(session, file, field, kind)` hint once, so an agent that declines a hint is not told again on its next edit. A false hint is worse than a missed one, so the scan stays silent whenever it cannot prove the effective field: an entry overridden later in its object literal (a later spread, any computed key, a repeated name), a container whose fields a method or pipe rewrites (`.mapFields`, `S.fieldsAssign`), and an `annoteSchema` / `annote` call on anything but a `$`-prefixed identity composer bound once. The hook reads `Edit` and `Write` payloads only; a `MultiEdit` payload does not decode, because a new string found in the final file does not prove which occurrence an earlier edit of the same call wrote. The suggestions are a curated table, `SCHEMA_IDIOM_TELLS`, and a test checks every name in it against `.claude/skills/schema-first-development/references/schema-index/`. `beep schema-idioms index --write` generates that index from the installed `node_modules/effect` with the type checker, never from training-data recall or the reference checkout. `schema-idioms-index.test.ts` and `beep schema-idioms index --check` fail when the committed index differs from the installed effect; no CI lane runs `--check` itself. After an Effect bump, run `--write`, and when an export a tell suggests is renamed or removed, update its row in the table too.

Reason: two independent judges labelled 341 samples. Definition-site name tells were judged real 100% (instant), 92% (duration, URL) and 50% (bytes, network). Use-site tells (`!== undefined`, `??`, `.trim()`, `.length > 0`, regex tests) and escape hatches (`S.makeFilter`, `S.isPattern`) scored 0-21%, and a hint keyed on an `S.makeFilter` input type sent an agent to `S.isMinSize`, which does not accept Effect's `HashSet`. A line regex over `key: S.Number` missed every real case because this repo names its intermediate schemas, so the scan follows a field's identifier to its `const`. The scan parses with `oxc-parser` (about 110 ms for the whole hook on a 312-line file) rather than ts-morph, whose TypeScript load alone took 180 ms.

Rejected: use-site and escape-hatch tells, at 0-21% precision; repeating a hint on every edit, which turns a declined suggestion into noise; an unchecked hand-maintained list of shipped schemas, which drifts on every Effect release; extending `beep lint effect-schema-inventory`, whose rows are syntax-only declaration facets read from the catalog-pinned reference checkout without a type checker, while grouping by wire type needs each export's resolved encoded type from the installed package.
