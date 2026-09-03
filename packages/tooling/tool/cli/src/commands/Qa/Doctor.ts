/**
 * Environment probes behind `beep qa doctor`.
 *
 * The doctor answers one question before a recording session burns operator
 * time: is this machine able to record, extract, and stamp a QA round? Every
 * probe is independent and total — a missing optional tool downgrades to a
 * warning, and only a missing required tool sets a non-zero exit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { Effect, FileSystem, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { configStringOption } from "../../internal/cli/EnvConfig.ts";
import { runCaptured } from "../../internal/process/index.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Qa/Doctor");

/**
 * Default obs-websocket host the QA lane B recorder connects to.
 *
 * **Example** (Log default OBS port)
 *
 * ```ts
 * import { OBS_WEBSOCKET_PORT } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * console.log(OBS_WEBSOCKET_PORT) // 4455
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OBS_WEBSOCKET_PORT = 4455;

/**
 * Outcome domain of one environment probe.
 *
 * **Example** (Count status domain options)
 *
 * ```ts
 * import { QaProbeStatus } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * console.log(QaProbeStatus.Options.length) // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const QaProbeStatus = LiteralKit(["fail", "pass", "warn"]).pipe(
  $I.annoteSchema("QaProbeStatus", {
    description: "Outcome domain of one QA environment probe.",
  })
);

/**
 * Outcome of one environment probe.
 *
 * **Example** (Assign pass status value)
 *
 * ```ts
 * import type { QaProbeStatus } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * const status: QaProbeStatus = "pass"
 * console.log(status)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type QaProbeStatus = typeof QaProbeStatus.Type;

/**
 * Result of probing one tool the recorded-QA pipeline depends on.
 *
 * **Example** (Make ffmpeg probe result)
 *
 * ```ts
 * import { QaProbe } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * const probe = QaProbe.make({ detail: "8.0", name: "ffmpeg", required: true, status: "pass" })
 * console.log(probe.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaProbe extends S.Class<QaProbe>($I`QaProbe`)(
  {
    detail: S.String.pipe(
      $I.annoteKey("QaProbe.detail", {
        description: "Version, path, or remediation hint for the probed tool.",
      })
    ),
    name: S.String.pipe(
      $I.annoteKey("QaProbe.name", {
        description: "Probed tool name.",
      })
    ),
    required: S.Boolean.pipe(
      $I.annoteKey("QaProbe.required", {
        description: "Whether a failure of this probe blocks the pipeline.",
      })
    ),
    status: QaProbeStatus.pipe(
      $I.annoteKey("QaProbe.status", {
        description: "Probe outcome.",
      })
    ),
  },
  $I.annote("QaProbe", {
    description: "Result of probing one tool the recorded-QA pipeline depends on.",
  })
) {}

/**
 * Whether a probe blocks the recorded-QA pipeline.
 *
 * **Example** (Optional fail is non-blocking)
 *
 * ```ts
 * import { isBlockingProbe, QaProbe } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * console.log(isBlockingProbe(QaProbe.make({ detail: "", name: "obs", required: false, status: "fail" }))) // false
 * ```
 *
 * @param probe - Probe result to classify.
 * @returns True when the probe is required and failed.
 * @category predicates
 * @since 0.0.0
 */
export const isBlockingProbe = (probe: QaProbe): boolean =>
  probe.required &&
  QaProbeStatus.$match(probe.status, {
    fail: () => true,
    pass: () => false,
    warn: () => false,
  });

const statusMark = (status: QaProbeStatus): string =>
  QaProbeStatus.$match(status, {
    fail: () => "FAIL",
    pass: () => "ok",
    warn: () => "warn",
  });

/**
 * Render the doctor probe table.
 *
 * **Example** (Render report heading line)
 *
 * ```ts
 * import { QaProbe, renderDoctorReport } from "@beep/repo-cli/commands/Qa/Doctor"
 *
 * const lines = renderDoctorReport([QaProbe.make({ detail: "8.0", name: "ffmpeg", required: true, status: "pass" })])
 * console.log(lines[0]) // "qa doctor"
 * ```
 *
 * @param probes - Probe results in display order.
 * @returns Report lines, heading first, one row per probe.
 * @category formatting
 * @since 0.0.0
 */
export const renderDoctorReport = (probes: ReadonlyArray<QaProbe>): ReadonlyArray<string> => {
  const blocking = A.filter(probes, isBlockingProbe);
  return [
    "qa doctor",
    ...A.map(
      probes,
      (probe) =>
        `  ${Str.padEnd(6)(statusMark(probe.status))} ${Str.padEnd(18)(probe.name)} ${probe.required ? "required" : "optional"}  ${probe.detail}`
    ),
    A.isReadonlyArrayNonEmpty(blocking)
      ? `missing required tooling: ${A.join(
          A.map(blocking, (probe) => probe.name),
          ", "
        )}`
      : "all required tooling present",
  ];
};

const probeBinary = Effect.fn("QaDoctor.probeBinary")(function* (
  name: string,
  args: ReadonlyArray<string>,
  required: boolean,
  remediation: string
): Effect.fn.Return<QaProbe, never, ChildProcessSpawner.ChildProcessSpawner> {
  const captured = yield* runCaptured({ args, command: name, source: "stdout", trim: true }).pipe(
    Effect.asSome,
    Effect.orElseSucceed(O.none<{ readonly exitCode: number; readonly output: string }>)
  );
  return O.match(captured, {
    onNone: () => QaProbe.make({ detail: remediation, name, required, status: "fail" }),
    onSome: (step) =>
      step.exitCode === 0
        ? QaProbe.make({
            detail: pipe(
              step.output,
              Str.split("\n"),
              A.head,
              O.getOrElse((): string => "present")
            ),
            name,
            required,
            status: "pass",
          })
        : QaProbe.make({ detail: remediation, name, required, status: "fail" }),
  });
});

const probeTcpPort = Effect.fn("QaDoctor.probeTcpPort")(function* (
  name: string,
  hostname: string,
  port: number,
  remediation: string
): Effect.fn.Return<QaProbe, never> {
  const reachable = yield* Effect.tryPromise(() =>
    Bun.connect({
      hostname,
      port,
      socket: {
        data: () => undefined,
        error: () => undefined,
        open: (socket) => {
          socket.end();
        },
      },
    }).then((socket) => {
      socket.end();
      return true;
    })
  ).pipe(Effect.orElseSucceed(() => false));
  return reachable
    ? QaProbe.make({ detail: `${hostname}:${port} reachable`, name, required: false, status: "pass" })
    : QaProbe.make({ detail: remediation, name, required: false, status: "warn" });
});

const probePlaywrightChromium = Effect.fn("QaDoctor.probePlaywrightChromium")(function* (): Effect.fn.Return<
  QaProbe,
  never,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = yield* configStringOption("HOME");
  const browsersDir = path.join(
    O.getOrElse(home, (): string => ""),
    ".cache",
    "ms-playwright"
  );
  const entries = yield* fs.readDirectory(browsersDir).pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  const chromium = A.filter(entries, Str.startsWith("chromium"));
  return A.isReadonlyArrayNonEmpty(chromium)
    ? QaProbe.make({
        detail: `${A.join(chromium, ", ")} in ${browsersDir}`,
        name: "playwright-chromium",
        required: true,
        status: "pass",
      })
    : QaProbe.make({
        detail: `no chromium build under ${browsersDir}; run \`bunx playwright install chromium\``,
        name: "playwright-chromium",
        required: true,
        status: "fail",
      });
});

/**
 * Run every recorded-QA environment probe.
 *
 * **Details**
 *
 * Probes run concurrently because they are independent processes; the returned
 * order is stable so the rendered table never reshuffles between runs.
 *
 * **Example** (runQaDoctor returns Effect)
 *
 * ```ts
 * import { runQaDoctor } from "@beep/repo-cli/commands/Qa/Doctor"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runQaDoctor())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runQaDoctor = Effect.fn("QaDoctor.run")(function* (): Effect.fn.Return<
  ReadonlyArray<QaProbe>,
  never,
  ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const [ffmpeg, ffprobe, exiftool, obs, playwright] = yield* Effect.all(
    [
      probeBinary("ffmpeg", ["-version"], true, "not on PATH; install ffmpeg"),
      probeBinary("ffprobe", ["-version"], true, "not on PATH; install ffmpeg"),
      probeBinary("exiftool", ["-ver"], true, "not on PATH; install perl-image-exiftool"),
      probeTcpPort(
        "obs-websocket",
        "127.0.0.1",
        OBS_WEBSOCKET_PORT,
        `127.0.0.1:${OBS_WEBSOCKET_PORT} closed; lane B only — enable the obs-websocket server in OBS settings`
      ),
      probePlaywrightChromium(),
    ],
    { concurrency: "unbounded" }
  );
  return [
    QaProbe.make({ detail: Bun.version, name: "bun", required: true, status: "pass" }),
    ffmpeg,
    ffprobe,
    exiftool,
    playwright,
    obs,
  ];
});
