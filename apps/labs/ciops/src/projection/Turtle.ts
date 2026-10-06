/**
 * Canonical schedule-as-A-Box serialization for the S7 projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { ScheduleScope, TurtleDocument } from "./Schemas.ts";
import type { LanePlanProposal, LaneStep, PendingRequest, ScheduleProposal } from "./Schemas.ts";

const prefixes = [
  "@prefix ciops: <https://oip.law/ontology/ci-ops#> .",
  "@prefix ciops-prov: <https://oip.law/ontology/ci-ops-prov#> .",
  "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
];

// Instrumentation contract identity; vocabulary ratification remains run-3 work.
const emissionContractVersion = "s7-emission/v2";
// Lane-plan emission identity (contract §8.3); disjoint from the admission specification tuple.
const lanePlanContractVersion = "s7-lane-plan/v1";
const provisionalHeader = "# PROVISIONAL GRAPH — closure OPEN; excluded from negation and ratified typing.";

const turtleLiteral = (value: string): string =>
  `"${pipe(
    value,
    Str.replaceAll(/\\/g, "\\\\"),
    Str.replaceAll(/"/g, '\\"'),
    Str.replaceAll(/\r/g, "\\r"),
    Str.replaceAll(/\n/g, "\\n")
  )}"`;

// Injective PN_LOCAL encoding: alphanumerics stay verbatim and every other
// UTF-8 byte becomes a %HH PLX escape, so distinct proposal ids can never
// mint the same node and the structural "-step-"/"-request-" suffixes below
// cannot be forged by id content.
const pnLocalSlug = (value: string): string =>
  A.join(
    A.map(A.fromIterable(new TextEncoder().encode(value)), (byte) =>
      /[A-Za-z0-9]/.test(String.fromCharCode(byte))
        ? String.fromCharCode(byte)
        : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`
    ),
    ""
  );

const requestTriples =
  (proposalNode: string) =>
  (request: PendingRequest, index: number): ReadonlyArray<string> => {
    const subject = `${proposalNode}-request-${index}`;
    return [
      `${subject} ciops:admissionChargeTokens "${request.weightTokens}"^^xsd:integer .`,
      `${subject} ciops:hasOriginKey ${turtleLiteral(request.originKey)} .`,
      `${subject} rdf:type ciops:SeatRequest .`,
    ];
  };

const serializeProposal = (proposal: ScheduleProposal): TurtleDocument => {
  const proposalNode = `ciops-prov:${pnLocalSlug(proposal.proposalId)}`;
  const episodeNode = `ciops-prov:episode-${pnLocalSlug(proposal.episodeId)}`;
  // Each component encodes '-' itself, so the tuple separators are injective.
  // Scope comes from the admission engine's LiteralKit even for an empty queue.
  const specificationNode = `ciops-prov:specification-${A.join(
    A.map(
      [emissionContractVersion, proposal.policyDigest, proposal.journalPrefixDigest, ScheduleScope.Enum.admission],
      pnLocalSlug
    ),
    "-"
  )}`;
  const admittedRequests = A.map(proposal.steps, (step) => step.request);
  const requests = A.appendAll(admittedRequests, proposal.deferredTail);
  const ratifiedTriples = pipe(
    A.append(A.flatMap(requests, requestTriples(proposalNode)), `${proposalNode} rdf:type ciops:ScheduleProposal .`),
    A.sort(Order.String)
  );
  const provisionalTriples = pipe(
    [
      ...A.flatMap(proposal.steps, (step, index) => {
        const stepSubject = `${proposalNode}-step-${step.stepIndex}`;
        return [
          `${proposalNode} ciops-prov:hasStep ${stepSubject} .`,
          `${stepSubject} ciops-prov:hasScopeTag ${turtleLiteral(step.scope)}^^xsd:string .`,
          `${stepSubject} ciops-prov:schedulesSeatRequest ${proposalNode}-request-${index} .`,
          `${stepSubject} ciops-prov:stepIndex "${step.stepIndex}"^^xsd:integer .`,
          `${stepSubject} rdf:type ciops-prov:ScheduleStep .`,
        ];
      }),
      ...A.map(
        requests,
        (request, index) =>
          `${proposalNode}-request-${index} ciops-prov:scheduledUnitRef ${turtleLiteral(request.nonce)}^^xsd:string .`
      ),
      ...A.map(
        proposal.deferredTail,
        (_request, index) =>
          `${proposalNode} ciops-prov:defersSeatRequest ${proposalNode}-request-${A.length(admittedRequests) + index} .`
      ),
      `${episodeNode} rdf:type ciops-prov:VerificationEpisode .`,
      `${episodeNode} ciops-prov:hasCurrentProposal ${proposalNode} .`,
      `${proposalNode} ciops-prov:hasProjectionSpecification ${specificationNode} .`,
      `${specificationNode} rdf:type ciops-prov:AdmissionProjectionSpecification .`,
      `${specificationNode} ciops-prov:policyDigest ${turtleLiteral(proposal.policyDigest)}^^xsd:string .`,
      `${specificationNode} ciops-prov:journalPrefixDigest ${turtleLiteral(proposal.journalPrefixDigest)}^^xsd:string .`,
    ],
    A.sort(Order.String)
  );
  const content = A.join(
    [
      A.join(prefixes, "\n"),
      A.join(ratifiedTriples, "\n"),
      A.join(A.prepend(provisionalTriples, provisionalHeader), "\n"),
    ],
    "\n\n"
  );
  return TurtleDocument.make({ content: `${content}\n` });
};

/**
 * Emits one byte-deterministic RDF document for a schedule proposal.
 *
 * **Details**
 *
 * The output is valid Turtle. Ratified node classes and properties use
 * `ciops:`; provisional episode, specification, step, and ordering facts follow
 * under the S6-census provisional comment header, prefix-separated as
 * `ciops-prov:`. Every proposal mints a distinct node id from its
 * `proposalId`. The caller's `episodeId` anchors `hasCurrentProposal`;
 * consumers replace the current document when that episode's proposal changes.
 * The specification identity encodes version, policy digest, journal-prefix
 * digest, and admission scope as an injective tuple. Each section is sorted
 * lexically for byte determinism, including empty and fully deferred proposals.
 *
 * **Example** (Emit an empty proposal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { emitScheduleAbox } from "@/projection/Turtle"
 * import { ScheduleProposal } from "@/projection/Schemas"
 * import { Effect } from "effect"
 *
 * const proposal = ScheduleProposal.make({
 *   episodeId: "verification-1",
 *   proposalId: "schedule-policy-prefix-1000",
 *   projectionInstantMillis: S.Natural.make(1000),
 *   steps: [],
 *   deferredTail: [],
 *   policyDigest: "policy",
 *   journalPrefixDigest: "prefix"
 * })
 * const document = Effect.runSync(emitScheduleAbox(proposal))
 * console.log(document.content.includes("ciops:ScheduleProposal")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const emitScheduleAbox = Effect.fn("CiOpsProjection.emitAbox")((proposal: ScheduleProposal) =>
  Effect.succeed(serializeProposal(proposal))
);

const laneStepTriples =
  (planNode: string) =>
  (step: LaneStep): ReadonlyArray<string> => {
    const subject = `${planNode}-lane-${step.laneStepIndex}`;
    return [
      `${planNode} ciops-prov:hasLaneStep ${subject} .`,
      `${subject} ciops-prov:laneIdRef ${turtleLiteral(step.laneId)}^^xsd:string .`,
      `${subject} ciops-prov:laneStepIndex "${step.laneStepIndex}"^^xsd:integer .`,
      `${subject} rdf:type ciops-prov:LaneStep .`,
    ];
  };

// precedesLaneStep is derived from laneStepIndex (i -> i+1): a second encoding of one order, not evidence.
const lanePrecedenceTriples = (planNode: string, plan: LanePlanProposal): ReadonlyArray<string> =>
  A.map(
    A.drop(plan.laneSteps, 1),
    (step) =>
      `${planNode}-lane-${step.laneStepIndex - 1} ciops-prov:precedesLaneStep ${planNode}-lane-${step.laneStepIndex} .`
  );

const serializeLanePlan = (plan: LanePlanProposal): TurtleDocument => {
  const planNode = `ciops-prov:${pnLocalSlug(plan.planId)}`;
  const episodeNode = `ciops-prov:episode-${pnLocalSlug(plan.episodeId)}`;
  const specificationNode = `ciops-prov:specification-${A.join(
    A.map([lanePlanContractVersion, plan.handoffSha256, plan.orderRule, plan.scope], pnLocalSlug),
    "-"
  )}`;
  const provisionalTriples = pipe(
    [
      ...A.flatMap(plan.laneSteps, laneStepTriples(planNode)),
      ...lanePrecedenceTriples(planNode, plan),
      `${episodeNode} rdf:type ciops-prov:VerificationEpisode .`,
      `${episodeNode} ciops-prov:hasLanePlan ${planNode} .`,
      `${planNode} rdf:type ciops-prov:LanePlan .`,
      `${planNode} ciops-prov:hasLanePlanSpecification ${specificationNode} .`,
      `${specificationNode} rdf:type ciops-prov:LanePlanSpecification .`,
      `${specificationNode} ciops-prov:handoffDigest ${turtleLiteral(plan.handoffSha256)}^^xsd:string .`,
      `${specificationNode} ciops-prov:laneOrderRule ${turtleLiteral(plan.orderRule)}^^xsd:string .`,
    ],
    A.sort(Order.String)
  );
  const content = A.join(
    [A.join(prefixes, "\n"), A.join(A.prepend(provisionalTriples, provisionalHeader), "\n")],
    "\n\n"
  );
  return TurtleDocument.make({ content: `${content}\n` });
};

/**
 * Emits one byte-deterministic RDF document for a lane plan.
 *
 * **Details**
 *
 * Every lane-plan term is provisional `ciops-prov:` instrumentation (contract
 * §8.3): the plan, its steps, the episode-to-plan, plan-to-step and
 * plan-to-specification edges, `laneStepIndex`, `laneIdRef`, the derived
 * consecutive-step `precedesLaneStep` edges, and the specification's
 * `handoffDigest` and `laneOrderRule`. No ratified term applies, so the
 * document carries the prefix block and the sorted provisional section only.
 * The specification IRI encodes the tuple `(s7-lane-plan/v1, handoffSha256,
 * orderRule, scope)`; the scope is never emitted as a scope term.
 *
 * **Gotchas**
 *
 * The episode node is typed `ciops-prov:VerificationEpisode` as in the
 * admission emission, so a lane plan must use an episode id distinct from
 * every admission episode id.
 *
 * **Example** (Emit an empty lane plan)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { emitLanePlan } from "@/projection/Turtle"
 * import { LanePlanProposal } from "@/projection/Schemas"
 * import { Effect } from "effect"
 *
 * const handoffSha256 = Sha256Hex.make("705f3e754a51c6750529ccec1021293c82fce0994709a18906b863609a0a2198")
 * const plan = LanePlanProposal.make({
 *   episodeId: "lane-plan-episode-1",
 *   planId: `lane-plan-${handoffSha256}`,
 *   handoffPath: "goals/time-to-certainty/research/gate-order-handoff.json",
 *   handoffSha256,
 *   orderRule: "gate-order-lexicographic/v1",
 *   scope: "pre-push:non-main",
 *   laneSteps: []
 * })
 * const document = Effect.runSync(emitLanePlan(plan))
 * console.log(document.content.includes("ciops-prov:LanePlan")) // true
 * ```
 *
 * @category serialization
 * @since 0.0.0
 */
export const emitLanePlan = Effect.fn("CiOpsProjection.emitLanePlan")((plan: LanePlanProposal) =>
  Effect.succeed(serializeLanePlan(plan))
);
