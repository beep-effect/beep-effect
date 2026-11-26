---
title: Long and complex block keys take explicit-key form, with values in compact notation padded two columns
date: 2026-11-26
reversal: Pad explicit-key continuation lines with ctx.indent as the `yaml` package does, measure the source key instead of the rendered one, and let indentSequences indent explicit-key sequence values.
governs:
  - src/internal/stringifier.ts#IMPLICIT_KEY_MAX_LENGTH
  - src/internal/stringifier.ts#EXPLICIT_COMPACT_PAD
  - src/internal/stringifier.ts#pushBlockObjectEntry
  - src/internal/stringifier.ts#pushExplicitObjectEntry
  - src/internal/stringifier.ts#pushBlockMapPair
  - src/internal/stringifier.ts#isComplexKey
  - src/internal/stringifier.ts#pushComplexKeyPair
  - src/internal/stringifier.ts#explicitKeyContinuationPad
  - src/internal/stringifier.ts#pushSpilledKeyPair
  - src/internal/stringifier.ts#pushExplicitKeyValueLines
  - src/internal/stringifier.ts#pushExplicitSingleLineValue
  - src/internal/stringifier.ts#pushExplicitMultiLineValue
enforcedBy: []
---
YAML 1.2 caps an implicit key at 1024 characters before its `:`, so a block-mapping key whose rendered form (quotes and escapes count, the source scalar does not) is longer spills to `? key` / `: value` or strict parsers reject the output. This matches the reference `yaml` package's `stringifyPair` (`str.length > 1024`, block context only): a rendered key of exactly 1024 characters stays implicit, and flow keys never spill. The value-path and node-path stringifiers both apply it (pnpm 11 lockfile snapshot keys exercise it).
A non-empty collection key, a scalar key holding a newline and a block-style scalar key always take explicit form, so an inner `:` is not read as the outer one; an empty collection key renders `[]` or `{}` on one line and stays implicit (M2N8/01).
The value sits in compact notation on the `:` line and its continuation lines are padded by `EXPLICIT_COMPACT_PAD`, two columns, never `ctx.indent`: compact lines must align with the first item, which starts two columns in, so any other pad re-nests or corrupts the value on reparse once `indent !== 2`. A key whose first line is only `&anchor`/`!tag` puts its content at the `?` level, a block-scalar key already indents its own lines, and `indentSequences` never reaches this branch.
A value with its own leading comment, and any value that cannot be compact, goes below a bare `:` at the value's indent; a one-pair block map takes an indented line of its own, since compact `: k: v` composes as two pairs after an explicit key; block scalar headers and multi-line quoted scalars stay inline. The entry's trailing comment goes on the line the inline value ends on (a block scalar's header, a quoted scalar's closing line), otherwise on a single-line key's `?` line, and is dropped after a multi-line key, where it would land inside the key.
Rejected: padding with the configured indent like the `yaml` package, whose own strict parser misreads or rejects that output at indent ≠ 2; measuring the source key, which lets quoting and escaping push a key past the limit unnoticed.
