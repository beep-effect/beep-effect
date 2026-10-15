/**
 * The setup doctor: probes a practice's requirements in dependency order and
 * runs approved automatic repairs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { ProbeResult, Remediation, SetupRequirement, SetupRequirementId } from "@beep/law-practice-domain";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EffectOutput } from "../internal/effectOutput.ts";
import { assembleReport, orderRequirements } from "./PracticeSetup.policy.ts";
import { SetupApprovals, SetupProbes } from "./PracticeSetup.ports.ts";
import type { SetupReport } from "@beep/law-practice-domain";
import type { SetupGraphInvalid } from "./PracticeSetup.policy.ts";
import type { SetupProbeUnavailable, SetupRepairFailed } from "./PracticeSetup.ports.ts";

const $I = $LawPracticeUseCasesId.create("PracticeSetup/PracticeSetup.service");

const RepairRefusalBase = LiteralKit([
  "unknown-requirement",
  "needs-human",
  "dependencies-unsatisfied",
  "already-satisfied",
  "declined",
]);

/**
 * Why the doctor refused to run a repair.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { RepairRefusal } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * console.log(RepairRefusal.is.declined("declined")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RepairRefusal = RepairRefusalBase.pipe(
  $I.annoteSchema("RepairRefusal", {
    description: "Why the setup doctor refused to run a repair.",
  }),
  SchemaUtils.withLiteralKitStatics(RepairRefusalBase)
);

/**
 * Decoded type of {@link RepairRefusal}.
 *
 * **Example** (Type a refusal)
 *
 * ```ts
 * import type { RepairRefusal } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * const refusal: RepairRefusal = "needs-human"
 * console.log(refusal)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RepairRefusal = typeof RepairRefusal.Type;

/**
 * The doctor did not run the requested repair.
 *
 * **Example** (Refuse a repair the lawyer declined)
 *
 * ```ts
 * import { SetupRepairRefused } from "@beep/law-practice-use-cases/PracticeSetup"
 * import { SetupRequirementId } from "@beep/law-practice-domain"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.map(S.decodeUnknownEffect(SetupRequirementId)("box-drive-installed"), (requirement) =>
 *   SetupRepairRefused.make({ requirement, refusal: "declined" })
 * )
 * Effect.runPromise(program).then((error) => console.log(error.refusal))
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SetupRepairRefused extends S.TaggedError<SetupRepairRefused, { readonly brand: unique symbol }>(
  $I`SetupRepairRefused`
)(
  "SetupRepairRefused",
  {
    requirement: SetupRequirementId.annotateKey({ description: "The requirement whose repair was refused." }),
    refusal: RepairRefusal.annotateKey({ description: "Why the repair was not run." }),
  },
  $I.annoteError<SetupRepairRefused>("SetupRepairRefused", {
    title: "Setup repair refused",
    description: "The setup doctor did not run the requested repair.",
  })
) {}

/**
 * Service shape of the setup doctor.
 *
 * @category models
 * @since 0.0.0
 */
export class SetupDoctorShape extends S.Opaque<SetupDoctorShape, { readonly brand: unique symbol }>()(
  S.Struct({
    check: Fn({
      input: S.Array(SetupRequirement),
      output: EffectOutput<SetupReport, SetupGraphInvalid | SetupProbeUnavailable>(),
    }).annotateKey({
      description: "Probe every requirement in dependency order and report.",
    }),
    repair: Fn({
      input: S.Struct({ requirements: S.Array(SetupRequirement), requirement: SetupRequirementId }),
      output: EffectOutput<
        ProbeResult,
        SetupGraphInvalid | SetupProbeUnavailable | SetupRepairFailed | SetupRepairRefused
      >(),
    }).annotateKey({
      description: "Run one approved automatic repair and return the requirement's new probe result.",
    }),
  }).pipe(
    $I.annoteSchema("SetupDoctorShape", {
      description: "Service shape of the setup doctor.",
    })
  )
) {}

/**
 * The setup doctor service.
 *
 * **Details**
 *
 * Stateless by design: every call re-probes the machine, so setup interrupted
 * by a reboot resumes from what is actually true. A repair runs only when its
 * requirement is probed unsatisfied, its dependencies are satisfied, its
 * remediation is automatic, and the lawyer approved it.
 *
 * **Example** (Read the service tag key)
 *
 * ```ts
 * import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup"
 *
 * console.log(SetupDoctor.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SetupDoctor extends Context.Service<SetupDoctor, SetupDoctorShape>()($I`SetupDoctor`) {
  /**
   * Live doctor over the host's {@link SetupProbes} and {@link SetupApprovals}.
   *
   * **Example** (Provide the live doctor)
   *
   * ```ts
   * import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(SetupDoctor.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    SetupDoctor,
    Effect.gen(function* () {
      const probes = yield* SetupProbes;
      const approvals = yield* SetupApprovals;

      const check = Effect.fnUntraced(function* (requirements: ReadonlyArray<SetupRequirement>) {
        const ordered = yield* orderRequirements(requirements);
        return yield* assembleReport(ordered, probes.probe);
      });

      const repair = Effect.fnUntraced(function* (input: {
        readonly requirements: ReadonlyArray<SetupRequirement>;
        readonly requirement: SetupRequirementId;
      }) {
        const refuse = (refusal: RepairRefusal) => SetupRepairRefused.make({ requirement: input.requirement, refusal });
        const target = A.findFirst(input.requirements, (requirement) => requirement.id === input.requirement);
        if (O.isNone(target)) {
          return yield* refuse("unknown-requirement");
        }
        const requirement = target.value;
        if (!Remediation.guards.automatic(requirement.remediation)) {
          return yield* refuse("needs-human");
        }
        const report = yield* check(input.requirements);
        const verdict = A.findFirst(report.checks, (entry) => entry.requirement === requirement.id);
        if (O.isNone(verdict) || verdict.value.state === "blocked") {
          return yield* refuse("dependencies-unsatisfied");
        }
        if (ProbeResult.guards.satisfied(verdict.value.result)) {
          return yield* refuse("already-satisfied");
        }
        const decision = yield* approvals.approveRepair(requirement);
        if (decision === "declined") {
          return yield* refuse("declined");
        }
        yield* probes.repair(requirement);
        return yield* probes.probe(requirement);
      });

      return SetupDoctorShape.make({ check, repair });
    })
  );
}
