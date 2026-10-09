import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { WorkflowCommand } from "../../effected/github-commands/WorkflowCommand.ts";

describe("WorkflowCommand runtime construction", () => {
  it.effect("reflective construction creates a stateless instance and preserves static escaping", () =>
    Effect.sync(() => {
      const instance = Reflect.construct(WorkflowCommand, []);
      assert.strictEqual(Object.getPrototypeOf(instance), WorkflowCommand.prototype);
      assert.deepStrictEqual(Object.keys(instance), []);
      assert.strictEqual(WorkflowCommand.notice("50%\nready", { title: "API: v1,v2" }), "::notice title=API%3A v1%2Cv2::50%25%0Aready");
    })
  );
});
