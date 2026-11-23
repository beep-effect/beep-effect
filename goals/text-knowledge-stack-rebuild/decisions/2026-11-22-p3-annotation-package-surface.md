---
title: "P3: @beep/annotation defines no Context.Service, exports Annotation<Kinds, K>, and restrict takes registered kind names by type"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Add a service contract when a second implementation or state appears, by a decision file"
---

`@beep/annotation` defines no `Context.Service`. Every arrow is pure or needs only core's `Digest.Digest`, as in `@beep/text` (decision `p2-no-context-service-in-text`); a service would be a name for a function. The SPEC name is exported as `Annotation<Kinds, K>`, the content of an annotation of kind `K` (all kinds by default), and `AnnotationOf` goes. `restrict` and `closure` take a `HashSet` of `KindName<Kinds>`, so an unregistered name is a type error and needs no runtime refusal. `verifyDocument` stays internal to the checked decode; a body that fails its kind's encoding there is a `PreimageMintError`, and only a key that is not the hash of its value is a `DocumentKeyMismatch`.
