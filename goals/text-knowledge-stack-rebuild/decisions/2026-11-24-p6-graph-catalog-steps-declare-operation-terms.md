---
title: "P6: the ten graph catalog steps declare operation terms, GraphOperation.name is removed, and the result cache keys on the term"
date: 2026-11-24
lane: "p6"
reversal: "Keep GraphOperation.name as a plain string beside the carried Operation and name its Operation with a parent term"
---

Independent review of the P6 design. A GraphOperation carries an Operation whose name is a TermIri, but the catalog steps (np/src/Graph/GraphOperations/Catalog.ts:65,95,126,156,186,217,251,271,291,311: sentencize, tokenize, posTag, lemmatize, extractEntities, parseDependencies, extractRelations, toLowerCase, toUpperCase, trim) have no declared terms, and the ResultStore keys results by operation name and node id (ResultStore.ts:118-128), so reusing one parent term would collide in the cache. The identity row, moved before the Operation row, declares operation:Sentencize, Tokenize, PosTag, Lemmatize, ExtractEntities, ParseDependencies, ExtractRelations, ToLowerCase, ToUpperCase and Trim beside MapToLaw and ProposeClaim. GraphOperation.name: string (Operation.ts:68) is removed and ResultKey.operationName carries the term IRI string; the cache is in-process with no stored reader. Amends 2026-11-24-p6-operation-terms-are-declared-for-the-office-action-steps and 2026-11-24-p6-one-operation-arrow-and-graph-operations-carry-it.
