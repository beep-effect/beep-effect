import { UnitInterval } from "@beep/schema/UnitInterval";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { ExpandedTerm, expandQueryWithOntology, QueryExpansionOptions } from "../../Utils/Retrieval.ts";

const summarizeSource: (term: ExpandedTerm) => string = ExpandedTerm.match({
  original: () => "query",
  altLabel: () => "synonym",
  broader: () => "generalization",
  narrower: () => "specialization",
  related: () => "association",
});

describe("Retrieval", () => {
  it.effect(
    "owns query-expansion defaults and bounded weights in the schema",
    Effect.fnUntraced(function* () {
      const policy = QueryExpansionOptions.make({});

      assert.isTrue(policy.includeAltLabels);
      assert.isFalse(policy.includeBroader);
      assert.isFalse(policy.includeNarrower);
      assert.strictEqual(policy.originalWeight, UnitInterval.make(1));
      assert.strictEqual(policy.synonymWeight, UnitInterval.make(0.8));
      assert.strictEqual(policy.hierarchyWeight, UnitInterval.make(0.5));

      const error = yield* S.decodeEffect(QueryExpansionOptions)({ synonymWeight: 1.1 }).pipe(Effect.flip);
      assert.include(error.message, "1");
    })
  );

  it.effect(
    "constructs and matches every expanded-term source exhaustively",
    Effect.fnUntraced(function* () {
      const terms: ReadonlyArray<ExpandedTerm> = [
        ExpandedTerm.cases.original.make({ term: "player", weight: UnitInterval.make(1) }),
        ExpandedTerm.cases.altLabel.make({ term: "athlete", weight: UnitInterval.make(0.8) }),
        ExpandedTerm.cases.broader.make({ term: "person", weight: UnitInterval.make(0.5) }),
        ExpandedTerm.cases.narrower.make({ term: "goalkeeper", weight: UnitInterval.make(0.5) }),
        ExpandedTerm.cases.related.make({ term: "team", weight: UnitInterval.make(0.5) }),
      ];

      yield* Effect.sync(() => {
        assert.deepStrictEqual(A.map(terms, summarizeSource), [
          "query",
          "synonym",
          "generalization",
          "specialization",
          "association",
        ]);
        assert.isTrue(A.some(terms, ExpandedTerm.guards.altLabel));
      });
    })
  );

  it.effect(
    "constructs expansion results through tagged-union cases",
    Effect.fnUntraced(function* () {
      const terms = expandQueryWithOntology(
        "player",
        {
          classes: HashMap.make(
            [
              "player",
              {
                label: "Player",
                altLabels: ["Athlete"],
                broader: ["Person"],
                narrower: ["Goalkeeper"],
              },
            ],
            ["unlabeled", { altLabels: ["Must not match"] }]
          ),
          properties: HashMap.empty(),
        },
        { includeBroader: true, includeNarrower: true }
      );

      yield* Effect.sync(() => {
        assert.deepStrictEqual(
          A.map(terms, (term) => term.source),
          ["original", "altLabel", "broader", "narrower"]
        );
        assert.isTrue(A.every(terms, S.is(ExpandedTerm)));
      });
    })
  );
});
