### sol-2-1
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:204
- class: bug   severity: required
- standard: D9, D11, and section 14’s verified upstream-bug exception; [JSON-LD 1.1 §9.7, Lists and Sets](https://www.w3.org/TR/json-ld11/#lists-and-sets), permits node objects inside `@list` and `@set` containers.   evidence: Read-only `bun --no-cache -e` probes against this commit and the pinned oracle built `CreativeWork.make({ "@id": "#w", additional: { mentions: { "@list": [{ "@id": "#missing" }] } } })`. Both returned a successful build, `danglingReferences: []`, no conformance issues, and `Success` from `Conformance.validateResult(graph, { danglingReferences: "report" })`. Substituting `@set` produced the same results. An `@list` containing `{ "@id": "bad id" }` also built successfully. The lab correctly detects the corresponding direct reference. This is new evidence for recognized JSON-LD containers beyond round 1’s direct scalar/array cases and its recorded exclusion of nested objects.
- failure: Wrapping a catch-all reference in a valid JSON-LD list or set bypasses identifier validation and the enabled graph-closure gate. The serializer retains the reference in the emitted document.
- fix: Extend the shared collector to recognize `@list` and `@set` containers and inspect their contained reference objects, retaining the originating property and discovery order. Keep value objects, including `@json` payloads, excluded. Add missing-target, present-target, malformed-id, and value-object regressions; record the additional upstream-bug evidence under section 14 before changing behavior.

### sol-2-2
- file: scratchpad/effected/schema-org/JsonLdDocument.ts:553
- class: law   severity: required
- standard: `standards/effect-first-development.md` EF-3 explicitly forbids `JSON.parse` and `JSON.stringify` and requires schema JSON codecs; D11.   evidence: On the supplied green commit, `toScriptBody` still directly executes `JSON.stringify(this.toJsonLd())`. Production calls also remain at `JsonLdDocument.ts:61,109`, `NodeRef.ts:61`, and `Conformance.ts:101,156,304`. These surviving calls establish a gap in the supplied gates. A read-only probe confirmed that `Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Json))(value))` preserves the native stringification bytes for script-closing text, lone surrogates, control escapes, quotes, backslashes, and supplementary Unicode.
- failure: The text serializer and diagnostic formatters continue to use the explicitly forbidden native JSON boundary, despite the module’s green gates.
- fix: Replace production stringification with schema JSON encoders, using `S.fromJsonString(S.Json)` for the document and `S.fromJsonString(S.String)` for quoted diagnostic strings. Use the synchronous Result form and retain the existing script escaping, public return types, and exact diagnostic bytes.

### sol-2-3
- file: scratchpad/effected/schema-org/Conformance.ts:578
- class: docs   severity: backlog
- standard: D11’s backlog classification for documentation corrections without a demonstrated JSDoc-law failure.   evidence: `Conformance.check` documents that “A prefixed term is skipped entirely, with no issue.” Read-only probes returned `PropertyNotOnType` for `schema:softwareVersion`, `UnknownTerm` for `bogus:telephone`, and no issue for `gs1:telephone`.
- failure: The public method documentation incorrectly tells callers that all prefixed terms bypass checking. Native `schema:` terms and undeclared prefixes are checked.
- fix: Qualify the bullet to say that terms with a declared foreign prefix are skipped; explicitly state that `schema:` terms and undeclared prefixes are checked.

REQUIRED: 2
BACKLOG: 1