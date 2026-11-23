import {
  LegalRole,
  legalPositionRelatorTerm,
  legalPositionRelatorTyping,
  partyTerm,
  positionBearerTerm,
  positionCounterpartyTerm,
} from "@beep/law-practice-domain";
import {
  LegalPositionRelatorPolicy,
  LegalPositionRelatorPolicyLive,
} from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy";
import { audit } from "@beep/ontology/Gufo";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const decodeLegalRoleOption = S.decodeUnknownOption(LegalRole);

const roleFieldTerms = { bearer: positionBearerTerm, counterparty: positionCounterpartyTerm };

const scope = {
  material: ["the demised premises"],
  quantitative: ["unlimited"],
  subjective: ["the lessor"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA"],
};

const role = (name: string, player: number) => ({
  admittedPlayerKinds: ["natural-person", "juristic-person"],
  name,
  player,
  sourceNorm: { designation: "cl. 4.1" },
});

const storedRelation = {
  ...productEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, 1),
  assertingInterpreter: { kind: "User", userId: 1 },
  bearer: role("lessee", 1),
  content: { description: "enter the land", polarity: "act" },
  counterparty: role("lessor", 2),
  grounding: { foundingExercise: null, producingExercise: 1 },
  positionKind: "privilege",
  scope,
  sourceNorm: { designation: "cl. 4.1" },
};

describe("legal position relator gUFO typing", () => {
  it("audits the relator, its two roles and the party category with no violation", () => {
    const terms = [legalPositionRelatorTerm, positionBearerTerm, positionCounterpartyTerm, partyTerm];
    expect(A.map(terms, (term) => [term, audit(legalPositionRelatorTyping)(term)])).toEqual(
      A.map(terms, (term) => [term, []])
    );
    expect(HashMap.size(legalPositionRelatorTyping.typing)).toBe(4);
  });
});

it.layer(LegalPositionRelatorPolicyLive)("legal position relator policy fields", (it) => {
  it.effect(
    "binds the policy's bearer and counterparty fields to the terms the relator mediates",
    Effect.fnUntraced(function* () {
      const policy = yield* LegalPositionRelatorPolicy;
      const stored = yield* policy.admit(storedRelation);
      const relator = HashMap.get(legalPositionRelatorTyping.typing, legalPositionRelatorTerm);
      const mediated = O.map(relator, (typing) =>
        typing.mediates.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String))
      );
      expect(mediated).toEqual(O.some(A.sort(R.values(roleFieldTerms), Order.String)));
      expect(O.map(relator, (typing) => typing.mediates.pipe(HashMap.values, A.fromIterable))).toEqual(O.some([1, 1]));
      const roleFields = A.sort(
        A.filterMap(R.toEntries(storedRelation), ([field, value]) =>
          O.isSome(decodeLegalRoleOption(value)) ? Result.succeed(field) : Result.failVoid
        ),
        Order.String
      );
      expect(roleFields).toEqual(R.keys(roleFieldTerms));
      const correlative = policy.correlativeView(stored);
      expect([correlative.bearer, correlative.counterparty]).toEqual([stored.counterparty, stored.bearer]);
    })
  );
});
