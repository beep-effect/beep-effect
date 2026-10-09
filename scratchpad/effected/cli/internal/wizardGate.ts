import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { CliConfig } from "effect/cli";

const $I = $ScratchpadId.create("effected/cli/internal/wizardGate");

/** The shape of the ambient config, as `CliConfig.make` returns it. */
type Config = ReturnType<typeof CliConfig.make>;

/**
 * The exact `CliConfig` object `CliPrompt.gateWizard` produced when it removed `--wizard`, or `undefined` when it
 * removed nothing.
 *
 * **Details**
 *
 * It is how a later decision can put the flag back without inventing it: the restore happens only when the CURRENT
 * config is this very object. A consumer who left `Wizard` out of their own `builtIns` never has it set, and one who
 * provides their own `CliConfig` inside the gate has a different object, so neither gets a wizard they did not ask for.
 *
 * **Example** (Read the absence of a dropped wizard config)
 *
 * ```ts
 * import { WizardDropped } from "@beep/scratchpad/effected/cli/internal/wizardGate"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(WizardDropped)) // undefined
 * ```
 *
 * @internal
 * @category services
 * @since 0.0.0
 */
export class WizardDropped extends Context.Reference<Config | undefined>($I`WizardDropped`, {
	defaultValue: () => undefined,
}) {}
