import * as ClaimEvidenceReview from "@beep/epistemic-domain/values/ClaimEvidenceReview";
import * as ClaimProjection from "@beep/epistemic-domain/values/ClaimProjection";
import * as Contradiction from "@beep/epistemic-domain/values/Contradiction";
import * as ContradictionDetection from "@beep/epistemic-domain/values/ContradictionDetection";
import * as EdgeEndpoint from "@beep/epistemic-domain/values/EdgeEndpoint";
import * as EvidenceVerification from "@beep/epistemic-domain/values/EvidenceVerification";
import * as LogicalEdgeIdentity from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { it } from "@beep/test-runner";
import { P, R } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const modules: R.ReadonlyRecord<string, R.ReadonlyRecord<string, unknown>> = {
  ClaimEvidenceReview,
  ClaimProjection,
  Contradiction,
  ContradictionDetection,
  EdgeEndpoint,
  EvidenceVerification,
  LogicalEdgeIdentity,
};

const identifiersIn = (root: unknown): ReadonlyArray<string> => {
  const visited: Array<object> = [];
  const found: Array<string> = [];
  const visit = (node: unknown): void => {
    if (A.isArray(node)) {
      A.forEach(node, visit);
      return;
    }
    if (!P.isObject(node) || A.some(visited, (seen) => seen === node)) {
      return;
    }
    visited.push(node);
    if (P.hasProperty(node, "identifier") && P.isString(node.identifier)) {
      found.push(node.identifier);
    }
    A.forEach(R.values(node), visit);
  };
  visit(root);
  return A.dedupe(found);
};

const listing = pipe(
  R.toEntries(modules),
  A.flatMap(([moduleName, exports]) =>
    pipe(
      R.toEntries(exports),
      A.filter(([, value]) => S.isSchema(value)),
      A.flatMap(([exportName, value]) =>
        A.map(identifiersIn(S.isSchema(value) ? value.ast : value), (id) => `${moduleName}.${exportName}\t${id}`)
      )
    )
  ),
  A.sort(Order.String),
  A.join("\n")
);

describe("bound value schema identifiers", () => {
  it.effect(
    "emits the same identifiers as before the factory extraction (only a decided package rename regenerates the fixture)",
    () => Effect.promise(() => expect(`${listing}\n`).toMatchFileSnapshot("./fixtures/value-schema-identifiers.txt"))
  );
});
