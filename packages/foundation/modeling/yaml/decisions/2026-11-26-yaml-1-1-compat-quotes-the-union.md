---
title: quoteCompat "yaml-1.1" quotes the union of the YAML 1.1 type grammars and the lenient real-world resolvers
date: 2026-11-26
reversal: Replace INT_11_RE, FLOAT_11_RE and TIMESTAMP_11_RE with the yaml.org/type grammars verbatim and drop FLOAT_11_REFERENCE_RE and SEXAGESIMAL_11_REFERENCE_RE.
governs:
  - src/internal/stringifier.ts#wouldBeResolved11
  - src/internal/stringifier.ts#wouldBeCoerced
  - src/internal/stringifier.ts#INT_11_RE
  - src/internal/stringifier.ts#FLOAT_11_RE
  - src/internal/stringifier.ts#TIMESTAMP_11_RE
  - src/internal/stringifier.ts#FLOAT_11_REFERENCE_RE
  - src/internal/stringifier.ts#SEXAGESIMAL_11_REFERENCE_RE
enforcedBy: []
---
`wouldBeResolved11` tests only what a YAML 1.1 parser (js-yaml, PyYAML, libyaml) coerces beyond the 1.2 Core Schema, from yaml.org/type (bool, int, float, timestamp): the extended boolean spellings, `_` digit separators, base-2/8/16 integers, sexagesimal numbers and timestamps; `.inf`/`.nan` and the null spellings are already 1.2 patterns. The check is strictly additive and never un-quotes what the 1.2 rules require.
Where the spec and lenient resolvers differ, the patterns accept the union. Integers accept `0o` octals and leading zeros (`09`, `0_9`), which the reference `yaml` package's 1.1 schema resolves though the spec says `0|[1-9][0-9_]*`. Floats need a decimal point or an exponent (bare digit runs are integers), with js-yaml's dotless exponent (`1e3`) and optional exponent sign. Timestamps take a 1-2 digit month and day in both forms (the spec's date-only branch is two-digit, `yaml` resolves `2024-1-15`), a `T`/`t` or whitespace separator, an optional fraction and a `Z` or colon-optional offset.
`FLOAT_11_REFERENCE_RE` and `SEXAGESIMAL_11_REFERENCE_RE` copy the `yaml` package's looser float (an optional integer part: `.`, `+.`, `._`, `e5`, `.e5`) and leading-zero sexagesimal (`0:30`) patterns verbatim, so the union stays a superset of that reader.
Reason: over-quoting is the safe direction for a compat mode.
Rejected: the spec grammars alone, which leave strings that real 1.1 readers coerce unquoted.
