import { AudienceFlagConflict, projectionFor, selectAudience } from "@beep/repo-gate-run/GateAudience";
import { Audience } from "@beep/runtime-env/Audience";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

const none = { audience: [], human: [], agent: [], ci: [] };

describe("audience selection", () => {
  it("an agent and CI get the agent projection, a person the terminal projection", () => {
    assert.strictEqual(projectionFor("agent"), "agent");
    assert.strictEqual(projectionFor("ci"), "agent");
    assert.strictEqual(projectionFor("human"), "terminal");
  });

  it.layer(Audience.layerTest("agent"), { timeout: "30 seconds" })("under a detected agent", (it) => {
    it.effect("keeps the detected audience without a flag", () =>
      Effect.gen(function* () {
        const selected = yield* selectAudience(none);
        assert.strictEqual(selected, "agent");
      })
    );

    it.effect("lets one flag override detection, a false flag counting for nothing", () =>
      Effect.gen(function* () {
        const human = yield* selectAudience({ ...none, human: [true], ci: [false] });
        const ci = yield* selectAudience({ ...none, audience: ["ci"] });
        assert.strictEqual(human, "human");
        assert.strictEqual(ci, "ci");
      })
    );

    it.effect("refuses two audience flags, repeats included", () =>
      Effect.gen(function* () {
        const repeated = yield* Effect.flip(selectAudience({ ...none, agent: [true, true] }));
        const mixed = yield* Effect.flip(selectAudience({ ...none, audience: ["human"], ci: [true] }));
        assert.instanceOf(repeated, AudienceFlagConflict);
        assert.deepStrictEqual(mixed.given, ["human", "ci"]);
      })
    );
  });
});
