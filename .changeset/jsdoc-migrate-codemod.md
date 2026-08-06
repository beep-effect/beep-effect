---
"@beep/repo-cli": patch
---

Ship the `beep quality jsdoc-migrate` pipeline (P1 of `goals/jsdoc-carrier-migration`):
`extract` scans the non-generated corpus into `path#symbol#ordinal`-anchored records with
`sourceHash`/`kind` verification fields and fails loudly on duplicate anchors; `titles` requests
per-anchor Example titles, remarks routing, lead split points, and `@see` purposes from the local
model proxy with per-anchor resume; `apply` rewrites affected blocks text-surgically by byte
offset behind fail-closed binding checks (bijection, hash, kind), quarantining any block whose
rewrite violates the two-clause conservation law or grows the `documentationShapeViolations`
oracle finding set; `verify` re-proves conservation between frozen originals and post-format
bytes into a schema-versioned proof manifest. The full-corpus dry run measures residue 32 of
11,674 affected blocks (31 unfenced examples plus one fence buried in `@remarks` content).
