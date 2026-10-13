import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { SchemaIssueRenderer } from "../../effected/cli/SchemaIssueRenderer.ts";

it.effect("SchemaIssueRenderer retains its runtime class identity", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(SchemaIssueRenderer, []);
  assert.isTrue(instance instanceof SchemaIssueRenderer);
}));
