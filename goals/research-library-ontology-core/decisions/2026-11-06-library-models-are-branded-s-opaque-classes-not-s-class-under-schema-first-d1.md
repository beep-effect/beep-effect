---
title: "Library models are branded S.Opaque classes, not S.Class, under schema-first D1"
date: 2026-11-06
lane: "feat/research-library-ontology-core"
reversal: "Convert back to S.Class if D1 adopts an exception for ontology-bearing models; the fold output stays identical"
---

The SPEC asked for named S.Class models. The repo's schema-first lint (rule schema-first-inventory, D1) requires plain-data models to be branded S.Opaque over S.Struct, and repo standards outrank packet prose (GOAL.md and the SPEC source hierarchy). The models stay named exported classes (class LibrarySource extends S.Opaque<...>()(S.Struct({...}))). Their ontology identity comes from .annotate($I.class("Source")), the same form packages/foundation/modeling/ontology/test/Fold.test.ts folds, so the T-Box, the SHACL shapes and the S.Class acceptance intent (named, annotated, no anonymous exported S.Struct) are unchanged.
