/**
 * Canonical schedule-as-A-Box serialization for the S7 projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { TurtleDocument } from "./Schemas.ts";
import type { PendingRequest, ScheduleProposal } from "./Schemas.ts";

const prefixes = [
  "@prefix ciops: <https://oip.law/ontology/ci-ops#> .",
  "@prefix ciops-prov: <https://oip.law/ontology/ci-ops-prov#> .",
  "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
  "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
];

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
  const admittedRequests = A.map(proposal.steps, (step) => step.request);
  const requests = A.appendAll(admittedRequests, proposal.deferredTail);
  const ratifiedTriples = pipe(
    A.append(A.flatMap(requests, requestTriples(proposalNode)), `${proposalNode} rdf:type ciops:ScheduleProposal .`),
    A.sort(Order.String)
  );
  const provisionalTriples = pipe(
    A.append(
      A.flatMap(proposal.steps, (step, index) => {
        const stepSubject = `${proposalNode}-step-${step.stepIndex}`;
        return [
          `${proposalNode} ciops-prov:hasStep ${stepSubject} .`,
          `${stepSubject} ciops-prov:hasScope ${turtleLiteral(step.scope)} .`,
          `${stepSubject} ciops-prov:schedulesSeatRequest ${proposalNode}-request-${index} .`,
          `${stepSubject} ciops-prov:stepIndex "${step.stepIndex}"^^xsd:integer .`,
          `${stepSubject} rdf:type ciops-prov:ScheduleStep .`,
        ];
      }),
      `ciops-prov:scheduler ciops-prov:hasCurrentProposal ${proposalNode} .`
    ),
    A.sort(Order.String)
  );
  const content = A.join(
    [
      A.join(prefixes, "\n"),
      A.join(ratifiedTriples, "\n"),
      A.join(
        A.prepend(
          provisionalTriples,
          "# PROVISIONAL GRAPH — closure OPEN; excluded from negation and ratified typing."
        ),
        "\n"
      ),
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
 * `ciops:`; the provisional `ScheduleStep` class and ordering edges follow
 * under the S6-census provisional comment header, prefix-separated as
 * `ciops-prov:`. Every proposal mints a distinct node id from its
 * `proposalId`, so `hasCurrentProposal` genuinely re-points across loads,
 * and each section is lexically sorted for byte determinism.
 *
 * **Example** (Emit an empty proposal)
 *
 * ```ts
 * import { emitScheduleAbox } from "@/projection/Turtle"
 * import { ScheduleProposal } from "@/projection/Schemas"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const proposal = ScheduleProposal.make({
 *   proposalId: "schedule-policy-prefix-1000",
 *   projectionInstantMillis: NonNegativeInt.make(1000),
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
