import { Git } from "@beep/git/Git";
import {
  CacheConformanceComparison,
  CacheConformanceEvidence,
  CacheConformanceEvidenceCheck,
  CacheConformanceLoadEnvelope,
  CacheConformancePaths,
  CacheConformanceRubric,
  CacheConformanceRun,
  CacheConformanceTarget,
  CacheQualificationService,
  cacheConformanceLoadEnvelopePath,
  cacheConformancePinsPath,
} from "@beep/repo-cli/commands/Cache";
import { makeCacheCommandForTesting } from "@beep/repo-cli/test/Cache";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { goodMode, makeConformanceServer, repoRoot, secrets, targetFor } from "./cache-conformance-server.ts";

afterEach(() => vi.restoreAllMocks());

it.prop(
  "round-trips evidence checks through their JSON codec",
  { value: Arbitrary.schema(CacheConformanceEvidenceCheck) },
  ({ value }) => {
    const codec = S.fromJsonString(CacheConformanceEvidenceCheck);
    const decoded = S.encodeResult(codec)(value).pipe(Result.getOrThrow, S.decodeResult(codec), Result.getOrThrow);
    expect(S.toEquivalence(CacheConformanceEvidenceCheck)(value, decoded)).toBe(true);
  },
  { arbitrary: fcRuns(20) }
);

const Services = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  Git.layer.pipe(Layer.provide(NodeServices.layer))
);

const encodeTarget = S.encodeEffect(S.fromJsonString(CacheConformanceTarget));
const encodeEnvelope = S.encodeEffect(S.fromJsonString(CacheConformanceLoadEnvelope));
const encodeEvidence = S.encodeEffect(S.fromJsonString(CacheConformanceEvidence));
const decodeRun = S.decodeEffect(S.fromJsonString(CacheConformanceRun));
const decodeComparison = S.decodeEffect(S.fromJsonString(CacheConformanceComparison));
const consoleText = TestConsole.logLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));
const errorText = TestConsole.errorLines.pipe(Effect.map(A.filter(P.isString)), Effect.map(A.join("\n")));

// The qualification authority is never reached by the conformance subcommands.
const unusedQualification = Layer.succeed(
  CacheQualificationService,
  CacheQualificationService.of({
    remoteReads: Effect.fn("CacheQualificationService.remoteReads")(() => Effect.die("unexpected remote-reads")),
    audit: Effect.fn("CacheQualificationService.audit")(() => Effect.die("unexpected audit")),
    inspect: Effect.fn("CacheQualificationService.inspect")(() => Effect.die("unexpected inspect")),
    fingerprint: Effect.fn("CacheQualificationService.fingerprint")(() => Effect.die("unexpected fingerprint")),
    baseline: Effect.fn("CacheQualificationService.baseline")(() => Effect.die("unexpected baseline")),
    transition: Effect.fn("CacheQualificationService.transition")(() => Effect.die("unexpected transition")),
    activation: Effect.fn("CacheQualificationService.activation")(() => Effect.die("unexpected activation")),
  })
);

// A small envelope keeps the lab command's measured steps fast.
const envelope = CacheConformanceLoadEnvelope.make({
  schemaVersion: "cache-conformance-load-envelope/v1",
  artifactSizes: {
    p50Bytes: S.Natural.make(64),
    p95Bytes: S.Natural.make(512),
    p99Bytes: S.Natural.make(1024),
    maxBytes: S.Natural.make(2048),
  },
  concurrency: { readPeak: S.Natural.make(2), writePeak: S.Natural.make(1), censored: true },
  envelope: {
    payloadBytes: S.Natural.make(1536),
    readConcurrency: S.Natural.make(3),
    writeConcurrency: S.Natural.make(2),
  },
});

const copied = [
  CacheConformancePaths.openapi,
  CacheConformancePaths.plan,
  CacheConformanceRubric.path,
  cacheConformancePinsPath,
];

// An isolated checkout root with the vendored inputs; commands resolve every
// repository path from `process.cwd()`, which the test points here.
const workspace = Effect.fn("ConformanceCommandTest.workspace")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const source = yield* repoRoot;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-command-" });
  for (const relative of copied) {
    yield* fs.makeDirectory(path.dirname(path.join(root, relative)), { recursive: true });
    yield* fs.copyFile(path.join(source, relative), path.join(root, relative));
  }
  const argument = path.join(root, cacheConformanceLoadEnvelopePath);
  const encodedEnvelope = yield* encodeEnvelope(envelope);
  yield* fs.writeFileString(argument, encodedEnvelope);
  vi.spyOn(process, "cwd").mockReturnValue(root);
  const run = Command.runWith(makeCacheCommandForTesting(unusedQualification), { version: "0.0.0" });
  const env = {
    READER: secrets.reader,
    WRITER: secrets.writer,
    FOREIGN: secrets.foreign,
    UNKNOWN: secrets.unknown,
    HOME: path.join(root, "home"),
  };
  return {
    fs,
    path,
    root,
    file: (name: string) => path.join(root, name),
    run: (args: ReadonlyArray<string>, overrides: Readonly<Record<string, string>> = {}) =>
      run(args).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord({ ...env, ...overrides }))
      ),
  };
});

const writeTarget = Effect.fn("ConformanceCommandTest.writeTarget")(function* (file: string, url: string) {
  const fs = yield* FileSystem.FileSystem;
  const encodedTarget = yield* encodeTarget(targetFor({ url }));
  yield* fs.writeFileString(file, encodedTarget);
});

it.layer(Services, { timeout: "180 seconds", excludeTestServices: true })("cache conformance commands", (it) => {
  it.effect("generates the corpus and detects drift through the command surface", () =>
    Effect.gen(function* () {
      const w = yield* workspace();
      yield* w.run(["conformance-corpus"]);
      const corpus = w.file(CacheConformancePaths.corpus);
      const exists1 = yield* w.fs.exists(corpus);
      expect(exists1).toBe(true);
      yield* w.run(["conformance-corpus", "--check"]);
      const text = yield* consoleText;
      expect(text).toContain("written.");
      expect(text).toContain("is current.");
      const argument1 = Str.replace("RC-032", "RC-099");
      const readFileString1 = yield* w.fs.readFileString(corpus);
      yield* w.fs.writeFileString(corpus, argument1(readFileString1));
      const pipe2 = yield* w.run(["conformance-corpus", "--check"]).pipe(Effect.isFailure);
      expect(pipe2).toBe(true);
      const errorText3 = yield* errorText;
      expect(errorText3).toContain("is stale");
    })
  );

  it.effect("runs, measures and compares a loopback target end to end", () =>
    Effect.gen(function* () {
      const w = yield* workspace();
      const server = yield* makeConformanceServer(goodMode);
      const target = w.file("target.json");
      yield* writeTarget(target, server.url);
      const wire = w.file("runs/wire.json");
      const lab = w.file("runs/lab.json");
      yield* w.fs.makeDirectory(w.file("runs"), { recursive: true });
      yield* w.run(["conformance-run", "--target", target, "--output", wire]);
      yield* w.run(["conformance-lab", "--target", target, "--output", lab]);
      const readFileString4 = yield* w.fs.readFileString(wire);
      const wireReport = yield* decodeRun(readFileString4);
      const readFileString5 = yield* w.fs.readFileString(lab);
      const labReport = yield* decodeRun(readFileString5);
      expect(wireReport.executors).toEqual(["wire"]);
      expect(labReport.executors).toEqual(["lab"]);
      const consoleText6 = yield* consoleText;
      expect(consoleText6).toContain("strict-openapi: pass");
      const evidence = w.file("evidence.json");
      const encodedEvidence = yield* encodeEvidence(
        CacheConformanceEvidence.make({
          schemaVersion: "cache-conformance-evidence/v1",
          source: "test/command-evidence",
          observedAt: "2026-10-24",
          profile: "local-container",
          topologies: ["owned-fixture"],
          checks: [
            CacheConformanceEvidenceCheck.make({
              case: "RC-029",
              dimension: "observability",
              verdict: "pass",
              expectation: "retention-observable",
              detail: "command test",
            }),
          ],
          obligations: [],
        })
      );
      yield* w.fs.writeFileString(evidence, encodedEvidence);
      const comparison = w.file("comparison.json");
      yield* w.run([
        "conformance-compare",
        "--runs",
        wire,
        "--runs",
        lab,
        "--evidence",
        evidence,
        "--output",
        comparison,
      ]);
      const readFileString7 = yield* w.fs.readFileString(comparison);
      const decoded = yield* decodeComparison(readFileString7);
      expect(decoded.evidenceSources).toEqual(["test/command-evidence"]);
      expect(decoded.verdict).toContain("No eligible replacement");
      const readFileString8 = yield* w.fs.readFileString(w.file("comparison.md"));
      expect(readFileString8).toContain("No eligible replacement");
      const bare = w.file("comparison-report");
      yield* w.run(["conformance-compare", "--runs", wire, "--output", bare]);
      const exists9 = yield* w.fs.exists(w.file("comparison-report.md"));
      expect(exists9).toBe(true);
      for (const secret of [secrets.reader, secrets.writer]) {
        const readFileString10 = yield* w.fs.readFileString(wire);
        expect(readFileString10).not.toContain(secret);
        const readFileString11 = yield* w.fs.readFileString(comparison);
        expect(readFileString11).not.toContain(secret);
      }
    })
  );

  it.effect("refuses unusable targets and an unavailable pinned client before any request", () =>
    Effect.gen(function* () {
      const w = yield* workspace();
      const remote = w.file("remote.json");
      const output = w.file("refused.json");
      yield* writeTarget(remote, "http://cache.example.com");
      const pipe12 = yield* w.run(["conformance-run", "--target", remote, "--output", output]).pipe(Effect.isFailure);
      expect(pipe12).toBe(true);
      const errorText13 = yield* errorText;
      expect(errorText13).toContain("non-loopback");
      const local = w.file("local.json");
      yield* writeTarget(local, "http://127.0.0.1:9");
      const pipe14 = yield* w
        .run(["conformance-run", "--target", local, "--output", output], { READER: "" })
        .pipe(Effect.isFailure);
      expect(pipe14).toBe(true);
      const errorText15 = yield* errorText;
      expect(errorText15).toContain("READER");
      const pipe16 = yield* w
        .run(["conformance-native", "--target", local, "--client", "stable", "--output", output])
        .pipe(Effect.isFailure);
      expect(pipe16).toBe(true);
      const errorText17 = yield* errorText;
      expect(errorText17).toContain("--fetch-client");
      const remoteReads = {
        TURBO_API: "https://cache.example.com",
        TURBO_TEAM: "team_lab",
        TURBO_TOKEN_REF: "op://v/i/f",
      };
      const pipe18 = yield* w
        .run(["remote-reads"], { ...remoteReads, TURBO_TOKEN_REPLACE: "2" })
        .pipe(Effect.isFailure);
      expect(pipe18).toBe(true);
      const errorText19 = yield* errorText;
      expect(errorText19).toContain("TURBO_TOKEN_REPLACE must be 0 or 1");
      const exists20 = yield* w.fs.exists(output);
      expect(exists20).toBe(false);
    })
  );
});
