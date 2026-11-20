---
title: "P1: the beep: CURIE prefix retires with the path-derived curie annotation; semantic-web identity predicates keep their bytes"
date: 2026-11-19
lane: "goals/text-knowledge-stack-rebuild-p1-l0-identity"
reversal: "Re-declare beep: as a registry prefix over the authority root by a decision file in any later phase; no stored row uses the prefix."
---

P1 ruling 6. The beep: CURIE prefix retires together with the curie annotation that composers derive from code paths: the beep entry of CoreVocab and the four terms SemanticFoundationVocab declares (Vocab.ts:548-558) are removed, and their only readers are identity tests (map R section 1.2). The IRIs live on as instances minted under the semantic-foundation namespace, with today bytes. The semantic-web identity predicates (IdentityRdfBinding.ts:27-28, minted as $SemanticWebId.create("identity/identifier") and create("identity/curie")) keep their bytes, because their segments are chosen by hand and spell no module path (the module is identity/IdentityRdfBinding); they are declared as terms of an identity-rdf namespace semantic-web/identity/ with their current values. The rule for the rest: an identity predicate whose IRI spells a module path is re-minted with a deprecation row; one that does not keeps its bytes.
