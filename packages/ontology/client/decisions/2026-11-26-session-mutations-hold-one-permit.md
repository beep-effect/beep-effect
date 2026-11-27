---
title: Session mutations hold one permit across read and write; SPARQL and validation reads run outside it
date: 2026-11-26
reversal: Drop sessionMutationSemaphore from the mutation atoms, or wrap runOntologySparqlAtom and runOntologyValidationAtom in it and delete sessionMoved.
governs:
  - src/aggregates/Session/Session.atoms.ts#sessionMutationSemaphore
  - src/aggregates/Session/Session.atoms.ts#sessionMoved
  - src/aggregates/Session/Session.atoms.ts#mutateOpenSession
  - src/aggregates/Session/Session.atoms.ts#runOntologyValidationAtom
  - src/aggregates/Session/Session.atoms.ts#runOntologySparqlAtom
enforcedBy: []
---

Every mutation reads the open session, awaits an RPC that returns a whole new session and writes it back. One permit spans the read and the write, so a queued mutation starts from the previous one's committed session. Undo and redo rewrite the session from a snapshot and take the same permit.
Two mutations without the permit both start from session S and return S+A and S+B; whichever lands last drops the other change with no error (a double-clicked Apply, or a graph gesture fired while Apply is pending).
SPARQL and validation do not take the permit, because a slow read must never block editing. Each read records the session signature it started from, and `sessionMoved` discards a result whose session changed meanwhile, showing the stale-read message instead of rows or a verdict about the old ontology.
Rejected: a lock around the write only, which still races, and reads that hold the permit, which freeze editing behind a slow query.
