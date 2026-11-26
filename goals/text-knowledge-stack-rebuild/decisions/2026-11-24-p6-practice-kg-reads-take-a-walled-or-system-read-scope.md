---
title: "P6: every Practice KG query takes a PracticeKgReadScope, Walled for a principal and Unwalled only for named system readers"
date: 2026-11-24
lane: "p6"
reversal: "Pass GrantedScopes to each query directly and delete PracticeKgReadScope; give the matter lookup service and the self-check a granted scope"
---

PracticeKgReadScope (PracticeKg.wall.ts) is a tagged union: Walled { familyKeys, mailFolders } is built from the principal's GrantedScopes by practiceKgReadScopeOf, in a stable sort; Unwalled is a system read. The tool handlers always read through LawPrincipal and MatterAuthority.grantedScopes, so a host without a configured principal gets the empty grant and every walled tool answers nothing (decision p6-an-unconfigured-principal-gets-the-empty-authority). Two readers are system reads and take Unwalled: PracticeKgMatterLookupLive, which docket intake uses to resolve a reference before any principal is involved, and the host self-check, which proves the bundle answers the tools' queries. Neither answers a principal's request; the kg_matter_lookup tool reads through the walled scope. The filters are SQL fragments built inside each query (practiceKgFamilyKeyFilter, practiceKgClientFilter, practiceKgMailFolderFilter) with sqlStringLiteral IN-lists rather than extra bind parameters: the values are decoded PracticeKgFamilyKey and MailFolderBinding fields, every query keeps its parameter list, and an empty grant is the literal FALSE, so a query cannot widen by an unbound parameter.
