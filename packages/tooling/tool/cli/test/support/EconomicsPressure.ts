/**
 * Pressure-source doubles for the `yeet economics` command suites: a source
 * that reads nothing, so no suite reads the workstation's PSI recorder or
 * admission journal.
 *
 * @packageDocumentation
 */
import {
  AdmissionStampRead,
  EconomicsPressureRead,
  PsiRecorderRead,
  YeetPressureSource,
} from "@beep/repo-cli/test/Yeet";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";

// A pressure read with both sources `not-read`.
const notReadPressure = EconomicsPressureRead.make({
  host: O.none(),
  recorder: PsiRecorderRead.make({ status: "not-read", lines: 0, invalidLines: 0, samples: [] }),
  admissions: AdmissionStampRead.make({ status: "not-read", rows: 0, opaqueRows: 0, stamps: [] }),
});

/**
 * A pressure source that answers `read` with the given read, never touching
 * the filesystem.
 */
export const pressureSourceOf = (read: EconomicsPressureRead): Layer.Layer<YeetPressureSource> =>
  Layer.succeed(YeetPressureSource, YeetPressureSource.of({ read: Effect.succeed(read) }));

/**
 * The pressure source for suites that do not test the pressure join.
 */
export const NoPressure = pressureSourceOf(notReadPressure);
