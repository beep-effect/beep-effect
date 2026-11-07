---
title: "Library export names keep the Library prefix; ontology class names are the bare SPEC names"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Rename the exports to the bare names in one mechanical pass; the class IRIs do not change"
---

The @beep/repo-cli/commands/Research facade already re-exports LibrarySource, LibraryCapture and the rest, and around 8k lines of Library code import them. Renaming the exports would be churn with no ontology value. The ontology identity comes from $I.class("Source") and its siblings, so the class IRIs are .../Library.schemas/Source etc. The one rename is LibraryVersion to LibrarySourceVersion, because SourceVersion is the named SPEC model and the old name was ambiguous.
