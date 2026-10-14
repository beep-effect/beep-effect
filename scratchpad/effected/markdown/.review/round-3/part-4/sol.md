### sol-3-1
- file: scratchpad/effected/markdown/internal/inlines/autolinkLiteral.ts:334
- class: schema   severity: required
- standard: `standards/schema-first-development-prompt.md`, “Schema owns pure data”; AGENTS.md schema-first domain-model law; D5 and D11.   evidence: At `3ad7b305790c7f0903f6d55766c55186745ba2d1`, `EmailMatch` is a primitive-only interface containing `from`, `to`, and `url`. `scanEmails` returns `ReadonlyArray<EmailMatch>` at line 373 and constructs those records at line 466. This is parser domain data, rather than a service contract, overload surface, or type-level operation. The pinned upstream has the same interface, but the port’s schema-first requirement applies to this retained model. The four green beep laws do not enforce ownership of private pure-data interfaces.
- failure: The email scanner’s named result model has no executable schema. Its shape and offset invariants exist only in a handwritten TypeScript interface, leaving this domain model outside the required schema-derived representation.
- fix: Define a file-local, annotated `EmailMatch` schema and derive the same-name type from it. Use nonnegative integer schemas for the merged-text offsets and a string schema for the destination. Keep the existing plain-object records, matching algorithm, and export surface.

### sol-3-2
- file: scratchpad/effected/markdown/internal/inlines/codeSpan.ts:22
- class: jsdoc   severity: required
- standard: `.patterns/jsdoc-documentation.md`, “Description and section grammar”: sections must be non-empty; D11 includes JSDoc-law breaks.   evidence: Inspection of the pinned Git objects confirms eight `**Details**` headings followed immediately by an Example section or tags, without any section content: `codeSpan.ts:22`, `emphasis.ts:64`, `emphasis.ts:176`, `entity.ts:22`, `escape.ts:20`, `footnoteReference.ts:64`, `footnoteReference.ts:141`, and `lineBreak.ts:24`. Their presence in the supplied docgen-green commit demonstrates a gate miss. Round-2 `back-27` explicitly deferred this defect; it did not close it or accept a behavioral deviation. The current brief contains no JSDoc deferral.
- failure: Eight exported documentation blocks violate the binding section grammar and render empty Details headings in documentation and IDE hovers.
- fix: Remove the eight empty `**Details**` headings and their padding, preserving the lead descriptions, examples, and tags.

REQUIRED: 2
BACKLOG: 0