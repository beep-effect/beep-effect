import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeEntityRuleSet, makeMentionRuleSet, makeRelationRuleSet, RuleSet } from "../../Prompt/RuleSet.ts";

const summarizeStage: (ruleSet: RuleSet) => string = RuleSet.match({
  mention: () => "mention rules",
  entity: () => "entity rules",
  relation: () => "relation rules",
});

describe("RuleSet", () => {
  it.effect(
    "constructs, guards, matches, and decodes every extraction stage",
    Effect.fnUntraced(function* () {
      const mention = makeMentionRuleSet();
      const entity = makeEntityRuleSet([], []);
      const relation = makeRelationRuleSet([], []);

      expect(RuleSet.guards.mention(mention)).toBe(true);
      expect(RuleSet.guards.entity(entity)).toBe(true);
      expect(RuleSet.guards.relation(relation)).toBe(true);
      expect(summarizeStage(mention)).toBe("mention rules");
      expect(summarizeStage(entity)).toBe("entity rules");
      expect(summarizeStage(relation)).toBe("relation rules");

      const encoded = yield* S.encodeEffect(RuleSet)(relation);
      const decoded = yield* S.decodeEffect(RuleSet)(encoded);

      expect(RuleSet.guards.relation(decoded)).toBe(true);
      expect(decoded.allRules).toEqual(relation.allRules);
      expect(decoded.getRulesByCategory("reference_integrity")).toEqual(
        relation.getRulesByCategory("reference_integrity")
      );
    })
  );
});
