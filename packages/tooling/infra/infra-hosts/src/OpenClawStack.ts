/**
 * The OpenClaw host stack: the content-addressed generation applicator for
 * the operator workstation's OpenClaw agent.
 *
 * **Details**
 *
 * Replaces the Pulumi program's ordered `command.local.Command` resources with
 * ordered `Command.Exec` resources. The `prod` graph:
 *
 * ```text
 * Exec Preflight ─ Exec Stage ─ Exec Apply ─ Exec Probe ─ Exec BackupShip (when configured)
 * ```
 *
 * Each step's command is the full rendered script, and its memo hashes no
 * files, so a step re-runs exactly when its rendered input changes: a new
 * generation id re-renders Stage, Apply, Probe and BackupShip; a new declared
 * identity re-renders Preflight. Every check reports through its exit status,
 * because `Command.Exec` keeps no stdout. The drift audit, the live acceptance
 * run and the rollback stay operator commands, returned as stack outputs, as
 * they were under Pulumi; `Command.Exec` deletes nothing, so `alchemy destroy`
 * leaves the workstation untouched and the rollback command is the teardown.
 *
 * Every other stage is a rehearsal: it decodes the configuration and renders
 * the generation without declaring a single command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Alchemy from "alchemy";
import * as Command from "alchemy/Command";
import * as Config from "effect/Config";
import { SourceError } from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { loadHostConfigFile } from "./HostConfigFile.ts";
import { HostsStageKind, stageKind, WorkstationOnly } from "./HostsStage.ts";
import {
  makeOpenClawGeneration,
  OpenClawBackupShipScriptInput,
  OpenClawGenerationIdentityScriptInput,
  OpenClawStackArgs,
  renderOpenClawApplyScript,
  renderOpenClawBackupShipScript,
  renderOpenClawDriftAuditScript,
  renderOpenClawLiveAcceptanceScript,
  renderOpenClawPreflightScript,
  renderOpenClawProbeScript,
  renderOpenClawRollbackScript,
  renderOpenClawStageScript,
} from "./OpenClawGeneration.ts";
import type { OpenClawGeneration } from "./OpenClawGeneration.ts";

/**
 * Alchemy stack name of the OpenClaw host stack.
 *
 * **Example** (Read the stack name)
 * ```ts
 * import { openClawStackName } from "@beep/infra-hosts/OpenClawStack"
 *
 * console.log(openClawStackName) // "HostsOpenClaw"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawStackName = "HostsOpenClaw";

/**
 * Environment variable naming the OpenClaw stack's config file, whose body
 * is the encoded {@link OpenClawStackArgs}.
 *
 * **Example** (Read the variable name)
 * ```ts
 * import { openClawConfigEnvKey } from "@beep/infra-hosts/OpenClawStack"
 *
 * console.log(openClawConfigEnvKey) // "BEEP_OPENCLAW_HOST_CONFIG"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawConfigEnvKey = "BEEP_OPENCLAW_HOST_CONFIG";

/**
 * Memo scope for applicator steps: hash no files, so only the rendered
 * command decides whether a step re-runs.
 */
const commandOnlyMemo = { include: [], exclude: ["**"] };

/**
 * The rendered scripts are `/bin/bash --noprofile --norc -p -c '<program>'`
 * invocations; `/bin/sh` only parses that one quoted word and starts bash.
 */
const shell = "/bin/sh";

/**
 * Privileged staging runs `npm install` under `sudo`; give it room.
 */
const stepTimeout = "20 minutes";

const generationFailure = (cause: unknown) =>
  new Config.ConfigError(new SourceError({ message: "Cannot render the OpenClaw generation.", cause }));

const applyGeneration = Effect.fn("OpenClawStack.applyGeneration")(function* (
  args: OpenClawStackArgs,
  generation: OpenClawGeneration
) {
  const identityInput = OpenClawGenerationIdentityScriptInput.make({ generation, identity: args.identity });
  const preflight = yield* Command.Exec("Preflight", {
    command: renderOpenClawPreflightScript(identityInput),
    shell,
    memo: commandOnlyMemo,
  });
  const stage = yield* Command.Exec("Stage", {
    command: renderOpenClawStageScript(generation),
    shell,
    memo: commandOnlyMemo,
    timeout: stepTimeout,
    env: { BEEP_HOSTS_AFTER: preflight.hash.input },
  });
  const apply = yield* Command.Exec("Apply", {
    command: renderOpenClawApplyScript(generation),
    shell,
    memo: commandOnlyMemo,
    timeout: stepTimeout,
    env: { BEEP_HOSTS_AFTER: stage.hash.input },
  });
  const probe = yield* Command.Exec("Probe", {
    command: renderOpenClawProbeScript(identityInput),
    shell,
    memo: commandOnlyMemo,
    timeout: stepTimeout,
    env: { BEEP_HOSTS_AFTER: apply.hash.input },
  });
  yield* O.match(args.backup, {
    onNone: () => Effect.void,
    onSome: (backup) =>
      Command.Exec("BackupShip", {
        command: renderOpenClawBackupShipScript(OpenClawBackupShipScriptInput.make({ backup, generation })),
        shell,
        memo: commandOnlyMemo,
        timeout: stepTimeout,
        // The archive passphrase reaches the script through the deploy
        // process environment `op run` builds; it is never a prop, so it never
        // lands in state.
        env: { BEEP_HOSTS_AFTER: probe.hash.input },
      }),
  });
});

/**
 * The OpenClaw stack program: guard, decode the config file, render the
 * generation and, for `prod`, declare the applicator steps. `prod` refuses to
 * run in CI.
 *
 * **Example** (Compose the stack)
 * ```ts
 * import * as AWS from "@alchemy.run/aws"
 * import { openClawStackName, openClawStackProgram } from "@beep/infra-hosts/OpenClawStack"
 * import * as Alchemy from "alchemy"
 * import * as Command from "alchemy/Command"
 *
 * const stack = Alchemy.Stack(
 *   openClawStackName,
 *   { providers: Command.providers(), state: AWS.state({ backend: "s3" }) },
 *   openClawStackProgram
 * )
 * console.log(stack.stackName) // "HostsOpenClaw"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const openClawStackProgram = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  const kind = stageKind(stack.stage);
  if (kind === HostsStageKind.Enum.prod) {
    yield* WorkstationOnly;
  }
  const args = yield* loadHostConfigFile(OpenClawStackArgs, openClawConfigEnvKey);
  const generation = yield* makeOpenClawGeneration(args).pipe(Effect.mapError(generationFailure));
  yield* HostsStageKind.match(kind, {
    prod: () => applyGeneration(args, generation),
    rehearsal: () => Effect.void,
  });
  const identityInput = OpenClawGenerationIdentityScriptInput.make({ generation, identity: args.identity });
  return {
    stage: kind,
    generationId: generation.generationId,
    generationDir: `${generation.configRoot}/${generation.generationId}`,
    configRoot: generation.configRoot,
    stateDir: generation.stateDir,
    unitName: generation.unitName,
    gatewayPort: generation.gatewayPort,
    openclawVersion: generation.openclawVersion,
    nodeVersion: generation.nodeVersion,
    operatorCommands: {
      driftAudit: renderOpenClawDriftAuditScript(identityInput),
      liveAcceptance: renderOpenClawLiveAcceptanceScript(generation),
      rollback: renderOpenClawRollbackScript(generation),
    },
  };
});
