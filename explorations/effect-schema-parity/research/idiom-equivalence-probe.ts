import * as S from "../../../.repos/effect/packages/effect/src/Schema.ts";

class LaneError extends S.TaggedError<LaneError>()("LaneError", { code: S.String }) {}
const a = new LaneError({ code: "same" });
const b = new LaneError({ code: "same" });
a.stack = "first-stack";
b.stack = "second-stack";
const result = {
  fieldsOnlyEqual: S.toEquivalence(LaneError)(a, b),
  differentFieldsEqual: S.toEquivalence(LaneError)(a, new LaneError({ code: "other" })),
};
console.log(JSON.stringify(result));
if (!result.fieldsOnlyEqual || result.differentFieldsEqual) throw new Error("Equivalence probe failed");
