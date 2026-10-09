import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { InvalidNodeIdError, NodeRef } from "../../effected/schema-org/NodeRef.ts";

it.effect("checked references preserve valid ids and expose typed invalid ids", () => Effect.gen(function* () {
  const ref = yield* NodeRef.toChecked("_:author");
  assert.deepStrictEqual(ref, NodeRef.to({ "@id": "_:author" }));
  const failed = yield* Effect.result(NodeRef.toChecked("bad id"));
  assertFailure(failed, InvalidNodeIdError.make({ input: "bad id" }));
  assert.strictEqual(InvalidNodeIdError.make({ input: "bad id" }).message, 'Invalid JSON-LD node id: "bad id"');
}));
