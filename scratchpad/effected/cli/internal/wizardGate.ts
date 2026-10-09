import { Context } from "effect";
import type { CliConfig } from "effect/cli";

/** The shape of the ambient config, as `CliConfig.make` returns it. */
type Config = ReturnType<typeof CliConfig.make>;

/**
 * The exact `CliConfig` object `CliPrompt.gateWizard` produced when it removed `--wizard`, or `undefined` when it
 * removed nothing.
 *
 * @remarks
 * It is how a later decision can put the flag back without inventing it: the restore happens only when the CURRENT
 * config is this very object. A consumer who left `Wizard` out of their own `builtIns` never has it set, and one who
 * provides their own `CliConfig` inside the gate has a different object, so neither gets a wizard they did not ask for.
 *
 * @internal
 */
export class WizardDropped extends Context.Reference<Config | undefined>("@effected/cli/WizardDropped", {
	defaultValue: () => undefined,
}) {}
