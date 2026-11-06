---
title: "Effect S.Class is the ontology source; Turtle and SHACL are generated"
date: 2026-11-06
lane: "explore/research-library-ontology"
reversal: "Delete the generated ontology/ files and the render subcommand; the S.Class models remain valid catalog schemas without annotations"
---

Named S.Class models with $I.annoteSchema annotations in Library.schemas.ts are hand-authored; the T-Box and shapes are projected through the @beep/ontology fold (fold -> AssembledOntology -> toTurtle) with IRIs minted by @beep/identity. LinkML (no installed tooling, interface-only TS generation) and hand-authored Turtle (two drifting sources) were rejected. Exploration decision 2026-11-06, T-Box source of truth.
