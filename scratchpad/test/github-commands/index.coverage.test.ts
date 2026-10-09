import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CommandNeutralizer } from "../../effected/github-commands/CommandNeutralizer.ts";
import * as Entry from "../../effected/github-commands/index.ts";
import { AnnotationProperties, WorkflowCommand } from "../../effected/github-commands/WorkflowCommand.ts";

describe("github-commands entrypoint", () => {
  it.effect("exports the same schema and utilities as their defining modules", () =>
    Effect.sync(() => {
      assert.strictEqual(Entry.AnnotationProperties, AnnotationProperties);
      assert.strictEqual(Entry.WorkflowCommand, WorkflowCommand);
      assert.strictEqual(Entry.CommandNeutralizer, CommandNeutralizer);
      assert.strictEqual(Entry.WorkflowCommand.debug("trace"), "::debug::trace");
      assert.strictEqual(Entry.CommandNeutralizer.text("::debug::trace"), "\u200b::debug::trace");
    })
  );
});
