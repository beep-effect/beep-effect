import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as CliConfig from "effect/cli/CliConfig";
import { WizardDropped } from "../../../effected/cli/internal/wizardGate.ts";
it.effect("wizard dropped reference defaults to absence and retains the provided config identity", () => Effect.gen(function* () {
  assert.strictEqual(yield* WizardDropped, undefined);
  const config = CliConfig.make({});
  assert.strictEqual(yield* WizardDropped.pipe(Effect.provideService(WizardDropped, config)), config);
  assert.strictEqual(yield* WizardDropped, undefined);
}));
