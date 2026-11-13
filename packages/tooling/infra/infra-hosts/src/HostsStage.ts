/**
 * Stage policy shared by the host stacks.
 *
 * The host stacks invert the rule every other Alchemy stack follows: their
 * `prod` stage reaches dankserver and the operator workstation only over the
 * YubiKey-gated SSH and sudo routes, so `prod` runs from the operator
 * workstation and refuses to run in CI (goals/infra-alchemy-rebuild D21, SPEC
 * Exception Ledger). The shared S3 state store's stage lease is the only
 * overlap guard; there is no deploy workflow for these stacks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $InfraHostsId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as Config from "effect/Config";
import { SourceError } from "effect/ConfigProvider";

const $I = $InfraHostsId.create("HostsStage");

const HostsStageKindBase = LiteralKit(["prod", "rehearsal"]);

/**
 * Stage kinds the host stacks distinguish.
 *
 * `prod` mutates the real host; `rehearsal` covers every other stage name
 * (`dev_$USER`, `live_$USER`, test stages), which deploys only the parts of a
 * stack that cannot touch production data or the workstation's system state.
 *
 * **Example** (List the stage kinds)
 * ```ts
 * import { HostsStageKind } from "@beep/infra-hosts/HostsStage"
 *
 * console.log(HostsStageKind.literals) // ["prod", "rehearsal"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HostsStageKind = HostsStageKindBase.pipe(
  $I.annoteSchema("HostsStageKind", {
    description: "Whether a host stack stage mutates the real host (prod) or only rehearses against it.",
  }),
  SchemaUtils.withLiteralKitStatics(HostsStageKindBase)
);

/**
 * Runtime type for {@link HostsStageKind}.
 *
 * **Example** (Annotate a stage kind)
 * ```ts
 * import type { HostsStageKind } from "@beep/infra-hosts/HostsStage"
 *
 * const kind: HostsStageKind = "rehearsal"
 * console.log(kind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HostsStageKind = typeof HostsStageKind.Type;

/**
 * Classify an Alchemy stage name.
 *
 * **Example** (Classify stage names)
 * ```ts
 * import { stageKind } from "@beep/infra-hosts/HostsStage"
 *
 * console.log(stageKind("prod")) // "prod"
 * console.log(stageKind("dev_operator")) // "rehearsal"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const stageKind = (stage: string): HostsStageKind =>
  stage === HostsStageKind.Enum.prod ? HostsStageKind.Enum.prod : HostsStageKind.Enum.rehearsal;

/**
 * Refuses to run when the `CI` environment variable is true.
 *
 * Yield it before declaring any `prod` resource. In CI it fails with a
 * `ConfigError` (the only error an `Alchemy.Stack` body may raise), so a `prod`
 * plan or deploy from a runner stops before the first resource is read. On the
 * workstation, where `CI` is unset or false, it succeeds.
 *
 * **Example** (Guard a prod stage)
 * ```ts
 * import { WorkstationOnly } from "@beep/infra-hosts/HostsStage"
 * import * as ConfigProvider from "effect/ConfigProvider"
 * import * as Effect from "effect/Effect"
 *
 * const onWorkstation = WorkstationOnly.parse(ConfigProvider.fromUnknown({}))
 * console.log(Effect.isEffect(onWorkstation)) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const WorkstationOnly: Config.Config<void> = Config.Boolean("CI").pipe(
  Config.withDefault(false),
  Config.flatMap((ci) =>
    ci
      ? Config.fail(
          new SourceError({
            message:
              "The host stacks deploy prod from the operator workstation only (D21): CI=true, refusing to plan or deploy.",
          })
        )
      : Config.succeed(undefined)
  )
);
