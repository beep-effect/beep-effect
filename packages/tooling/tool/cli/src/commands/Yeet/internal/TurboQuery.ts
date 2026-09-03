/**
 * Turbo query snapshot collection for Yeet planning.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { jsonObjectTextFromMixedOutput } from "../../../internal/cli/MixedOutputJson.ts";
import {
  resolveLocalRepoBinary,
  runRepoCommandCapture,
  TurboPlanSnapshot,
  TurboPlanTask,
  TurboWorkspacePackage,
} from "../../../internal/repo-run/index.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { emptyTurboPlanSnapshot, YEET_FEEDBACK_TASKS, YeetRunMode } from "./Planner.ts";
import type { FileSystem, Path } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { YeetRunOptions } from "../Yeet.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/TurboQuery");

class TurboQueryAffectedReason extends S.Class<TurboQueryAffectedReason>($I`TurboQueryAffectedReason`)(
  {
    __typename: S.String,
  },
  $I.annote("TurboQueryAffectedReason", {
    description: "Turbo affected query reason metadata.",
  })
) {}

class TurboQueryAffectedPackageRef extends S.Class<TurboQueryAffectedPackageRef>($I`TurboQueryAffectedPackageRef`)(
  {
    name: S.String,
  },
  $I.annote("TurboQueryAffectedPackageRef", {
    description: "Package reference nested in a Turbo affected task result.",
  })
) {}

class TurboQueryAffectedTask extends S.Class<TurboQueryAffectedTask>($I`TurboQueryAffectedTask`)(
  {
    fullName: S.String,
    name: S.String,
    package: TurboQueryAffectedPackageRef,
    reason: S.optionalKey(TurboQueryAffectedReason),
  },
  $I.annote("TurboQueryAffectedTask", {
    description: "One task returned by Turbo query affected.",
  })
) {}

class TurboQueryAffectedTaskConnection extends S.Class<TurboQueryAffectedTaskConnection>(
  $I`TurboQueryAffectedTaskConnection`
)(
  {
    items: S.Array(TurboQueryAffectedTask),
    length: S.Finite,
  },
  $I.annote("TurboQueryAffectedTaskConnection", {
    description: "Turbo affected task connection payload.",
  })
) {}

class TurboQueryAffectedData extends S.Class<TurboQueryAffectedData>($I`TurboQueryAffectedData`)(
  {
    affectedTasks: TurboQueryAffectedTaskConnection,
  },
  $I.annote("TurboQueryAffectedData", {
    description: "Data payload returned by Turbo query affected.",
  })
) {}

class TurboQueryAffectedDocument extends S.Class<TurboQueryAffectedDocument>($I`TurboQueryAffectedDocument`)(
  {
    data: TurboQueryAffectedData,
  },
  $I.annote("TurboQueryAffectedDocument", {
    description: "Turbo query affected JSON document.",
  })
) {}

class TurboQueryPackage extends S.Class<TurboQueryPackage>($I`TurboQueryPackage`)(
  {
    name: S.String,
    path: S.String,
  },
  $I.annote("TurboQueryPackage", {
    description: "One workspace package returned by Turbo query ls.",
  })
) {}

class TurboQueryPackageConnection extends S.Class<TurboQueryPackageConnection>($I`TurboQueryPackageConnection`)(
  {
    count: S.Finite,
    items: S.Array(TurboQueryPackage),
  },
  $I.annote("TurboQueryPackageConnection", {
    description: "Turbo package list connection payload.",
  })
) {}

class TurboQueryLsDocument extends S.Class<TurboQueryLsDocument>($I`TurboQueryLsDocument`)(
  {
    packageManager: S.optionalKey(S.String),
    packages: TurboQueryPackageConnection,
  },
  $I.annote("TurboQueryLsDocument", {
    description: "Turbo query ls JSON document.",
  })
) {}

const decodeTurboQueryAffectedDocument = S.decodeUnknownEffect(S.fromJsonString(TurboQueryAffectedDocument));
const decodeTurboQueryLsDocument = S.decodeUnknownEffect(S.fromJsonString(TurboQueryLsDocument));

const shouldCollectAffectedFeedbackTasks = (mode: YeetRunMode): boolean =>
  YeetRunMode.$match(mode, {
    closeout: () => false,
    publish: () => false,
    repair: () => true,
    verify: () => false,
    monitor: () => false,
    status: () => false,
    "pre-push-hook": () => false,
  });

/**
 * Extract the last decodable JSON object from mixed command output for tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const jsonObjectTextFromMixedOutputForTesting = jsonObjectTextFromMixedOutput;

const runTurboQueryJson = Effect.fn("Yeet.runTurboQueryJson")(function* (
  repoRoot: string,
  args: ReadonlyArray<string>,
  label: string
): Effect.fn.Return<
  string,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turbo = yield* resolveLocalRepoBinary(repoRoot, "turbo");
  const result = yield* runRepoCommandCapture(turbo, args, repoRoot).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to run ${label}.`))
  );
  if (result.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${label} failed with exit code ${result.exitCode}.`,
      command: `${turbo} ${A.join(args, " ")}`,
      exitCode: result.exitCode,
    });
  }
  if (result.truncated) {
    return yield* YeetCommandError.make({
      message: `${label} output exceeded the repo-run capture limit.`,
      command: `${turbo} ${A.join(args, " ")}`,
      exitCode: 1,
    });
  }

  return yield* pipe(
    jsonObjectTextFromMixedOutput(result.output),
    Effect.fromOption(() =>
      YeetCommandError.make({
        message: `${label} did not emit a JSON object.`,
        command: `${turbo} ${A.join(args, " ")}`,
        exitCode: 1,
      })
    )
  );
});

const collectTurboVersion = Effect.fn("Yeet.collectTurboVersion")(function* (
  repoRoot: string
): Effect.fn.Return<
  O.Option<string>,
  never,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turbo = yield* resolveLocalRepoBinary(repoRoot, "turbo");
  const result = yield* runRepoCommandCapture(turbo, ["--version"], repoRoot).pipe(Effect.option);
  return pipe(
    result,
    O.filter((output) => output.exitCode === 0),
    O.map((output) => Str.trim(output.output)),
    O.filter(Str.isNonEmpty)
  );
});

const packagePathsByName = (document: TurboQueryLsDocument): Record<string, string> =>
  pipe(
    document.packages.items,
    A.map((pkg) => [pkg.name, pkg.path] as const),
    R.fromEntries
  );

const turboWorkspacePackageFromQueryPackage = (pkg: TurboQueryPackage): TurboWorkspacePackage =>
  TurboWorkspacePackage.make({
    name: pkg.name,
    path: pkg.path,
  });

const turboWorkspacePackagesFromQueryDocument = (
  document: TurboQueryLsDocument
): ReadonlyArray<TurboWorkspacePackage> => pipe(document.packages.items, A.map(turboWorkspacePackageFromQueryPackage));

const turboPlanTaskFromAffectedTask =
  (pathsByName: Record<string, string>) =>
  (task: TurboQueryAffectedTask): TurboPlanTask => {
    const packagePath = R.get(pathsByName, task.package.name);
    return TurboPlanTask.make({
      taskId: task.fullName,
      packageName: task.package.name,
      task: task.name,
      ...(O.isSome(packagePath) ? { packagePath: packagePath.value } : {}),
    });
  };

const turboPlanTasksFromQueryDocuments = (
  affectedDocument: TurboQueryAffectedDocument,
  packageDocument: TurboQueryLsDocument
): ReadonlyArray<TurboPlanTask> => {
  const pathsByName = packagePathsByName(packageDocument);
  return pipe(affectedDocument.data.affectedTasks.items, A.map(turboPlanTaskFromAffectedTask(pathsByName)));
};

const collectAffectedFeedbackTasks = Effect.fn("Yeet.collectAffectedFeedbackTasks")(function* (
  repoRoot: string,
  options: YeetRunOptions,
  packageDocument: TurboQueryLsDocument
): Effect.fn.Return<
  ReadonlyArray<TurboPlanTask>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  if (!shouldCollectAffectedFeedbackTasks(options.mode)) {
    return [];
  }

  const affectedJson = yield* runTurboQueryJson(
    repoRoot,
    ["query", "affected", "--tasks", ...YEET_FEEDBACK_TASKS, "--base", options.base, "--head", options.head],
    "turbo query affected"
  );
  const affectedDocument = yield* decodeTurboQueryAffectedDocument(affectedJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo affected query JSON."))
  );
  return turboPlanTasksFromQueryDocuments(affectedDocument, packageDocument);
});

const decodeTurboPlanTasksFromQueryJson = Effect.fn("Yeet.decodeTurboPlanTasksFromQueryJson")(function* (
  affectedJson: string,
  packageJson: string
): Effect.fn.Return<ReadonlyArray<TurboPlanTask>, YeetCommandError> {
  const affectedDocument = yield* decodeTurboQueryAffectedDocument(affectedJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo affected query JSON."))
  );
  const packageDocument = yield* decodeTurboQueryLsDocument(packageJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo package query JSON."))
  );
  return turboPlanTasksFromQueryDocuments(affectedDocument, packageDocument);
});

/**
 * Decode Turbo query JSON into Yeet Turbo plan task metadata for focused tests.
 *
 * @category testing
 * @since 0.0.0
 */
export const decodeTurboPlanTasksFromQueryJsonForTesting = decodeTurboPlanTasksFromQueryJson;

/**
 * Collect the Turbo package catalog and affected feedback-task snapshot.
 *
 * **Example** (Collect turbo plan snapshot)
 *
 * ```ts
 * import { collectTurboPlanSnapshot, defaultYeetRunOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(collectTurboPlanSnapshot(".", defaultYeetRunOptions()))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const collectTurboPlanSnapshot = Effect.fn("Yeet.collectTurboPlanSnapshot")(function* (
  repoRoot: string,
  options: YeetRunOptions
): Effect.fn.Return<
  TurboPlanSnapshot,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const turboVersion = yield* collectTurboVersion(repoRoot);
  const packageJson = yield* runTurboQueryJson(repoRoot, ["query", "ls", "--output", "json"], "turbo query ls");
  const packageDocument = yield* decodeTurboQueryLsDocument(packageJson).pipe(
    Effect.mapError(YeetCommandError.new("Failed to decode Turbo package query JSON."))
  );
  const tasks = yield* collectAffectedFeedbackTasks(repoRoot, options, packageDocument);
  const packages = turboWorkspacePackagesFromQueryDocument(packageDocument);

  return TurboPlanSnapshot.make({
    ...emptyTurboPlanSnapshot([]),
    ...(O.isSome(turboVersion) ? { turboVersion: turboVersion.value } : {}),
    packages,
    tasks,
  });
});
