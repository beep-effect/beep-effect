# Instance

- id: `knowledge-ref-classification-input`
- file:line: `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:1855`
- symbol: exported `KnowledgeRefClassificationInput`
- members: `kind`, `pairingAmbiguous`, `ungoverned`
- source: `f5e1d4c64f37e0a8c42e217eee5f06841220c161`
- status: designed; Tier 1; independent P3 and implementation pending.

# Current shape

The exported type at 1855-1864 combines four `KnowledgeRefKind` values with two grammar booleans, independent pattern context, surface, resolution status, and anchor/token Options. Its documentation at 1847-1849 says pairing ambiguity belongs to goal URIs and ungoverned syntax belongs to repository paths. The global classifier checks pairing before governance at 1961-1965, then host handling, then resolution.

The prior independent adjudication correctly found that producer coherence alone could not settle this public contract. Benjamin has now answered **Require kind-specific grammar flags**, recorded in `DECISIONS.md` under the 2026-09-22 ruling. Wrong-kind and simultaneous grammar flags are not legitimate inputs. Successful execution of the old total cascade does not make them legal. This restores the historical inventory id as qualified rather than retaining the unsupported D1 disposition.

E2 is the global ordered flag cascade that currently dispatches across the unconstrained bag. The kind-specific ownership comment and owner ruling establish the legal grammar; a documentation comment is not an E1 exclusive-write site. No invented defensive validation or rejection guard is claimed. `patternContext` remains an independent fact, not a grammar state.

# Cardinality gap

The inventory projection is `(kind, pairingAmbiguous, ungoverned)`: **4 × 2 × 2 = 16 representable / 6 legal**.

| Kind | Legal flag pairs (pairingAmbiguous, ungoverned) | Target grammar |
| --- | --- | --- |
| host-path | false,false | no grammar field |
| upstream | false,false | no grammar field |
| repo-path | false,false; false,true | governed; ungoverned |
| goal-uri | false,false; true,false | paired; ambiguous |

This follows directly from the two implications in the ruling. Every listed tuple remains legal for both surfaces, every one of the five resolution statuses, both pattern values, and every anchor/token Option combination. No independent dimension is narrowed. Including those finite dimensions and Option presence gives **16 × 2 × 5 × 2 × 4 = 1280** representable presence abstractions versus **6 × 2 × 5 × 2 × 4 = 480** legal ones. These are presence abstractions, not counts of concrete objects: anchor literal choices and arbitrary token strings are not enumerated in that number. No producer-only cardinality or both-present host constraint is assumed.

# Target schema

Replace the exported TypeScript literal with an exported runtime schema and same-name `typeof ...Type` alias. Reuse existing `KnowledgeRefKind`, `KnowledgeRefSurface`, `KnowledgeRefResolutionStatus`, `KnowledgeHostAnchor`, and `$I`. Do not invent another reference-kind domain or alter the encoded KnowledgeRef union.

Use four named `S.Class` members in this existing module, with `kind: S.tag(KnowledgeRefKind.Enum[...])`. Their common fields are:

- `surface: KnowledgeRefSurface`;
- `resolutionStatus: KnowledgeRefResolutionStatus`;
- `anchor: S.Option(KnowledgeHostAnchor)`;
- `token: S.Option(S.String)`;
- `patternContext: S.Boolean`.

**All five common fields occur on all four members**, including reserved upstream and nonhost anchor/token payloads. Preserve existing runtime Options with `S.Option`, not an OptionFrom boundary conversion. Keep arbitrary token strings, including empty strings. Do not require resolutionStatus=not-applicable for a grammar failure or for host inputs.

Host and Upstream add no grammar field. Repo adds `governance`, a private annotated `LiteralKit(["governed", "ungoverned"])`. Goal adds `pairing`, a separate private annotated `LiteralKit(["paired", "ambiguous"])`. These payload-free domains use literal kits, not extra tagged object layers. Construct the kits from unannotated bases and preserve needed statics with `withLiteralKitStatics`; do not call mapMembers on a reconstructed kit assuming annotations retained every helper. Their choice fields are required, with no implicit default.

Assemble the four named classes with `S.Union`, annotate using `$I.annote(...)`, then apply `S.toTaggedUnion("kind")` last. This reuses the existing kind domain rather than duplicating its literal list. Use the resulting `.cases`, `.guards`, and `.match`; class tags are defaulted, so `.make(...)` callers omit kind. Class schemas are annotated with local identity and semantic descriptions. No handwritten structural guards, exported parallel interfaces, redundant fixed-false properties, or compatibility boolean bag survive this owner.

# Migration inventory

All source anchors below are in Knowledge.refs.ts unless named otherwise.

1. **Declaration and docs 1842-1864:** replace the type and explain the six legal grammar states. Clarify that the owner ruling restricts grammar flags only; common Options and resolution statuses remain accepted on every kind. Export the schema and derived type from the existing module without broadening root barrels.
2. **Classifier 1960-1987:** exhaustive kind match. Repo dispatches ungoverned directly to `ungoverned-syntax`, otherwise uses existing resolution classification. Goal dispatches ambiguous directly to `ambiguous-ref-pairing`, otherwise uses that same resolution classification. Upstream always uses resolution classification. Host retains the exact Option branch and existing host helper calls. Keep one local resolution classification path shared by the three nonhost normal cases rather than copying the five-arm table or adding a raw-input normalizer.
3. **Production adapter 2958-2967:** lands atomically with `knowledge-ref-candidate`. Match the new private five-case candidate. Host builds classifier Host using Some(ref.anchor)/Some(ref.raw). GovernedRepo and UngovernedRepo build Repo with matching governance. PairedGoal and AmbiguousGoal build Goal with matching pairing. Each forwards unchanged surface, computed resolution.status, and independent patternContext; nonhost anchor/token remain None because these actual producers currently write None. That producer fact does not narrow the public schema. No production Upstream writer is added merely because the public case exists.
4. **Upstream private producers 2512-2535, 2622-2651, 2668-2692 and callers 2694-2751:** owned by the RefCandidate design. Their extraction, pairing decisions, source strings and ordering remain as specified there. Coordinate their new candidate constructors with the adapter above; do not retain a transitional public grammar-flag bag.
5. **Documentation examples 1929-1951:** switch to `.cases["host-path"].make` and `.cases["repo-path"].make`, explicitly selecting governed. Preserve their classification results and common field values. Update descriptions of the cascade so they do not imply wrong-kind or simultaneous grammar flags are supported.
6. **Tests in knowledge-refs.test.ts 35,747-784:** import the runtime schema, not only the type. Migrate archivalHostInput to Host construction. Replace grammarFailureInput's unconstrained kind plus flag-pair parameter with two explicit case constructors or schema-derived case values; no helper may recreate the old product. Keep existing expectations and extend across all resolution statuses.
7. **Observation and report consumers 2968-2997:** classification remains the same KnowledgeRefClassification literal. Retain KnowledgeRefObservation, resolution/remediation, refId preimages, occurrence counting, sorting, report metadata and encoded output. No field is added to the report.

Exhaustive Graft searches found only the module examples, production adapter and test helpers/calls as direct classifier/type consumers. Knowledge.command.ts, Knowledge.service.ts and Lint/RoadmapRefs.ts use other facilities. The CLI package exposes command subpaths, so this is an exported decoded TypeScript migration despite package privacy. Do not pretend external callers are exhaustively knowable; document the source migration and use the existing package release policy at implementation.

# Guard-deletion accounting

| Current site | Obligation removed | Replacement / retained behavior |
| --- | --- | --- |
| 1855-1864 | Cross-kind flag slots admit ten illegal projected states | Four members with two scoped literal domains |
| 1847-1850 | Caller must manually synchronize flags with kind | Schema represents the ratified invariant; docs explain legitimate dimensions |
| 1961-1965 | Global ordered boolean checks carry grammar dispatch | Kind-scoped literal dispatch; no simultaneous-state tie-break |
| 2959-2966 | Adapter copies both flags for every kind | Candidate match constructs the relevant classifier member |
| tests747-770; examples1929-1951 | Every caller writes fixed false values and can pair wrong kind/flags | Schema case constructors and scoped grammar choices |

The grammar decision itself is not deleted: it moves to scoped literal dispatch. No guard count is invented. Preserve O.match(anchor), the None actionable-host fallback, token None→empty-string fallback, pattern-before-archival priority, lexical convention predicates, and all five resolution arms. These are supported behavior, not coherence guards. The source's host helper boolean parameters are excluded function flags and are not new inventory owners.

# Encoded-side impact

Host anchor=None returns actionable-host-path even with patternContext=true or archival surface. With Some(anchor), token=None becomes the empty string, then pattern context wins over archival; live conventions retain their exact ordering. Host ignores resolutionStatus. Nonhost grammar failures take precedence over every resolution status. Nonhost normal cases map resolved→verified, missing→broken-target, identity-mismatch→identity-mismatch, producer-owned→producer-owned-target, and not-applicable→ambiguous-ref-pairing. Upstream retains the same normal nonhost mapping. Nonhost anchor/token and patternContext remain accepted even where ignored.

Tier 1 because this is an in-process carrier with no existing codec, persistence writer, request payload or report field. The exported decoded API changes atomically within the campaign authorization. Do not add a legacy encoded input bag or claim wire compatibility requires retaining illegal states. Conversely, do not infer blanket permission to narrow a legitimate input dimension from the grammar ruling. New schema encode capability is not a pre-existing wire contract and must not be introduced into the report pipeline.

The compatibility obligation is equal classification for every legal old input and byte-identical report/CLI JSON. Preserve existing ref and resolution schemas, raw subject strings, optional displayPath omission, Unicode normalization, sorting, duplicate ordinal allocation, refIds, remediation text and operational failure ordering. Package changeset requirements are determined by implementation release policy, not inferred solely from package privacy or absence in ignore lists.

# Test impact

At P4, compare baseline and migrated classifiers for all 480 legal presence abstractions, using representative Some(anchor)/Some(token) values, and separately expand the finite anchor domain and lexical token categories. The presence matrix alone does not prove all arbitrary string behavior. Cover None/Some combinations on every kind; all five statuses for every grammar state; both surfaces and pattern values; reserved upstream. Include host None with pattern+archival, host Some with token None, empty token and recognized/unrecognized convention spellings. Preserve exact helper logic to support the unbounded token domain.

Add type-level negative fixtures rejecting wrong-kind governance/pairing and simultaneous grammar fields in normal constructors, with no unsafe casts that defeat the assertion. Schema boundary tests must verify the target typed model cannot carry an illegal grammar state; do not claim default excess-property stripping rejects every unknown extra key unless deliberately configured and tested. No new arbitrary external decoder is needed for an in-process caller.

For integrated candidate/classifier migration, retain existing scanner fixtures and compare complete report JSON against the saved source baseline. Cover all five candidate states with both pattern values, duplicate refs, ambiguous goals, ungoverned existing targets, host conventions and generated evidence. Verify manifest reads remain deduplicated, sorted and forbidden for ambiguous goals, and that malformed-manifest and UTF-8 behavior is unchanged. Run focused knowledge refs tests, full `bun run beep quality package-verify @beep/repo-cli`, and canonical Yeet verification/publication gates. No package implementation or package verification is claimed by this P2 document.

# Risk

Land this owner **atomically with the reviewed RefCandidate migration after P3/GATE 2**. That resolves the apparent conflict with the older exact-source candidate design's instruction to keep the public bag unchanged: that instruction correctly bounded its earlier unresolved-owner audit, and is superseded at joint implementation only by this newly ratified separate design. Preserve its historical artifact and add an explicit cross-design reconciliation record. Do not land the classifier first with an unchecked adapter from the old broad candidate type or silently reconstruct both public booleans. Each owner retains its own cardinality and deletion accounting; no double implementation credit.

This proposal is a P2 source audit plus binding semantic ruling. It does not settle citation holds, complete a census round, satisfy independent review, or authorize implementation by itself.
