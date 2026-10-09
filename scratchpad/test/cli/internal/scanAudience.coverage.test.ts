import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { scanAudience } from "../../../effected/cli/internal/scanAudience.ts";
it.effect("missing audience values are rejected without swallowing subsequent flags", () => Effect.sync(() => {
  assert.deepStrictEqual(scanAudience(["--audience", "--agent", "--audience"]), { given: ["agent"], conflict: false });
  assert.deepStrictEqual(scanAudience(["--audience=", "--no-ci", "--ci=invalid", "--", "--human"]), { given: [], conflict: false });
}));
