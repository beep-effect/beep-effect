import { WizardDropped } from "@beep/cli-kit/internal/wizardGate";
import { assert, it } from "@effect/vitest";
import * as CliConfig from "effect/cli/CliConfig";
import * as Effect from "effect/Effect";

it.effect("wizard dropped reference defaults to absence and retains the provided config identity", () =>
  Effect.gen(function* () {
    const WizardDropped1 = yield* WizardDropped;
    assert.strictEqual(WizardDropped1, undefined);
    const config = CliConfig.make({});
    const pipe2 = yield* WizardDropped.pipe(Effect.provideService(WizardDropped, config));
    assert.strictEqual(pipe2, config);
    const WizardDropped3 = yield* WizardDropped;
    assert.strictEqual(WizardDropped3, undefined);
  })
);
