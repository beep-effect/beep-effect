# AgentO vs the packet system: vocabulary mapping and the migration method

**Date:** 2026-08-25 · **Sources:** Ekelhart, Kurniawan, Ekaputra, Kiesling,
"AgentO: An Ontology for Modeling Agentic AI Systems", ESWC 2026, LNCS 16550,
pp. 298–320 (doi:10.1007/978-3-032-25159-6_16; read from the operator's copy
of the proceedings, `~/YeeBois/research/The Semantic Web.pdf`); the ontology
itself, revision 0.2, fetched 2026-08-25 from
https://sepses.ifs.tuwien.ac.at/onto/ontology.ttl (w3id redirect target of
https://w3id.org/agentic-ai/onto; doi:10.5281/zenodo.18342624).
**License:** CC BY 4.0, reference-only. Nothing is vendored.

## 1. What AgentO is

A design-time OWL vocabulary for "a team of agents runs a workflow pattern of
steps; each step has a task; a task is performed by an agent that uses tools
and resources, toward a goal or objective". Namespace
`http://www.w3id.org/agentic-ai/onto#`. Counted from the Turtle: 21 classes,
about 40 object properties, 10 own data properties plus `dcterms:title`,
`dcterms:description`, `dcterms:reference`.

The layering is the useful part. Almost every class is a subclass of a stable
parent ontology:

| AgentO class | Parent | Notes |
| --- | --- | --- |
| `LLMAgent`, `HumanAgent` | `prov:Agent` | the paper also makes `Tool` a superclass of `LLMAgent` (Table 1, issue 3) |
| `WorkflowPattern` | `pplan:Plan` | `hasWorkflowStep`, `hasSubPattern`, `nextPattern` |
| `WorkflowStep`, `StartStep`, `EndStep` | `pplan:Step` | `stepOrder`, `nextStep`, `relatedStep`, `hasAssociatedTask` |
| `Team` | `beam:System` | `hasAgentMember`, `hasTeamGoal`, `hasWorkflowPattern` |
| `LanguageModel` | `beam:StatisticalModel` | `useLanguageModel` |
| `Goal`, `Objective`, `Environment` | `:Context` | `contributesToGoal`, `contributesToObjective` |
| `Constraint`, `Memory` | `:KnowledgeBase` | |
| `Prompt` | (own) | four data properties: `promptInstruction`, `promptContext`, `promptInputData`, `promptOutputIndicator` |
| `Task`, `Tool`, `Capability`, `Config`, `Instance` | (own / BEAM) | `performedByAgent`, `requiresResource`, `producedResource`, `hasAgentConfig` |

What it refuses to model matters as much. Table 1 of the paper records the
authors' decisions not to model runtime flags, function calls, loops, or
invocation semantics; execution traces and MCP/A2A alignment are listed as
future work (Sect. 6). AgentO can state that an agent was supposed to perform
step 3 with a tool. It cannot state that step 3 ran, when, by whom, against
which input digest, producing which output. The packet system already holds
that second half: `PacketEvent` (`actor`, `parent`, `expectedRevision`,
`at`) and the PROV-O port in `packages/foundation/modeling/rdf/src/Prov.ts`
(`Activity`, `Association.hadPlan`, `Generation`, `Derivation`).

Maturity signals, stated plainly: revision 0.2, one listed author, the Widoco
page's evaluation section is empty, and the accompanying KG holds 66 patterns
(AutoGen 6, CrewAI 16, LangGraph 9, Mastra 35). Maintained under the BILAI
project through autumn 2029. Good enough to map to; not something to bind
internal identifiers to.

## 2. The mapping to a goal packet

The goal manifest (`initiative-manifest/v2`) already carries most of AgentO
as untyped JSON and prose:

| AgentO | Where it lives in a packet today | Typed? |
| --- | --- | --- |
| `Objective` / `Goal` | `initiative.mission`, `README.md` | string |
| `WorkflowPattern` + `WorkflowStep` + `stepOrder` | `phases[]` P0..P5 | id/name/status only |
| `LLMAgent` + `useLanguageModel` + `hasAgentConfig` | `agentLaunchers[]` (`kind: codex-goal`); model/effort lane choices live in session memory and PR bodies | kind + path only |
| `HumanAgent` + `humanParticipatedIn` | the operator, implicit in `DECISIONS.md` | no |
| `Prompt` (four parts) | `GOAL.md`, a hand-written blob bounded by `targetChars`/`maxChars` | no |
| `Task` + `performedByAgent` | `PLAN.md` prose | no |
| `Tool` + `toolUsage` | `verificationCommands[]`, skill names in prose | string list |
| `Constraint` | `stopConditions[]` | string list |
| `Resource` + `requiresResource` | `currentSourceOfTruth[]`, `researchReports[]` | path list |
| `Team` + `hasAgentMember` per step | nowhere; which model at which effort ran which phase with which tools is oral tradition | no |
| `prov:Agent` on runtime events | `PacketEventActor` | yes |

The last two rows are the finding. The per-phase lane composition is the fact
most often re-derived from memory files, and the launcher is the one packet
artifact that is authored by hand yet fully determined by the others.

## 3. Where the payoff is, and where it is not

The paper's use case 2 (query the KG for reusable agent/task/tool
configurations by objective) is the capability the fleet lacks. "Which packets
ran a Full-tier gate with a browser-QA tool on a Sol lane" is `rg` over
Markdown today. Two honest caveats:

- 214 packets is small. A JSON projection plus `jq` covers most of the query
  need. RDF/JSON-LD earns its place only when the packet graph joins the rest
  of the knowledge graph: PROV provenance of research reports, evidence spans,
  the ontology packages. That join is the argument for RDF; SPARQL by itself
  is not.
- D8 (ratified) makes Git Markdown packets plus the event chain the sole
  system of record, with projections read-only and derived. AgentO fits only
  as a projection vocabulary. Making an OWL graph authoritative would
  re-litigate D8, and the paper supplies no reason to.

Recommended shape: our own terms in `packages/foundation/modeling/rdf`
subclassing `prov:` and `pplan:`, with `rdfs:subClassOf` /
`owl:equivalentClass` links to AgentO where the concepts coincide, IRIs carried
as `SemanticSchemaMetadata` annotations on the manifest schemas, emitted by
one more read-only projection off the existing fold. AgentO-compatible export,
no dependency on a 0.2 ontology's IRIs surviving.

## 4. The method worth stealing outright (fleet migration campaign)

Sect. 4 of the paper is a migration recipe, and it is the shape of the
unchartered fleet convention-migration campaign (goal PLAN P5; census 214
packets, 79 manifest key shapes, 65 non-v2 manifests):

1. Translate every heterogeneous source into the target schema with an LLM
   (they used gpt-5-mini; 47.72–166.60 s per pattern; ~2.8M input / 570k
   output tokens; $2.72 total for 66 patterns).
2. Every translation output carries a mandatory "Issues / Assumptions" header
   ahead of the instance data (Listing 1.2), so schema gaps are recorded at
   the point they are hit rather than reconstructed later.
3. Hand-review a stratified sample (6 per source framework, 24 of 66).
4. Extend the target schema from the recurring issues (27 found; Table 1
   records add / decline-to-model decisions per issue).
5. Re-run the translation with the extended schema and diff against round 1.

Constraint the paper did not have: Amendment E's no-backfill law. For
completed-retained packets the translation produces a genesis event plus a
translation report, never synthesized `stage-entered` / `status-set` history.
The "Issues / Assumptions" header becomes the per-packet translation report;
the recurring-issues table becomes the schema-amendment input for v2.

## 5. Amendment candidates queued for the Session B grill

Recorded as proposals in `MAP.md` ("Queued amendment candidates
(2026-08-25)"), not ratified. Both land inside existing candidates; neither
opens a packet.

- **Amendment H (candidate 3): typed `PacketWorkPlan`, rendered launchers.**
  Manifest gains a schema-first work plan: steps bound to responsible agents
  (kind, model, effort), tools/skills, constraints, required resources, and
  the human approver. `GOAL.md` becomes a projection rendered from it, with
  the four-part prompt split (instruction / context / input data / output
  indicator) as the render contract. Same move the skill-contract kernel made
  for skills.
- **Amendment I (candidates 3 and 4): JSON-LD projection lane.** One
  additional read-only projection emitting the packet graph with
  PROV-O / P-Plan-anchored IRIs and AgentO mappings; candidate 4's evidence
  receipts reuse the same IRIs on the runtime (PROV `Activity` /
  `Association` / `Generation`) side, where AgentO adds nothing.

## 6. Dispositions

| Item | Disposition |
| --- | --- |
| AgentO IRIs as internal identifiers | rejected; map to them, subclass PROV-O / P-Plan |
| OWL graph as a system of record | rejected; D8 |
| Runtime trace vocabulary from AgentO | rejected; not modeled there, PROV-O already ported |
| Four-part prompt split as launcher render contract | adopt in Amendment H |
| Translate-with-assumptions-header, sample-review, amend, re-run | adopt as the fleet campaign's method |
| New goal or exploration packet for this | rejected; folds into candidates 3/4 and the campaign charter |
