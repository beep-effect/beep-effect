---
"@beep/cosmos": patch
"@beep/graph-3d": patch
"@beep/n3": patch
"@beep/ontology-domain": patch
"@beep/oxigraph": patch
"@beep/shacl": patch
---

Quality-lane cleanup (PR-1 aux): `test:property` removed from the six manifests with no property tests (cosmos, graph-3d, n3, oxigraph, shacl, ontology-domain) so the Property Laws lane stops replaying their unit suites. Script-only manifest changes; no runtime behaviour changes.
