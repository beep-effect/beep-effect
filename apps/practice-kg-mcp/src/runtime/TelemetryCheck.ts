/**
 * Operator smoke for the telemetry key path: resolves the telemetry
 * directory and round-trips a random test secret through the production
 * DPAPI port, printing one line that says whether it worked and which path
 * it took.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeKgMcpId } from "@beep/identity/packages";
import { StrictKeyProtection } from "@beep/observability/strict";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import * as OptionUtils from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { SelfCheckFailure } from "../PracticeKgMcp.errors.ts";
import { DpapiPort, layerPracticeKgDpapi, resolvePracticeKgTelemetryDir, roundTripDpapi } from "./TelemetryKey.ts";

const $I = $PracticeKgMcpId.create("runtime/TelemetryCheck");

/**
 * The single line `--self-check-telemetry` prints.
 *
 * **Details**
 *
 * `ok` says whether the round trip returned the secret, `keyPath` names the
 * path that ran (`dpapi-ffi`, or `dpapi-powershell` when the FFI path was
 * unavailable; `dev-file` off Windows), and `telemetryDir` is the directory
 * the host resolved. The secret and the wrapped bytes are never printed.
 *
 * **Example** (A passing Windows report)
 *
 * ```ts
 * import { PracticeKgTelemetrySelfCheckReport } from "../../src/runtime/TelemetryCheck.ts"
 *
 * const report = PracticeKgTelemetrySelfCheckReport.make({ ok: true, keyPath: "dpapi-ffi" })
 * console.log(report.ok) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PracticeKgTelemetrySelfCheckReport extends S.Opaque<
  PracticeKgTelemetrySelfCheckReport,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ok: S.Boolean,
    keyPath: S.optionalKey(StrictKeyProtection),
    telemetryDir: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("PracticeKgTelemetrySelfCheckReport", {
      description: "Outcome of the telemetry key smoke: ok, the key path that ran, and the telemetry directory.",
    })
  )
) {}

const encodeReport = S.encodeEffect(S.fromJsonString(PracticeKgTelemetrySelfCheckReport));

/**
 * Runs the telemetry key smoke with the production port for the host
 * platform (`HostProcessPlatform`): DPAPI on Windows, the dev port
 * elsewhere.
 *
 * **Example** (Check the key path)
 *
 * ```ts
 * import { runPracticeKgTelemetrySelfCheck } from "../../src/runtime/TelemetryCheck.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runPracticeKgTelemetrySelfCheck())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runPracticeKgTelemetrySelfCheck = Effect.fn("PracticeKgTelemetryCheck.run")(function* () {
  const platform = yield* HostProcessPlatform;
  const telemetryDir = yield* resolvePracticeKgTelemetryDir(platform);
  const keyPath = yield* Layer.build(layerPracticeKgDpapi(platform)).pipe(
    Effect.flatMap((ports) => roundTripDpapi(Context.get(ports, DpapiPort))),
    Effect.scoped,
    Effect.result
  );
  return PracticeKgTelemetrySelfCheckReport.make({
    ok: Result.isSuccess(keyPath),
    ...OptionUtils.getSomesStruct({ keyPath: O.getSuccess(keyPath), telemetryDir }),
  });
});

/**
 * Prints a telemetry self-check report as one JSON line on stdout, failing
 * with `SelfCheckFailure` (a non-zero exit) when it did not pass.
 *
 * **Example** (Print the report)
 *
 * ```ts
 * import { printPracticeKgTelemetrySelfCheck, runPracticeKgTelemetrySelfCheck } from "../../src/runtime/TelemetryCheck.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(printPracticeKgTelemetrySelfCheck(runPracticeKgTelemetrySelfCheck()))) // true
 * ```
 *
 * @param check - The self-check to run and print.
 * @category use-cases
 * @since 0.0.0
 */
export const printPracticeKgTelemetrySelfCheck = Effect.fn("PracticeKgTelemetryCheck.print")(function* <E, R>(
  check: Effect.Effect<PracticeKgTelemetrySelfCheckReport, E, R>
) {
  const report = yield* check;
  // The report is schema-built, so an encode failure is a defect.
  const orDie1 = yield* Effect.orDie(encodeReport(report));
  yield* Console.log(orDie1);
  if (!report.ok) {
    return yield* SelfCheckFailure.make({ message: "The telemetry key round trip failed." });
  }
});
