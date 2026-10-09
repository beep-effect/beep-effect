### fable-1-1
- file: scratchpad/effected/markdown/MarkdownDiagnostic.ts:52
- class: law   severity: required
- standard: D9 + EFFECTED_PORT_GOAL.md section 14 (deviation protocol: ledger row first, then code, then the smallest adjusted test, then README Port notes); allowed cause law:schemaNumber (tsconfig.base.json:208 'schemaNumber': 'error'; effect-tsgo docs/rules/schema-number.md); precedent scratchpad/effected/jsonc/README.md deviations 9 and 13 which record the identical switch with pinning tests   evidence: Upstream Schema.Number became S.Finite at MarkdownDiagnostic.ts:52-55 (offset/length/line/character), MarkdownEdit.ts:54-55 (MarkdownRange) and :71-72 (MarkdownEdit), FrontmatterSource.ts:88 (FrontmatterSourceSplit.bodyOffset), MarkdownFormat.ts:174-175 (MarkdownModificationError); MarkdownNode.ts:45-47 Point too (part-2 surface). Read-only bun probe against the lab classes: MarkdownDiagnostic.make({offset: NaN,...}), MarkdownEdit.make({length: Infinity,...}), MarkdownRange.make({offset: NaN}), FrontmatterSourceSplit.make({bodyOffset: NaN}), MarkdownModificationError.make({offset: NaN,...}) each THROW 'Schema validation failed'; S.decodeUnknownResult(MarkdownDiagnostic)({offset: Infinity,...}) REJECTED; controls using upstream's S.Number (S.Struct decode and S.Class.make) ACCEPTED. README.md:517-519 says 'Deviations: None'; PORT_LEDGER.json row w2-markdown has deviations: []; rg 'NaN|Infinity|non-finite' scratchpad/test/markdown/*.test.ts finds no pinning test (only an unrelated ?? Number.NaN fallback at frontmatter.test.ts:192).
- failure: A section-14 deviation (different accepted input: non-finite offsets/lengths now throw on construction and fail decode) ships while the port notes and ledger assert no deviation exists and no test pins the new behaviour; the integrator and the promotion grill have no record that these five classes reject what upstream accepted.
- fix: Add one ledger deviations row to w2-markdown (reason law:schemaNumber, naming MarkdownDiagnostic, MarkdownRange, MarkdownEdit, FrontmatterSourceSplit, MarkdownModificationError); add one 'rejects a non-finite offset' case (jsonc's 'rejects a non-finite width' shape) to diagnostic.test.ts, edit.test.ts, frontmatter-source.test.ts and format.test.ts; add the README Port notes -> Deviations entry citing those tests.

### fable-1-2
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:26
- class: law   severity: required
- standard: D9 + section 14 ('a different error tag' is a deviation; procedure: ledger row, adjusted smallest test, README entry); allowed cause law:7 (standards/effect-laws-v1.md: no native Error in production source); precedent scratchpad/effected/jsonc/README.md deviation 1 (native throw -> typed, recorded under law:7)   evidence: Upstream throws new Error(...) in three places; the lab throws S.TaggedError subclasses: SchemaRegistryError (declared :26-33, thrown FrontmatterResolver.ts:368/378/386/392), OverlappingMarkdownEditsError (MarkdownEdit.ts:26, thrown :91), DocumentNavigationError (MarkdownDocument.ts:42-49, thrown :218/:239). Probe: SchemaResolver.fromRegistry({'': S.String}) THROWS _tag SchemaRegistryError; MarkdownEdit.applyAll with overlapping edits THROWS _tag OverlappingMarkdownEditsError (messages preserved byte-for-byte). Lab tests pin only the message or a bare throw: edit.test.ts:59/64 (regex), frontmatter-resolver.test.ts:334-340 (bare assert.throws), document-query.test.ts:159/161 and document.test.ts:396 (bare); README 'Deviations: None', ledger deviations: []. hardening.test.ts:193-194 already tightened the analogous LineIndex assertion (TypeError -> InvalidLineTableError, part-2 surface) with no record either.
- failure: Three observable error-tag deviations with a valid law:7 cause have no ledger row, no README entry and no adjusted test, so the thrown classes are outside the contract suite and the port notes misstate the module's behaviour relative to upstream.
- fix: Add one ledger deviations row (reason law:7) naming the three classes plus the README entry; pin the tag in the existing assertions (try/catch + assert.strictEqual on the thrown value's _tag at edit.test.ts:59/64, frontmatter-resolver.test.ts:334-340, document-query.test.ts:159/161, document.test.ts:396), or export the three classes and assert.throws(fn, Class), listing them under Added exports per D2.

### fable-1-3
- file: scratchpad/effected/markdown/MarkdownFormat.ts:525
- class: schema   severity: required
- standard: AGENTS.md Code Laws ('Prefer named schema building blocks, derived S.is(...) guards, and named LiteralKit internal domains over ad-hoc predicate helpers'); standards/effect-laws-v1.md law 19 (LiteralKit for named internal literal domains, especially when .is is part of the design); D5 (kit substitutions land in S4); precedent scratchpad/effected/jsonc/JsoncNode.ts:111 JsoncNodeType = LiteralKit([...])   evidence: Five named literal domains over MarkdownNodeType are HashSet.fromIterable<string> tables consumed only by HashSet.has: FLOW_TYPES :525, PHRASING_TYPES :539, FLOW_PARENTS :559, PHRASING_PARENTS :562, NO_MULTILINE_ANCESTORS :574; two hand-written guards isFlowReplacement :554 and isPhrasingReplacement :556 assert node is FlowContent / PhrasingContent from string membership. The explicit <string> type parameter widens every table so a misspelled member still compiles. Soundness of the current guards verified: FLOW_TYPES is a subset of the FlowContent union members (MarkdownNode.ts:784-796) and PHRASING_TYPES of PhrasingContent (:480-495). No LiteralKit import exists in the module (rg -l LiteralKit scratchpad/effected/markdown is empty).
- failure: The module's literal domains are untyped membership tables plus ad-hoc predicates instead of named kits with derived .is guards, below the D5 end-state bar the closed modules reached; MarkdownNodeType typos in these tables are not caught by tsgo.
- fix: import { LiteralKit } from '@beep/schema/LiteralKit'; const FlowReplacementType = LiteralKit(['blockquote','code','definition','footnoteDefinition','heading','html','list','paragraph','table','thematicBreak']) (same for PhrasingReplacementType, FlowParentType, PhrasingParentType, NoMultilineAncestorType); isFlowReplacement = (node: MarkdownNode): node is FlowContent => FlowReplacementType.is(node.type); replace HashSet.has(SET, x.type) with Kit.is(x.type) at :773/:775/:810; drop the effect/HashSet import.

### fable-1-4
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:401
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md:372 (Effect.fn('Name') for reusable effectful functions, the name being the API); law 22 scope (only Effect.gen bodies must use Effect.fn); upstream and jsonc span-naming convention Module.method   evidence: Upstream resolve is a plain arrow returning Effect.fail/Effect.succeed; the port wraps it in Effect.fn('resolve'). Every other span in the module and in the closed ports is qualified: Markdown.ts:240/326/467, MarkdownDocument.ts:665, MarkdownFormat.ts:754/832, scratchpad/effected/jsonc/JsoncFingerprint.ts:414 ('JsoncFingerprint.canonicalize').
- failure: Every registry resolution emits an un-namespaced span named 'resolve' that upstream never emitted and that cannot be attributed to this API in a trace.
- fix: Rename to Effect.fn('SchemaResolver.resolve'), or drop the wrapper to match upstream (the body is not a generator, so law 22 does not require it).

### fable-1-5
- file: scratchpad/effected/markdown/MarkdownDocument.ts:271
- class: perf   severity: backlog
- standard: D11 (perf is required only with a measurement or an algorithmic-class argument; neither applies, this is constant-factor); law 11 is satisfied, the issue is where the matcher is built   evidence: phrasingText (:268-296) constructs Match.value(node).pipe(five Match.discriminator cases, Match.orElse) plus fresh closures over `out` for every phrasing node on every call, and links (:556-564) does the same per tree node; upstream's switch allocated nothing per node. phrasingText runs for every heading and section text projection and recurses per container.
- failure: Per-node matcher and closure allocation in the heading/section-text and link walks; no measured regression, so backlog.
- fix: Hoist a module-level const phrasingNodeText = Match.type<PhrasingContent>().pipe(Match.discriminator('type')('text','inlineCode',(n) => n.value), ...('break', () => ' '), ...('image','imageReference',(n) => n.alt ?? ''), ...(containers, (n) => phrasingText(n.children)), Match.orElse(() => '')) and write out += phrasingNodeText(node); same shape returning O.Option<DocumentLink> for links.

### fable-1-6
- file: scratchpad/effected/markdown/FrontmatterResolver.ts:248
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21 (tersest equivalent helper form when behaviour is unchanged)   evidence: isMapping is P.isObjectKeyword(value) && !P.isFunction(value) && !A.isArray(value). isObjectKeyword admits functions (node_modules/effect/dist/Predicate.js:782-784: typeof object && not null || isFunction), which is why the port subtracts them; P.isObjectOrArray (Predicate.js:688-690) is exactly upstream's typeof value === 'object' && value !== null.
- failure: No runtime difference; three predicates express a guard two express.
- fix: const isMapping = (value: unknown): value is Record<string, unknown> => P.isObjectOrArray(value) && !A.isArray(value);

### fable-1-7
- file: scratchpad/effected/markdown/Markdown.ts:156
- class: effect-idiom   severity: backlog
- standard: standards/effect-laws-v1.md law 21; effect-laws-v1.md 'Dual-Arity Inventory Contract' ('A callable shaped (input, options?) is excluded because its one-argument form is already complete')   evidence: The @internal parsePassResult(text, options?) became dual((args) => isString(args[0]), ...) with an added data-last overload (options?) => (text) => Result (:153-156). Upstream is a plain function; the only call sites are data-first (Markdown.ts parse paths and MarkdownDocument.ts parseResult), so the second overload is unused.
- failure: Predicate-dispatched arity and a dead overload on an internal helper; parsePassResult() with no arguments now returns a function instead of being a type error.
- fix: Restore the plain export const parsePassResult = (text: string, options?: MarkdownParseOptions): Result.Result<BlockPassResult, MarkdownParseError> => { ... } and drop the dual/isString imports if unused elsewhere.

### fable-1-8
- file: scratchpad/effected/markdown/Frontmatter.ts:272
- class: jsdoc   severity: backlog
- standard: D4 / section 10 carrier conversion; S2 docgen (not yet run, so backlog by operator order); precedent: jsonc examples import '@beep/scratchpad/effected/jsonc/index' (scratchpad/effected/jsonc/Jsonc.ts:41,72) and runner examples '@beep/scratchpad/effected/runner/Exports'   evidence: JSDoc examples import from './index.ts' at Frontmatter.ts:272, FrontmatterSource.ts:137, Markdown.ts:210 and :276, MarkdownDocument.ts:326, MarkdownFormat.ts:610. Docgen compiles examples from a generated location where a relative './index.ts' does not resolve; every closed port uses the @beep/scratchpad/effected/<m>/index alias.
- failure: audit:effected -- docgen markdown (S2) will fail on these six examples.
- fix: Rewrite the six example imports to from '@beep/scratchpad/effected/markdown/index'.

### fable-1-9
- file: scratchpad/effected/markdown/MarkdownEdit.ts:26
- class: schema   severity: backlog
- standard: D5 ($ScratchpadId identity annotations); consistency with the port's sibling internal errors   evidence: OverlappingMarkdownEditsError is declared with the $I identity template but no $I.annote(...) third argument, while the other two port-added internal errors carry one (FrontmatterResolver.ts:26-33 SchemaRegistryError, MarkdownDocument.ts:42-49 DocumentNavigationError).
- failure: The error has an identity but no description annotation, so catalog and docgen surfaces show it blank; inconsistent with its siblings.
- fix: Append $I.annote('OverlappingMarkdownEditsError', { description: 'Overlapping edits were handed to MarkdownEdit.applyAll, a programmer error.' }) as the third argument.

REQUIRED: 3
BACKLOG: 6
