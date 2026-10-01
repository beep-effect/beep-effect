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
  summarySha256: digest(`${pair * 3 + role + 1}`),
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
export const signedPilotInput = {
  schemaVersion: "cache-pilot-signed/v2",
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
  toolchainDigest: digest("a"),
  signedRootConfiguration: digest("a"),
  pairs: A.map(A.range(0, 2), (pair) => ({
    protection: {
      mechanism: "nested-reader-denial/v1",
      protectedFiles: 2,
      readsDenied: true,
      writesDenied: true,
      writerEnvironmentHidden: true,
      protectedBytesUnchanged: true,
    },
    id: pair,
    client: { ...pin, namespace: `team_pair_${pair}` },
    authoritative: run(pair, 0),
    producer: run(pair, 1),
    replay: run(pair, 2),
    events: A.map(A.range(0, 2), (role) => event(pair, role)),
  })),
};
