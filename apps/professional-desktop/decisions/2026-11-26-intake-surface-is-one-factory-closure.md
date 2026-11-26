---
title: One factory builds the intake actor atoms, DOM adapters and surface atom, so only the surface closure stays alive
date: 2026-11-26
reversal: Look up the intake actor, DOM adapters and actions through separate Atom.family entries keyed by workspace.
governs:
  - src/intake/Intake.atoms.ts#makeDocumentIntakeSurface
enforcedBy: []
---

`makeDocumentIntakeSurface` builds the actor atoms, the drag and drop adapters and the surface atom in one closure; the surface atom's closure is the only thing that has to stay alive. The actions atom reads no reactive state, so it computes once per workspace and every closure, the file-input React ref callback included, stays referentially stable across intake state changes.
Rejected: separate `Atom.family` lookups per piece. A second lookup could mint a second actor behind a WeakRef, and actions derived from reactive state would hand React a new ref callback on every intake transition.
