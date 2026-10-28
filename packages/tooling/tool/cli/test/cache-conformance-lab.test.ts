import {
  buildCacheConformanceCorpus,
  CacheConformanceClientPin,
  CacheConformanceComparison,
  CacheConformanceEvidence,
  CacheConformanceEvidenceCheck,
  CacheConformanceLoadEnvelope,
  CacheConformanceObligationCheck,
  CacheConformanceProxyEvent,
  CacheConformanceProxyOptions,
  CacheConformanceRubric,
  CacheConformanceRun,
  CacheConformanceTarget,
  compareCacheConformanceRuns,
  loadCacheConformanceBearers,
  makeCacheConformanceFaultProxy,
  mergeCacheConformanceRuns,
  renderCacheConformanceComparison,
  runCacheConformance,
  runCacheConformanceLab,
  runCacheConformanceNative,
} from "@beep/repo-cli/commands/Cache";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import { CacheRuntimeProcess } from "@beep/repo-cli/test/Cache";
import { Sha256Hex } from "@beep/schema";
import { NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  bearers,
  caseOf,
  foreignTeamId,
  goodMode,
  makeConformanceServer,
  repoRoot,
  secrets,
  targetFor,
  teamId,
} from "./cache-conformance-server.ts";
import type { ServerMode } from "./cache-conformance-server.ts";

afterEach(() => vi.restoreAllMocks());

const Services = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);
// The fault proxy injects `reset` and `truncated-body` by failing the response
// stream, which Bun.serve turns into a connection abort. The CLI only runs on
// Bun; vitest's Node run serves through a Bun.serve shim that completes the
// response instead, so abort-dependent expectations assert that shim behaviour
// there rather than the abort.
const abortsConnections = process.versions.bun !== undefined;

type ProbeReply = { readonly status: number; readonly headers: Headers.Headers; readonly body: Uint8Array };
type ProbeOutcome = Result.Result<O.Option<ProbeReply>, unknown>;
const replied = (outcome: ProbeOutcome, check: (reply: ProbeReply) => boolean) =>
  Result.isSuccess(outcome) && O.exists(outcome.success, check);
const tagOf = (outcome: ProbeOutcome) =>
  Result.isSuccess(outcome)
    ? O.flatMap(outcome.success, (reply) => Headers.get(reply.headers, "x-artifact-tag"))
    : O.none();
const abortedOrShimCompleted = (outcome: ProbeOutcome) =>
  abortsConnections ? Result.isFailure(outcome) : replied(outcome, (reply) => reply.status === 200);
const RunJson = S.fromJsonString(CacheConformanceRun, { space: 2 });
const ComparisonJson = S.fromJsonString(CacheConformanceComparison, { space: 2 });
const encodeProxyEvents = S.encodeEffect(CacheConformanceProxyEvent.pipe(S.Array, S.fromJsonString));
const encodeSummaryJson = S.encodeEffect(S.fromJsonString(S.Json));

// A small envelope keeps the measured steps fast while exercising every step.
const envelope = CacheConformanceLoadEnvelope.make({
  schemaVersion: "cache-conformance-load-envelope/v1",
  artifactSizes: {
    p50Bytes: S.Natural.make(64),
    p95Bytes: S.Natural.make(512),
    p99Bytes: S.Natural.make(1024),
    maxBytes: S.Natural.make(4096),
  },
  concurrency: { readPeak: S.Natural.make(4), writePeak: S.Natural.make(2) },
  envelope: {
    payloadBytes: S.Natural.make(2048),
    readConcurrency: S.Natural.make(6),
    writeConcurrency: S.Natural.make(3),
  },
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(env));

const policyTarget = (readerWriterSplit: boolean, tenantBinding: boolean) =>
  targetFor({ url: "http://127.0.0.1:1", readerWriterSplit, tenantBinding });

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })("cache conformance bearer rule", (it) => {
  it.effect("allows reuse only where the target claims no separation", () =>
    Effect.gen(function* () {
      const load = (target: CacheConformanceTarget, env: Record<string, string>) =>
        loadCacheConformanceBearers(target).pipe(withEnv(env), Effect.result);
      const shared = { READER: "one-token", WRITER: "one-token", FOREIGN: "one-token", UNKNOWN: "other-token" };
      (yield* load(policyTarget(false, false), shared)).pipe(Result.isSuccess, assertTrue);
      (yield* load(policyTarget(true, false), shared)).pipe(Result.isFailure, assertTrue);
      const split = { READER: "reader-token", WRITER: "writer-token", FOREIGN: "reader-token", UNKNOWN: "other-token" };
      (yield* load(policyTarget(true, false), split)).pipe(Result.isSuccess, assertTrue);
      (yield* load(policyTarget(true, true), split)).pipe(Result.isFailure, assertTrue);
      (yield* load(policyTarget(false, false), { ...shared, UNKNOWN: "one-token" })).pipe(Result.isFailure, assertTrue);
      (yield* load(policyTarget(false, false), { ...shared, READER: "" })).pipe(Result.isFailure, assertTrue);
    })
  );
});

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })("cache conformance fault proxy", (it) => {
  it.effect("forwards unchanged and injects each read fault with a direct receipt", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const target = targetFor({ url: server.url });
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({ target, bearers, holdMs: 400 })
      );
      const hash = "00112233445566778899aabbccddeeff";
      const body = new TextEncoder().encode("proxied artifact body");
      const query = `?teamId=${teamId}`;
      const upload = yield* HttpClientRequest.put(`${proxy.url}/v8/artifacts/${hash}${query}`).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "Atag-value" }),
        HttpClientRequest.bodyUint8Array(body),
        HttpClient.execute
      );
      expect(upload.status).toBe(200);
      const read = (fault: Parameters<typeof proxy.setScenario>[1]) =>
        proxy.setScenario(`probe-${fault}`, fault).pipe(
          Effect.andThen(
            HttpClient.get(`${proxy.url}/v8/artifacts/${hash}${query}`, {
              headers: { authorization: `Bearer ${secrets.reader}` },
            }).pipe(
              Effect.flatMap((response) =>
                response.arrayBuffer.pipe(
                  Effect.map((buffer) => ({
                    status: response.status,
                    headers: response.headers,
                    body: new Uint8Array(buffer),
                  }))
                )
              ),
              Effect.timeoutOption("200 millis"),
              Effect.result
            )
          )
        );
      const plain = yield* read("none");
      assertTrue(replied(plain, (reply) => reply.status === 200));
      assertSome(tagOf(plain), "Atag-value");
      (yield* read("missing-tag")).pipe(tagOf, assertNone);
      assertSome(tagOf(yield* read("tampered-tag")), "Btag-value");
      const tampered = yield* read("tampered-body");
      assertTrue(replied(tampered, (reply) => reply.body.byteLength === body.byteLength && reply.body[0] !== body[0]));
      assertTrue(replied(yield* read("status-429"), (reply) => reply.status === 429));
      assertTrue(replied(yield* read("status-503"), (reply) => reply.status === 503));
      const held = yield* read("timeout");
      assertTrue(Result.isSuccess(held) && O.isNone(held.success));
      (yield* read("reset")).pipe(abortedOrShimCompleted, assertTrue);
      (yield* read("truncated-body")).pipe(abortedOrShimCompleted, assertTrue);
      const events = yield* proxy.events;
      const faults = A.map(
        A.filter(events, (event) => event.exchange.method === "GET"),
        (event) => event.fault
      );
      expect(faults).toEqual(
        expect.arrayContaining([
          "none",
          "missing-tag",
          "tampered-tag",
          "tampered-body",
          "status-429",
          "status-503",
          "reset",
          "truncated-body",
        ])
      );
      const receipts = yield* encodeProxyEvents(events);
      for (const secret of [...R.values(secrets), "Atag-value", "Btag-value", hash])
        expect(receipts).not.toContain(secret);
    })
  );
});

it.layer(Services, { timeout: "120 seconds", excludeTestServices: true })("cache conformance lab runner", (it) => {
  it.effect("separates every proxied fault class and measures the envelopes", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const report = yield* runCacheConformanceLab(corpus, targetFor({ url: server.url }), bearers, envelope);
      expect(report.executors).toEqual(["lab"]);
      expect(report.representative).toBe(false);
      expect(caseOf(report, "RC-023").verdicts.observability.verdict).toBe(abortsConnections ? "pass" : "fail");
      for (const id of ["RC-027", "RC-028"]) {
        expect(caseOf(report, id).verdicts["performance-envelope"].verdict).toBe("pass");
        expect(caseOf(report, id).measurements.length).toBeGreaterThan(0);
      }
      const outcomes = A.map(
        A.filter(caseOf(report, "RC-023").exchanges, (exchange) => Str.startsWith("reader-get-")(exchange.step)),
        (exchange) => exchange.outcome
      );
      expect(outcomes).toEqual([
        "miss",
        "success",
        "throttled",
        "server-error",
        "timeout",
        ...(abortsConnections ? ["transport-error", "truncated-body"] : ["success", "success"]),
      ]);
      expect(caseOf(report, "RC-002").verdicts["strict-openapi"].verdict).toBe("not-executed");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of R.values(secrets)) expect(encoded).not.toContain(secret);
      expect(yield* S.encodeEffect(RunJson)(yield* S.decodeEffect(RunJson)(encoded))).toBe(encoded);
    })
  );

  it.effect("labels only a disposable-deployment run representative", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const deployed = CacheConformanceTarget.make({
        ...targetFor({ url: server.url }),
        profile: "disposable-deployment",
      });
      expect((yield* runCacheConformanceLab(corpus, deployed, bearers, envelope)).representative).toBe(true);
    })
  );
});

// Stand-in signed client at the native process seam: it signs and verifies a
// tag over (hash, team, bytes) with the run key, so proxied tampering, a
// wrong team or a dropped tag must all cause a rejection. It never claims
// real Turbo or sandbox execution.
const taskHash = "c0ffee0123456789";
const sign = (key: string, team: string, body: Uint8Array) =>
  Crypto.Crypto.use((crypto) =>
    crypto.digest("SHA-256", new Uint8Array([...new TextEncoder().encode(`${key}|${taskHash}|${team}|`), ...body]))
  ).pipe(Effect.map(Hex.encode));

type SimulatedRun = {
  readonly work: string;
  readonly team: string;
  readonly key: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly deny: boolean;
};

const simulatedRun = (options: Parameters<typeof CacheRuntimeProcess.runCapturedStreams>[0]): SimulatedRun => {
  const args = options.args ?? [];
  const env = options.env ?? {};
  const team = env.TURBO_TEAMID ?? "";
  return {
    work: O.getOrThrow(A.get(args, O.getOrThrow(A.findFirstIndex(args, (arg) => arg === "--bind")) + 1)),
    team,
    key: env.TURBO_REMOTE_CACHE_SIGNATURE_KEY ?? "",
    url: `${env.TURBO_API}/v8/artifacts/${taskHash}?teamId=${team}`,
    headers: { authorization: `Bearer ${env.TURBO_TOKEN}` },
    deny: env.PROBE_DENY_EXECUTION === "1",
  };
};

const simulatedOutput = new TextEncoder().encode("conformance-native-signed-output\n");

const makeNativeClient = (fs: FileSystem.FileSystem, path: Path.Path, client: HttpClient.HttpClient) => {
  const restore = Effect.fnUntraced(function* (run: SimulatedRun) {
    const response = yield* client.get(run.url, { headers: run.headers });
    const stored = new Uint8Array(yield* response.arrayBuffer);
    const tag = Headers.get(response.headers, "x-artifact-tag");
    const verified = response.status === 200 && O.contains(tag, yield* sign(run.key, run.team, stored));
    return { verified, stored };
  });
  const writeOutput = Effect.fnUntraced(function* (run: SimulatedRun, bytes: Uint8Array) {
    yield* fs.makeDirectory(path.join(run.work, "dist"), { recursive: true });
    yield* fs.writeFile(path.join(run.work, "dist/result.txt"), bytes);
  });
  const upload = Effect.fnUntraced(function* (run: SimulatedRun) {
    yield* HttpClientRequest.put(run.url).pipe(
      HttpClientRequest.setHeaders({
        ...run.headers,
        "x-artifact-tag": yield* sign(run.key, run.team, simulatedOutput),
      }),
      HttpClientRequest.bodyUint8Array(simulatedOutput),
      client.execute,
      Effect.flatMap((reply) => reply.arrayBuffer)
    );
  });
  const writeSummary = Effect.fnUntraced(function* (run: SimulatedRun, verified: boolean, exitCode: number) {
    yield* fs.makeDirectory(path.join(run.work, ".turbo/runs"), { recursive: true });
    yield* fs.writeFileString(
      path.join(run.work, ".turbo/runs/run.json"),
      yield* encodeSummaryJson({
        turboVersion: "2.11.10",
        tasks: [
          {
            taskId: "build",
            hash: taskHash,
            cache: verified ? { status: "HIT", source: "REMOTE" } : { status: "MISS" },
            execution: { exitCode },
          },
        ],
      })
    );
  });
  return Effect.fn("ConformanceNativeTest.process")(function* (
    options: Parameters<typeof CacheRuntimeProcess.runCapturedStreams>[0]
  ) {
    expect(options.command).toBe("/usr/bin/bwrap");
    expect(options.args).toContain("--skip-infer");
    expect(options.args).toContain("--single-package");
    const run = simulatedRun(options);
    const { verified, stored } = yield* restore(run);
    // Restored from a verified remote hit, executed when allowed, or denied (exit 42).
    if (verified) yield* writeOutput(run, stored);
    if (!verified && !run.deny) yield* writeOutput(run, simulatedOutput).pipe(Effect.andThen(upload(run)));
    const exitCode = verified || !run.deny ? 0 : 42;
    yield* writeSummary(run, verified, exitCode);
    return CacheRuntimeProcess.CapturedStreams.make({ exitCode, stdout: "", stderr: "", truncated: false });
  }, Effect.orDie);
};

const pin = CacheConformanceClientPin.make({
  channel: "stable",
  version: "2.11.10",
  platformPackage: "@turbo/linux-64@2.11.10",
  platformIntegrity: "sha512-AAAA",
  executableSha256: Sha256Hex.make(Str.repeat(64)("a")),
});

const runNativeAgainst = Effect.fn("ConformanceNativeTest.run")(function* (mode: ServerMode) {
  const fs = yield* FileSystem.FileSystem;
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockImplementation(() => Effect.succeed(pin.executableSha256));
  vi.spyOn(CacheRuntimeProcess, "runCapturedStreams").mockImplementation(
    makeNativeClient(fs, yield* Path.Path, yield* HttpClient.HttpClient)
  );
  const server = yield* makeConformanceServer({ ...mode, bindTenant: false });
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-native-" });
  const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
  const target = targetFor({ url: server.url, tenantBinding: false });
  return {
    corpus,
    target,
    report: yield* runCacheConformanceNative(root, corpus, target, bearers, { pin, executable: "/synthetic/turbo" }),
  };
});

it.layer(Services, { timeout: "120 seconds", excludeTestServices: true })("cache conformance native matrix", (it) => {
  it.effect("scores a tag-preserving backend through every signed case", () =>
    Effect.gen(function* () {
      const { report } = yield* runNativeAgainst(goodMode);
      expect(report.executors).toEqual(["native"]);
      expect(A.map(report.clients, (client) => client.version)).toEqual(["2.11.10"]);
      for (const id of ["RC-009", "RC-010", "RC-017", "RC-018", "RC-019", "RC-020", "RC-021", "RC-022"])
        expect([id, caseOf(report, id).verdicts["published-stable-client"]]).toEqual([id, { verdict: "pass" }]);
      expect(caseOf(report, "RC-022").verdicts["beep-security-policy"].verdict).toBe("pass");
      expect(caseOf(report, "RC-017").verdicts["published-canary-client"].verdict).toBe("not-executed");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of R.values(secrets)) expect(encoded).not.toContain(secret);
    })
  );

  it.effect("never credits a fault rejection when the control replay could not restore", () =>
    Effect.gen(function* () {
      const { report } = yield* runNativeAgainst({ ...goodMode, dropTags: true });
      const signed = caseOf(report, "RC-017").verdicts["published-stable-client"];
      expect(signed.verdict).toBe("fail");
      for (const id of ["RC-018", "RC-019", "RC-020", "RC-021"]) {
        const verdict = caseOf(report, id).verdicts["published-stable-client"];
        expect(verdict.verdict === "fail" ? verdict.expectation : verdict.verdict).toBe("control-replay-restored");
      }
    })
  );
});

it.layer(Services, { timeout: "180 seconds", excludeTestServices: true })("cache conformance comparison", (it) => {
  it.effect("merges runs per target and never passes an unexecuted gate", () =>
    Effect.gen(function* () {
      const { corpus, target, report: native } = yield* runNativeAgainst(goodMode);
      const wire = yield* runCacheConformance(corpus, target, bearers);
      const lab = yield* runCacheConformanceLab(corpus, target, bearers, envelope);
      const merged = yield* mergeCacheConformanceRuns([wire, native, lab]);
      expect(merged.executors).toEqual(["wire", "native", "lab"]);
      expect(caseOf(merged, "RC-017").verdicts["published-stable-client"].verdict).toBe("pass");
      expect(caseOf(merged, "RC-023").verdicts.observability.verdict).toBe(abortsConnections ? "pass" : "fail");
      const incumbent = CacheConformanceRun.make({ ...wire, topology: "beep-incumbent" });
      const comparison = yield* compareCacheConformanceRuns(yield* repoRoot, [wire, native, lab, incumbent]);
      expect(comparison.verdict).toContain("No eligible replacement");
      expect(comparison.eligibleReplacements).toEqual([]);
      const candidate = A.findFirst(comparison.targets, (entry) => entry.topology === "owned-fixture").pipe(
        O.getOrThrow
      );
      const status = (gate: number) =>
        A.findFirst(candidate.gates, (result) => result.gate === gate).pipe(
          O.map((result) => result.status),
          O.getOrThrow
        );
      expect([status(1), status(2), status(9), status(12)]).toEqual(["pass", "unproven", "unproven", "unproven"]);
      expect(candidate.eligible).toBe(false);
      expect(candidate.materialWin).toBe("not-evaluated");
      const markdown = renderCacheConformanceComparison(comparison);
      expect(markdown).toContain("No eligible replacement");
      const encoded = yield* S.encodeEffect(ComparisonJson)(comparison);
      expect(yield* S.encodeEffect(ComparisonJson)(yield* S.decodeEffect(ComparisonJson)(encoded))).toBe(encoded);
    })
  );

  it.effect("refuses to compare targets scored against different corpora", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const regenerated = CacheConformanceRun.make({
        ...wire,
        topology: "beep-incumbent",
        corpus: { ...wire.corpus, specSha256: Sha256Hex.make(Str.repeat(64)("b")) },
      });
      const outcome = yield* compareCacheConformanceRuns(yield* repoRoot, [wire, regenerated]).pipe(Effect.result);
      outcome.pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("never compares a candidate with another profile's incumbent", () =>
    Effect.gen(function* () {
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const good = yield* makeConformanceServer(goodMode);
      const weak = yield* makeConformanceServer({ ...goodMode, bindTenant: false });
      const candidate = yield* runCacheConformance(corpus, targetFor({ url: good.url }), bearers);
      const weakRun = yield* runCacheConformance(corpus, targetFor({ url: weak.url }), bearers);
      // The only incumbent fails gate 5, which the candidate passes, but it was
      // measured in another profile: a fallback would report gate 5 as removed.
      const otherProfileIncumbent = CacheConformanceRun.make({
        ...weakRun,
        profile: "disposable-deployment",
        topology: "beep-incumbent",
      });
      const comparison = yield* compareCacheConformanceRuns(yield* repoRoot, [candidate, otherProfileIncumbent]);
      const target = A.findFirst(comparison.targets, (entry) => entry.topology === "owned-fixture").pipe(O.getOrThrow);
      expect(target.blockersRemoved).toEqual([]);
      expect(target.regressions).toEqual([]);
    })
  );

  it.effect("lets executed external evidence and pinned licenses settle gates", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const pinned = CacheConformanceRun.make({
        ...wire,
        backend: { id: "turborepo-remote-cache", release: "2.12.0", digest: "pinned" },
      });
      const check = (id: string, dimension: "beep-security-policy" | "observability", verdict: "pass" | "fail") =>
        CacheConformanceEvidenceCheck.make({
          case: id,
          dimension,
          verdict,
          expectation: `${id}-${dimension}`,
          detail: "lab",
        });
      const document = CacheConformanceEvidence.make({
        schemaVersion: "cache-conformance-evidence/v1",
        source: "test/deployed-evidence",
        observedAt: "2026-10-24",
        profile: "local-container",
        topologies: ["owned-fixture"],
        checks: [
          check("RC-029", "beep-security-policy", "pass"),
          check("RC-029", "observability", "pass"),
          check("RC-030", "beep-security-policy", "pass"),
          check("RC-030", "observability", "fail"),
        ],
        obligations: [
          CacheConformanceObligationCheck.make({
            gate: 12,
            obligation: "maintenance",
            verdict: "pass",
            expectation: "maintenance-acceptable",
            detail: "lab",
          }),
        ],
      });
      const comparison = yield* compareCacheConformanceRuns(yield* repoRoot, [pinned], [document]);
      const target = A.head(comparison.targets).pipe(O.getOrThrow);
      const status = (gate: number) =>
        A.findFirst(target.gates, (result) => result.gate === gate).pipe(
          O.map((result) => result.status),
          O.getOrThrow
        );
      expect([status(8), status(10), status(12)]).toEqual(["fail", "pass", "pass"]);
      expect(comparison.evidenceSources).toEqual(["test/deployed-evidence"]);
      const gate9 = A.findFirst(target.gates, (result) => result.gate === 9).pipe(O.getOrThrow);
      expect(gate9.reason).toContain("demand is censored");
      const bare = yield* compareCacheConformanceRuns(yield* repoRoot, [wire]);
      const unpinned = A.findFirst(A.head(bare.targets).pipe(O.getOrThrow).gates, (result) => result.gate === 12).pipe(
        O.getOrThrow
      );
      expect(unpinned.status).toBe("unproven");
    })
  );

  it.effect("refuses to compare when the frozen rubric changed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* repoRoot;
      const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-rubric-" });
      const copy = path.join(scratch, CacheConformanceRubric.path);
      yield* fs.makeDirectory(path.dirname(copy), { recursive: true });
      yield* fs.writeFileString(
        copy,
        `${yield* fs.readFileString(path.join(root, CacheConformanceRubric.path))}\nedit\n`
      );
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(root);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const refused = yield* compareCacheConformanceRuns(scratch, [wire]).pipe(Effect.result);
      refused.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(refused)) expect(refused.failure.message).toContain("changed");
      expect(foreignTeamId).not.toBe(teamId);
    })
  );
});

const ProxyEventJson = S.fromJsonString(CacheConformanceProxyEvent);
const encodeProxyEvent = S.encodeEffect(ProxyEventJson);
const decodeProxyEvent = S.decodeEffect(ProxyEventJson);

it.effect.prop(
  "round trips schema-generated proxy events through JSON",
  { event: CacheConformanceProxyEvent },
  ({ event }) =>
    Effect.gen(function* () {
      const encoded = yield* encodeProxyEvent(CacheConformanceProxyEvent.make(event));
      expect(yield* encodeProxyEvent(yield* decodeProxyEvent(encoded))).toBe(encoded);
    }),
  { arbitrary: { runs: 50 } }
);
