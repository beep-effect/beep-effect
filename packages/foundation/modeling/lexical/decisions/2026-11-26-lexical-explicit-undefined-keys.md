---
title: Optional Lexical keys accept an explicit undefined and decode it to None
date: 2026-11-26
reversal: Replace OptionFromLexicalUndefinedOr with S.OptionFromOptionalKey on each field, so a present key holding undefined fails to decode.
governs:
  - src/Lexical.model.ts#OptionFromLexicalUndefinedOr
enforcedBy: []
---

Lexical's own exportJSON writes several optional keys with an explicit undefined (checked: this.getChecked(), theme: this.getTheme(), frozenRowCount: x ? x : undefined). The fields built with OptionFromLexicalUndefinedOr decode an absent key and an undefined key alike to None.
Reason: the producer is third-party (the pinned @lexical/* exportJSON sources), so the wire cannot be changed to omit the key; rejecting it would refuse the editor's own serialized state.
Rejected: the repo's exact-optional-key default, S.OptionFromOptionalKey (EF-40), which rejects a present key holding undefined.
Accepted limit: this is an EF-40 exception scoped to keys Lexical writes as undefined.
