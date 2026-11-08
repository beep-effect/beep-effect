import { optionalDefect } from "@beep/schema/SchemaUtils/optionalDefect";
import { assert, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const Failure = S.Struct({ code: S.String, cause: optionalDefect("Underlying transport failure.") });

it("retains the exact supplied diagnostic object", () => {
  const original = new Error("first transport");
  const failure = Failure.make({ code: "unavailable", cause: O.some(original) });
  assert.strictEqual(O.getOrThrow(failure.cause), original);
});
