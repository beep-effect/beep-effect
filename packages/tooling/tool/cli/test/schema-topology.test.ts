import { collectSchemaTopologyViolations } from "@beep/repo-cli/test/Lint";
import { NodeServices } from "@effect/platform-node";
import { layer } from "@effect/vitest";
import { Effect } from "effect";
import { expect } from "vitest";

layer(NodeServices.layer)("schema topology lint", (it) => {
  it.effect(
    "keeps @beep/schema on the canonical topology",
    Effect.fn("SchemaTopologyTest.keepsCanonicalTopology")(function* () {
      const violations = yield* collectSchemaTopologyViolations();
      expect(violations).toEqual([]);
    })
  );
});
