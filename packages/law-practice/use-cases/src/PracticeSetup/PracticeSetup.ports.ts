/**
 * Ports the setup doctor needs from its host: probing and repairing a
 * requirement on the real machine, and asking the lawyer to approve a repair.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { SetupRequirement, SetupRequirementId } from "@beep/law-practice-domain";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { EffectOutput } from "../internal/effectOutput.ts";
import type { ProbeResult } from "@beep/law-practice-domain";
import type * as Effect from "effect/Effect";

const $I = $LawPracticeUseCasesId.create("PracticeSetup/PracticeSetup.ports");

/**
 * A probe could not run at all (as opposed to finding the requirement unmet).
 *
 * **Example** (Report an unavailable probe)
 *
 * ```ts
 * import { SetupProbeUnavailable } from "@beep/law-practice-use-cases/PracticeSetup"
 * import { SetupRequirementId } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.map(S.decodeUnknownEffect(SetupRequirementId)("box-drive-installed"), (requirement) =>
 *   SetupProbeUnavailable.make({ requirement, reason: "registry read failed" })
 * )
 * Effect.runPromise(program).then((error) => console.log(error._tag))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SetupProbeUnavailable extends S.TaggedError<SetupProbeUnavailable, { readonly brand: unique symbol }>(
  $I`SetupProbeUnavailable`
)(
  "SetupProbeUnavailable",
  {
    requirement: SetupRequirementId.annotateKey({ description: "The requirement whose probe could not run." }),
    reason: S.NonEmptyString.annotateKey({ description: "Why the probe could not run." }),
  },
  $I.annoteError<SetupProbeUnavailable>("SetupProbeUnavailable", {
    title: "Setup probe unavailable",
    description: "A setup probe could not run on this machine.",
  })
) {}

/**
 * An approved automatic repair failed.
 *
 * **Example** (Report a failed repair)
 *
 * ```ts
 * import { SetupRepairFailed } from "@beep/law-practice-use-cases/PracticeSetup"
 * import { SetupRequirementId } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.map(S.decodeUnknownEffect(SetupRequirementId)("box-drive-installed"), (requirement) =>
 *   SetupRepairFailed.make({ requirement, reason: "installer exited with code 1603" })
 * )
 * Effect.runPromise(program).then((error) => console.log(error._tag))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SetupRepairFailed extends S.TaggedError<SetupRepairFailed, { readonly brand: unique symbol }>(
  $I`SetupRepairFailed`
)(
  "SetupRepairFailed",
  {
    requirement: SetupRequirementId.annotateKey({ description: "The requirement whose repair failed." }),
    reason: S.NonEmptyString.annotateKey({ description: "Why the repair failed." }),
  },
  $I.annoteError<SetupRepairFailed>("SetupRepairFailed", {
    title: "Setup repair failed",
    description: "An approved automatic repair failed.",
  })
) {}

/**
 * Host service shape for probing and repairing setup requirements.
 *
 * **Details**
 *
 * The gateway implements one probe and, for automatic remediations, one
 * repair per requirement id. Repairs run only after the doctor has obtained
 * approval through {@link SetupApprovals}.
 *
 * @category models
 * @since 0.0.0
 */
export class SetupProbesShape extends S.Opaque<SetupProbesShape, { readonly brand: unique symbol }>()(
  S.Struct({
    probe: Fn({
      input: SetupRequirement,
      output: EffectOutput<ProbeResult, SetupProbeUnavailable>(),
    }).annotateKey({ description: "Check one requirement on the real machine." }),
    repair: Fn({
      input: SetupRequirement,
      output: EffectOutput<void, SetupRepairFailed>(),
    }).annotateKey({ description: "Perform one requirement's automatic remediation." }),
  }).pipe(
    $I.annoteSchema("SetupProbesShape", {
      description: "Host service shape for probing and repairing setup requirements.",
    })
  )
) {}

/**
 * Host service that probes and repairs setup requirements.
 *
 * **Example** (Read the service tag key)
 *
 * ```ts
 * import { SetupProbes } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * console.log(SetupProbes.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SetupProbes extends Context.Service<SetupProbes, SetupProbesShape>()($I`SetupProbes`) {}

const RepairDecisionBase = LiteralKit(["approved", "declined"]);

/**
 * The lawyer's answer to a repair request.
 *
 * **Example** (Check a decision)
 *
 * ```ts
 * import { RepairDecision } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * console.log(RepairDecision.is.approved("approved")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RepairDecision = RepairDecisionBase.pipe(
  $I.annoteSchema("RepairDecision", {
    description: "The lawyer's answer to a repair request.",
  }),
  SchemaUtils.withLiteralKitStatics(RepairDecisionBase)
);

/**
 * Decoded type of {@link RepairDecision}.
 *
 * **Example** (Type a decision)
 *
 * ```ts
 * import type { RepairDecision } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * const decision: RepairDecision = "declined"
 * console.log(decision)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RepairDecision = typeof RepairDecision.Type;

/**
 * Host service shape for asking the lawyer to approve an automatic repair.
 *
 * @category models
 * @since 0.0.0
 */
export class SetupApprovalsShape extends S.Opaque<SetupApprovalsShape, { readonly brand: unique symbol }>()(
  S.Struct({
    approveRepair: Fn({
      input: SetupRequirement,
      output: EffectOutput<RepairDecision>(),
    }).annotateKey({
      description: "Show the repair's plain-language summary and return the lawyer's decision.",
    }),
  }).pipe(
    $I.annoteSchema("SetupApprovalsShape", {
      description: "Host service shape for asking the lawyer to approve an automatic repair.",
    })
  )
) {}

/**
 * Host service that asks the lawyer to approve automatic repairs.
 *
 * **Example** (Approve every repair in a test)
 *
 * ```ts
 * import { SetupApprovals, SetupApprovalsShape } from "@beep/law-practice-use-cases/PracticeSetup"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const ApproveAll = Layer.succeed(
 *   SetupApprovals,
 *   SetupApprovalsShape.make({ approveRepair: () => Effect.succeed("approved" as const) })
 * )
 * console.log(Layer.isLayer(ApproveAll))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SetupApprovals extends Context.Service<SetupApprovals, SetupApprovalsShape>()($I`SetupApprovals`) {}

/**
 * Lift a plain approval function into the {@link SetupApprovalsShape}.
 *
 * **Example** (Always decline)
 *
 * ```ts
 * import { makeSetupApprovals } from "@beep/law-practice-use-cases/PracticeSetup"
 * import * as Effect from "effect/Effect"
 *
 * const shape = makeSetupApprovals(() => Effect.succeed("declined" as const))
 * console.log(typeof shape.approveRepair)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSetupApprovals = (
  approveRepair: (requirement: SetupRequirement) => Effect.Effect<RepairDecision>
): SetupApprovalsShape => SetupApprovalsShape.make({ approveRepair });
