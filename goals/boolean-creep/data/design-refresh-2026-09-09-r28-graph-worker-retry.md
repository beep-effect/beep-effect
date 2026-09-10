# R28 graph-worker retry value audit

P2 audit on frozen HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7` and
`origin/main` `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Proposed disposition:
retain the qualified graph-worker owner, correct its finite control-state
cardinality to **12 representable / 5 legal**, correct its synthetic symbol
suffix, and withdraw thirteen remaining ineligible D1 probe seeds. Twelve of
those seeds contain callable predicates; the thirteenth invents member names
for inline SQL expressions. Four earlier withdrawals remain withdrawn.

The companion P2 design is
`data/provisional-r2-domains-ontology-graph-worker-requeue-latches.md`.
Neither file edits the current canonical design, inventory, archives, source,
tests, reports, or status. Parent integration and independent P3 design review
remain outstanding. The raw independent 6/5 claim requires a bounded correction
before it can support the proposed 12/5 canonical row.

## Independent receipt and qualification boundary

The completed lane is
`data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-epistemic-ontology.jsonl`,
with adjacent `r28-epistemic-ontology.execution.json`. Its receipt reports the
same source HEAD, start `2026-09-09T04:50:15.839287+00:00`, finish
`2026-09-09T05:01:56.793550+00:00`, exit 0, end-turn event true, no errors,
and one valid qualified record. Scoped validation was
`inventory OK: 1 records, 1 unique ids`. Coverage was epistemic and ontology
client/config/domain/server/tables/ui/use-cases source, excluding tests and
generated surfaces. This audit reads tests as contract evidence without running
them.

| Receipt provenance | SHA-256 |
| --- | --- |
| Independent JSONL, locally hashed | `26e59dc806c61db3dc2a67c45a21d6637b55950740cd4e6657c1c2ee005c50bd` |
| Execution JSON, locally hashed | `a2dbf027a8742673ecf5655ab44a3aba051baeacdee57c9ab092e83c601e0798` |
| Receipt base prompt | `6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b` |
| Receipt extra prompt | `5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b` |
| Receipt transcript | `0011437b1c501bfee406a03eba9d5111b58c5bbbb7f81adce1b7f9cf9d7b7ff2` |
| Receipt runner | `0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc` |
| Receipt seed | `bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24` |

The receipt's original qualification relation is correct: the retry marker is
only set true while retaining a command. Its 6/5 numerator incorrectly substitutes
the local producer subset for the declared payload type. This P2 correction is
native source analysis, not an independent P3 vote or a rewrite of that receipt.

## Actual owner and complete cardinality

`packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1779` declares
the exported `ontologyGraphWorkerBridgeAtom`. Its mounted callback has four
mutable locals at 1789–1792: `worker: Option<Worker>`,
`previousProjection: Option<OntologyGraphProjection>`,
`lastProjectionRequest: Option<WorkerCommand>`, and the Boolean
`requeuedAfterFailure`, initially false. The last two are the actual co-carried
retry owner. They are values, not callable predicates. The `.requeueLatches`
suffix is only a scanner label; no such nested object or symbol is declared.
Keep the stable ID and exact two members, and use symbol
`ontologyGraphWorkerBridgeAtom`.

`WorkerCommand` is imported from `@beep/ontology-use-cases/aggregates/Session`
at `Session.atoms.ts:46–48`. Its actual schema and type alias live in
`packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts`:
five literals at 24–30, five union cases at 74–99, type derived from the whole
schema at 122. The declaration at `Session.atoms.ts:1791` uses this whole type.

| Declared command kind | Required case payload, unchanged public protocol |
| --- | --- |
| `parseTurtle` | `request: ParseTurtleRequest` |
| `diffDatasets` | `before: Dataset`, `after: Dataset` |
| `computeSnapshot` | `session: Session` |
| `projectGraph` | `snapshot: OntologySnapshot`, `options: OntologyGraphProjectionOptions` |
| `applyGraphDelta` | `snapshot`, `delta: SessionChangeDelta`, `previous: OntologyGraphProjection`, `options` |

With one finite alternative per command kind, the declared Option has six
alternatives: None plus those five Some kinds. Across the retry Boolean it
represents `(1 + 5) × 2 = 12` control states. Arbitrary values within required
payload objects are retained payload, not additional independent state axes.

| Last request | Retry false | Retry true |
| --- | --- | --- |
| None | Legal: initial commandless state before the immediate subscription installs a command. | Illegal: the only true writer requires Some. |
| Some `projectGraph` | Legal: fresh project request or retained project after graph success. | Legal: first failure records the retry before dispatch. |
| Some `applyGraphDelta` | Legal: fresh request when both previous projection and delta exist, or retained apply command after graph success. | Legal: first failure records the retry before redispatching the retained full command. |
| Some `parseTurtle` | Representable, unsupported by this private owner's producers. | Representable, unsupported by this private owner's producers. |
| Some `diffDatasets` | Representable, unsupported by this private owner's producers. | Representable, unsupported by this private owner's producers. |
| Some `computeSnapshot` | Representable, unsupported by this private owner's producers. | Representable, unsupported by this private owner's producers. |

This gives five legal states and seven inadmissible states. Only two command
constructors write the private request slot: apply at 1931–1937 and project at
1942–1946, assigned Some at 1949. The only true assignment is inside the Some
branch at 1914. Fresh traffic clears the marker at 1950; graph-result handlers
clear it at 1860 and 1866 while retaining the command. An exhaustive graft search
found no other writes. Neither the public command constructors nor the worker's
message decoder can write this closure-local slot.

The public protocol supports all five variants, including its documented parse
and compute constructors at `Session.worker-protocol.ts:35–69`. The visualizer
worker at `Session.visualizer.worker.ts:27–48` exhaustively matches all five;
its parse/diff/compute handlers intentionally do nothing, while project/apply
produce results. Those no-op command arms must not be removed from the public
protocol to make the private count smaller. Similarly, the bridge's three
non-graph result arms at 1856–1858 remain no-ops after the common watchdog disarm.

## Exact proposed canonical correction

Keep the owner and stable ID. The following row is proposed for parent
integration after independent correction; the old canonical 4/3 design and raw
independent 6/5 report remain immutable inputs to this P2 audit.

```json
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-domains-ontology-graph-worker-requeue-latches","file":"packages/ontology/client/src/aggregates/Session/Session.atoms.ts","line":1791,"symbol":"ontologyGraphWorkerBridgeAtom","kind":"sibling-state","members":["lastProjectionRequest","requeuedAfterFailure"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/ontology/client/src/aggregates/Session/Session.atoms.ts","line":1791},"note":"The actual local is explicitly Option<WorkerCommand>; Session.worker-protocol.ts:24-30,74-99,122 declares five command kinds, so None plus five Some kinds times the Boolean gives 12 representable finite control states."},{"class":"E4","cite":{"file":"packages/ontology/client/src/aggregates/Session/Session.atoms.ts","line":1914},"note":"Only the Some arm sets the retry Boolean true. The only stored commands are projectGraph/applyGraphDelta from constructors at1931 and1942, installed at1949. Initial None+false and both retry states for either graph command give five legal states; None+true and six non-graph-command pairs have no supported writer."},{"class":"E1","cite":{"file":"packages/ontology/client/src/aggregates/Session/Session.atoms.ts","line":1949},"note":"Fresh graph traffic installs a full command and resets its retry budget; successful project/apply result handlers at1860 and1866 reset the budget while retaining the command. The first failure advances before watchdog/dispatch, preserving bounded retries under synchronous constructor/send failure."}],"cardinality":{"representable":12,"legal":5},"storage":"stored","exposure":"internal","targetShape":"tagged-union","tier":1,"notes":"Corrects the old presence-only4/3 and raw R28 emitted-subset6/5 counts. Same actual two-local owner; remove synthetic .requeueLatches symbol suffix. Private retry payload narrows to existing WorkerCommand projectGraph/applyGraphDelta case schemas, yielding absent|retryable(command)|retried(command), five control states. Public five-command protocol, constructors, encoded payloads, result codecs, independent worker/projection locals, watchdog/reset/termination order and observable failure behavior remain unchanged. Native P2 proposal pending independent correction and P3 design review."}
```

## Complete flow and compatibility obligations

`graphRequestAtom` at `Session.atoms.ts:1650–1654` reads snapshot, options, and
delta. The bridge subscribes immediately at 1922–1957, selecting apply only when
both retained previous projection and current delta are Some; otherwise it
selects project. Every new request restores its retry budget, clears the error,
arms the watchdog, dispatches, and clears the delta in that order. Do not treat
clearing a reactive delta as inert: preserve subscription and atom-update timing
so actual fresh traffic still selects the current request and resets its budget.

Dispatch at 1898–1903 queues a boundary callback that constructs/reuses the
worker and posts `encodeWorkerCommand(command)`. The boundary atom at 1745–1763
contains synchronous constructor/encoding/send exceptions. Construction retains
the bundler-recognized literal `new Worker(new URL(..., import.meta.url),
{ type: "module" })` at 1845. Failure resets before redacted error publication:
disarm watchdog, clear previous projection and projection/delta/backend atoms,
terminate the worker, and attempt requeue at 1822–1837.

The retry transition must record retried before `armWatchdog` and dispatch. It
must retain the complete command, including an apply command's original
`previous`, snapshot, delta and options, unless actual fresh graph traffic
replaces the stored command. Clearing the independent `previousProjection`
local does not itself rewrite a retained apply request to project. A second
failure terminates/reset state but does not dispatch from retried. Successful
project or apply results restore the retained command's budget, clear the error,
and update projection state. They do not introduce request-ID correlation or
discard a retained command, neither of which exists in the frozen behavior.

All messages disarm the 20-second watchdog before result decoding. Malformed
results, `error`, `messageerror`, and timeout retain their specific failure path;
non-graph successful results do not reset the retry budget. Finalization at
1959–1964 disarms the watchdog, clears pending boundary/failure request slots,
and terminates the worker. It does not invoke reset/requeue.

The complete writer/reader/export/test/codec map and deletion accounting are in
the companion eight-section design. It keeps this state inside the mounted
atom and preserves the five-case worker protocol, public schemas, typed array
payloads, options/defaults, encoded `focusIri` omission, renderer inputs, and
public atom/aggregate exports. No persisted retry-state codec is introduced.

## Remaining D1 probe withdrawals: source proof

The footer's broad statement expands to the thirteen exact IDs below. Remove
these records from the active census through parent integration; do not retain
them as D1, qualify them, manufacture owners, or change their runtime checks.
Full paths and original member arrays are in the structured proposals later in
this file.

| Stable ID | Exact declaration and consumer evidence; eligibility conclusion |
| --- | --- |
| `r3-domains-contradiction-repo-interval-probes` | `ContradictionTriage.repo.ts:102`,108,111 declare `startsBeforeEnd`, `validIntervalsOverlap`, `validIntervalContains` as functions. Applicability invokes overlap at146; validation invokes containment at227. No stored triple of their results. |
| `r3-domains-ontology-tool-delta-shape-probes` | `OntologyToolService.ts:187` and200 declare `hasRealDelta` and `operationIntroducesShape`. Separate ensure functions invoke them at191 and213 to preserve no-op/shape-partition refusals. Their Boolean return annotations do not declare payload fields. |
| `r3-domains-session-graph-partition-probes` | `Session.model.ts:86` and93 declare functions over GraphTerm. `graphMatchesPartition`100–107 invokes them from existing GraphPartition literal cases; `PartitionGraphCoherenceCheck`109 consumes the combined predicate. No `.probes` record exists. |
| `r3-domains-shacl-violation-equality-probes` | `Session.validation.ts:362`,363,632,645 declare four functions. `sameViolation` composes comparisons at645–659 and `verifyRepair` calls it at680. Keep these comparisons; there is no four-Boolean owner. |
| `r3-domains-visualizer-relationship-probes` | `Session.visualizer.ts:622`,625,715 declare equality, membership and endpoint-visibility functions. `addRelationship`635 and removal643 use equality/membership; projection filters visibility at1259. Required relationship/map data do not turn helpers into state members. |
| `r3-domains-session-quad-membership-probes` | Domain `Session.model.ts:447`,449,475 declare quad equality, membership, and subject-key functions. Add/remove at455–464 and partition classification552/558 invoke them separately. No co-carried Boolean fields. |
| `r3-domains-contradiction-evidence-set-probes` | `Contradiction.model.ts:499` and607 declare functions over evidence arrays. Schema filter562 checks uniqueness; literal-kind filter612–617 checks disjointness for independent-evidence. The arrays remain real payload; no Boolean pair is declared. |
| `r3-domains-contradiction-proposal-id-probes` | `Contradiction.model.ts:876`,878 declare ID equivalence and list uniqueness functions. Schema filter907 and dedupe transformation918 use callable references. Do not convert an equivalence function into stored state. |
| `r3-domains-execution-record-hash-probes` | `ExecutionRecord.model.ts:577`,811 are exported hash-check functions; `verifyOutcomeBinding`719–730 is an overloaded dual callable that invokes both. Preserve public calls, seals and binding checks. Function-valued exports are outside the Boolean carrier net. |
| `r3-domains-evidence-span-consistency-probes` | `EvidenceSpan.model.ts:175` is a static predicate,185–197 an overloaded dual static predicate. Neither is an instance Boolean schema field. Preserve their exported aliases/calling forms and evidence association checks. |
| `r3-domains-contradiction-repo-applicability-probes` | `ContradictionTriage.repo.ts:118`,133,156,286 declare four functions over distinct proposal/version/edge/receipt arguments. Callers253,838,860,1073 perform real validation. No `.targetProbes` value is declared. |
| `r3-domains-sparql-limit-probes` | `Session.sparql.ts:436` declares nested callable `startsWithAt`;506 declares callable `queryHasLimit`. The scanner loop485 and `injectLimit`509 invoke them. Actual output `injected` at510/513 is a different real field and is not this synthetic pair. |
| `r3-domains-contradiction-repo-anchor-sql-probes` | `ContradictionTriage.repo.ts:596–598` has three inline `sql<boolean>` tagged-template expressions inside `and(...)`. `scopeRefMatches`, `startCharMatches`, and `quoteMatches` are not declared identifiers. SQL expression objects are not Boolean values. Withdraw as synthetic/non-Boolean SQL expressions, correcting the footer's blanket callable description. Keep all three join predicates unchanged. |

## Earlier withdrawals and unchanged records

At audit time all four earlier IDs were absent from the active inventory:

- `r3-domains-reasoner-module-affected-flags` — functions at
  `Session.reasoner.ts:482`,485,493, consumed at820/821/834.
- `r3-domains-ontology-iri-kind-probes` — functions at
  `Session.projections.ts:469`,480,489,501.
- `r3-domains-reasoner-type-key-probes` — functions at
  `Session.reasoner.ts:507`,772,784.
- `r3-domains-session-projections-term-view-probes` — functions at
  `Session.projections.ts:382`,427,942–951.

Their existing source adjudication is
`data/design-refresh-2026-09-09-r28-nontooling-impact.md:53–67`; the independent
epistemic-ontology footer confirms that they remain callables with no
replacement carrier. This task neither reinstates nor re-archives them.
Other scoped seeds, including actual Boolean atoms, props, SHACL result badges,
and query safeguards, are not swept into these thirteen probe withdrawals.

## Verification and limitations

Graft discovery and exhaustive package searches preceded exact source reads.
The bridge atom is a module-level expression missing from the call graph;
exhaustive occurrences found its UI mount, tests, and all private writes.
Source reads supplemented graph results for schema cases, imports, public
barrels, worker entry, and anonymous SQL expressions. Missing graph edges were
not interpreted as absence of consumers.

Static checks cover the exact declared five-command union, 12-row control-state
table, complete private writers, JSON proposal validity, thirteen unique
withdrawals, eight mandatory design sections, pinned refs, and source/fixture
hash comparisons against frozen HEAD. No package/test/generator commands,
services, git mutations, source/test writes, canonical/current-design changes,
or current-report edits were performed. Parent may archive/adopt the provisional
design only after the normal integration decision. A bounded independent
cardinality/footer correction and independent P3 remain separate gates.

## Structured withdrawal proposals

```jsonl
{"id":"r3-domains-contradiction-repo-interval-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts","line":102,"symbol":"proposalsAreApplicable.intervalProbes","members":["startsBeforeEnd","validIntervalsOverlap","validIntervalContains"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-ontology-tool-delta-shape-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/use-cases/src/tools/OntologyToolService.ts","line":187,"symbol":"OntologyToolService.mutationProbes","members":["hasRealDelta","operationIntroducesShape"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-session-graph-partition-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/domain/src/aggregates/Session/Session.model.ts","line":86,"symbol":"graphMatchesPartition.probes","members":["isDefaultGraph","graphIsCanonicalPartition"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-shacl-violation-equality-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts","line":362,"symbol":"sameViolation.equalityProbes","members":["sameNamedNode","sameViolationDetails","sameOptionalNamedNode","sameViolation"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-visualizer-relationship-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts","line":622,"symbol":"relationshipExists.probes","members":["sameRelationship","relationshipExists","relationshipVisible"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-session-quad-membership-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/domain/src/aggregates/Session/Session.model.ts","line":447,"symbol":"hasQuad.probes","members":["sameQuad","hasQuad","hasSubjectKey"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-contradiction-evidence-set-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts","line":499,"symbol":"ContradictionMatchBasisStruct.evidenceProbes","members":["hasUniqueEvidenceIds","evidenceSetsAreDisjoint"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-contradiction-proposal-id-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts","line":876,"symbol":"hasUniqueProposalIds.probes","members":["proposalsShareId","hasUniqueProposalIds"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-execution-record-hash-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts","line":577,"symbol":"verifyOutcomeBinding.hashProbes","members":["verifyExecutionDecisionHash","verifyExecutionOutcomeHash","verifyOutcomeBinding"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-evidence-span-consistency-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts","line":175,"symbol":"EvidenceSpan.consistencyProbes","members":["isInternallyConsistent","matchesAnchor"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-contradiction-repo-applicability-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts","line":118,"symbol":"proposalsAreApplicable.targetProbes","members":["proposalTargetsSupersessionHead","proposalsAreApplicable","edgeMatchesCandidateBelief","receiptMatchesSubmission"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-sparql-limit-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts","line":436,"symbol":"topLevelLimit.probes","members":["startsWithAt","queryHasLimit"],"reason":"Declared callable predicates, not co-carried Boolean values or fields. Preserve runtime checks and public callable contracts; see exact declaration and consumer proof in this audit."}
{"id":"r3-domains-contradiction-repo-anchor-sql-probes","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts","line":596,"symbol":"getEvidenceSource.anchorSqlProbes","members":["scopeRefMatches","startCharMatches","quoteMatches"],"reason":"Synthetic member names for three inline sql<boolean> expression objects at596-598; no named Boolean or callable carrier exists. Preserve all SQL predicates."}
```

These entries identify exact prior-row owners and members; they are proposals
for removing ineligible active census records, not replacement inventory rows
with manufactured cardinalities. The source proof table above distinguishes
every callable from the SQL-only case.

## Frozen source and protected-input hashes

All fourteen source/test files below were byte-compared with `git show HEAD:<path>`
and matched the frozen source. The current canonical design and original
independent report/receipt were hashed and left unchanged. Ref reads also
matched both frozen pins. Hashes here describe inputs; handoff file hashes are
reported separately so the audit does not require a self-referential digest.

| File | SHA-256 |
| --- | --- |
| `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts` | `441e827749e3b484d74ab66f42df994899fc7ef78ed4e35d90cb6f15782b4e4c` |
| `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts` | `bfc06a582ce285e391131d938e32af14d06281bda265ed2bcf4e83feb8fdb91c` |
| `packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts` | `5be3f0db60cc0605f5a07a44ebc7f01ee071f46ea36bc5760f3acb4148ed0d1a` |
| `packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts` | `50527a631baa4d64c142d190f405291d12de9d7618ccb533278ed6bb67a7e892` |
| `packages/ontology/client/src/aggregates/Session/Session.atoms.ts` | `8da0fadb37d135a5e7001ba4d5686fe64184a52cd518f3eedf65c10c32ac1602` |
| `packages/ontology/client/src/aggregates/Session/Session.visualizer.worker.ts` | `2812d2d1d95f1b32292cbd2b332de0276fb457e995adae915dd79cc3ba23f5a0` |
| `packages/ontology/client/test/Session.atoms.test.ts` | `6aed35677ec91ac8bccc38d8c1d1634b2aad6f3dff54b29ede3029384ed51b3a` |
| `packages/ontology/client/test/worker-wire.test.ts` | `dbe62184ca64eb69f6ca390beeffa404ffba43cd6cc037ec4a3503ebcc16f28c` |
| `packages/ontology/domain/src/aggregates/Session/Session.model.ts` | `15e0fc7daadb1e71e19fd5270052f5d1c68f5a51f26f94c8cf16ef24599e4d6f` |
| `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts` | `817333718f05b96bb3a6fedc14a561c3e30a885bb86b72413484c3596876da30` |
| `packages/ontology/use-cases/src/aggregates/Session/Session.validation.ts` | `a4e9690fb9127e5b37dc8cf43ef733603ca869ceb0b8ceea11efa1739530a0c9` |
| `packages/ontology/use-cases/src/aggregates/Session/Session.visualizer.ts` | `648025fcdff89e527a0a7c5b27b5ee28a2ffe3f0238c5a30e8c7b62b01873bbc` |
| `packages/ontology/use-cases/src/aggregates/Session/Session.worker-protocol.ts` | `65b524e0373795fdedae43d3399008954af587db5b4e3a33bce1501d69b0f816` |
| `packages/ontology/use-cases/src/tools/OntologyToolService.ts` | `ca02cbcd92c282dcacc87ac9be723c24ef0a1ac28c51c27e3b6c88405a47f738` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-epistemic-ontology.jsonl` | `26e59dc806c61db3dc2a67c45a21d6637b55950740cd4e6657c1c2ee005c50bd` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-epistemic-ontology.execution.json` | `a2dbf027a8742673ecf5655ab44a3aba051baeacdee57c9ab092e83c601e0798` |
| `goals/boolean-creep/designs/r2-domains-ontology-graph-worker-requeue-latches.md` | `5000c14ebda54616fc374d61cc365ff98f80dd5e4bda2f1ccd61b281aee98a27` |
