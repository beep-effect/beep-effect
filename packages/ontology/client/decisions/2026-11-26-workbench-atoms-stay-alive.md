---
title: Ontology workbench state atoms are keep-alive singletons
date: 2026-11-26
reversal: Replace workbenchState with plain Atom.make so the registry idle TTL disposes the atoms.
governs:
  - src/aggregates/Session/Session.atoms.ts#workbenchState
  - src/aggregates/Session/Session.atoms.ts#ontologyAutoOpenAttemptedAtom
enforcedBy: []
---

The registry disposes an atom with no listeners and no dependents once its idle TTL elapses, and the desktop sets a TTL. The workbench atoms are subscribed only from inside `OntologyWorkbench`, which unmounts when the user switches surface.
Without keep-alive, leaving the Ontology tab reset the open document, its unsaved change log, the dirty signature and the redo stack to their defaults after the TTL, and the workbench came back with no file open.
This is application state, not view state. The atoms are singletons, so keeping them alive leaks nothing.
Rejected: plain disposable atoms. Accepted limit: a per-editor atom family must not use workbenchState, since keep-alive would pin every editor ever created.
