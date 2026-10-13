### sol-3-1
- file: scratchpad/effected/schema-org/internal/vocabulary.ts:2557
- class: jsdoc   severity: required
- standard: `.patterns/jsdoc-documentation.md`, Hard requirements (“Example code uses Effect patterns”); `standards/effect-first-development.md` EF-3 and EF-19 prohibit direct `JSON.stringify`; D11 makes a cited JSDoc/Effect-idiom violation required.   evidence: `rg -n 'JSON.stringify' scratchpad/effected/schema-org/internal/vocabulary.ts` finds seven calls in the added Example fences: lines 2557, 3518, 4472, 4507, and 4762–4764. These examples are absent from the pinned oracle. The calls occur inside comments, outside the source AST checked by the source diagnostics; compilation of an extracted example also permits native JSON encoding in these plain expressions. Consequently, green source and docgen gates do not establish compliance here. This is distinct from round-2 backlog-8, which covers native `.map` and `.includes` examples.
- failure: The new examples teach the native JSON encoding explicitly forbidden by the binding Effect guidance. Copying the documented usage reproduces the violation, despite the module’s green gates.
- fix: Remove the `JSON.stringify` wrappers and log the arrays directly, retaining the comments as descriptions of the returned values. These examples demonstrate row decoding and name resolution, so JSON serialization is unnecessary. This preserves every demonstrated value, requires no runtime change, and reduces the file’s size.

REQUIRED: 1
BACKLOG: 0