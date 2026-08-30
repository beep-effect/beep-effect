# R2 vocabulary reuse scan

Date: 2026-08-27

## Scope and method

This scan starts from all 66 rows in `ontology/docs/pre-glossary.csv`: 26 classes,
36 properties, and four named individuals. It checks whether an external term has the same
meaning, a usefully similar meaning, or only a contextual relationship. The mapping predicates
follow the requested SSSOM-style vocabulary:

- `skos:exactMatch`: interchangeable in this ontology's intended use.
- `skos:closeMatch`: materially similar, but one term is narrower or has different constraints.
- `skos:related`: useful context only; do not substitute the terms.

No class mapping below is an `exactMatch`. Most external classes are intentionally broad, while
the local classes carry monorepo-specific validity, scheduling, or certainty conditions. Exact
property mappings are also rare for the same reason.

The recommended reuse policy is small-term reuse or alignment, not wholesale imports. PROV-O is
the one plausible foundational import. P-Plan's non-commercial share-alike license needs legal
review before an import or copied axiom set.

## Baseline metadata vocabularies

Use Dublin Core Terms for source, created, modified, creator, and license metadata. Use SKOS for
labels, definitions, notes, and mappings. These vocabularies do not model CI operations, but they
avoid minting administrative metadata. PROV-O should carry assertion-level derivation.

## PROV-O

[PROV-O][prov-o] is a W3C Recommendation dated 2013. It is an OWL 2 provenance ontology and is
stable reference material. The specification is governed by W3C document-use and patent rules.

Coverage:

- `prov:Activity`, `prov:Entity`, and `prov:SoftwareAgent` supply broad parents for executions,
  evidence objects, and coding agents.
- `prov:Plan` is a broad parent for an intended verification plan.
- `prov:Invalidation` and `prov:invalidated` cover the event of an entity becoming invalid.
- `prov:startedAtTime`, `prov:endedAtTime`, `prov:generatedAtTime`, and `prov:atTime` cover
  provenance timestamps.
- `prov:used`, `prov:wasGeneratedBy`, `prov:wasDerivedFrom`, and
  `prov:wasAssociatedWith` can connect work, inputs, proofs, and agents.

Mapping candidates include `VerificationEpisode`, `WorkUnit`, `Proof`, `Agent`,
`InvalidationEvent`, `beganAt`, `recordedAt`, `landedAt`, `invalidates`,
`touchesPackage`, and `hasCostProvenance`. The consolidated table gives the proposed strength.

Limits:

PROV-O records what happened and how entities were influenced. It does not define lane
obligations, certainty tiers, cache epochs, hash input membership, proof survival, queueing,
resource grants, budgets, contention, or blast-radius inference. `prov:Invalidation` says that an
entity became invalid; it does not calculate which proofs an epoch change kills.

Decision: import or profile the small PROV-O core. Specialize it with local terms. Do not treat a
generic `prov:Entity` as a complete proof model.

## P-Plan

[P-Plan][p-plan] release 1.1 is an OWL 2 extension of PROV-O published in 2013. It models plans,
steps, variables, executions, and the correspondence between planned and executed elements. The
published license is CC BY-NC-SA 2.0.

Coverage:

- `p-plan:Step` is a strong parent or alignment target for `VerificationLane`.
- `p-plan:Activity` is a strong parent or alignment target for an executed `WorkUnit`.
- `p-plan:correspondsToStep` closely matches `executesLane` once `WorkUnit` is modeled as an
  execution and `VerificationLane` as its plan step.
- `p-plan:Variable`, `hasInputVar`, and `hasOutputVar` can describe declared step inputs and
  outputs. They are relevant to lane input declarations, but not to hash membership by themselves.
- `p-plan:Plan`, `isStepOfPlan`, and `isPreceededBy` can express a verification plan and ordering.

Limits:

P-Plan does not model scheduler admission, affected scopes, budgets, grants, lock waits,
certainty, cache epochs, invalidation, or probabilistic cost. A variable is not a `HashSurface`:
P-Plan does not state that membership in the variable's concrete input set determines a cache key
or invalidation radius.

Decision: reuse the pattern and align selected terms. Do not import until the packet accepts the
non-commercial share-alike license.

## OSLC Automation

[OSLC Automation 2.1][oslc-auto] and its [RDF vocabulary][oslc-vocab] were published by the
OASIS OSLC Open Project in 2021. The specification is CC BY 4.0, with portions under Apache-2.0.
It defines interoperable automation plans, requests, results, parameters, states, and verdicts.

Coverage:

- `oslc_auto:AutomationPlan` closely matches the reusable prescription behind a lane.
- `oslc_auto:AutomationRequest` closely matches a scheduled or submitted `WorkUnit`.
- `oslc_auto:AutomationResult` closely matches the execution result from which a `Proof` may be
  derived.
- `oslc_auto:executesAutomationPlan` closely matches `executesLane`.
- `oslc_auto:producedByAutomationRequest` links a result to its request.
- `oslc_auto:State`, `state`, `Verdict`, and `verdict` can carry execution lifecycle and outcome.
- `ParameterInstance`, `inputParameter`, and `outputParameter` can describe explicit inputs and
  outputs.

Limits:

An `AutomationResult` is not automatically a valid proof. OSLC does not bind a result to a tree
state and cache epoch, discharge a certainty obligation, calculate an affected package closure,
or model grants and contended resources. Its states and verdicts are execution-level, not
certainty tiers or seat lifecycle states.

Decision: prefer alignment or a small adapter vocabulary. OSLC gives the best existing names for
the plan-request-result spine, but the local ontology must add validity and scheduling semantics.

## SEON, the Software Engineering Ontology Network

The requested [SEON][seon] is the UFES Software Engineering Ontology Network, not the similarly
named Zurich Software Evolution ONtologies. It is a network grounded in UFO. Its core Software
Process Ontology covers standard, project, and performed processes; activities; artifacts;
resources; procedures; and stakeholder participation. Domain layers cover requirements,
configuration management, measurement, and other software-engineering areas.

Status and license:

- The public specification and network browser verify that the ontology network exists.
- A current release cadence and an explicit reuse license were not found. License: [UNVERIFIED].
- Exact stable CURIEs for the relevant network terms should be resolved from the released OWL
  artifacts before any SSSOM file is committed.

Coverage:

SEON offers broader concepts related to software activities, performed processes, artifacts,
resources, software items, dependencies, measurements, and stakeholders. These are possible
parents or related targets for `VerificationLane`, `WorkUnit`, `PackageRef`, `CostEstimate`,
`ContendedResource`, `Agent`, and `dependsOn`.

Limits:

SEON is a conceptual software-engineering network, not an operational CI scheduler. The reviewed
material does not define proof validity, certainty tiers, cache epochs, hash surfaces, grants,
backpressure, queue delay decomposition, or lane-specific invalidation.

Decision: use as a conceptual benchmark. Do not import or emit term-level IRIs until license and
artifact persistence are verified.

## SPDX 3.0.1 and the Build profile

[SPDX 3.0.1][spdx] is a published open specification for BOM exchange. The specification uses
Community Specification License 1.0; older portions remain under CC BY 3.0. SPDX metadata is
designed for open reuse under CC0. The [Build profile][spdx-build] models a software build's
inputs, outputs, tools, host, invoking agent, configuration digest, environment, parameters, and
start and end times.

Coverage:

- `spdx-build:Build` closely matches a `WorkUnit` only when that unit is a software build.
- `spdx-core:Agent` is a close match for the broad local `Agent` class.
- `spdx-software:Package` is a close match for `PackageRef`, though the local class identifies a
  workspace package rather than a distributable package description.
- Build `buildType` is related to `LaneKind` and `VerificationLane`.
- Core relationship types such as `hasInput`, `hasOutput`, `invokedBy`, `usesTool`, and
  `dependsOn` can carry build lineage and direct software dependency facts.
- `spdx-core:Hash` and Build `configSourceDigest` can record digests.

Limits:

A digest is not a `HashSurface`. SPDX can record a configuration digest or build input, but it
does not define the complete set of inputs feeding a lane's cache key. It also lacks proof
validity across epochs, certainty obligations, contention, grants, budgets, queueing, and
blast-radius rules. The Build class excludes test, lint, and policy lanes unless a consumer uses
an intentionally broad local build interpretation.

Decision: align packages, agents, direct dependencies, and actual build executions. Do not use
SPDX Build as the superclass of every verification work unit.

## in-toto attestations

The [in-toto Attestation Framework][in-toto] version 1.2 defines authenticated metadata about
software artifacts. It separates subject, predicate, statement, envelope, and bundle layers. The
repository root is Apache-2.0. In-toto governance assigns specifications to the Community
Specification License, so an implementation can use the format while a derived specification
should preserve the applicable specification notices. The CNCF-hosted project is active.

Coverage:

- An in-toto `Statement` is a close exchange representation for a `Proof` when the predicate
  states the lane outcome and the statement is authenticated.
- `ResourceDescriptor` can identify the tree, artifact, or other subject by name and digest.
- Predicate types can carry SLSA provenance, SPDX material, test results, or a local
  verification-proof predicate.
- Envelope signatures can establish authenticity, which the pre-glossary currently leaves
  implicit.

Limits:

The framework deliberately permits arbitrary predicates. It does not define this packet's proof
semantics, expiry conditions, cache epoch, lane obligations, certainty tier, scheduler admission,
or invalidation radius. A signed statement can be authentic and still be irrelevant or stale for
the current tree and epoch.

Decision: use as a serialization and authentication boundary for selected `Proof` instances.
Define the operational semantics in the local ontology or a versioned in-toto predicate.

## W3C SSN/SOSA

[SSN/SOSA][ssn] is a 2017 W3C Recommendation for sensors, observations, procedures, features of
interest, observed properties, results, samplers, and actuators. W3C document-use and patent rules
apply. A newer 2023-edition work remains on the W3C draft track; the 2017 Recommendation is the
stable reference used here.

Genuine relevance is narrow:

- `sosa:Observation` and `sosa:Result` are related to measured cost evidence and KPI telemetry.
- `sosa:resultTime` is related to the time at which a metric observation became available.
- `sosa:Actuation` is related to a `ControlIntervention` only if the intervention is modeled as an
  action that changes a system property.

Limits:

CI journals and hosted-run records are usually software provenance, not sensor observations.
SSN/SOSA does not supply lanes, proofs, epochs, hash surfaces, grants, budgets, or invalidation.
Importing it only to name a metric result would add avoidable conceptual weight.

Decision: no core import. Reconsider a small SOSA alignment only if telemetry sources become
first-class sensors or observations in a later CQ.

## Schema.org actions

[Schema.org `Action`][schema-action] is a broad action model with `agent`, `object`, `result`,
`instrument`, `startTime`, `endTime`, `actionStatus`, and `error`. Schema.org is a living
community vocabulary. Its schema is licensed under CC BY-SA 3.0.

Coverage:

- `schema:Action` is a close but very broad target for `WorkUnit` and `ControlIntervention`.
- `schema:agent` is related to the local `Agent` participation.
- `schema:startTime` and `schema:endTime` align with execution time boundaries.
- `schema:error` is related to a surfaced failure and thus to `FailureSignature` evidence.

Limits:

Schema.org is designed for Web markup, not formal CI reasoning. Its loose domain and range model
does not express scheduling laws, proof validity, cache keys, dependency closure, grants,
contention, budgets, or certainty.

Decision: do not import for the core ontology. PROV-O and OSLC Automation have tighter semantics.

## DOAP

[DOAP][doap] is an RDF vocabulary for software project metadata. The maintained repository is
Apache-2.0 licensed. It describes projects, releases, repositories, maintainers, programming
languages, issue trackers, and project URLs.

Coverage:

- `doap:Project` is a close but broader target for `PackageRef` when each workspace package is
  treated as a software project.
- DOAP repository classes are close targets for `Checkout` only at the repository-description
  level. A checkout or worktree is a local realization, not the repository itself.

Limits:

DOAP does not describe build or verification executions, dependencies, proofs, cache validity,
hash inputs, scheduler resources, or timing. It should not be stretched into an operational
model.

Decision: reuse only for project and repository metadata if that metadata enters scope.

## Verified CI/build-specific candidates

### Software Build System ONtology

The [SBSON dissertation][sbson] verifies that the Software Build System ONtology exists. SBSON
models technology-independent build and dependency-management semantics, with system-specific
layers for Maven, Ant, Ivy, and Gradle. It covers build systems, projects, artifacts, releases,
dependencies, dependency scopes, and repository knowledge.

Status and license:

- Verified as a 2019 research ontology described and evaluated in a doctoral dissertation.
- A maintained, resolvable ontology namespace and reuse license were not verified.
- Exact term IRIs and current downloadable OWL artifacts: [UNVERIFIED].

SBSON is relevant to `PackageRef`, `dependsOn`, `dependsOnTransitive`, and parts of
`HashSurface` that concern declared build dependencies. It does not cover proof validity,
certainty tiers, cache epochs, scheduler grants, backpressure, or lane-specific hash inputs.

Decision: benchmark the dependency model, but do not import or publish mappings until its
namespace, artifacts, and license are verified.

### DevOps-infra ontology network

The [DevOps-infra core ontology][devops-infra] has a first official release dated 2021-04-19 and
defines a core `Resource` concept for a larger DevOps infrastructure ontology network. The
published documentation leaves its license field blank.

Its resource model is related to `ContendedResource`, `SharedCache`, and `Checkout`, but it does
not supply verified CI attempt, proof, epoch, grant, or certainty semantics. License:
[UNVERIFIED].

Decision: no import. Keep it as a discovery lead if the ontology later expands infrastructure CQs.

No other maintained OWL/RDF ontology with a verified public specification was found that models
CI attempts, cache epochs, verification certainty, and scheduler backpressure together. CI/CD
data models and pipeline schemas exist, but a schema is not automatically a reusable ontology.

## Consolidated mapping table

Prefixes in this table are descriptive. Resolve and pin every external IRI before producing the
formal SSSOM file. SEON and SBSON candidates are excluded because their exact reusable IRIs or
licenses remain unverified.

| Our term | Candidate external term | Predicate | Confidence |
| --- | --- | --- | --- |
| `VerificationLane` | `p-plan:Step` | `skos:closeMatch` | high |
| `VerificationLane` | `oslc_auto:AutomationPlan` | `skos:closeMatch` | high |
| `VerificationLane` | SPDX Build `buildType` | `skos:related` | medium |
| `LaneKind` | SPDX Build `buildType` | `skos:related` | medium |
| `WorkUnit` | `p-plan:Activity` | `skos:closeMatch` | high |
| `WorkUnit` | `oslc_auto:AutomationRequest` | `skos:closeMatch` | high |
| `WorkUnit` | `schema:Action` | `skos:closeMatch` | medium |
| `WorkUnit` | `spdx-build:Build` | `skos:closeMatch` | medium |
| `Scope` | `oslc_auto:ParameterInstance` | `skos:related` | low |
| `VerificationEpisode` | `prov:Activity` | `skos:closeMatch` | medium |
| `VerificationEpisode` | `p-plan:Bundle` | `skos:related` | low |
| `CertaintyTier` | `oslc_auto:Verdict` | `skos:related` | low |
| `CostEstimate` | `sosa:Result` | `skos:related` | medium |
| `CostProvenance` | `prov:wasDerivedFrom` | `skos:related` | medium |
| `ChangeSet` | `prov:Entity` | `skos:closeMatch` | low |
| `PackageRef` | `spdx-software:Package` | `skos:closeMatch` | high |
| `PackageRef` | `doap:Project` | `skos:closeMatch` | medium |
| `Proof` | `prov:Entity` | `skos:closeMatch` | medium |
| `Proof` | `oslc_auto:AutomationResult` | `skos:closeMatch` | high |
| `Proof` | in-toto `Statement` | `skos:closeMatch` | medium |
| `TreeState` | in-toto `ResourceDescriptor` | `skos:closeMatch` | medium |
| `InvalidationEvent` | `prov:Invalidation` | `skos:closeMatch` | high |
| `HashSurface` | `spdx-core:Hash` | `skos:related` | low |
| `SeatRequest` | `oslc_auto:AutomationRequest` | `skos:related` | low |
| `GrantState` | `oslc_auto:State` | `skos:related` | low |
| `ContendedResource` | DevOps-infra `Resource` | `skos:related` | low |
| `Checkout` | `doap:Repository` | `skos:closeMatch` | medium |
| `FailureSignature` | `schema:Error` | `skos:related` | medium |
| `ControlIntervention` | `schema:Action` | `skos:closeMatch` | medium |
| `ControlIntervention` | `sosa:Actuation` | `skos:related` | low |
| `Agent` | `prov:SoftwareAgent` | `skos:closeMatch` | high |
| `Agent` | `spdx-core:Agent` | `skos:closeMatch` | high |
| `Agent` | `schema:agent` | `skos:related` | medium |
| `executesLane` | `p-plan:correspondsToStep` | `skos:closeMatch` | high |
| `executesLane` | `oslc_auto:executesAutomationPlan` | `skos:closeMatch` | high |
| `requiresLane` | `p-plan:isStepOfPlan` | `skos:related` | low |
| `hasCostEstimate` | `sosa:hasResult` | `skos:related` | low |
| `touchesPackage` | `prov:used` | `skos:related` | low |
| `dependsOn` | SPDX relationship `dependsOn` | `skos:closeMatch` | high |
| `dependsOnTransitive` | SPDX relationship `dependsOn` | `skos:related` | medium |
| `provesTree` | in-toto `subject` | `skos:related` | medium |
| `invalidates` | `prov:invalidated` | `skos:closeMatch` | high |
| `hasGrantState` | `oslc_auto:state` | `skos:related` | low |
| `feedsLane` | `p-plan:hasInputVar` | `skos:related` | low |
| `surfacedByLane` | `oslc_auto:reportsOnAutomationPlan` | `skos:related` | medium |
| `beganAt` | `prov:startedAtTime` | `skos:exactMatch` | high |
| `beganAt` | `schema:startTime` | `skos:closeMatch` | high |
| `recordedAt` | `prov:generatedAtTime` | `skos:closeMatch` | medium |
| `landedAt` | `prov:atTime` | `skos:closeMatch` | medium |

The following pre-glossary terms have no defensible direct mapping in the reviewed vocabularies:

- Classes: `CacheEpoch`, `SeatGrant`, `ResourceBudget`, `SharedCache`, `MemoryClass`, and
  `FailureSignature` as an equivalence class rather than an error object.
- Properties: `hasLaneKind`, `admissibleFor`, `targetsTier`, `hasMemoryClass`, `hasCostProvenance`,
  `validInEpoch`, `dischargesObligation`, `timeToCertaintyMs`, `lockWaitMs`, `executionMs`,
  `repairGapMs`, `ciWaitMs`, `contendsFor`, `occupiesCheckout`, `admittedBy`, `hasBudget`,
  `maxGrantCostMs`, `touchesHashSurface`, `radiatesToPackage`, `cachedIn`, `mountsCache`,
  `inEpoch`, and `estimatedFailureProbability`.
- Individuals: `MachineProofLock`, `TierRepairGreen`, `TierLocalFullProof`, and
  `TierCiMergeGreen` are local operational constants.

The remaining data properties, including `p50Ms` and `p95Ms`, are ordinary metric fields. They
need local definitions because no reviewed vocabulary fixes their percentile population,
measurement window, unit, and provenance semantics.

## Genuinely novel operational semantics

These concepts should remain local unless a later scan finds an exact operational standard:

1. **Cache epoch as a proof-validity world.** `CacheEpoch`, `validInEpoch`, and `inEpoch` bind
   evidence and cache state to a shared interpretation of all hash inputs. This is stronger than a
   timestamp, version, digest, or provenance bundle.

2. **Hash surface as declared cache-key membership.** `HashSurface`, `touchesHashSurface`, and
   `feedsLane` describe the complete input set that determines one lane's hash. SPDX hashes,
   P-Plan variables, and in-toto subjects can record inputs or digests, but not this membership
   rule.

3. **Computed invalidation blast radius.** The chain from a changed surface through a lane to
   affected packages, including `radiatesToPackage`, is not present in the reviewed vocabularies.
   PROV invalidation records an event after the fact; it does not compute the radius.

4. **Tree-and-epoch proof validity.** `Proof`, `provesTree`, `validInEpoch`, `invalidates`, and
   `dischargesObligation` together define whether evidence still satisfies a lane obligation.
   OSLC results and in-toto statements lack these acceptance conditions.

5. **Certainty tiers as outstanding proof obligations.** `CertaintyTier`, `requiresLane`, and the
   three tier individuals model progressively stronger operational certainty. They are not OSLC
   verdicts or generic workflow states.

6. **Seat, grant, and budget backpressure.** `SeatRequest`, `SeatGrant`, `GrantState`,
   `ResourceBudget`, `admittedBy`, `hasBudget`, and `maxGrantCostMs` describe admission under a
   bounded machine-time budget. Workflow and automation vocabularies do not model this scheduler
   contract.

7. **Contention laws over checkouts and machine resources.** `ContendedResource`,
   `contendsFor`, `occupiesCheckout`, and `MachineProofLock` encode exclusive or capacity-bound
   resources and the no-two-active-grants-per-checkout invariant.

8. **Time-to-certainty decomposition.** `timeToCertaintyMs`, `lockWaitMs`, `executionMs`,
   `repairGapMs`, and `ciWaitMs` partition an episode around an operational KPI. Generic duration
   properties do not define these mutually interpreted phases.

9. **Failure-signature equivalence and surfacing economics.** `FailureSignature` groups attempts
   by failed step and failure kind, while `surfacedByLane` supports earliest-and-cheapest failure
   discovery. Schema.org errors and OSLC verdicts do not define the equivalence class.

10. **Tagged control interventions over the KPI series.** `ControlIntervention` and `landedAt`
    partition observed episodes by a deliberate operational change. PROV and Schema.org can
    describe the action and time, but not the packet's causal comparison convention.

## Reuse recommendation

Adopt this layered pattern:

1. PROV-O for provenance entities, activities, agents, derivation, and invalidation events.
2. P-Plan alignments for lane plans and work-unit executions, subject to license approval.
3. OSLC Automation alignments for the plan-request-result exchange spine.
4. SPDX Build and in-toto at software-supply-chain interchange boundaries.
5. Local `ciops:` terms for epochs, hash surfaces, proof validity, certainty, admission,
   contention, budgets, and KPI decomposition.

Do not import SSN/SOSA, Schema.org, DOAP, SEON, SBSON, or DevOps-infra into the core T-Box at this
stage. Keep their mappings as documentation until a CQ requires their additional commitments.

[prov-o]: https://www.w3.org/TR/prov-o/
[p-plan]: https://www.opmw.org/model/p-plan/
[oslc-auto]: https://docs.oasis-open-projects.org/oslc-op/auto/v2.1/automation-spec.html
[oslc-vocab]: https://docs.oasis-open-projects.org/oslc-op/auto/v2.1/psd01/automation-vocab.html
[seon]: https://dev.nemo.inf.ufes.br/seon/SEON.html
[spdx]: https://spdx.github.io/spdx-spec/
[spdx-build]: https://spdx.github.io/spdx-spec/v3.0.1/model/Build/Build/
[in-toto]: https://github.com/in-toto/attestation/blob/main/spec/README.md
[ssn]: https://www.w3.org/TR/vocab-ssn/
[schema-action]: https://schema.org/Action
[doap]: https://github.com/ewilderj/doap
[sbson]: https://elliseghan.github.io/assets/articles/Eghan_PhD_F2019.pdf
[devops-infra]: https://oeg-upm.github.io/devops-infra/ontology/core/index-en.html
