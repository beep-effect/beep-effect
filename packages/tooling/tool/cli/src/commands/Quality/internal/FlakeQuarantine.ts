/**
 * TS2589 flake-quarantine detection and incident schemas for quality lanes.
 *
 * The Effect-patched TS7 native compiler counts type instantiations across four
 * parallel checker threads, so the count on an identical program is
 * scheduling-dependent. Packages with multi-million instantiation mass sit near
 * the TS2589 ceiling, and a full repo sweep under machine load occasionally
 * pushes one of them over it — emitting `error TS2589` with **no file
 * location** on a package that never fails standalone.
 *
 * This module owns the strict signature detection for that flake class plus the
 * schemas used to record a quarantined incident. Execution (captured lane runs,
 * standalone reruns, artifact writes) lives in `commands/Quality/Tasks`; the
 * yeet verdict reads the artifact through {@link FlakeQuarantineArtifact}.
 *
 * A lane failure is quarantinable only when every rule below holds; anything
 * else stays a hard failure:
 *
 * - at least one no-location TS2589 line, each attributed to a Turbo task
 *   prefix (`@scope/pkg:task: error TS2589: ...`),
 * - no other TypeScript diagnostic anywhere in the output (a located TS2589
 *   also disqualifies),
 * - Turbo's `Failed:` footer names at least one task, every failed task is
 *   attributed to a no-location TS2589 line, and at most
 *   {@link MAX_QUARANTINED_TASKS_PER_LANE} tasks failed,
 * - the captured output was not truncated (enforced by the caller, which has
 *   the truncation flag).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { optionalProp } from "../../../internal/cli/OptionRecord.ts";
import { OutputBound, QualityTaskStep, StepFlakeQuarantinePolicy } from "../../../internal/process/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";

const $I = $RepoCliId.create("commands/Quality/internal/FlakeQuarantine");

/**
 * Repo-root-relative path of the flake-quarantine incident artifact.
 *
 * The quality lane runner deletes any stale copy before a policy-carrying lane
 * group starts and writes it only when incidents were quarantined in that run;
 * the yeet verdict reads it right after the proof step finishes.
 *
 * @example
 * ```ts
 * import { FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH } from "@beep/repo-cli/test/Quality"
 *
 * console.log(FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const FLAKE_QUARANTINE_ARTIFACT_RELATIVE_PATH = ".beep/yeet/flake-quarantine.json";

/**
 * Maximum Turbo tasks one lane failure may quarantine.
 *
 * The established flake class strikes one near-ceiling package per lane; a
 * larger failed set is not that class and stays a hard failure.
 *
 * @example
 * ```ts
 * import { MAX_QUARANTINED_TASKS_PER_LANE } from "@beep/repo-cli/test/Quality"
 *
 * console.log(MAX_QUARANTINED_TASKS_PER_LANE)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const MAX_QUARANTINED_TASKS_PER_LANE = 3;

const FLAKE_QUARANTINE_OUTPUT_MAX_CHARS = 4 * 1024 * 1024;

/**
 * Output bound for quarantine-eligible lane captures.
 *
 * Sized far above a full forced pre-push sweep (~0.5 MiB) because a truncated
 * capture cannot prove "the only error output is the TS2589 signature" and
 * therefore disqualifies quarantine.
 *
 * @example
 * ```ts
 * import { flakeQuarantineOutputBound } from "@beep/repo-cli/test/Quality"
 *
 * console.log(flakeQuarantineOutputBound.maxChars)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const flakeQuarantineOutputBound = OutputBound.make({
  maxChars: FLAKE_QUARANTINE_OUTPUT_MAX_CHARS,
  truncatedNotice: `\n[flake-quarantine] output truncated after ${FLAKE_QUARANTINE_OUTPUT_MAX_CHARS} characters`,
});

/**
 * One failed Turbo task attributed to the no-location TS2589 signature.
 *
 * @example
 * ```ts
 * import { FlakeQuarantineTask } from "@beep/repo-cli/test/Quality"
 *
 * const task = FlakeQuarantineTask.make({ taskId: "@beep/box#build", packageName: "@beep/box", task: "build" })
 * console.log(task.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FlakeQuarantineTask extends S.Class<FlakeQuarantineTask>($I`FlakeQuarantineTask`)(
  {
    taskId: S.String,
    packageName: S.String,
    task: S.String,
  },
  $I.annote("FlakeQuarantineTask", {
    description: "One failed Turbo task attributed to the no-location TS2589 flake signature.",
  })
) {}

/**
 * One quarantined environment-only flake incident.
 *
 * Recorded per failed Turbo task after its standalone rerun and the shared
 * lane rerun both came back green.
 *
 * @example
 * ```ts
 * import { FlakeQuarantineIncident } from "@beep/repo-cli/test/Quality"
 *
 * const incident = FlakeQuarantineIncident.make({
 *   policy: "ts2589-no-location",
 *   laneLabel: "quality:build",
 *   taskId: "@beep/box#build",
 *   packageName: "@beep/box",
 *   task: "build",
 *   standaloneCommand: "bun run build -- --filter=@beep/box",
 *   detectedAt: "2026-08-01T00:00:00.000Z",
 *   standaloneDurationMs: 42000,
 *   laneRerunDurationMs: 31000,
 * })
 * console.log(incident.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FlakeQuarantineIncident extends S.Class<FlakeQuarantineIncident>($I`FlakeQuarantineIncident`)(
  {
    policy: StepFlakeQuarantinePolicy,
    laneLabel: S.String,
    taskId: S.String,
    packageName: S.String,
    task: S.String,
    standaloneCommand: S.String,
    detectedAt: S.String,
    standaloneDurationMs: S.Finite,
    laneRerunDurationMs: S.Finite,
  },
  $I.annote("FlakeQuarantineIncident", {
    description: "One environment-only compiler flake quarantined by a quality lane rerun.",
  })
) {}

/**
 * Persisted flake-quarantine artifact read by the yeet verdict.
 *
 * @example
 * ```ts
 * import { FlakeQuarantineArtifact } from "@beep/repo-cli/test/Quality"
 *
 * const artifact = FlakeQuarantineArtifact.make({
 *   schemaVersion: "yeet-flake-quarantine/v1",
 *   incidents: [],
 * })
 * console.log(artifact.schemaVersion)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FlakeQuarantineArtifact extends S.Class<FlakeQuarantineArtifact>($I`FlakeQuarantineArtifact`)(
  {
    schemaVersion: S.Literal("yeet-flake-quarantine/v1"),
    incidents: S.Array(FlakeQuarantineIncident),
  },
  $I.annote("FlakeQuarantineArtifact", {
    description: "Persisted record of environment-only flake incidents quarantined during one quality run.",
  })
) {}

/**
 * JSON-string codec for the flake-quarantine artifact file.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { FlakeQuarantineArtifact, FlakeQuarantineArtifactJson } from "@beep/repo-cli/test/Quality"
 *
 * const artifact = FlakeQuarantineArtifact.make({ schemaVersion: "yeet-flake-quarantine/v1", incidents: [] })
 * console.log(Effect.runSync(FlakeQuarantineArtifactJson.encode(artifact)))
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const FlakeQuarantineArtifactJson = JsonStringCodec(FlakeQuarantineArtifact);

const ANSI_ESCAPE_PATTERN = /\u001B\[[0-9;?]*[0-9A-Za-z]/gu;
const TURBO_TASK_LINE_PREFIX_PATTERN = /^(@[^\s:]+):([^\s:]+): ?(.*)$/u;
const NO_LOCATION_TS2589_PATTERN = /^error TS2589: Type instantiation is excessively deep and possibly infinite\.?/u;
const TS_DIAGNOSTIC_PATTERN = /error TS\d{4,7}:/u;
const TURBO_FAILED_FOOTER_PATTERN = /^Failed:\s+(.+)$/u;
const TURBO_TASK_ID_PATTERN = /^(@[^\s#,]+)#([^\s,]+)$/u;

const stripAnsi: (text: string) => string = Str.replace(ANSI_ESCAPE_PATTERN, "");

type ScannedLine = {
  /** Turbo `package:task` key when the line carried a task prefix. */
  readonly taskKey: O.Option<string>;
  /** The line text with any Turbo task prefix removed, trimmed. */
  readonly body: string;
};

const scanLine = (line: string): ScannedLine => {
  const trimmed = Str.trim(stripAnsi(line));
  return pipe(
    O.fromNullishOr(TURBO_TASK_LINE_PREFIX_PATTERN.exec(trimmed)),
    O.match({
      onNone: () => ({ taskKey: O.none<string>(), body: trimmed }),
      onSome: (match) => ({
        taskKey: O.some(`${match[1]}#${match[2]}`),
        body: Str.trim(match[3] ?? ""),
      }),
    })
  );
};

const failedTaskIdsFromLine = (body: string): ReadonlyArray<string> =>
  pipe(
    O.fromNullishOr(TURBO_FAILED_FOOTER_PATTERN.exec(body)),
    O.map((match) =>
      pipe(
        Str.split(/[,\s]+/u)(match[1] ?? ""),
        A.map(Str.trim),
        A.filter((token) => TURBO_TASK_ID_PATTERN.test(token))
      )
    ),
    O.getOrElse(A.empty<string>)
  );

const taskFromTaskId = (taskId: string): O.Option<FlakeQuarantineTask> =>
  pipe(
    O.fromNullishOr(TURBO_TASK_ID_PATTERN.exec(taskId)),
    O.flatMap((match) =>
      O.zipWith(O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2]), (packageName, task) =>
        FlakeQuarantineTask.make({ taskId, packageName, task })
      )
    )
  );

type Ts2589Scan = {
  readonly attributedTaskKeys: ReadonlyArray<string>;
  readonly unattributedCount: number;
  readonly disqualifyingDiagnosticCount: number;
  readonly failedTaskIds: ReadonlyArray<string>;
};

const emptyTs2589Scan: Ts2589Scan = {
  attributedTaskKeys: A.empty(),
  unattributedCount: 0,
  disqualifyingDiagnosticCount: 0,
  failedTaskIds: A.empty(),
};

const scanOutputForTs2589 = (output: string): Ts2589Scan =>
  pipe(
    Str.split(/\r?\n/u)(output),
    A.map(scanLine),
    A.reduce(emptyTs2589Scan, (scan, line) => {
      if (NO_LOCATION_TS2589_PATTERN.test(line.body)) {
        return O.match(line.taskKey, {
          onNone: () => ({ ...scan, unattributedCount: scan.unattributedCount + 1 }),
          onSome: (taskKey) => ({ ...scan, attributedTaskKeys: A.append(scan.attributedTaskKeys, taskKey) }),
        });
      }
      if (TS_DIAGNOSTIC_PATTERN.test(line.body)) {
        return { ...scan, disqualifyingDiagnosticCount: scan.disqualifyingDiagnosticCount + 1 };
      }
      return { ...scan, failedTaskIds: A.appendAll(scan.failedTaskIds, failedTaskIdsFromLine(line.body)) };
    })
  );

/**
 * Decide whether a failed lane output matches the no-location TS2589 flake
 * signature, returning the failed Turbo tasks to rerun standalone.
 *
 * Returns `None` — keep the failure hard — unless every strictness rule in the
 * module documentation holds. The caller must additionally reject truncated
 * captures before consulting this.
 *
 * @param output - Full captured lane output (stdout+stderr interleaved).
 * @returns Failed tasks from Turbo's `Failed:` footer when quarantinable.
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { detectNoLocationTs2589Flake } from "@beep/repo-cli/test/Quality"
 *
 * const output = [
 *   "@beep/box:build: error TS2589: Type instantiation is excessively deep and possibly infinite.",
 *   "Failed:    @beep/box#build",
 * ].join("\n")
 * console.log(O.isSome(detectNoLocationTs2589Flake(output)))
 * ```
 * @category detection
 * @since 0.0.0
 */
export const detectNoLocationTs2589Flake = (output: string): O.Option<A.NonEmptyReadonlyArray<FlakeQuarantineTask>> => {
  const scan = scanOutputForTs2589(output);
  if (scan.unattributedCount > 0 || scan.disqualifyingDiagnosticCount > 0) {
    return O.none();
  }
  if (A.isReadonlyArrayEmpty(scan.attributedTaskKeys)) {
    return O.none();
  }

  const failedTaskIds = A.dedupe(scan.failedTaskIds);
  if (A.isReadonlyArrayEmpty(failedTaskIds) || A.length(failedTaskIds) > MAX_QUARANTINED_TASKS_PER_LANE) {
    return O.none();
  }
  if (!A.every(failedTaskIds, (taskId) => A.contains(scan.attributedTaskKeys, taskId))) {
    return O.none();
  }

  return pipe(
    failedTaskIds,
    A.map(taskFromTaskId),
    A.getSomes,
    A.match({
      onEmpty: O.none<A.NonEmptyReadonlyArray<FlakeQuarantineTask>>,
      onNonEmpty: O.some,
    })
  );
};

/**
 * Build the standalone rerun step for one quarantined Turbo task.
 *
 * Reuses the lane's `bun run <script>` invocation with an explicit package
 * filter appended and the lane's environment preserved verbatim. Preserving an
 * inherited `TURBO_FORCE=true` is deliberate: under a forced sweep an older
 * successful cache entry can exist at the failed task's unchanged hash, and a
 * cache-reading rerun would replay it without invoking the compiler — a
 * vacuous green. Keeping the lane's forcing guarantees the environment-only
 * attribution rests on a real execution; without forcing, a flake implies a
 * cache miss, so the task executes either way.
 *
 * @param step - The failed quarantine-eligible lane step.
 * @param task - One failed Turbo task attributed to the flake signature.
 * @returns Step running only that package's lane standalone.
 * @example
 * ```ts
 * import { FlakeQuarantineTask, QualityTaskStep, standaloneQuarantineRerunStep } from "@beep/repo-cli/test/Quality"
 *
 * const lane = QualityTaskStep.make({ label: "quality:build", command: "bun", args: ["run", "build"], cwd: "/repo" })
 * const task = FlakeQuarantineTask.make({ taskId: "@beep/box#build", packageName: "@beep/box", task: "build" })
 * console.log(standaloneQuarantineRerunStep(lane, task).args)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const standaloneQuarantineRerunStep = (step: QualityTaskStep, task: FlakeQuarantineTask): QualityTaskStep =>
  QualityTaskStep.make({
    label: `${step.label}:flake-rerun:${task.packageName}`,
    command: step.command,
    args: [...step.args, "--", `--filter=${task.packageName}`],
    cwd: step.cwd,
    ...optionalProp("env", O.fromUndefinedOr(step.env)),
  });

/**
 * Build the full lane rerun step that arbitrates a quarantine attempt.
 *
 * Reruns the identical lane with the quarantine policy stripped (no recursive
 * quarantine) and `TURBO_FORCE` removed so tasks proven green in the failed
 * run replay from the cache that run wrote, while tasks Turbo skipped after
 * the flake actually execute.
 *
 * @param step - The failed quarantine-eligible lane step.
 * @returns Step rerunning the whole lane once.
 * @example
 * ```ts
 * import { laneQuarantineRerunStep, QualityTaskStep } from "@beep/repo-cli/test/Quality"
 *
 * const lane = QualityTaskStep.make({ label: "quality:build", command: "bun", args: ["run", "build"], cwd: "/repo" })
 * console.log(laneQuarantineRerunStep(lane).label)
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const laneQuarantineRerunStep = (step: QualityTaskStep): QualityTaskStep =>
  QualityTaskStep.make({
    label: `${step.label}:flake-lane-rerun`,
    command: step.command,
    args: step.args,
    cwd: step.cwd,
    env: { ...(step.env ?? {}), TURBO_FORCE: undefined },
  });
