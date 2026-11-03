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
import { decodeYamlTextWith } from "@beep/repo-cli-kit/schema/TextCodec";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import { A, Str, thunkFalse } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import {
  VersionCategoryReport,
  VersionDriftItem,
  VersionSyncError,
  versionCategoryStatusFromDrift,
} from "../../VersionSync.schemas.ts";

const $I = $RepoCliId.create("commands/VersionSync/internal/resolvers/NodeResolver");
// ── Types ───────────────────────────────────────────────────────────────────

/**
 * A workflow file location with a `node-version` field.
 *
 * @category models
 * @since 0.0.0
 */
export class NodeVersionLocation extends S.Opaque<NodeVersionLocation, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    jobName: S.String,
    stepIndex: S.Natural,
    currentValue: S.String,
    yamlPath: S.Array(S.Union([S.String, S.Finite])),
  }).pipe(
    $I.annoteSchema("NodeVersionLocation", {
      description: "A workflow file location with a node-version field.",
    })
  )
) {}

/**
 * Resolved Node version state.
 *
 * @category models
 * @since 0.0.0
 */
export class NodeVersionState extends S.Opaque<NodeVersionState, { readonly brand: unique symbol }>()(
  S.Struct({
    nvmrc: S.String,
    workflowLocations: S.Array(NodeVersionLocation),
  }).pipe(
    $I.annoteSchema("NodeVersionState", {
      description: "Resolved Node version state.",
    })
  )
) {}

class WorkflowSetupNodeWith extends S.Opaque<WorkflowSetupNodeWith, { readonly brand: unique symbol }>()(
  S.Struct({
    "node-version": S.optionalKey(S.Unknown),
    "node-version-file": S.optionalKey(S.Unknown),
  }).pipe(
    $I.annoteSchema("WorkflowSetupNodeWith", {
      description: "Subset of a workflow step with-block relevant to Node version pinning.",
    })
  )
) {}

class WorkflowStep extends S.Opaque<WorkflowStep, { readonly brand: unique symbol }>()(
  S.Struct({
    with: S.optionalKey(WorkflowSetupNodeWith),
  }).pipe(
    $I.annoteSchema("WorkflowStep", {
      description: "Subset of GitHub workflow step fields required for node-version discovery.",
    })
  )
) {}

class WorkflowJob extends S.Opaque<WorkflowJob, { readonly brand: unique symbol }>()(
  S.Struct({
    steps: ArrayKeyDefaultEmpty(WorkflowStep),
  }).pipe(
    $I.annoteSchema("WorkflowJob", {
      description: "Subset of GitHub workflow job fields required for node-version discovery.",
    })
  )
) {}

class WorkflowDocument extends S.Opaque<WorkflowDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    jobs: S.Record(S.String, WorkflowJob).pipe(
      S.withConstructorDefault(Effect.succeed(R.empty<string, WorkflowJob>())),
      S.withDecodingDefaultKey(Effect.succeed(R.empty<string, WorkflowJob>()))
    ),
  }).pipe(
    $I.annoteSchema("WorkflowDocument", {
      description: "Subset of GitHub workflow YAML fields required for node-version discovery.",
    })
  )
) {}

const decodeWorkflowDocument = decodeYamlTextWith(S.decodeUnknownEffect(WorkflowDocument));

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

// These canonical coverage jobs (the unit and Labs producers and their
// comparison) preserve the legacy Node22/V8 measurement engine. Heavy's matrix
// pin remains covered by the templated-value rule below; ordinary jobs still
// follow .nvmrc. Keep this exception tied to the actual workflow, job IDs, and
// reviewed runtime pin.
const isCanonicalCoverageRuntimePin = S.is(
  S.Struct({
    file: S.tag(".github/workflows/check.yml"),
    jobName: S.Literals(["test-unit-shard", "labs", "coverage-regression"]),
    currentValue: S.tag("22.23.4"),
  })
);

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

  const workflow = yield* decodeWorkflowDocument(content).pipe(
    VersionSyncError.mapError("Failed to parse workflow YAML", relativeFile)
  );

  const steps = A.flatMap(R.toEntries(workflow.jobs), ([jobName, job]) =>
    A.map(job.steps, (step, stepIdx) => ({ jobName, stepIdx, step }))
  );
  for (const { jobName, stepIdx, step } of steps) {
    const withBlock = step.with;
    if (withBlock === undefined || withBlock["node-version"] === undefined) {
      continue;
    }

    if (withBlock["node-version-file"] !== undefined) {
      continue;
    }

    const nodeVersion = nodeVersionString(withBlock["node-version"]);
    // A templated value (for example a matrix-driven per-lane override that
    // falls back to .nvmrc when empty) cannot be asserted at lint time.
    if (
      Str.includes("${{")(nodeVersion) ||
      isCanonicalCoverageRuntimePin({ file: relativeFile, jobName, currentValue: nodeVersion })
    ) {
      continue;
    }
    locations = A.append(
      locations,
      NodeVersionLocation.make({
        file: relativeFile,
        jobName,
        stepIndex: S.Natural.make(stepIdx),
        currentValue: nodeVersion,
        yamlPath: ["jobs", jobName, "steps", stepIdx, "with", "node-version"],
      })
    );
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
    status: versionCategoryStatusFromDrift(items),
    items,
    latest: O.none(),
    error: O.none(),
  });
};
