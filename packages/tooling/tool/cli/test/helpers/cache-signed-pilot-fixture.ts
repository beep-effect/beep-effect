import { cacheSignedCaptureDiagnostic } from "@beep/repo-cli/test/Cache";
import * as A from "effect/Array";
import * as Str from "effect/String";

const digest = Str.repeat(64);
const pin = { version: "2.11.4", sha256: digest("a"), namespace: "team_stable" };
const task = {
  computation: "@beep/identity#lint",
  taskHash: "0123456789abcdef",
  exitCode: 0,
  inputsDigest: digest("b"),
};
const run = (pair: number, role: number) => ({
  id: `pair-${pair}-${role}`,
  root: role === 2 ? "root-b" : "root-a",
  cacheEnabled: role !== 0,
  graphExitCode: 0,
  nativeRuntimeKeyObserved: true,
  sourceTreeUnchanged: true,
  dependencies: [{ ...task, computation: "@beep/types#lint", origin: "fresh" }],
  summarySha256: Str.padStart(64, "0")(`${pair * 3 + role + 1}`),
  outcome: {
    _tag: "Executed",
    selected: { ...task, origin: role === 2 ? "remote-hit" : "fresh" },
    logSha256: digest("c"),
    logBytes: 23,
    replayLogMatches: role !== 0,
  },
});
const event = (pair: number, role: number) => ({
  sequence: role + 1,
  scenario: { id: `pair-${pair}`, fault: "none" },
  operation: role === 1 ? "put" : "get",
  role: role === 2 ? "reader" : "writer",
  status: role === 0 ? 404 : 200,
  artifact: task.taskHash,
  digest: role === 0 ? null : digest("d"),
  bytes: role === 0 ? 0 : 159,
  tagPresent: role !== 0,
});
const baseKey = {
  computation: task.computation,
  layer: "turbo-task-result",
  profile: "test-profile",
  epoch: "test-epoch",
};
const linked = { path: "/fixture/loader", target: "/fixture/loader", sha256: digest("a") };
const staticLink = { _tag: "Static" };
const comparison = (pair: number) => ({
  archive: {
    archiveSha256: digest("d"),
    archiveBytes: 159,
    decodedBytes: 2048,
    path: "packages/foundation/modeling/identity/.turbo/turbo-lint.log",
    logSha256: digest("c"),
    logBytes: 23,
  },
  protection: {
    mechanism: "nested-reader-denial/v1",
    protectedFiles: 2,
    readsDenied: true,
    writesDenied: true,
    writerEnvironmentHidden: true,
    protectedBytesUnchanged: true,
  },
  id: pair,
  authorityRoot: Str.padStart(64, "0")(`${100 + pair * 3}`),
  producerRoot: Str.padStart(64, "0")(`${101 + pair * 3}`),
  replayRoot: Str.padStart(64, "0")(`${102 + pair * 3}`),
  client: { ...pin, namespace: `team_pair_${pair}` },
  authoritative: run(pair, 0),
  producer: run(pair, 1),
  replay: run(pair, 2),
  events: A.map(A.range(0, 2), (role) => event(pair, role)),
});
export const signedPilotInput = {
  schemaVersion: "cache-pilot-signed/v9",
  captureControls: A.map(
    ["credential-output", "terminal-control", "oversized-log", "undeclared-output"] as const,
    (name, index) => ({
      case: name,
      isolationRoot: Str.padStart(64, "0")(`${9100 + index}`),
      summarySha256: Str.padStart(64, "0")(`${9200 + index}`),
      probeSha256: Str.padStart(64, "0")(`${9300 + index}`),
      taskHash: `capture-${index}`,
      selectedExitCode: 0,
      origin: "fresh",
      diagnostic: cacheSignedCaptureDiagnostic(name),
    })
  ),
  authority: "signed-pilot-observation-only",
  network: "private-loopback-nested-readers/v1",
  baseKey,
  key: { ...baseKey, profile: `${baseKey.profile}-private-loopback-signed-v1` },
  sourceRevision: Str.repeat(40)("a"),
  channel: "stable",
  client: pin,
  runtimeKeyDigest: digest("a"),
  runtimeLinker: {
    format: "glibc-ldd/v1",
    detector: linked,
    loader: linked,
    executables: {
      bun: staticLink,
      node: staticLink,
      turbo: staticLink,
      biome: staticLink,
      bash: staticLink,
      sh: staticLink,
    },
  },
  bun: pin,
  biome: pin,
  node: pin,
  installedDependencies: {
    format: "canonical-gnu-tar/v1",
    sha256: digest("a"),
    regularFiles: 1,
    entries: 1,
    bytes: 10,
    links: [],
  },
  activation: { path: "fixture/activation.json", sha256: digest("a") },
  configurationDigest: digest("a"),
  activatedConfigurationDigest: digest("b"),
  signedConfigurationDigest: digest("c"),
  toolchainDigest: digest("a"),
  signedRootConfiguration: digest("a"),
  freshPairs: A.map(
    [
      { pair: 0, leftRoot: "1", rightRoot: "2", leftSummary: "a", rightSummary: "b" },
      { pair: 1, leftRoot: "3", rightRoot: "4", leftSummary: "c", rightSummary: "d" },
      { pair: 2, leftRoot: "5", rightRoot: "6", leftSummary: "e", rightSummary: "f" },
    ],
    ({ pair, leftRoot, rightRoot, leftSummary, rightSummary }) => ({
      id: pair,
      leftRoot: digest(leftRoot),
      rightRoot: digest(rightRoot),
      left: {
        ...run(pair, 0),
        id: `fresh-${pair}-left`,
        selectedTaskInterval: { startTime: 1000 + pair * 1000, endTime: 1800 + pair * 1000 },
        cacheEnabled: true,
        summarySha256: digest(leftSummary),
        outcome: { ...run(pair, 0).outcome, replayLogMatches: true },
      },
      right: {
        ...run(pair, 0),
        id: `fresh-${pair}-right`,
        selectedTaskInterval: { startTime: 1400 + pair * 1000, endTime: 2200 + pair * 1000 },
        root: "root-b",
        cacheEnabled: true,
        summarySha256: digest(rightSummary),
        outcome: { ...run(pair, 0).outcome, replayLogMatches: true },
      },
    })
  ),
  policyRefusal: {
    reason: "missing-child-config",
    removedPath: "packages/foundation/modeling/identity/turbo.json",
    isolationRoot: digest("8"),
    computation: task.computation,
    taskHash: "fedcba9876543210",
    inputsDigest: digest("b"),
    configuration: {
      cache: true,
      inputs: ["$TURBO_DEFAULT$"],
      env: [],
      passThroughEnv: [],
      outputs: [],
      dependsOn: [],
      persistent: false,
      interactive: false,
      interruptible: false,
      outputLogs: "full",
    },
    dryPlanSha256: digest("9"),
    planExitCode: 0,
    nativeRuntimeKeyObserved: false,
    nativeExecutionObserved: false,
    executionSummaries: 0,
    selectedLogFiles: 0,
    guardRejected: true,
  },
  nonExecutions: A.map(
    ["missing-root-config", "malformed-root-config", "malformed-child-config", "absent-script"],
    (reason, index) => ({
      id: reason,
      reason,
      isolationRoot: Str.padStart(64, "0")(`${900 + index}`),
      exitCode: reason === "absent-script" ? 0 : 1,
      stdoutSha256: digest("a"),
      stderrSha256: digest("b"),
      selectedExecutionObserved: false,
      ...(reason === "absent-script" ? { summarySha256: digest("7") } : { diagnostic: reason }),
    })
  ),
  mutations: A.map(
    [
      { case: "root-task-config", changedPath: "turbo.json", seedExit: 0 },
      { case: "child-task-config", changedPath: "packages/foundation/modeling/identity/turbo.json", seedExit: 0 },
      { case: "root-lint-config", changedPath: "biome.jsonc", seedExit: 1 },
      { case: "lockfile", changedPath: "bun.lock", seedExit: 0 },
      { case: "package-manager", changedPath: "package.json", seedExit: 0 },
      { case: "generated-alias", changedPath: "tsconfig.json", seedExit: 0 },
      { case: "dependency-source", changedPath: "packages/foundation/primitive/types/src/index.ts", seedExit: 1 },
    ],
    (variant, index) => {
      const pair = index + 13;
      const seedHash = `00000000000000${index}1`;
      const seed = {
        ...run(pair, 1),
        id: `mutation-${index}-seed`,
        graphExitCode: variant.seedExit,
        summarySha256: Str.padStart(64, "0")(`${100 + index}`),
        outcome: {
          ...run(pair, 1).outcome,
          selected: { ...task, origin: "fresh", taskHash: seedHash, exitCode: variant.seedExit },
        },
      };
      const seedEvents = A.map(A.range(0, variant.seedExit === 0 ? 1 : 0), (role) => ({
        ...event(pair, role),
        artifact: seedHash,
      }));
      return {
        case: variant.case,
        changedPath: variant.changedPath,
        beforeSha256: digest("a"),
        afterSha256: digest("b"),
        seed,
        comparison: {
          ...comparison(pair),
          events: A.appendAll(
            seedEvents,
            A.map(comparison(pair).events, (event) => ({
              ...event,
              sequence: event.sequence + seedEvents.length,
            }))
          ),
        },
      };
    }
  ),
  pairs: A.map(A.range(0, 2), comparison),
  shadows: A.map(
    [
      "baseline",
      "source-comment",
      "added-source",
      "readme",
      "declared-env",
      "declared-env-empty",
      "orchestration-env",
      "locale",
      "timezone",
      "absolute-root",
    ],
    (name, index) => {
      const pair = comparison(index + 3);
      const changed = A.contains(
        ["source-comment", "added-source", "readme", "declared-env", "declared-env-empty"],
        name
      );
      const taskHash = changed ? Str.padStart(16, "0")(`${index + 1}`) : task.taskHash;
      return {
        case: name,
        comparison: {
          ...pair,
          authoritative: {
            ...pair.authoritative,
            outcome: { ...pair.authoritative.outcome, selected: { ...pair.authoritative.outcome.selected, taskHash } },
          },
          producer: {
            ...pair.producer,
            outcome: { ...pair.producer.outcome, selected: { ...pair.producer.outcome.selected, taskHash } },
          },
          replay: {
            ...pair.replay,
            outcome: { ...pair.replay.outcome, selected: { ...pair.replay.outcome.selected, taskHash } },
          },
          events: A.map(pair.events, (event) => ({ ...event, artifact: taskHash })),
        },
      };
    }
  ),
};
