import {
  correlativePosition,
  HohfeldPosition,
  HohfeldPositionKind,
  LegalActContent,
  LegalActPolarity,
  oppositePosition,
} from "@beep/law-practice-domain";
import { assert, describe, it } from "@effect/vitest";
import * as S from "effect/Schema";

const equivalent = S.toEquivalence(HohfeldPosition);

describe("Hohfeld position derivation laws", () => {
  it("preserves the act across counterparties and negates it only for the same-party opposite", () => {
    for (const kind of HohfeldPositionKind.literals)
      for (const polarity of LegalActPolarity.literals) {
        const position = HohfeldPosition.make({
          kind,
          content: LegalActContent.make({ description: "enter the land", polarity }),
        });
        const correlative = correlativePosition(position);
        const opposite = oppositePosition(position);
        assert.notStrictEqual(correlative.kind, kind);
        assert.deepStrictEqual(correlative.content, position.content);
        assert.notStrictEqual(opposite.kind, kind);
        assert.strictEqual(opposite.content.description, position.content.description);
        assert.notStrictEqual(opposite.content.polarity, polarity);
        assert.isTrue(equivalent(correlativePosition(correlative), position));
        assert.isTrue(equivalent(oppositePosition(opposite), position));
        assert.isTrue(equivalent(correlativePosition(opposite), oppositePosition(correlative)));
      }
  });
  it("reads an enforceable claim as the counterparty's duty and its opposite as no right", () => {
    const claim = HohfeldPosition.make({
      kind: "claim",
      content: LegalActContent.make({ description: "pay the debt", polarity: "act" }),
    });
    assert.strictEqual(correlativePosition(claim).kind, "duty");
    assert.strictEqual(oppositePosition(claim).kind, "noRight");
  });
});
