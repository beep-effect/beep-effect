/**
 * Live wiring proofs. Building these layer values touches no service: nothing
 * connects until a layer is launched, so this only proves the wiring composes
 * from a configuration.
 */
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as O from "effect/Option";
import { DocketIntakeAppConfig } from "@/Config";
import { main } from "@/Main";
import { liveWiring } from "@/runtime/Layer";
import { fixtureConfig } from "./support/Config.ts";

describe("@beep/docket-intake live wiring", () => {
  it("composes the pipeline, dry-run and mailbox layers from a configuration", () => {
    const options = { config: fixtureConfig, initialSince: "2030-01-01T06:00:00.000Z" };
    const intake = liveWiring.intake(options);
    const dryRun = liveWiring.dryRun({ ...options, directory: "/fixture/state/docket-intake/dry-run" });
    const mailbox = liveWiring.mailbox(fixtureConfig);
    expect([Layer.isLayer(intake), Layer.isLayer(dryRun), Layer.isLayer(mailbox)]).toStrictEqual([true, true, true]);
  });
  it("composes the pipeline over a practice-KG bundle and a docket sheet export when both are configured", () => {
    const config = DocketIntakeAppConfig.make({
      ...fixtureConfig,
      docketSheetCsv: O.some("/fixture/docket-sheet.csv"),
      kgBundleDirectory: O.some("/fixture/practice-kg-bundle"),
    });
    expect(Layer.isLayer(liveWiring.intake({ config, initialSince: "2030-01-01T06:00:00.000Z" }))).toBe(true);
  });
  it("exposes the command line as one program", () => {
    expect(Effect.isEffect(main)).toBe(true);
  });
});
