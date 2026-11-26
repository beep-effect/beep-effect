---
title: A plain, untagged, unanchored `<<` mapping key is always emitted plain
date: 2026-11-26
reversal: Route `<<` keys through ordinary key rendering so the quote fallback may quote them.
governs:
  - src/internal/stringifier.ts#isPlainMergeKey
  - src/internal/stringifier.ts#stringifyMappingKeyLines
enforcedBy: []
---
A plain `<<` key resolves to `tag:yaml.org,2002:merge` and splices the aliased mapping into its parent, while `'<<'` is an ordinary string key that merges nothing. The difference is silent, since both parse and round-trip, so re-emitting a merge key quoted is a semantic rewrite the fidelity obligation forbids. The flow and block mapping branches both render keys through `stringifyMappingKeyLines`, so they cannot disagree.
The rule is narrow: it fires only on a plain-styled scalar with no tag and no anchor, so an explicitly quoted `'<<'` and any tagged key keep their written form. A key with no style counts as plain, because a hand-built unstyled `<<` can only have been meant as a merge key.
Rejected: quoting `<<` like any other indicator-led key; treating a quoted `'<<'` as a merge key too.
