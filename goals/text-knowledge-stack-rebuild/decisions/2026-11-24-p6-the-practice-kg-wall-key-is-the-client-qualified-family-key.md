---
title: "P6: the Practice KG wall key is the client-qualified family key; rows with a NULL client or family are denied"
date: 2026-11-24
lane: "p6"
reversal: "Return MatterScope to bare docket families and filter on docket_family"
---

Independent review of the P6 design. Practice KG matters are keyed by the client-qualified family_key (server/src/PracticeKg.matters.ts:297-306), but documents and search filter on the bare docket_family (PracticeKg.queries.ts:211), and the KG spells the qualified key as client || '.' || docket_family, NULL when client is NULL (:58); documents.client, docket and docket_family are nullable (PracticeKg.fts.ts:61-68). Two clients with the same family string would share a bare-family grant, and a config check over configured keys cannot see a data collision. The wall key is PracticeKgFamilyKey { client, family }, both non-empty, encoded as the KG spelling. Every walled query filters on it inside its SQL: client || '.' || docket_family on kg_node and documents, family_key on the matter tables, and for candidate claims the snapshot family with the document node's client. A row whose client or family is NULL has no key and is denied. The two-matter fixture files its matters under two clients that share one bare family string. Amends 2026-11-24-p6-matter-authority-port-principal-and-scope-bindings (MatterScope.familyKeys replaces docketFamilies) and the Practice KG wall decision.
