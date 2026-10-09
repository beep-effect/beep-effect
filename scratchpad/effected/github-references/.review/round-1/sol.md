### sol-1-1
- file: scratchpad/effected/github-references/IssueReferences.ts:60
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-33; `standards/schema-first-development-prompt.md` “Schema owns pure data”; D5 and D11.   evidence: `IssueReference` and `BareLineReference` are handwritten interfaces at lines 60 and 80. The same applies to `ClosingList`, `ReferenceList`, and `HarvestedReferenceList` in `ClosingList.ts:67`, `:79`, and `:365`. These are concrete parser-result data models, with no corresponding schemas. The four law commands listed in the port contract’s section 8 cover imports, Effect functions, terse helpers, and native runtime usage; they do not verify schema-authored data models.
- failure: The parser-result shapes exist only as erased TypeScript declarations. Their fields have no schema source of truth from which validation, codecs, equivalence, or arbitrary generation can derive. These models do not qualify for the service-contract or type-level machinery exceptions.
- fix: Define annotated `S.Struct` models and derive the existing same-name types from their `.Type`. Preserve the current structural types and plain-object parser outputs to satisfy D9; class construction is unnecessary. If the schemas become public runtime exports, record those additions in Port notes and the ledger.

### sol-1-2
- file: scratchpad/effected/github-references/IssueReferences.ts:53
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` laws 17 and 19; `standards/effect-first-development.md` EF-12 and EF-12b; operator identity requirement in `scratchpad/EFFECTED_PORT_GOAL.md`; D5 and D11.   evidence: The named closing-keyword domain is an exported tuple plus an indexed-access type, with an anonymous, unannotated `S.Literals` schema inside its guard. `ClosingList.ts:92–95` reconstructs the combined and closing-only domains the same way; `ReferenceKeyword` at `ClosingList.ts:60` and `KeywordFamily` at `KeywordFamily.ts:19` also lack named schema definitions. No `$ScratchpadId` identity or `LiteralKit` appears in these files. The listed four law gates do not check these modeling requirements.
- failure: Named, reused literal domains remain outside the required `LiteralKit` model, and the newly introduced schemas lack canonical identity metadata. Closing-keyword validation is also reconstructed in two files instead of deriving from one named schema.
- fix: Introduce identity-annotated literal kits for the closing keywords, reference keywords, and keyword families. Derive the existing keyword arrays and types from those kits, preserving tuple order and public types, and derive membership guards from the shared schemas.

### sol-1-3
- file: scratchpad/effected/github-references/IssueReferences.ts:118
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` “Hard requirements,” “Carrier policy,” and “Kind-split Example law”; port contract section 10.2.   evidence: Exported API documentation retains `@remarks` and `@example` throughout `IssueReferences.ts`, `ClosingList.ts`, and `KeywordFamily.ts`. No owning declaration has `@category` or `@since`, and several runtime exports—including `parseBareLines`, `collectReferenceLists`, and `harvestReferenceLists`—lack examples. S2 is explicitly deferred.
- failure: The documentation does not meet the required section grammar, metadata, or value-export example requirements.
- fix: During S2, preserve the upstream prose while converting legacy carriers to titled sections, add canonical categories and `@since 0.0.0`, and supply meaningful examples for runtime exports that lack them.

### sol-1-4
- file: scratchpad/effected/github-references/README.md:28
- class: docs   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` section 10.3, “README adaptation.”   evidence: The README retains the upstream badges, pre-1.0 stability block, plugin recommendation, and Install section. Its examples still import `@effected/github-references`, including the quick start at line 49. S2 is explicitly deferred.
- failure: Following the README’s installation and example instructions exercises the published upstream package rather than the lab port being documented.
- fix: During S2, remove the specified publishing boilerplate and rewrite examples to imports that resolve to the lab module, retaining the API prose and grammar guarantees.

### sol-1-5
- file: scratchpad/test/github-references/ClosingList.test.ts:27
- class: test   severity: backlog
- standard: Port contract section 11.2; `.patterns/testing-patterns.md` “Choose assertions by value, not by tester.”   evidence: Option results are asserted with `assert.isTrue(O.isSome(parsed))`, `assert.isTrue(O.isNone(...))`, and subsequent `O.getOrThrow` calls throughout `ClosingList.test.ts` and `IssueReferences.test.ts`. S3 is explicitly deferred.
- failure: The tests retain the upstream container-assertion style instead of the required canonical Option assertion helpers.
- fix: During S3, replace presence checks and extraction with `assertSome(parsed, expectedPayload)` and rejection checks with `assertNone(parsed)`, preserving every existing case and plain-value assertion.

### sol-1-6
- file: scratchpad/test/github-references/IssueReferences.test.ts:14
- class: test   severity: backlog
- standard: D10; `scratchpad/EFFECTED_PORT_GOAL.md` section 11.4, “S3: property floor.”   evidence: All three test files contain example-based cases; none uses property tests, arbitrary generation, or `fcRuns`. A read-only differential probe produced zero mismatches across 127,008 parser comparisons and all twelve keyword-family mappings, but that probe is not retained in the suite. S3 is explicitly deferred.
- failure: The retained tests do not satisfy the parser property floor or continuously verify fidelity over generated inputs.
- fix: During S3, add properties for canonical render/parse fidelity and normalization idempotence, plus generated differential comparisons against the pinned oracle. Use the canonical property-test API and `fcRuns`, retaining the existing upstream cases.

REQUIRED: 2
BACKLOG: 4