---
title: Stringify defaults keep the released bytes, and only quoteStyle "auto" takes the yaml npm package's tab handling
date: 2026-11-26
reversal: Default quoteStyle to "auto" and let a tab stay in single quotes under every quote style.
governs:
  - src/internal/stringifier.ts#createContext
  - src/internal/stringifier.ts#stringStyleRenderers
  - src/internal/stringifier.ts#hasUnplainableChar
  - src/internal/stringifier.ts#renderPlainKey
enforcedBy: []
---
`createContext` keeps output byte-identical for callers that do not opt in: `lineWidth` 0 never folds (only a positive width enables column folding), `quoteStyle` "single" is the released plain-scalar fallback, and an absent `quoteCompat` adds no quoting.
Under "single" and "double" a tab makes a plain scalar unplainable and forces double quotes with `\t`, the released conservative form, since some parsers reject an interior tab in plain text. Under "auto" the stringifier follows the `yaml` npm package: an interior tab stays plain, and a quoted one stays literal inside single quotes (valid YAML 1.2 on one line, and it reads back exactly). A leading or trailing tab, or one beside `#` or after `:`, is quoted under every setting by the indicator and ambiguity checks; CR and the other C0 controls are double-quoted before the fallback is consulted (a plain scalar cannot carry CR: the parser normalises it away, corrupting the round-trip), and backslashes are literal in single quotes.
Mapping keys render plain-styled and take the same fallback, so a key such as `@types/acorn` honours `quoteStyle` instead of a hard-coded single quote.
Rejected: the `yaml` package's presentation as the default, which would change released output for every existing caller; one tab rule for every quote style.
