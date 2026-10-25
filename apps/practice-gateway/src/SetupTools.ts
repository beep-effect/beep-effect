/**
 * The four always-mounted setup tools: read and save the practice profile,
 * report setup status, and run one approved repair.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import {
  CapabilityChoice,
  ItLimits,
  PracticeProfile,
  ProbeResult,
  Remediation,
  RequirementCheck,
  SetupReport,
  SetupRequirementId,
} from "@beep/law-practice-domain";
import { RepairRefusal, SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup";
import { annotateFourHints, FourHintAnnotations, sanitizedToolkit } from "@beep/mcp-kit";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Toolkit from "effect/ai/Toolkit";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { ONBOARDING_GUIDE_DESCRIPTION, OnboardingGuide } from "./OnboardingGuide.ts";
import { ProfileStore } from "./ProfileStore.ts";
import { requirementsForSaved } from "./Requirements.ts";
import type { SetupRequirement } from "@beep/law-practice-domain";
import type {
  SetupGraphInvalid,
  SetupProbeUnavailable,
  SetupRepairFailed,
  SetupRepairRefused,
} from "@beep/law-practice-use-cases/PracticeSetup";
import type { ProfileStoreFailure } from "./PracticeGateway.errors.ts";

const $I = $PracticeGatewayId.create("SetupTools");

/**
 * Why a setup tool call failed.
 *
 * **Example** (Check a failure reason)
 *
 * ```ts
 * import { SetupToolFailureReason } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupToolFailureReason.is.declined("declined")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SetupToolFailureReason = LiteralKit([
  "profile-store",
  "graph-invalid",
  "probe-unavailable",
  "unknown-requirement",
  "needs-human",
  "dependencies-unsatisfied",
  "already-satisfied",
  "declined",
  "repair-failed",
]).pipe(
  $I.annoteSchema("SetupToolFailureReason", {
    description: "Why a setup tool call failed.",
  })
);

/**
 * Decoded type of {@link SetupToolFailureReason}.
 *
 * **Example** (Type a reason)
 *
 * ```ts
 * import type { SetupToolFailureReason } from "@beep/practice-gateway/SetupTools"
 *
 * const reason: SetupToolFailureReason = "needs-human"
 * console.log(reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SetupToolFailureReason = typeof SetupToolFailureReason.Type;

/**
 * Failure returned to the agent by a setup tool, in plain language.
 *
 * **Example** (A declined repair)
 *
 * ```ts
 * import { SetupToolError } from "@beep/practice-gateway/SetupTools"
 *
 * const error = SetupToolError.make({ tool: "setup_repair", reason: "declined", message: "The lawyer said no." })
 * console.log(error.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupToolError extends S.Opaque<SetupToolError, { readonly brand: unique symbol }>()(
  S.Struct({
    tool: S.NonEmptyString.annotateKey({ description: "The tool that failed." }),
    reason: SetupToolFailureReason.annotateKey({ description: "Why it failed." }),
    message: S.NonEmptyString.annotateKey({ description: "What happened and what to do next, in plain language." }),
  }).pipe(
    $I.annoteSchema("SetupToolError", {
      description: "Plain-language failure returned by a practice gateway setup tool.",
    })
  )
) {}

/**
 * Result of `setup_profile_get`.
 *
 * **Example** (No profile saved yet)
 *
 * ```ts
 * import { SetupProfileView } from "@beep/practice-gateway/SetupTools"
 * import * as O from "effect/Option"
 *
 * console.log(SetupProfileView.make({ profile: O.none() }).profile._tag) // "None"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupProfileView extends S.Opaque<SetupProfileView, { readonly brand: unique symbol }>()(
  S.Struct({
    profile: S.OptionFromNullOr(PracticeProfile).annotateKey({
      description: "The saved practice profile, or null when the onboarding interview has not saved one.",
    }),
  }).pipe(
    $I.annoteSchema("SetupProfileView", {
      description: "The saved practice profile, if any.",
    })
  )
) {}

/**
 * Result of `setup_status`: the doctor's report and a plain-language summary.
 *
 * **Example** (Read a status summary)
 *
 * ```ts
 * import { SetupReport } from "@beep/law-practice-domain"
 * import { SetupStatus } from "@beep/practice-gateway/SetupTools"
 *
 * const status = SetupStatus.make({
 *   report: SetupReport.make({ checks: [], humanSteps: [], complete: true }),
 *   summary: "Setup is complete.",
 *   repairable: [],
 * })
 * console.log(status.summary)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupStatus extends S.Opaque<SetupStatus, { readonly brand: unique symbol }>()(
  S.Struct({
    report: SetupReport.annotateKey({ description: "One verdict per requirement plus the batched human steps." }),
    summary: S.NonEmptyString.annotateKey({ description: "The report in plain language for the lawyer." }),
    repairable: S.Array(SetupRequirementId).annotateKey({
      description:
        "Requirements setup_repair can fix now: probed and unsatisfied, with an automatic remediation and every dependency satisfied.",
    }),
  }).pipe(
    $I.annoteSchema("SetupStatus", {
      description: "Setup doctor report with a plain-language summary.",
    })
  )
) {}

/**
 * Input of `setup_repair`.
 *
 * **Example** (Ask for the Box Drive install)
 *
 * ```ts
 * import { SetupRequirementId } from "@beep/law-practice-domain"
 * import { SetupRepairRequest } from "@beep/practice-gateway/SetupTools"
 *
 * const request = SetupRepairRequest.make({ requirement: SetupRequirementId.make("box-drive-installed") })
 * console.log(request.requirement)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupRepairRequest extends S.Opaque<SetupRepairRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    requirement: SetupRequirementId.annotateKey({
      description: "Id of the requirement to repair, as reported by setup_status.",
    }),
  }).pipe(
    $I.annoteSchema("SetupRepairRequest", {
      description: "Which setup requirement to repair.",
    })
  )
) {}

const readHints = FourHintAnnotations.make({ destructive: false, idempotent: true, openWorld: false, readOnly: true });
const writeHints = FourHintAnnotations.make({
  destructive: false,
  idempotent: true,
  openWorld: false,
  readOnly: false,
});
const repairHints = FourHintAnnotations.make({
  destructive: true,
  idempotent: false,
  openWorld: true,
  readOnly: false,
});

const setupTool = <Name extends string, Parameters extends S.Top, Success extends S.Top>(
  name: Name,
  description: string,
  parameters: Parameters,
  success: Success,
  hints: FourHintAnnotations
) =>
  annotateFourHints(
    Tool.make(name, { description, failure: SetupToolError, failureMode: "return", parameters, success }),
    hints
  );

const NoParameters = S.Struct({});

/**
 * `setup_profile_get`: read the saved practice profile.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { SetupProfileGetTool } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupProfileGetTool.name) // "setup_profile_get"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupProfileGetTool = setupTool(
  "setup_profile_get",
  "Read the saved practice profile (the onboarding interview's outcome). Returns profile null when none is saved yet.",
  NoParameters,
  SetupProfileView,
  readHints
);

/**
 * Accept a value either in its schema shape or JSON-encoded as a string.
 *
 * **Details**
 *
 * Some MCP clients send nested object or number arguments as JSON strings;
 * the onboarding proof (2026-10-14) saw the profile's IT limits rejected that
 * way. Decoding tries the plain shape first.
 */
const plainOrJson = <Schema extends S.Codec<unknown, unknown, never, never>>(schema: Schema) =>
  S.Union([schema, S.fromJsonString(schema)]);

/**
 * Input of `setup_profile_save`: the {@link PracticeProfile} fields, each
 * accepted plain or JSON-encoded.
 *
 * **Example** (Decode a profile whose IT limits arrive as a JSON string)
 *
 * ```ts
 * import { SetupProfileSaveInput } from "@beep/practice-gateway/SetupTools"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(SetupProfileSaveInput)({
 *   choices: [{ kind: "declined", capability: "secrets" }],
 *   itLimits: '{"adminRights":"available","proxy":"none"}',
 *   recordedAt: 0,
 * })
 * Effect.runPromise(program).then((input) => console.log(input.itLimits.proxy)) // "none"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupProfileSaveInput extends S.Opaque<SetupProfileSaveInput, { readonly brand: unique symbol }>()(
  S.Struct({
    choices: CapabilityChoice.pipe(S.NonEmptyArray, plainOrJson),
    itLimits: plainOrJson(ItLimits),
    recordedAt: plainOrJson(S.DateTimeUtcFromMillis),
  }).pipe(
    $I.annoteSchema("SetupProfileSaveInput", {
      description: "The practice profile fields, each accepted plain or JSON-encoded.",
    })
  )
) {}

/**
 * `setup_profile_save`: replace the saved practice profile.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { SetupProfileSaveTool } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupProfileSaveTool.name) // "setup_profile_save"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupProfileSaveTool = setupTool(
  "setup_profile_save",
  "Save the practice profile after the onboarding interview. It holds capability choices and IT limits only; never put secrets or client data in it. Provider tools change after Claude restarts the gateway.",
  SetupProfileSaveInput,
  PracticeProfile,
  writeHints
);

/**
 * `setup_status`: check every requirement the saved profile selects.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { SetupStatusTool } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupStatusTool.name) // "setup_status"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupStatusTool = setupTool(
  "setup_status",
  "Check this computer against the saved practice profile. Returns each requirement's verdict in dependency order, the steps only the lawyer can take, and a plain-language summary to relay.",
  NoParameters,
  SetupStatus,
  readHints
);

/**
 * `setup_repair`: run one automatic repair after the lawyer approves it.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { SetupRepairTool } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupRepairTool.name) // "setup_repair"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupRepairTool = setupTool(
  "setup_repair",
  "Run one automatic repair reported by setup_status. The lawyer approves it in a prompt first; returns the requirement's new probe result.",
  SetupRepairRequest,
  ProbeResult,
  repairHints
);

/**
 * Result of `setup_onboarding_guide`.
 *
 * **Example** (Wrap a guide)
 *
 * ```ts
 * import { SetupOnboardingGuide } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupOnboardingGuide.make({ guide: "1. Call setup_status." }).guide)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupOnboardingGuide extends S.Opaque<SetupOnboardingGuide, { readonly brand: unique symbol }>()(
  S.Struct({
    guide: S.NonEmptyString.annotateKey({ description: "The onboarding steps to follow, as Markdown." }),
  }).pipe(
    $I.annoteSchema("SetupOnboardingGuide", {
      description: "The onboarding steps Claude follows to set up this computer.",
    })
  )
) {}

/**
 * `setup_onboarding_guide`: the onboarding steps to follow.
 *
 * **Example** (Read the tool name)
 *
 * ```ts
 * import { SetupOnboardingGuideTool } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(SetupOnboardingGuideTool.name) // "setup_onboarding_guide"
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupOnboardingGuideTool = setupTool(
  "setup_onboarding_guide",
  ONBOARDING_GUIDE_DESCRIPTION,
  NoParameters,
  SetupOnboardingGuide,
  readHints
);

/**
 * The always-mounted setup toolkit.
 *
 * **Example** (List the setup tools)
 *
 * ```ts
 * import { SetupToolkit } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(Object.keys(SetupToolkit.tools))
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SetupToolkit = Toolkit.make(
  SetupOnboardingGuideTool,
  SetupProfileGetTool,
  SetupProfileSaveTool,
  SetupStatusTool,
  SetupRepairTool
);

const statusLabel = RequirementCheck.match({
  probed: (check) => check.result.status,
  blocked: () => "blocked",
});

/**
 * The requirements `setup_repair` can fix now: probed and unsatisfied, with
 * an automatic remediation and every dependency probed satisfied.
 *
 * **Example** (Nothing to repair in a complete report)
 *
 * ```ts
 * import { SetupReport } from "@beep/law-practice-domain"
 * import { repairableRequirements } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(repairableRequirements(SetupReport.make({ checks: [], humanSteps: [], complete: true }), [])) // []
 * ```
 *
 * @param report - The doctor's report.
 * @param requirements - The requirements the report covers.
 * @category utilities
 * @since 0.0.0
 */
export const repairableRequirements: {
  (requirements: ReadonlyArray<SetupRequirement>): (report: SetupReport) => ReadonlyArray<SetupRequirement>;
  (report: SetupReport, requirements: ReadonlyArray<SetupRequirement>): ReadonlyArray<SetupRequirement>;
} = dual(2, (report: SetupReport, requirements: ReadonlyArray<SetupRequirement>): ReadonlyArray<SetupRequirement> => {
  const probed = A.filter(report.checks, RequirementCheck.guards.probed);
  const satisfiedIds = pipe(
    probed,
    A.filter((check) => ProbeResult.guards.satisfied(check.result)),
    A.map((check) => check.requirement)
  );
  return pipe(
    probed,
    A.filter((check) => !ProbeResult.guards.satisfied(check.result)),
    A.map((check) => A.findFirst(requirements, (requirement) => requirement.id === check.requirement)),
    A.getSomes,
    A.filter(
      (requirement) =>
        Remediation.guards.automatic(requirement.remediation) &&
        A.every(requirement.dependsOn, (dependency) => A.contains(satisfiedIds, dependency))
    )
  );
});

/**
 * Summarize a doctor report in plain language.
 *
 * **Details**
 *
 * Names the passing count, the lawyer's batched steps (their instructions),
 * the repairs the gateway can make with approval, and how many checks wait
 * on earlier steps.
 *
 * **Example** (Summarize a complete report)
 *
 * ```ts
 * import { SetupReport } from "@beep/law-practice-domain"
 * import { summarizeReport } from "@beep/practice-gateway/SetupTools"
 *
 * console.log(summarizeReport(SetupReport.make({ checks: [], humanSteps: [], complete: true }), []))
 * // "Setup is complete: all 0 checks pass."
 * ```
 *
 * @param report - The doctor's report.
 * @param requirements - The requirements the report covers.
 * @category utilities
 * @since 0.0.0
 */
export const summarizeReport: {
  (requirements: ReadonlyArray<SetupRequirement>): (report: SetupReport) => string;
  (report: SetupReport, requirements: ReadonlyArray<SetupRequirement>): string;
} = dual(2, (report: SetupReport, requirements: ReadonlyArray<SetupRequirement>): string => {
  const total = A.length(report.checks);
  if (report.complete) {
    return `Setup is complete: all ${total} checks pass.`;
  }
  const passing = A.length(A.filter(report.checks, (check) => statusLabel(check) === "satisfied"));
  const blocked = A.length(A.filter(report.checks, RequirementCheck.guards.blocked));
  const repairable = pipe(
    repairableRequirements(report, requirements),
    A.map((requirement) => requirement.remediation),
    A.filter(Remediation.guards.automatic),
    A.map((remediation) => remediation.summary)
  );
  const lines = [
    `${passing} of ${total} checks pass.`,
    ...A.map(report.humanSteps, (step) => `You need to: ${step.remediation.instruction}`),
    ...A.map(repairable, (summary) => `I can do this for you once you approve it: ${summary}`),
    ...(blocked > 0 ? [`${blocked} more checks wait on the steps above.`] : []),
  ];
  return A.join(lines, "\n");
});

const failure = (tool: string, reason: SetupToolFailureReason, message: string) =>
  SetupToolError.make({ tool, reason, message });

const doctorFailure = (tool: string) =>
  Match.type<
    ProfileStoreFailure | SetupGraphInvalid | SetupProbeUnavailable | SetupRepairFailed | SetupRepairRefused
  >().pipe(
    Match.tagsExhaustive({
      ProfileStoreFailure: (error) => failure(tool, "profile-store", error.message),
      SetupGraphInvalid: (error) =>
        failure(tool, "graph-invalid", `The setup requirements cannot be ordered (${error.problem}).`),
      SetupProbeUnavailable: (error) =>
        failure(tool, "probe-unavailable", `The check for ${error.requirement} could not run: ${error.reason}`),
      SetupRepairFailed: (error) => failure(tool, "repair-failed", error.reason),
      SetupRepairRefused: (error) =>
        RepairRefusal.match(error.refusal, {
          "unknown-requirement": () =>
            failure(tool, "unknown-requirement", `${error.requirement} is not one of this practice's requirements.`),
          "needs-human": () =>
            failure(tool, "needs-human", `${error.requirement} needs the lawyer to act; relay its instruction.`),
          "dependencies-unsatisfied": () =>
            failure(tool, "dependencies-unsatisfied", `Finish the earlier steps before ${error.requirement}.`),
          "already-satisfied": () =>
            failure(tool, "already-satisfied", `${error.requirement} already holds; nothing to repair.`),
          declined: () =>
            failure(
              tool,
              "declined",
              "The change was not approved: the lawyer declined or cancelled the prompt, or this Claude app cannot show approval prompts. Nothing was changed. Ask the lawyer in chat how to proceed."
            ),
        }),
    })
  );

/**
 * Handlers for {@link SetupToolkit} over the profile store and the doctor.
 *
 * **Example** (Compose the handlers)
 *
 * ```ts
 * import { SetupToolkitHandlers } from "@beep/practice-gateway/SetupTools"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SetupToolkitHandlers))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SetupToolkitHandlers = SetupToolkit.toLayer(
  Effect.gen(function* () {
    const store = yield* ProfileStore;
    const doctor = yield* SetupDoctor;
    const onboarding = yield* OnboardingGuide;

    const savedRequirements = Effect.map(store.get, requirementsForSaved);

    return SetupToolkit.of({
      setup_onboarding_guide: () => Effect.succeed(SetupOnboardingGuide.make({ guide: onboarding.text })),
      setup_profile_get: Effect.fn("PracticeGateway.setup_profile_get")(function* () {
        const profile = yield* store.get.pipe(Effect.mapError(doctorFailure("setup_profile_get")));
        return SetupProfileView.make({ profile });
      }),
      setup_profile_save: Effect.fn("PracticeGateway.setup_profile_save")(function* (input) {
        return yield* store
          .save(PracticeProfile.make(input))
          .pipe(Effect.mapError(doctorFailure("setup_profile_save")));
      }),
      setup_status: Effect.fn("PracticeGateway.setup_status")(function* () {
        return yield* Effect.gen(function* () {
          const requirements = yield* savedRequirements;
          const report = yield* doctor.check(requirements);
          return SetupStatus.make({
            report,
            summary: summarizeReport(report, requirements),
            repairable: A.map(repairableRequirements(report, requirements), (requirement) => requirement.id),
          });
        }).pipe(Effect.mapError(doctorFailure("setup_status")));
      }),
      setup_repair: Effect.fn("PracticeGateway.setup_repair")(function* (request) {
        return yield* savedRequirements.pipe(
          Effect.flatMap((requirements) => doctor.repair({ requirements, requirement: request.requirement })),
          Effect.mapError(doctorFailure("setup_repair"))
        );
      }),
    });
  })
);

/**
 * The setup toolkit registered on the current MCP server.
 *
 * **Example** (Register the setup tools)
 *
 * ```ts
 * import { SetupToolsLayer } from "@beep/practice-gateway/SetupTools"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(SetupToolsLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const SetupToolsLayer = sanitizedToolkit(SetupToolkit).pipe(Layer.provide(SetupToolkitHandlers));
