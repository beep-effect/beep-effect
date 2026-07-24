/**
 * Node.js version resolver.
 *
 * Reads `.nvmrc` as the source of truth and scans GitHub workflow YAML files
 * for `node-version:` fields that should match.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { NonNegativeInt } from "@beep/schema";
import { decodeYamlTextAs } from "@beep/schema/Yaml";
import { A, Str, thunkFalse } from "@beep/utils";
import { Effect, FileSystem, identity, Path, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  VersionCategoryReport,
  VersionCategoryStatusThunk,
  VersionDriftItem,
  VersionSyncError,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/NodeResolver");
// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A workflow file location with a `node-version` field.
 *
 * @category models
 * @since 0.0.0
 */
export class NodeVersionLocation extends S.Class<NodeVersionLocation>($I`NodeVersionLocation`)(
  {
    file: S.String,
    jobName: S.String,
    stepIndex: NonNegativeInt,
    currentValue: S.String,
    yamlPath: S.Array(S.Union([S.String, S.Finite])),
  },
  $I.annote("NodeVersionLocation", {
    description: "A workflow file location with a node-version field.",
  })
) {}

/**
 * Resolved Node version state.
 *
 * @category models
 * @since 0.0.0
 */
export class NodeVersionState extends S.Class<NodeVersionState>($I`NodeVersionState`)(
  {
    nvmrc: S.String,
    workflowLocations: S.Array(NodeVersionLocation),
  },
  $I.annote("NodeVersionState", {
    description: "Resolved Node version state.",
  })
) {}

class WorkflowSetupNodeWith extends S.Class<WorkflowSetupNodeWith>($I`WorkflowSetupNodeWith`)(
  {
    "node-version": S.optionalKey(S.Unknown),
    "node-version-file": S.optionalKey(S.Unknown),
  },
  $I.annote("WorkflowSetupNodeWith", {
    description: "Subset of a workflow step with-block relevant to Node version pinning.",
  })
) {}

class WorkflowStep extends S.Class<WorkflowStep>($I`WorkflowStep`)(
  {
    with: S.optionalKey(WorkflowSetupNodeWith),
  },
  $I.annote("WorkflowStep", {
    description: "Subset of GitHub workflow step fields required for node-version discovery.",
  })
) {}

class WorkflowJob extends S.Class<WorkflowJob>($I`WorkflowJob`)(
  {
    steps: S.Array(WorkflowStep).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<WorkflowStep>())),
      S.withDecodingDefault(Effect.succeed(A.empty<WorkflowStep>()))
    ),
  },
  $I.annote("WorkflowJob", {
    description: "Subset of GitHub workflow job fields required for node-version discovery.",
  })
) {}

class WorkflowDocument extends S.Class<WorkflowDocument>($I`WorkflowDocument`)(
  {
    jobs: S.Record(S.String, WorkflowJob).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, WorkflowJob>())),
      S.withDecodingDefault(Effect.succeed(R.empty<string, WorkflowJob>()))
    ),
  },
  $I.annote("WorkflowDocument", {
    description: "Subset of GitHub workflow YAML fields required for node-version discovery.",
  })
) {}

const UnknownNodeVersionValueToString = S.Unknown.pipe(
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (value) => `${value}`,
      encode: identity,
    })
  ),
  $I.annoteSchema("UnknownNodeVersionValueToString", {
    description: "Schema transformation that normalizes unknown workflow node-version values into strings.",
  })
);

const decodeNodeVersionString = S.decodeUnknownOption(UnknownNodeVersionValueToString);
const nodeVersionString = (value: unknown): string => O.getOrElse(decodeNodeVersionString(value), () => `${value}`);

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve Node.js version state from `.nvmrc` and workflow files.
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveNodeVersions: (
  repoRoot: string
) => Effect.Effect<NodeVersionState, VersionSyncError, FileSystem.FileSystem | Path.Path> = Effect.fn(
  "resolveNodeVersions"
)(function* (repoRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // Read .nvmrc
  const nvmrcPath = path.join(repoRoot, ".nvmrc");
  const nvmrc = yield* fs
    .readFileString(nvmrcPath)
    .pipe(Effect.map(Str.trim), VersionSyncError.mapError("Failed to read .nvmrc", ".nvmrc"));

  // Scan workflow files
  const workflowDir = path.join(repoRoot, ".github", "workflows");
  const workflowDirExists = yield* fs.exists(workflowDir).pipe(Effect.orElseSucceed(thunkFalse));

  if (!workflowDirExists) {
    return NodeVersionState.make({ nvmrc, workflowLocations: A.empty<NodeVersionLocation>() });
  }

  const entries = yield* fs.readDirectory(workflowDir).pipe(Effect.orElseSucceed(A.empty<string>));

  const ymlFiles = A.filter(entries, P.or(Str.endsWith(".yml"), Str.endsWith(".yaml")));

  let locations = A.empty<NodeVersionLocation>();

  for (const ymlFile of ymlFiles) {
    const relativeFile = `.github/workflows/${ymlFile}`;
    const filePath = path.join(workflowDir, ymlFile);
    const content = yield* fs
      .readFileString(filePath)
      .pipe(VersionSyncError.mapError("Failed to read workflow file", relativeFile));

    const found = yield* findNodeVersionLocations(content, relativeFile);
    for (const loc of found) {
      locations = A.append(locations, loc);
    }
  }

  return NodeVersionState.make({ nvmrc, workflowLocations: locations });
});

/**
 * Find `node-version:` field locations in a workflow YAML document.
 *
 * @param content - The raw YAML content of the workflow file.
 * @param relativeFile - The relative path to the workflow file.
 * @returns An array of locations where `node-version` is declared.
 * @category utilities
 * @since 0.0.0
 */
const findNodeVersionLocations: (
  content: string,
  relativeFile: string
) => Effect.Effect<Array<NodeVersionLocation>, VersionSyncError> = Effect.fn(function* (content, relativeFile) {
  let locations = A.empty<NodeVersionLocation>();

  const workflow = yield* decodeYamlTextAs(WorkflowDocument)(content).pipe(
    VersionSyncError.mapError("Failed to parse workflow YAML", relativeFile)
  );

  for (const jobName of R.keys(workflow.jobs)) {
    const job = workflow.jobs[jobName];

    for (let stepIdx = 0; stepIdx < A.length(job.steps); stepIdx += 1) {
      const step = job.steps[stepIdx];
      const withBlock = step.with;
      if (withBlock === undefined || withBlock["node-version"] === undefined) {
        continue;
      }

      if (withBlock["node-version-file"] !== undefined) {
        continue;
      }

      const nodeVersion = nodeVersionString(withBlock["node-version"]);
      locations = A.append(
        locations,
        NodeVersionLocation.make({
          file: relativeFile,
          jobName,
          stepIndex: NonNegativeInt.make(stepIdx),
          currentValue: nodeVersion,
          yamlPath: ["jobs", jobName, "steps", stepIdx, "with", "node-version"],
        })
      );
    }
  }

  return locations;
});

/**
 * Build the Node category report from resolved state.
 *
 * @param state - The resolved Node version state.
 * @returns The version category report for Node.js.
 * @category utilities
 * @since 0.0.0
 */
export const buildNodeReport: (state: NodeVersionState) => VersionCategoryReport = (state) => {
  let items = A.empty<VersionDriftItem>();

  for (const loc of state.workflowLocations) {
    if (!Str.equivalence(loc.currentValue, state.nvmrc)) {
      items = A.append(
        items,
        VersionDriftItem.make({
          file: loc.file,
          field: `node-version (${loc.jobName}, step ${loc.stepIndex})`,
          current: loc.currentValue,
          expected: state.nvmrc,
          line: O.none(),
        })
      );
    }
  }

  return VersionCategoryReport.cases.node.make({
    status: A.match(items, {
      onEmpty: VersionCategoryStatusThunk.ok,
      onNonEmpty: VersionCategoryStatusThunk.drift,
    }),
    items,
    latest: O.none(),
    error: O.none(),
  });
};
