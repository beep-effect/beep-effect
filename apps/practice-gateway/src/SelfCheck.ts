/**
 * The `--self-check` command line: run the setup doctor once over the saved
 * profile and print its report as one JSON line.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import { SetupReport } from "@beep/law-practice-domain";
import { SetupDoctor } from "@beep/law-practice-use-cases/PracticeSetup";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { SelfCheckFailure } from "./PracticeGateway.errors.ts";
import { ProfileStore } from "./ProfileStore.ts";
import { requirementsForSaved } from "./Requirements.ts";
import { summarizeReport } from "./SetupTools.ts";
import { PRACTICE_GATEWAY_VERSION } from "./Version.ts";
import type { SetupGraphInvalid, SetupProbeUnavailable } from "@beep/law-practice-use-cases/PracticeSetup";
import type * as Config from "effect/Config";
import type { ProfileStoreFailure } from "./PracticeGateway.errors.ts";

const $I = $PracticeGatewayId.create("SelfCheck");

/**
 * The line `--self-check` prints when the doctor ran.
 *
 * **Details**
 *
 * `ok` means the doctor ran, not that setup is complete; read
 * `report.complete` for that.
 *
 * **Example** (Build a report line)
 *
 * ```ts
 * import { SetupReport } from "@beep/law-practice-domain"
 * import { GatewaySelfCheckReport } from "@beep/practice-gateway/SelfCheck"
 *
 * const line = GatewaySelfCheckReport.make({
 *   ok: true,
 *   extensionVersion: "0.1.0",
 *   profileSaved: false,
 *   summary: "Setup is complete: all 0 checks pass.",
 *   report: SetupReport.make({ checks: [], humanSteps: [], complete: true }),
 * })
 * console.log(line.ok)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewaySelfCheckReport extends S.Opaque<GatewaySelfCheckReport, { readonly brand: unique symbol }>()(
  S.Struct({
    ok: S.Literal(true).annotateKey({ description: "The doctor ran." }),
    extensionVersion: S.NonEmptyString.annotateKey({ description: "The gateway version." }),
    profileSaved: S.Boolean.annotateKey({ description: "Whether a practice profile is saved." }),
    summary: S.NonEmptyString.annotateKey({ description: "The report in plain language." }),
    report: SetupReport.annotateKey({ description: "The setup doctor's report." }),
  }).pipe(
    $I.annoteSchema("GatewaySelfCheckReport", {
      description: "Self-check line printed when the setup doctor ran.",
    })
  )
) {}

/**
 * The line `--self-check` prints when the doctor could not run.
 *
 * **Example** (Build a refusal line)
 *
 * ```ts
 * import { GatewaySelfCheckRefusal } from "@beep/practice-gateway/SelfCheck"
 *
 * console.log(GatewaySelfCheckRefusal.make({ ok: false, message: "The profile is unreadable." }).ok)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewaySelfCheckRefusal extends S.Opaque<GatewaySelfCheckRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    ok: S.Literal(false).annotateKey({ description: "The doctor did not run." }),
    message: S.NonEmptyString.annotateKey({ description: "Why it did not run." }),
  }).pipe(
    $I.annoteSchema("GatewaySelfCheckRefusal", {
      description: "Self-check line printed when the setup doctor could not run.",
    })
  )
) {}

const encodeReport = S.encodeEffect(S.fromJsonString(GatewaySelfCheckReport));
const encodeRefusal = S.encodeEffect(S.fromJsonString(GatewaySelfCheckRefusal));

/**
 * Run the doctor over the saved profile's requirements.
 *
 * **Example** (Run the check)
 *
 * ```ts
 * import { runGatewaySelfCheck } from "@beep/practice-gateway/SelfCheck"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runGatewaySelfCheck))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runGatewaySelfCheck = Effect.gen(function* () {
  const store = yield* ProfileStore;
  const doctor = yield* SetupDoctor;
  const profile = yield* store.get;
  const requirements = requirementsForSaved(profile);
  const report = yield* doctor.check(requirements);
  return GatewaySelfCheckReport.make({
    ok: true,
    extensionVersion: PRACTICE_GATEWAY_VERSION,
    profileSaved: O.isSome(profile),
    summary: summarizeReport(report, requirements),
    report,
  });
}).pipe(Effect.withSpan("PracticeGateway.selfCheck"));

type SelfCheckError = Config.ConfigError | ProfileStoreFailure | SetupGraphInvalid | SetupProbeUnavailable;

const refusalMessage = Match.type<SelfCheckError>().pipe(
  Match.tagsExhaustive({
    ConfigError: (error) => `The gateway settings could not be read: ${error.message}`,
    ProfileStoreFailure: (error) => error.message,
    SetupGraphInvalid: (error) => `The setup requirements cannot be ordered (${error.problem}).`,
    SetupProbeUnavailable: (error) => `The check for ${error.requirement} could not run: ${error.reason}`,
  })
);

// Prints the refusal line, then fails with the error that tells the main
// runner the failure is already on stdout.
const refuse = (error: SelfCheckError) => {
  const message = refusalMessage(error);
  return encodeRefusal(GatewaySelfCheckRefusal.make({ ok: false, message })).pipe(
    Effect.orDie,
    Effect.flatMap(Console.log),
    Effect.andThen(SelfCheckFailure.make({ cause: error, message }))
  );
};

/**
 * Print a self-check outcome as exactly one JSON line on stdout.
 *
 * **Details**
 *
 * A doctor that ran prints the report and succeeds, whatever the report
 * says. A doctor that could not run prints `{"ok":false,"message":…}` and
 * fails with `SelfCheckFailure`, which exits non-zero without a second line.
 *
 * **Example** (Print the check)
 *
 * ```ts
 * import { printGatewaySelfCheck, runGatewaySelfCheck } from "@beep/practice-gateway/SelfCheck"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(printGatewaySelfCheck(runGatewaySelfCheck)))
 * ```
 *
 * @param check - Self-check to run and report.
 * @category use-cases
 * @since 0.0.0
 */
export const printGatewaySelfCheck = <R>(
  check: Effect.Effect<GatewaySelfCheckReport, SelfCheckError, R>
): Effect.Effect<void, SelfCheckFailure, R> =>
  check.pipe(
    // The line encodes a value its schema already validated, so an encode failure is a defect.
    Effect.flatMap(flow(encodeReport, Effect.orDie)),
    Effect.matchEffect({ onFailure: refuse, onSuccess: Console.log }),
    Effect.withSpan("PracticeGateway.printSelfCheck")
  );
