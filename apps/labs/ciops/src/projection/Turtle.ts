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

const requestTriples = (request: PendingRequest, index: number): ReadonlyArray<string> => {
  const subject = `ciops-prov:request-${index}`;
  return [
    `${subject} ciops:admissionChargeTokens "${request.weightTokens}"^^xsd:integer .`,
    `${subject} ciops:hasOriginKey ${turtleLiteral(request.originKey)} .`,
    `${subject} rdf:type ciops:SeatRequest .`,
    `${subject} rdf:type ciops:WorkUnitSpecification .`,
  ];
};

const serializeProposal = (proposal: ScheduleProposal): TurtleDocument => {
  const admittedRequests = A.map(proposal.steps, (step) => step.request);
  const requests = A.appendAll(admittedRequests, proposal.deferredTail);
  const defaultTriples = pipe(
    A.append(A.flatMap(requests, requestTriples), "ciops-prov:proposal rdf:type ciops:ScheduleProposal ."),
    A.sort(Order.String)
  );
  const provisionalTriples = pipe(
    A.append(
      A.flatMap(proposal.steps, (step, index) => {
        const stepSubject = `ciops-prov:step-${step.stepIndex}`;
        return [
          `ciops-prov:proposal ciops-prov:hasStep ${stepSubject} .`,
          `${stepSubject} ciops-prov:hasScope ${turtleLiteral(step.scope)} .`,
          `${stepSubject} ciops-prov:schedulesWorkUnit ciops-prov:request-${index} .`,
          `${stepSubject} ciops-prov:stepIndex "${step.stepIndex}"^^xsd:integer .`,
          `${stepSubject} rdf:type ciops-prov:ScheduleStep .`,
        ];
      }),
      "ciops-prov:scheduler ciops-prov:hasCurrentProposal ciops-prov:proposal ."
    ),
    A.sort(Order.String),
    A.map((triple) => `  ${triple}`)
  );
  const content = A.join(
    [
      A.join(prefixes, "\n"),
      A.join(defaultTriples, "\n"),
      `ciops-prov:ordering {\n${A.join(provisionalTriples, "\n")}\n}`,
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
 * Ratified node classes and properties use `ciops:`. The provisional
 * `ScheduleStep` class and ordering edges live only inside the
 * `ciops-prov:ordering` named graph, whose triples are lexically sorted.
 *
 * **Example** (Emit an empty proposal)
 *
 * ```ts
 * import { emitScheduleAbox } from "@beep/ciops/projection/Turtle"
 * import { ScheduleProposal } from "@beep/ciops/projection/Schemas"
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
