import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { TYPE_NAMES, PROPERTY_NAMES } from "../../effected/schema-org/internal/vocabulary.ts";
import { Vocabulary } from "../../effected/schema-org/Vocabulary.ts";

const runs = { arbitrary: fcRuns(100) };
const TypeIndex = S.Int.check(S.isBetween({ minimum: 0, maximum: TYPE_NAMES.length - 1 }));
const PropertyIndex = S.Int.check(S.isBetween({ minimum: 0, maximum: PROPERTY_NAMES.length - 1 }));

it.effect.prop(
  "ordered queries, set queries and legality agree for vocabulary terms before and after memoization",
  [Arbitrary.schema(TypeIndex), Arbitrary.schema(PropertyIndex)],
  ([typeIndex, propertyIndex]) => Effect.gen(function* () {
    const type = yield* Effect.fromOption(A.get(TYPE_NAMES, typeIndex));
    const property = yield* Effect.fromOption(A.get(PROPERTY_NAMES, propertyIndex));
    assert.strictEqual(Vocabulary.hasType(type), true);
    assert.strictEqual(Vocabulary.hasProperty(property), true);
    const ancestors = Vocabulary.ancestorsInOrder(type);
    const properties = Vocabulary.propertiesInOrder(type);
    assert.deepStrictEqual(Vocabulary.ancestorsInOrder(type), ancestors);
    assert.deepStrictEqual(Vocabulary.propertiesInOrder(type), properties);
    assert.strictEqual(HashSet.size(Vocabulary.ancestorsOf(type)), ancestors.length);
    assert.strictEqual(HashSet.size(Vocabulary.propertiesOf(type)), properties.length);
    assert.strictEqual(HashSet.has(Vocabulary.ancestorsOf(type), type), false);
    assert.strictEqual(Vocabulary.isPropertyOn(property, type), A.contains(properties, property));
    assert.strictEqual(Vocabulary.isPropertyOn(property, type), HashSet.has(Vocabulary.propertiesOf(type), property));
    for (const ancestor of ancestors) {
      for (const inherited of Vocabulary.propertiesInOrder(ancestor)) {
        assert.strictEqual(Vocabulary.isPropertyOn(inherited, type), true);
      }
    }
  }),
  runs,
);
