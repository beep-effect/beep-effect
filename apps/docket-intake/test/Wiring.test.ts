/**
 * Live wiring proofs. Building these layer values touches no service: nothing
 * connects until a layer is launched, so this only proves the wiring composes
 * from a configuration.
 */
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { main } from "@/Main";
import { liveWiring } from "@/runtime/Layer";
import { fixtureConfig } from "./support/Config.ts";

describe("@beep/docket-intake live wiring", () => {
  it("composes the pipeline layer and the mailbox layer from a configuration", () => {
    const intake = liveWiring.intake({ config: fixtureConfig, initialSince: "2030-01-01T06:00:00.000Z" });
    const mailbox = liveWiring.mailbox(fixtureConfig);

    expect([Layer.isLayer(intake), Layer.isLayer(mailbox)]).toStrictEqual([true, true]);
  });

  it("exposes the command line as one program", () => {
    expect(Effect.isEffect(main)).toBe(true);
  });
});
