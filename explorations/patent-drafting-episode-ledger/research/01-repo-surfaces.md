# Lane A — Repo Composition Inventory

**Date:** 2026-08-06 · **Packet:** `explorations/patent-drafting-episode-ledger`
· **Lane:** A (repo composition inventory, per `DECISIONS.md` 2026-08-06
"research depth") · **Tree:** branch `docs/patent-drafting-episode-ledger-open`,
tip `003064c881` (`docs(explorations): open patent-drafting-episode-ledger
wedge`).

Every claim below is anchored to `file:line` in this checkout. No web sources
were consulted for this lane (Lane B owns public sources). No client or
pre-publication patent material is referenced anywhere.

**Binding boundaries respected, not re-litigated:** remo2 (rows-first
`PracticeKgQuery`; lineage only through disposable in-memory `@beep/rdf`
sessions via the bounded `SparqlQueryService`; no persistent graph store; no
projection becomes authority) and remo3 (`DraftingEpisode` ledgers are
law-practice product records — repo-native, authoritative, append-only;
operator dev-memory stays operator-level and may carry at most a lossy
rebuildable projection with recent-raw-episode fallback). No rebuild of
`ExecutionLedger`, the runtime draft-gate contracts, or weighted RRF.

---

## 1. `ProfessionalRuntime` contracts — exact current spans

All in `packages/agents/use-cases/src/processes/ProfessionalRuntime/`
(831-line `ProfessionalRuntime.contracts.ts`; 2,387 lines across the process).
Every contract is an `S.Class` with an `$I`-composed identifier
(`ProfessionalRuntime.contracts.ts:22`).

| Symbol | Span | Shape (fields, in source order) |
| --- | --- | --- |
| `RuntimeEvidenceRef` | `ProfessionalRuntime.contracts.ts:209-222` | `artifactId`; `spanId` (`Option`); `spanIds` (`Option<ReadonlyArray>`) |
| `RuntimeCandidateDraft` | `ProfessionalRuntime.contracts.ts:428-446` | `artifactId`, `body`, `draftId`, `draftKind`, `evidence[]`, `lifecycle`, `producedByPrincipalId`, `requiresApproval`, `subject`, `to[]` |
| `RuntimeApprovalGate` | `ProfessionalRuntime.contracts.ts:473-491` | `approvalGateId`, `candidateRefs[]`, `decision`, `evidence[]`, `lifecycle`, `policyBasis`, `requestedActions[]`, `reviewerPrincipalId` |
| `RuntimeActivity` | `ProfessionalRuntime.contracts.ts:608-623` | `activityId`, `activityType`, `artifactId` (`Option`), `principalId`, `spanIds` (`Option`) |
| `RuntimeUsageRecord` | `ProfessionalRuntime.contracts.ts:645-655` | `mode`, `model`, `provider`, `usageRecordId` |

**Principals** are not one symbol. There are two distinct surfaces:

- `RuntimePrincipalId` — module-local branded id schema,
  `ProfessionalRuntime.contracts.ts:83-87` (not exported; reachable only
  through the classes that embed it).
- `principals: S.Array(RuntimePrincipalId)` — the packet-level principal roster
  on `SdkContextPacket`, `ProfessionalRuntime.contracts.ts:751-753`. Principal
  membership is enforced: an approval gate whose `reviewerPrincipalId` is
  absent from the packet roster is a validation issue
  (`ProfessionalRuntime.fixture-service.ts:104-115`).

Supporting surfaces the episode rung composes:

- `RuntimeScope` (org/thread/workspace) — `:147-160`.
- `RuntimeEntityRef` (kind/id) — `:180-188`.
- `RuntimeCandidateClaim` — `:253-272` (claim id, type, confidence, optional
  `eventDate`, evidence, lifecycle, producing principal, statement,
  subject ref).
- `RuntimeCandidateProject` — `:303-317`; `RuntimeCandidateTask` — `:343-358`;
  `RuntimeDraftRecipient` — `:380-388`.
- `RuntimeSourceSpanRef` — `:541-549`; `RuntimeSourceArtifact` — `:573-585`.
- `SdkContextPacket` — `:731-771` (the evidence-bounded packet: activities,
  approval gates, candidate claim/draft/task id lists, exclusions,
  `generatedAt`, principals, request, `scenarioId`, `schemaVersion` literal
  `runtime-data-loop.expected.context-packet.v1` (`:122-126`), scope, source
  artifacts, usage, vertical context).
- `CandidateOutputSet` — `:810-831` (approval gates, candidate project, claims,
  context packet, drafts, `scenarioId`, tasks; carries
  `static readonly fromUnknown` at `:830`).

Value vocabularies, all `LiteralKit` (`ProfessionalRuntime.values.ts`):
`RuntimeFixtureScenarioId = ["law-patent-intake","wealth-cash-request"]`
(`:28-32`), `RuntimeCandidateLifecycle = ["candidate"]` (`:65-69`),
`RuntimeClaimConfidence = ["high","medium","low"]` (`:102-106`),
`RuntimeApprovalDecision = ["pending"]` (`:139-143`),
`RuntimeRequestKind = ["email_to_candidate_work"]` (`:176-180`),
`RuntimeSourceKind = ["email"]` (`:213-217`),
`RuntimeActivityType = ["artifact_ingested","candidate_work_proposed"]`
(`:250-254`), `RuntimeUsageMode = ["deterministic_fixture"]` (`:287-291`).

Ports around the contracts: `ProfessionalRuntimeSdk` interface
(`ProfessionalRuntime.service.ts:28-45`) with `getContextPacket` +
`proposeCandidateOutputSet`; `GetContextPacket` query
(`ProfessionalRuntime.queries.ts:37-48`); `ProposeCandidateOutputSet` command
(`ProfessionalRuntime.commands.ts:64-75`);
`ProfessionalRuntimeValidationError` (`ProfessionalRuntime.errors.ts:28-48`).
Public barrel re-exports contracts/commands/queries/values at
`packages/agents/use-cases/src/public.ts:68,101,124,139,155`; the proof barrel
adds fixtures at `packages/agents/use-cases/src/proof.ts:22,42,80,102`.

**Composition read for the wedge.** These five symbols plus principals are
already the *content* of an episode event — what was drafted, what gate covers
it, what evidence grounds it, who acted, what the model cost was. What they are
not is *ordered, sealed, or replayable*: nothing here carries a sequence
number, a prior-record link, a seal, or an occurred-at instant.
`RuntimeApprovalDecision` is a one-member literal (`"pending"`), so an accepted
or refused disposition is currently unrepresentable in the runtime vocabulary.

## 2. The `law-patent-intake` runtime fixture (ADHD-3's "speedrun entry")

**Code:** `runLawPatentIntake`,
`packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:122-401`
— a pure `(RuntimeFixtureInput) => CandidateOutputSet` builder. Dispatch is a
`LiteralKit.$match` registry at `:687-692`; the effectful entry point is
`runRuntimeFixture` (`Effect.fn("RuntimeFixture.run")`) at `:741-753`. Input
schema `RuntimeFixtureInput` at `:93-102`; the two determinism guards are
`assertScenario` (`:104-110`, seed/email `scenarioId` must agree) and
`assertSpanRefs` (`:112-120`, every declared span id must appear as
`[span:<id>]` in the body).

**Data on disk:**
`goals/agentic-professional-runtime/fixtures/runtime-data-loop/law-patent-intake/`
— `body.md`, `input.email.json`, `seed.json`, and five expected snapshots
(`expected.claims.json`, `expected.tasks.json`, `expected.drafts.json`,
`expected.approval-gates.json`, `expected.context-packet.json`), validated by
`goals/agentic-professional-runtime/fixtures/runtime-data-loop/validate-fixtures.mjs`.

**What the fixture emits (the candidate episode event stream), with anchors:**

1. Ingestion activity `activity-law-email-ingested-001`
   (`activityType: "artifact_ingested"`) — `fixtures.ts:373-378`.
2. Three candidate claims — `claim-law-provisional-request-001` (`:129-147`),
   `claim-law-demo-date-001` (`:148-166`, `eventDate: "2026-06-12"`),
   `claim-law-inventor-candidates-001` (`:167-184`, confidence `medium`).
   Subject refs are `matter-law-robotic-gripper-001` and
   `patent-asset-robotic-gripper-001` (`:133-136`, `:152-155`, `:171-174`).
3. One candidate project `project-law-provisional-filing-001` (`:186-207`).
4. Three candidate tasks (`:208-251`).
5. One client-facing draft `draft-law-patent-acknowledgement-001` with
   `requiresApproval: true` and all four spans as evidence (`:252-275`).
6. One approval gate `approval-law-patent-intake-001`, `decision: "pending"`,
   reviewer `principal-user-law-jordan-miles`, `policyBasis` = attorney
   approval required before accepting legal-context claims, creating
   authoritative tasks, or sending a client-facing draft; `candidateRefs`
   covers all seven candidates (`:276-305`).
7. Proposal activity `activity-law-candidates-proposed-001` (`:379-384`) and
   one usage record `usage-law-fixture-agent-001`
   (`mode: "deterministic_fixture"`, `provider: "fixture"`, `model: "none"`)
   (`:386-393`).
8. Context packet `context-law-patent-intake-001`, `generatedAt`
   `2026-05-01T14:13:30Z`, three exclusions (`:306-398`).

**SDK facade over it:** `makeInMemoryProfessionalRuntimeSdk`
(`ProfessionalRuntime.fixture-service.ts:246-280`) resolves a scenario, checks
artifact + scope identity, runs `validateOutputSet` (`:176-185`), and — for
proposals — requires byte-identity with the regenerated fixture output via a
canonical JSON compare (`:45`, `:274`). Evidence integrity checks
(`:77-102`) reject spans not declared on a packet source artifact. Tests:
`packages/agents/use-cases/test/ProfessionalRuntime.test.ts:68-176` (five
cases, including encoded-shape stability at `:86` and schema-derived
arbitraries at `:170`).

**Composition read.** The fixture deterministically regenerates an
evidence-closed, grouped candidate-output set for one law-patent matter, and
the existing snapshots prove that encoded grouped shape. It does **not**
define a sequence or timestamp across claims, project, tasks, drafts, approval
gates, and nested context activities; stable serialization is not a domain
event order. The fixture is therefore cheap source material, not yet a
`DraftingEpisode` replay corpus. A replay proof first needs either an explicit
flattening plus total-order contract or a canonical event fixture, followed by
an episode-fold snapshot.

## 3. `ExecutionLedger` — append-only / hash-chain precedent

**Port:** `packages/epistemic/use-cases/src/ExecutionLedger/ExecutionLedger.ports.ts`
— `ExecutionLedgerShape` at `:61-73` (five members: `appendDecision`,
`appendOutcome`, `readDecisions`, `readOutcomes`, `readUnsettledAllowed`),
service tag at `:108`. The module header states the two design laws verbatim:
"append-and-read only: there is no update, no delete, and no way to express
either" (`:6-8`) and "Chain verification is not on the port … so a lying
adapter cannot vouch for its own chain" (`:8-11`). Errors:
`ExecutionLedger.errors.ts` (217 lines). Live Drizzle implementation is in the
epistemic server tier (`packages/epistemic/server/src/ExecutionLedger/`).

**Records:** `packages/epistemic/domain/src/values/ExecutionRecord/ExecutionRecord.model.ts`
(842 lines). Header (`:1-21`) states the payload-free law: "The ledger stores
exactly one class of data … hashes, opaque identifiers, bounded literals, and
typed outcomes … nothing can carry a payload. Raw destinations and operation
names never appear; only their digests do." Chain primitives:
`ExecutionRunKey` (`:62`), `DecisionRecordHash` (`:102`), `OutcomeRecordHash`
(`:140`), digest-only `SinkDestinationDigest` (`:180`) and
`GrantOperationDigest` (`:220`), bounded `ExecutionSettlement =
["completed","failed","interrupted"]` (`:263`) chosen over an `Exit` precisely
so no failure payload enters (`:246`, `:430`). Chain fields `seq` /
`prevHash` / `hash` at `:289-296` ("Position in the run's chain; zero-based,
dense"; "none only at seq zero"). Sealing and verification:
`sealExecutionDecision` (`:526`), `verifyExecutionDecisionChain` (`:652`),
`sealExecutionOutcome` (`:759`), `verifyExecutionOutcomeHash` (`:771` region).
Encoding-version prefixes are bumped on any canonical-encoding change (`:40-41`).

**Storage:** raw `pgTable` projections, not `EntityTable.pgTableFrom`, because
the entity machinery "assumes a mutable shape" —
`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:5-11`;
`executionDecisionTable` at `:78-91`, `executionOutcomeTable` at `:121-126`.
Guards live in raw SQL:
`packages/_internal/db-admin/drizzle/20260726210000_epistemic_execution_ledger/migration.sql`
— tables at `:1`, `:42`; `PRIMARY KEY (run_key, seq)`; uniqueness on `hash`,
`(run_key, hash)`, `(hash, verdict)`; `CHECK (seq >= 0)`;
`CHECK ((seq = 0) = (prev_hash IS NULL))`; outcome→decision composite FK plus
`CHECK (decision_verdict = 'allowed')`; and four triggers at `:68`, `:72`,
`:76`, `:80` (`BEFORE UPDATE OR DELETE` per row + `BEFORE TRUNCATE` per
statement).

**What transfers to a payload-bearing law-owned `DraftingEpisode` ledger:**

- The *port shape law*: append + read only, with no update/delete expressible
  in the type (`ports.ts:6-8`).
- *Verification outside the adapter*: recomputing the chain from fetched rows
  in the domain tier, never trusting an adapter's self-report (`ports.ts:8-11`,
  `ExecutionRecord.model.ts:652`).
- The *chain mechanics*: dense zero-based `seq`, `prevHash` none-iff-genesis,
  a seal over versioned canonical encoding, and a bumped encoding-version
  prefix on any encoding change (`:40-41`, `:289-296`, `:526`).
- The *DB-level guard pair*: row-level `BEFORE UPDATE OR DELETE` plus
  statement-level `BEFORE TRUNCATE`, with the constraint/trigger names pinned
  by a proof test.

**What does not transfer:**

- The digest-only column allowlist and the "nothing can carry a payload" law
  (`ExecutionRecord.model.ts:1-21`). A `DraftingEpisode` event is *made of*
  payload — outline nodes, retrieval spans, chunk text, validator output,
  attorney feedback — so the wedge inherits the append-only discipline while
  explicitly rejecting the no-payload discipline.
- The bounded-literal settlement in place of a typed result
  (`:246`, `:263`): drafting stages need typed stage I/O, not a three-member
  sentinel.
- The raw-`pgTable` escape hatch is *not* automatically required — see §4:
  law-practice already proved the payload-bearing variant on top of the normal
  `BaseEntity` machinery.

## 4. Law-practice surfaces (Claim, PatentAsset, the live PR #575 lane, EntityIds)

### 4.1 `Claim` and `PatentAsset`

- `Claim` — `packages/law-practice/domain/src/entities/Claim/Claim.model.ts:52-93`.
  `BaseEntity.Class` keyed by `LawPractice.ClaimId` (`:53`). Fields:
  `claimNumber` (`:56`), `fixtureKey` (`:59`), `independent` (`:62`),
  `patentAssetFixtureKey` (`:65`), `text` (`:68`), each with a `persisted`
  column mapping (`:72-88`). **No limitation decomposition, no support state,
  no dependency edge** — confirming the seed's read.
- `PatentAsset` — `packages/law-practice/domain/src/entities/PatentAsset/PatentAsset.model.ts:48-83`
  (`fixtureKey`, `matterFixtureKey`, `status`, `title`). It exists; the seed's
  "if present" is answered yes.
- Sibling entities in the slice:
  `packages/law-practice/domain/src/entities/` holds `CandorDisposition`,
  `Claim`, `Distinction`, `IdsSubmissionFact`, `LegalClient`, `LegalContact`,
  `Matter`, `OfficeAction`, `PatentAsset`, `PatentCitationEvent`,
  `PriorArtReference`, `Rejection`.

### 4.2 The live candor lane (PR #575, merged `5e4df6be4a`, 2026-08-06)

Commit `5e4df6be4a` — `feat(law-practice): land the patent citation candor
gate (#575)`; follow-up `f6e392d296` (#589) pinned examiner-head semantics.
Files it added (`git show --name-status --format="" 5e4df6be4a`):

- **domain entities:** `PatentCitationEvent` (`…/PatentCitationEvent.model.ts:69-137`),
  `CandorDisposition` (`…/CandorDisposition.model.ts:63-116`),
  `IdsSubmissionFact`, each with a `.values.ts` sibling.
- **domain values:** `CitingApplicationIdentity`, `ObservationVersionRef`.
- **use-cases:** `CandorPolicy` (`.errors.ts`, `.ports.ts`, `.service.ts`,
  `.values.ts`) and `CandorRecord` (`.ports.ts`, `.reader.ts`).
- **server:** `CandorRecord/CandorRecord.layer.ts`, `CandorRecord.repo.ts`
  (309 lines; `makeInMemoryCandorRecordRepository` at `:179`,
  `makeCandorRecordRepository` — the Drizzle one — at `:241`).
- **tables:** `CandorDisposition`, `IdsSubmissionFact`, `PatentCitationEvent`
  `.table.ts` + `.converters.ts`.
- **migration:** `packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/`
  (`migration.sql`, `snapshot.json`).
- **identity:** `packages/shared/domain/src/identity/LawPractice.ts` (126 insertions / 136 deletions in the #575 diff).

Gate/event/disposition shapes as landed:

- `PatentCitationEvent` fields: `actor`, `citingApplication` (jsonb),
  `discovery` (jsonb tagged provenance), `grounding`
  (`TextAnchorVerificationReceipt`, jsonb — "re-verification is required
  before any current claim", `:82-85`), `observedAt` ("recorded for audit and
  never used to establish currency", `:86-88`), `possibleDuplicateOf`
  (`Option`, "recorded and never resolved; makes this event uncovered",
  `:89-93`), `quarantine` (`Option`, "layered beside the evidence, never
  rewriting it", `:94-96`), `reference`, `supersedes` (`Option<ObservationVersionRef>`,
  `:100-102`).
- `CandorDisposition` fields: `citingApplication`, `decidedAt`, `disposes`
  (`ObservationVersionRef` — "version-exact binding to the observation this
  judgment answers", `:73-75`), `lifecycle`, `litigationFrameJudgment`
  (`Option`), `rule56Judgment` (`Option`), `supersedes`
  (`Option<CandorDispositionId>`). Doc block `:41-49`: "A recorded disposition
  is never edited. Revision and withdrawal append a new record whose
  `supersedes` names the prior one." Authorship is `createdByPrincipal`, and
  the predicate fails closed on principal kind so "an agent can never dispose
  of its own AI-discovered finding" (`:36-39`).
- Gate: `CandorGateVerdict`
  (`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.values.ts:215-269`)
  carries only `scope` + `uncovered: ReadonlyArray<UncoveredEvent>`; blocked-ness
  is *derived* from the uncovered list, "never a stored value" (`:229-235`).
  `UncoveredEvent` at `:156`, `UncoveredReason` at `:121`, `CandorFilingScope`
  at `:73`. Service shape `CandorPolicyShape.evaluate`
  (`CandorPolicy.ports.ts:178-194`) returns `CandorGateVerdict` requiring
  `CandorRecordReader | SourceTextResolver | Crypto.Crypto`;
  `CandorRecordReader` tag at `:129`, `CandorPolicy` tag at `:243`;
  `CandorPolicyLive` at `CandorPolicy.service.ts:286`.

### 4.3 The migration precedent this wedge's rung 2 follows

`packages/_internal/db-admin/drizzle/20260806031625_law_practice_candor_gate/migration.sql`
(125 lines) — the law-practice slice's **first** db-admin migration
(`goals/patent-citation-candor-gate/SPEC.md:22-25` states rung 2 lands it "on
the `ExecutionLedger` precedent"). Structure:

1. Three `CREATE TABLE`s at `:1`, `:22`, `:45`
   (`law_practice_candor_disposition`, `law_practice_ids_submission_fact`,
   `law_practice_patent_citation_event`) — normal entity columns
   (`created_at`, `created_by_principal` jsonb, `org_id`, …) *plus* jsonb
   payload columns. **This is the payload-bearing append-only precedent** the
   `DraftingEpisode` ledger needs, and it did not require the raw-`pgTable`
   escape hatch §3 used.
2. Tenant-scoped unique constraints at `:79`, `:83`.
3. Self-referential append-only lineage FKs: `…_candor_disposition_supersedes_fk`
   (`:87`) and `…_patent_citation_event_possible_duplicate_fk` (`:92`).
4. One shared guard function `law_practice_candor_block_mutation()` (`:96-101`,
   `RAISE EXCEPTION 'law practice candor records are append-only: % on %'`),
   then six triggers (`:103`, `:107`, `:111`, `:115`, `:119`, `:123`) — one
   `BEFORE UPDATE OR DELETE … FOR EACH ROW` and one `BEFORE TRUNCATE … FOR
   EACH STATEMENT` per table.

The lane is three-sited, not one: the migration directory (`migration.sql` +
`snapshot.json`), the proof oracle
(`packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts:808-819`
— one `AcceptedProofFile` entry per artifact, `role: "db-admin"`,
`stage: "persistence"`, writers `template` and `json`), and the desktop
runtime registration (`apps/professional-desktop/src/runtime/Migrations.gen.ts:844-846`,
generated inline SQL keyed by migration name). Existing migration inventory
(`packages/_internal/db-admin/drizzle/`, 13 directories) shows this as the
newest entry.

### 4.4 Shared-domain `EntityId` registration precedent

`packages/shared/domain/src/identity/LawPractice.ts` — slice registry with
`const make = EntityId.factory("law_practice", $I)` at `:12`. Each id is a
`make("<snake_entity_type>", { description })` export followed by a
`export type` alias with a `@see` back-link:

- `PatentAssetId` — `:109-120`; `ClaimId` — `:163-174`.
- `PatentCitationEventId` — `:304-315` (added by #575).
- `CandorDispositionId` — `:338-349` (added by #575; its doc block records the
  append-only revision rule at `:319-325`).
- `IdsSubmissionFactId` (added by #575 — the third and final registration in
  its diff; the review-gate recount of `git show 5e4df6be4a` found exactly
  three `= make(` source registrations, correcting D-1's original "four").

A `DraftingEpisodeId` / `ClaimLimitationSupportId` would follow this exact
three-part pattern in this one file: `make("drafting_episode", { … })`, the
runtime type alias, and a `**Example** (Read the registered entity type)`
JSDoc block.

## 5. remo2 lane surfaces

### 5.1 `PracticeKgQuery` target shape

`goals/practice-kg-mcp/SPEC.md` — mission `:6-12` (read-only, local-first
stdio MCP server plus a portable data bundle); D-2 `:33` (deterministic
docket-family spine "no LLM anywhere in this layer" + OA span-grounded
candidate claims + email correspondence edges + corpus FTS); D-4 `:35`
("Read-only, labeled. Every tool is read-only. Candidate claims are labeled
`candidate — unreviewed` with their evidence span … No write tools"); D-6
`:37` (KG/epistemic rows in PGlite, catalog + FTS in DuckDB); D-9 `:41`
(placement ruling: tool declarations → `law-practice/use-cases`, handlers +
projection writers → `law-practice/server`, read-model tables →
`@beep/law-practice-tables`, stdio app → `apps/practice-kg-mcp`).

**Live implementation exists** (see §10 drift D-2). `packages/law-practice/server/src/`
carries 3,992 lines of `PracticeKg.*`: `PracticeKg.queries.ts` (194),
`PracticeKg.rows.ts` (328), `PracticeKg.schemas.ts` (596),
`PracticeKg.projections.ts` (782), `PracticeKg.claims.ts` (403),
`PracticeKg.fts.ts` (341), `PracticeKg.emails.ts` (213),
`PracticeKg.tool-handlers.ts` (283), `PracticeKg.errors.ts` (116),
`PracticeKg.host.ts` (54), `Tools.ts` (131). Read-model tables:
`packages/law-practice/tables/src/entities/{KgNode,KgEdge,KgBuild}` (raw
`pgTable`, e.g. `KgNode.read-model-table.ts:66`), surfaced through
`packages/law-practice/tables/src/ReadModels.ts:109-249`. App:
`apps/practice-kg-mcp`.

The live named-query catalog is `PracticeKgQueries`
(`packages/law-practice/server/src/PracticeKg.queries.ts:21-194`) — a frozen
record of SQL strings with explicit `ORDER BY` clauses over natural-key
fields (`:46`, `:65`, `:71`, `:90`, `:102`, `:138`, `:145`, `:156`, `:166`,
`:174`, `:193`). That ordering is **not total**: `kg_node` makes only `iri`
unique (`KgNode.read-model-table.ts:71-73`), while queries such as
`application`, `find`, and `provenance` omit `iri` as a tie-breaker; `find`
also applies `LIMIT 100`. The deterministic-row property remo2 depends on is
therefore an explicit gap: add a unique tie-breaker/constraint before treating
the live rows as a contract. Row shapes are schema-decoded, not raw:
`decodePracticeKgGraphRows` / `…FamilyRows` / `…DocumentRows` / `…EmailRows` /
`…CandidateClaimRows` at `PracticeKg.rows.ts:216,230,244,258,272`. Candidate
claims are span-bearing and label-carrying —
`'candidate — unreviewed' AS label` with `startChar`/`endChar`/`evidenceQuote`
from `epistemic_evidence` (`PracticeKg.queries.ts:46-64`).

**NOT FOUND:** no symbol named `PracticeKgQuery` (singular) exists anywhere in
the repo — the only matches are exploration/goal prose
(`explorations/patent-drafting-episode-ledger/CAPTURE.md:177`,
`.../DECISIONS.md:28,90`, `research/SOURCES.md:82`,
`explorations/legal-patent-kg-deepening/{ROUTING-SEED.md:254,DECISIONS.md:167,routing-seed.json:254}`,
`.../research/20-adhd-integration.md:67`). `PracticeKgQuery` is a *proposed
contract name*, not an existing surface, and it is one letter from the live
`PracticeKgQueries` constant.

### 5.2 The bounded `SparqlQueryService`

`packages/foundation/capability/semantic-web/src/services/sparql-query.ts`
(395 lines) — "Minimal engine-agnostic SPARQL query service contract"
(`:1-5`). `SparqlQueryProfile = ["select","ask","construct"]` (`:44`);
`SparqlQueryRequest` (`:87-98`) carries `query`, `profile`,
**`dataset: Dataset` inline**, and `timeoutMs` (`Option<NonNegativeInt>`);
`SparqlSelectResult` (`:115`), `SparqlQueryError` (`:279`);
`SparqlQueryServiceShape` (`:305-307`, one member: `execute`); service tag
`SparqlQueryService` (`:348`). The contract's declared equivalence basis is
"Exact query and result equality within a bounded execution envelope"
(`:24`).

Because the dataset travels **in the request**, the service is stateless and
has no store — the "disposable in-memory session" is the mechanic the contract
already enforces, not something the wedge must add.

**Where the bounds actually live:** the only bound on the service contract is
`timeoutMs`. The result-count envelope is in the ontology use-case layer —
`OntologySparqlSafeguards` (`packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts:82-96`,
`defaultLimit: 100`, `maxResultCount: 200`) with truncation applied at
`:557-562`. Any wedge lineage query inherits bounds only if it reuses that
envelope or declares its own.

### 5.3 The `@beep/rdf` in-memory dataset Session pattern (ontology-workbench)

- `@beep/rdf` = `packages/foundation/modeling/rdf`
  (`src/{Rdf,Iri,Uri,JsonLd,Prov,Evidence,SemanticSchemaMetadata}.ts`,
  `src/Vocab`, `src/Adapters`). Dataset constructor:
  `makeDataset = (quads) => Dataset.make({ quads: A.fromIterable(quads) })`
  — `packages/foundation/modeling/rdf/src/Rdf.ts:1066`.
- Session assembly:
  `packages/ontology/use-cases/src/aggregates/Session/Session.sparql.ts` —
  imports `makeDataset`, `makeNamedNode`, `makeQuad` from `@beep/rdf/Rdf`
  (`:10`); `partitionDataset` at `:505`; `sparqlDataset(input)` at `:515-525`
  builds a fresh dataset per run from the session's asserted + ontologies
  partitions and, conditionally, inferred; the request is constructed at
  `:597` with `dataset: sparqlDataset(input)`. Named graph partitions
  (`asserted`, `ontologies`, `inferred`, `shapes`, `provenance`) are IRI-keyed
  at `packages/ontology/domain/src/aggregates/Session/Session.values.ts:110-116`.
  Runner service `OntologySparqlRunner` at `Session.sparql.ts:638`,
  `OntologySparqlRunnerLive` at `:655-661`.
- Engine layer: `OxigraphSparqlQueryServiceLive`,
  `packages/drivers/oxigraph/src/Oxigraph.sparql.ts`, wired at
  `packages/ontology/server/src/aggregates/Session/Session.layer.ts`
  (`OntologySparqlRunnerLayer = OntologySparqlRunnerLive.pipe(Layer.provide(OxigraphSparqlQueryServiceLive))`).

The remo2 lineage lane is therefore a **three-package composition** —
`@beep/rdf` (dataset value), `@beep/semantic-web` (bounded service contract),
`@beep/oxigraph` (engine layer) — with `@beep/ontology-use-cases` supplying
the reference assembly and safeguard envelope.

## 6. remo3 lane surfaces

`standards/memory-architecture/04-decision-log.md`:

- **2026-08-01 clarification** — `:67-95`, heading "Drafting Episodes Are
  Product Records; Cognee May Project Them (Clarification)". Context `:69-74`
  names this campaign's /adhd remove-assumption lens as the trigger. Decision
  `:76-84`: "Replayable drafting/derivation episode ledgers are **product
  records** owned by the professional runtime's product tables — repo-native,
  authoritative, append-only. Cognee's always-on operator dev-memory role is
  unchanged. Cognee MAY additionally carry lossy, disposable projections of
  committed product events for retrieval ergonomics, rebuilt from the ledger
  at any time, and is never their authority." Consequences `:86-95` add the
  hard requirement: "Product surfaces that adopt a Cognee projection must ship
  a rebuild-from-ledger path and a deterministic fallback (e.g. recent raw
  episode tails) so Cognee unavailability degrades reads, never truth."
- **2026-08-06 role retirement** — `:7-65`, heading "Operator Dev-Memory Role
  Passes to basic-memory + codegraph (Cognee Role Retirement)". Decision
  `:21-35`: basic-memory (AGPL-3.0, internal tooling only) becomes the durable
  cross-agent dev-memory at `~/YeeBois/memory/beep-shared`; codegraph (MIT) is
  the deterministic code KG; both keyless. **Boundary paragraph `:36-42`:**
  "the 2026-08-01 operator/product authority boundary is unchanged and remains
  binding. This entry moves operator memory between operator-level tools only.
  Product tables stay the professional runtime's sole authority and never
  become an operator-memory backend; operator memory — now basic-memory rather
  than Cognee — never becomes product authority." Consequence `:57-60`: the
  store "carries a hard confidentiality rule against any pre-publication
  patent or OIP client material."

`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`:

- **`:62-84` (Decision 2 — program ownership, LOCKED 2026-07-14).** Answer at
  `:68-77`; the deferral list at `:73-77` explicitly defers "external graph
  projections as rebuildable, driver-isolated, non-authoritative consumers;
  Cognee/Graphiti operator tooling; and **IP-law-specific records**". That
  last clause is the seam this wedge occupies: IP-law records are outside the
  generic epistemic core by that packet's own decision.
- **`:116-135` (Decision 4 — durable truth authority, LOCKED, "settled
  doctrine").** `:123-129`: "Durable truth lives in repo-native Postgres
  through epistemic domain entities, `@beep/epistemic-tables`, server-owned
  transactional repositories, and `@beep/db-admin` migrations. No external
  graph vendor enters the authority path. Any future graph service is
  optional, rebuildable, driver-isolated, fed only from accepted authority
  records, and prohibited from direct authoritative writes." Rejected options
  `:133-135` name Cognee explicitly as a rejected system of record.

The seed's `:66-84,116-135` anchors are accurate (66 is the Question line of
Decision 2; 116 is the Decision 4 heading).

## 7. The four composed goal SPEC contracts

| Goal | Lifecycle | Binding contract for this wedge | Anchors |
| --- | --- | --- | --- |
| `agentic-professional-runtime` | manifest has no `lifecycle` key (initiative-shaped manifest: `productProofs`, `runtimeSlices`, `implementationRungs`, `phases`, `completionGate`) | Draft/gate/fixture requirements | `SPEC.md:30-37` (v1 trace: onboard → ingest → deterministic fixture agent → candidates → **strict human approval gate** → bounded SDK context), `:40-43` (canonical scenario pair, law patent intake first), `:45-51` (candidate records only), `:52-55` ("Claim plus evidence plus provenance plus lifecycle is the authoritative record of what was asserted, evidenced, and decided — not of whether the underlying proposition is true. Search, graph views, retrieval packets, summaries, and MCP outputs are **projections**"), `:60-63` (agents propose; acceptance records a scoped disposition and "does not make their propositions true"), `:116-126` (deterministic proof, terminal outputs) |
| `hybrid-retrieval-fusion-core` | `active` | Deterministic weighted RRF, exact-literal priority, stable ties, span preservation | `SPEC.md:5-24` (pipeline + empty-channel renormalization), `:77-79` (`1/(k+rank)`, one-based ranks, `k = 60`), `:80-81` (renormalize only on whole-empty channels), `:82-85` (literal tier/floor cannot be outscored by fuzzy consensus; one documented stable comparator), `:86-88` (duplicate ids collapse; contributions sum exactly to the fused score), `:89-90` ("Every result preserves its pre-verified `TextAnchor`. Fusion neither invents nor repairs spans."), `:91-93` (output is a ranked candidate/evidence packet, "never an admitted claim, `ClaimGateResult`, or direct LLM context") |
| `practice-kg-mcp` | `active` | Read-only KG surface, deterministic docket rows | `SPEC.md:6-12`, `:33` (D-2), `:35` (D-4 read-only/labeled), `:37` (D-6 storage), `:41` (D-9 placement) — plus the live surfaces in §5.1 |
| `citation-verified-span-substrate` | `active` | Exact source-versioned support anchors — what the `ClaimLimitationSupport` rung consumes | `SPEC.md:5-11` (matter-scoped verified `TextAnchor` over `GroundedExtraction[]`, canonical half-open UTF-16 boundaries, normalization→raw offset mapping, straddle, fail-closed), `:14-20` (non-goals: no fuzzy/case-folded match pass; never emit normalized text instead of the exact raw slice; nothing privileged leaves the device), `:44-51` (target surfaces) |

**Live status of the anchor substrate:** `citation-verified-span-substrate` is
implemented, not merely specified —
`packages/foundation/modeling/provenance/src/TextAnchor.ts:155` (`TextAnchor`),
`SourceTextIdentity.ts:119`, `VerifiedTextAnchor.ts:152`
(`TextAnchorVerificationReceipt`), `:349` (`verifyTextAnchor`), `:77`
(`VerifiedTextAnchorError`) — and it is already consumed in law-practice at
`PatentCitationEvent.model.ts:82-85`. The `ClaimLimitationSupport` rung has a
live carrier to reuse today.

**Fusion is not implemented.** `rg -il "reciprocal.?rank|RrfScorer|weightedRrf|fusedScore"`
over `packages/**/src/**` returns zero files; `@beep/nlp-processing` exists at
`packages/foundation/capability/nlp-processing` but carries no fusion module.
Weighted RRF remains a SPEC contract only.

## 8. Sibling boundaries (stable reference points, never reopened)

**`goals/patent-citation-candor-gate`** — manifest `lifecycle:
completed-retained`. SPEC objective `:5-24` sets four normative properties the
episode wedge should mirror rather than re-derive: (a) every occurrence is a
source-versioned, evidence-grounded event (`:8-10`); (b) "Attorney judgment
exists only as a `CandorDisposition` record bound to the exact event and its
exact observation version — **no legal judgment is ever computed by the
system**" (`:11-13`); (c) promotion is blocked by a *derived*, fail-closed
predicate, and a newer observation version re-blocks (`:14-19`); (d) the
two-rung shape — rung 1 domain + service + failing-then-green test over
in-memory storage, rung 2 durable storage "on the `ExecutionLedger` precedent,
the slice's first db-admin migration, and the live filing-promotion path
actually consulting the predicate" (`:20-24`). Decision log opens at `:26`:
design order schema → service → implementation (`:32-33`), hard fact/judgment
split (`:34-38`), "derived gate, no stored closure" (`:39-42`), predicate
semantics with the 2026-08-06 post-merge scope clarification (`:43-54`). What #575
actually implemented is inventoried in §4.2/§4.3.

**`goals/legal-position-relator-runtime`** — manifest `lifecycle: active`;
**SPEC only, zero implementation** (`rg -l "HohfeldPosition|LegalPositionRelator"`
over `packages/**/src/**` returns nothing). SPEC `:5-28`: closed eight-member
`HohfeldPosition` domain with correlative/opposite derivations over
`(positionKind, LegalActContent)` (`:9-12`); a *simple* `LegalPositionRelator`
storing one advantage-side directed relation ("persisting both ends of a
correlative pair is a schema defect, not a style choice", `:13-15`); a
`LegalPositionRelatorPolicy` emitting typed candidate *inputs* where "Legal
comparability itself is never computed" (`:16-20`); rung 2 adds
authority-gated transition events, `CorrectionDelta`, `PriorityBasis`, and
durable append-only storage (`:21-25`). `:27-28`: "The system records
positions, exercises, and scope alignments. Legal judgment stays human,
always." Its decision log opens at `:30`, and items 1-4 (`:37-49`) are the
template this packet's DECISIONS.md mirrors: two research lanes (`:37-39`),
live-source + SPEC-bound posture that "never blocks on a sibling goal and
never forks one's contract" (`:40-45`), Opus subagents (`:46-47`), design
order schema → service → implementation (`:48-49`).

Both siblings converge on the same law the episode wedge must carry: the
system records acts and evidence; it never computes the legal conclusion.

## 9. NET-NEW re-confirmation (2026-08-06 sweep)

`rg -c "<symbol>" --glob 'packages/**/src/**' -g '!**/node_modules/**'` over
this checkout, all eight seed symbols:

| Symbol | Files in `packages/**/src/**` | Files repo-wide |
| --- | --- | --- |
| `DraftingEpisode` | **0** | 12 (all docs: `standards/memory-architecture/04-decision-log.md`, `explorations/ATLAS.md`, `explorations/lynx-lkg-ontology-grounding/research/04-beep-effect-grounding.md`, this packet's 4 files, `legal-patent-kg-deepening`'s 5) |
| `MemoryProjection` | **0** | 9 (docs only) |
| `AnswerProvenanceAnnex` | **0** | 5 (docs only) |
| `LegalInferenceEvent` | **0** | 5 (docs only) |
| `NormativeRow` | **0** | 5 (docs only) |
| `ClaimLimitationSupport` | **0** | 10 (docs only: `explorations/ATLAS.md`, this packet's `CAPTURE.md`/`README.md`/`SOURCES.md`/`ops/manifest.json`, `legal-patent-kg-deepening`'s 5) |
| `DraftingOutline` | **0** | 4 (docs only) |
| `DraftingRouteState` | **0** | 4 (docs only) |

**Verdict: no drift.** All eight remain net-new in package source; the
2026-08-01 finding holds on 2026-08-06. Every repo-wide hit is exploration or
standards prose, never code. Note the near-collision flagged in §5.1:
`PracticeKgQuery` (proposed) vs the live `PracticeKgQueries`
(`packages/law-practice/server/src/PracticeKg.queries.ts:21`) — the wedge
should not reuse that stem.

## 10. Nugget → surface reconciliation

**Primary cluster.**

- **T1-F10** (atomic normative rows; anti-hub prefilter is not a default gate)
  → `NormativeRow` net-new (§9). Nearest live substrate: the schema-decoded
  row/query surface of `PracticeKgQueries` (`PracticeKg.queries.ts:21-194`)
  and `PracticeKg.rows.ts:216-272`, with the non-total ordering gap recorded
  in §5.1. The anti-hub policy has no live counterpart —
  fusion channel weighting is SPEC-only
  (`goals/hybrid-retrieval-fusion-core/SPEC.md:77-88`) and there is no
  implementation to constrain (§7). Caution stands: small-benchmark result,
  supports a study fixture only.
- **T3-F4** (deterministic identity/hierarchy/scope/language/as-of resolution
  before ranking; disclose the policies used) → `AnswerProvenanceAnnex`
  net-new. Deterministic-before-ranking is already the live posture of the KG
  rows (§5.1) and the SPEC posture of fusion (`SPEC.md:82-93`, literal tier +
  span preservation + non-admitting output). The *disclosure* half — a
  machine-readable annex of temporal/membership/retrieval/fallback/
  incompleteness policies — has no carrier anywhere. Closest analogue is
  `SdkContextPacket.exclusions`
  (`ProfessionalRuntime.contracts.ts:747-749`), a free-text string array, which
  is exactly the shape T3-F4 says is insufficient.
- **T3-F5** (typed n-ary legal inference events with fact and norm premises)
  → `LegalInferenceEvent` net-new. Nearest live shapes: `PatentCitationEvent`
  (`PatentCitationEvent.model.ts:69-137`) as a source-versioned observation
  record, and `CandorDisposition` (`CandorDisposition.model.ts:63-116`) as a
  human judgment bound to an exact version. Neither carries premises or a
  conclusion. Caution stands: retrieval gain is unablated, hypothesis only.
- **T3-F10** (raw episodes are audit authority; entities/edges/summaries/
  communities are lossy projections; recent-raw fallback required) →
  `MemoryProjection` net-new; the *policy* is already binding at
  `standards/memory-architecture/04-decision-log.md:76-95` (rebuild-from-ledger
  path + deterministic fallback) reaffirmed at `:36-42`, and at
  `explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md:123-129`. So
  T3-F10 needs a *port*, not a decision.
- **T4-F7** (replayable episode ledger: matter and document versions, outline,
  retrieval spans, model configuration, chunks, plan, validators, attorney
  feedback; memory proposes precedents but never supplies current-disclosure
  support) → `DraftingEpisode` net-new. Composition inputs already live:
  matter/patent-asset refs and model/provider/mode attribution
  (`fixtures.ts:133-136,151-155,386-393`), evidence spans
  (`contracts.ts:209-222`), append-only chain precedent (§3), payload-bearing
  append-only storage precedent (§4.3).
- **ADHD-3** (law-owned append-only `DraftingEpisode` authoritative; memory
  engines limited to rebuildable lossy projections + recent-raw fallback) →
  grill RESOLVED; surfaces are §6 (boundary), §3 (ledger precedent), §4.3
  (migration precedent), §2 (speedrun entry). The named "speedrun entry" is
  concretely `runLawPatentIntake` + its five expected snapshots (§2).

**Absorbed first-rung cluster.**

- **T4-F1** (every generated limitation needs exact support in the *current*
  description or an explicit attorney disposition; independent and dependent
  evaluated separately; anchor fidelity does not decide written-description
  law) → `ClaimLimitationSupport` net-new. Live carriers to reuse:
  `Claim.independent` (`Claim.model.ts:62-64`) already separates independent
  from dependent; `TextAnchorVerificationReceipt` + `verifyTextAnchor`
  (`VerifiedTextAnchor.ts:152,349`) already provide the exact source-versioned
  anchor; `CandorDisposition` (`CandorDisposition.model.ts:63-116`) is the
  proven shape for an append-only attorney judgment bound to an exact version,
  and its "no legal judgment is ever computed" law
  (`goals/patent-citation-candor-gate/SPEC.md:11-13`) is the same never-compute
  boundary T4-F1 demands.
- **T4-F2** (outline nodes, section budgets, retrieval spans, chunks, assembly
  lineage as auditable artifacts; traceability, not a quality claim) →
  `DraftingOutline` net-new; no partial carrier exists. `RuntimeCandidateDraft`
  is body+subject+recipients only (`contracts.ts:428-446`), confirming the
  seed's "only draft/evidence/gate-facing fields".
- **T4-F3** (reference overlap cannot accept a draft; support, completeness,
  clarity, terminology, dependency, feature linkage, repetition, and attorney
  adjudication need separate provenance-bearing gates) → net-new. The live
  single-gate precedent is `CandorGateVerdict` carrying *only* an uncovered
  list with per-item `UncoveredReason` (`CandorPolicy.values.ts:121,156,215`) —
  a per-axis reason vocabulary is exactly the generalization T4-F3 asks for,
  and the derived-not-stored property (`:228-234`) is the mechanic to keep.
- **T4-F4** (specialist routing persisted with candidate routes, rationale,
  stage I/O, validator results, retries, overrides) → `DraftingRouteState`
  net-new. The live dispatch analogue is the fixture's `$match` registry
  (`fixtures.ts:687-692`) — a total, deterministic route with **no** persisted
  rationale, retry, or override, i.e. the null case T4-F4 wants replaced.
- **ADHD-2** (ordered `ClaimLimitationSupportSet` on law-practice claims;
  refuse draft promotion while any limitation lacks verified
  current-description anchors or an append-only attorney disposition;
  dependency closure is part of the gate) → net-new; composes
  `Claim` (§4.1), the verified-anchor substrate (§7), the derived fail-closed
  predicate pattern (§4.2), and `RuntimeApprovalGate` (`contracts.ts:473-491`)
  as the shared gate ADHD-2/ADHD-3 both attach to. Note the live blocker:
  `RuntimeApprovalDecision` is the single literal `"pending"`
  (`values.ts:139-143`), so "refuse promotion" has no representable decision
  today.

## § Corrections to inherited anchors

Attribution of every difference from the 2026-08-01 seed grounding.

**C-1 — `ProfessionalRuntime.contracts.ts:428-490` was wrong for three of five
symbols; the SOURCES.md §4 correction is CONFIRMED, with one refinement.**
The seed span (`CAPTURE.md:145`) covers `RuntimeCandidateDraft` (`:428-446`)
and `RuntimeApprovalGate` (`:473-491`) only — and `:490` truncates the gate by
one line, stopping inside the class rather than at its closing `) {}`.
`RuntimeEvidenceRef` is at `:209-222`, `RuntimeActivity` at `:608-623`,
`RuntimeUsageRecord` at `:645-655`, exactly as
`research/SOURCES.md:63-66` states. Additional correction: "principals" is not
a single symbol (see §1) — cite `contracts.ts:83-87` for the id schema and
`:751-753` for the packet roster. *Cause:* seed-time span estimate over a
30 KB file, not a code move — the file is unchanged since `2026-08-01 01:16`.

**C-2 — `Claim.model.ts:52-93` is still exact.** Verified line-for-line
(`export class Claim` at 52, `) {}` at 93). No correction needed.

**C-3 — `ExecutionLedger.ports.ts:61-108` is still exact.** `:61`
opens `ExecutionLedgerShape`, `:108` is the `ExecutionLedger` service tag. No
correction needed.

**C-4 — `agent-memory-tiers-bitemporal-edges/DECISIONS.md:66-84,116-135` is
still exact.** Verified: `:66` is Decision 2's Question line, `:116` is
Decision 4's heading. No correction needed.

**C-5 — `goals/hybrid-retrieval-fusion-core/SPEC.md:75-102` starts two lines
early.** The numbered contract items the seed relies on run `:77-102`
(item 3 at 77 through item 12 at 101-102); `:75-76` is the tail of item 2.
Non-substantive.

**C-6 — `goals/practice-kg-mcp/SPEC.md:33-41` omits D-9.** The seed span
covers D-1…D-10 (`:33-41`); the placement ruling D-9 is at `:42`, outside it.
Since D-9 is what fixes where a KG query surface may live, cite `:41-42` or
`:33-42` going forward.

**D-1 — NEW SINCE SEED: the entire candor lane is live code, not a plan.**
Moved by **PR #575** (`5e4df6be4a`, 2026-08-06 07:05) with follow-up **#589**
(`f6e392d296`). The seed's SOURCES.md knew #575 "opened the migration lane";
what is newly grounded here is that it also landed three domain entities, two
domain values, two use-case service families, two server repositories, three
table modules, three `EntityId` registrations (recounted at review gate 1
against the #575 diff), the slice's first db-admin
migration with a six-trigger append-only guard, its `AcceptedProofManifest`
entries, and its `Migrations.gen.ts` registration (§4.2-4.4). **Consequence
for the wedge:** rung 2's storage question is largely answered — a
payload-bearing append-only law-practice table already exists as precedent,
and it did *not* need `ExecutionLedger`'s raw-`pgTable` escape hatch.

**D-2 — NEW SINCE SEED: `goals/practice-kg-mcp` is not SPEC-only.** The seed
row reads "`goals/practice-kg-mcp` already owns a read-only IP-law KG surface"
(`CAPTURE.md:155-157`) as a SPEC ownership claim. In this checkout the surface
is *implemented*: ~4.0 kLOC of `PracticeKg.*` in
`packages/law-practice/server/src`, three read-model tables in
`packages/law-practice/tables/src/entities`, and `apps/practice-kg-mcp`
(§5.1). *Cause:* not a single PR — the practice-kg-mcp goal has been shipping
since 2026-07-27 (SPEC `:3`), predating the 2026-08-01 seed; the seed's
grounding sweep looked at goal SPECs, not at slice source. **Consequence:**
remo2's "rows-first `PracticeKgQuery`" should be written against the live row
and decoder shapes rather than invented, and must not collide with the
existing `PracticeKgQueries` name.

**D-3 — NEW SINCE SEED: the verified-anchor substrate is live and already
consumed.** The seed lists `goals/citation-verified-span-substrate` as a SPEC
to "reuse, not recreate" (`CAPTURE.md:164-166`).
`TextAnchor`/`SourceTextIdentity`/`TextAnchorVerificationReceipt`/
`verifyTextAnchor` all exist in
`packages/foundation/modeling/provenance/src` and are consumed by #575 at
`PatentCitationEvent.model.ts:82-85` (§7). *Moved by:* the provenance
substrate work plus #575. **Consequence:** the `ClaimLimitationSupport` rung
can bind to a live receipt type on day one.

**D-4 — CORRECTION: the "bounded `SparqlQueryService`" is bounded in two
places, and it is not in `@beep/rdf`.** The seed phrase "the `@beep/rdf`
in-memory dataset Session pattern … via the existing bounded
`SparqlQueryService`" (`CAPTURE.md:177-181`) compresses three packages.
`SparqlQueryService` lives in `@beep/semantic-web`
(`packages/foundation/capability/semantic-web/src/services/sparql-query.ts:305,348`);
`@beep/rdf` supplies only `Dataset`/`makeDataset`
(`packages/foundation/modeling/rdf/src/Rdf.ts:1066`); the engine is
`@beep/oxigraph`. The service contract's only bound is `timeoutMs`
(`sparql-query.ts:87-98`) — the result-count envelope (`defaultLimit: 100`,
`maxResultCount: 200`) is a *caller-side* value object in
`@beep/ontology-use-cases`
(`Session.sparql.ts:82-96`, truncation at `:557-562`). A wedge lineage query
that reuses the service without reusing that envelope is unbounded in result
count. *Cause:* seed-time shorthand, not code movement.

**D-5 — CONTEXT UPDATE (already recorded in this packet, confirmed here):**
`standards/memory-architecture/04-decision-log.md:7-65` (2026-08-06) passes
operator dev-memory from Cognee to basic-memory + codegraph, moved by **PR
#604** (`04b39eb827`, `feat(memory): adopt basic-memory + codegraph as the
shared agent knowledge plane`). Boundary paragraph `:36-42` keeps the
operator/product split explicitly unchanged. The wedge's `MemoryProjection`
port stays engine-agnostic; "Cognee" in the seed-time quotes reads as the
operator memory engine of record at seed time.

**D-6 — NO DRIFT: `hybrid-retrieval-fusion-core` and
`legal-position-relator-runtime` remain SPEC-only.** Zero fusion symbols and
zero Hohfeld/relator symbols in `packages/**/src/**` (§7, §8). Both stay
stable reference boundaries with nothing live to compose against.

**D-7 — NO DRIFT: all eight net-new symbols are still net-new** (§9), with the
`PracticeKgQuery`/`PracticeKgQueries` naming hazard as the only new caveat.

### Open items this lane could not close (recorded honestly)

- **NOT FOUND:** any repo symbol named `PracticeKgQuery`, `MatterProjection`,
  or an equivalent typed row-query contract for the remo2 lane. Only
  `PracticeKgQueries` (SQL text) and its decoders exist.
- **NOT FOUND:** any `AcceptedProofManifest` or migration precedent for a
  *law-practice event ledger* specifically; §4.3 is the candor precedent and
  is the closest available template.
- **NOT FOUND:** any existing "annex", "policy disclosure", or
  "incompleteness" carrier for T3-F4 beyond
  `SdkContextPacket.exclusions: ReadonlyArray<NonEmptyString>`
  (`ProfessionalRuntime.contracts.ts:747-749`).
- **Not assessed by this lane:** whether `RuntimeApprovalDecision`'s
  single-literal domain (`values.ts:139-143`) may be widened from this wedge —
  that touches `goals/agentic-professional-runtime`'s SPEC, which the
  dependency-posture decision forbids amending from here. Flagged for align.
