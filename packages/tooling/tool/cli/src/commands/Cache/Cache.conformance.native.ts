/**
 * Native signed-cache conformance: exact pinned Turbo clients against a target
 * through the fault proxy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel } from "@beep/repo-configs/cache";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HttpClient from "effect/http/HttpClient";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { writeContainedFileString } from "../../internal/cli/FsGuards.ts";
import { OutputBound, runCapturedStreams } from "../../internal/process/index.ts";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { CacheConformanceProxyOptions, makeCacheConformanceFaultProxy } from "./Cache.conformance.proxy.ts";
import { CacheConformanceCaseResult, CacheConformanceClientRecord } from "./Cache.conformance.schemas.ts";
import {
  assembleCacheConformanceRun,
  assertCacheConformanceTargetBoundary,
  cacheConformanceCaseVerdicts,
  cacheConformanceVerdictOf,
  skippedCacheConformanceCase,
} from "./Cache.conformance.ts";
import { CacheConformanceWireCheck } from "./Cache.conformance.wire.ts";
import {
  decodeCacheExperimentText,
  hashCacheExperimentExecutable,
  readCacheExperimentBytes,
  requireCacheLinuxX64,
} from "./Cache.evidence.ts";
import { CacheProtocolNativeSummary, cacheProtocolSandboxMounts } from "./Cache.protocol.runner.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type {
  CacheConformanceBearers,
  CacheConformanceCase,
  CacheConformanceCaseId,
  CacheConformanceCorpus,
  CacheConformanceDimension,
  CacheConformanceFault,
  CacheConformanceProxyEvent,
  CacheConformanceTarget,
  CacheConformanceVerdict,
} from "./Cache.conformance.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.native");

/**
 * Repository-relative pin file for the exact native clients.
 *
 * **Example** (Read the pin path)
 * ```ts
 * import { cacheConformancePinsPath } from "@beep/repo-cli/commands/Cache"
 * console.assert(cacheConformancePinsPath.endsWith(".json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const cacheConformancePinsPath = "goals/turborepo-cache-conformance/research/pins-2026-10-23.json";

/**
 * One exact client lane from the pin file.
 *
 * **Example** (Inspect pinned client fields)
 * ```ts
 * import { CacheConformanceClientPin } from "@beep/repo-cli/commands/Cache"
 * console.assert("platformIntegrity" in CacheConformanceClientPin.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceClientPin extends S.Opaque<CacheConformanceClientPin, { readonly brand: unique symbol }>()(
  S.Struct({
    channel: CacheClientChannel,
    version: S.NonEmptyString.check(S.isPattern(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)),
    platformPackage: S.NonEmptyString.check(S.isPattern(/^@turbo\/linux-64@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)),
    platformIntegrity: S.NonEmptyString.check(S.isPattern(/^sha512-[A-Za-z0-9+/]+={0,2}$/)),
    executableSha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CacheConformanceClientPin", {
      description: "Exact published platform package, its registry integrity and the extracted executable digest.",
    })
  )
) {}

const PinsDocument = S.Struct({ clients: S.Array(CacheConformanceClientPin) }).pipe(
  $I.annoteSchema("CacheConformancePinsDocument", { description: "Client lanes selected from the pin file." })
);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const bound = OutputBound.make({ maxChars: 64 * 1024, truncatedNotice: "capture exceeded bound" });

const clientDirectory = Effect.fn("CacheConformance.clientDirectory")(function* (version: string) {
  const path = yield* Path.Path;
  const home = yield* Config.String("HOME").pipe(
    Effect.mapError(() => CacheCommandError.new("HOME must be set to locate the client cache."))
  );
  return path.join(home, ".cache/beep/turbo-cache-lab/clients", version);
});

const verifyExecutable = Effect.fn("CacheConformance.verifyExecutable")(function* (
  executable: string,
  pin: CacheConformanceClientPin
) {
  const digest = yield* hashCacheExperimentExecutable(executable);
  if (digest !== pin.executableSha256)
    return yield* CacheCommandError.new(
      `Client ${pin.version} at ${executable} has SHA-256 ${digest}, not the pinned ${pin.executableSha256}.`
    );
  return executable;
});

const registryUrl = (pin: CacheConformanceClientPin) => {
  const name = Str.slice(0, Str.lastIndexOf("@")(pin.platformPackage).pipe(O.getOrElse(() => 0)))(pin.platformPackage);
  const basename = Str.slice(Str.indexOf("/")(name).pipe(O.getOrElse(() => -1)) + 1)(name);
  return `https://registry.npmjs.org/${name}/-/${basename}-${pin.version}.tgz`;
};

const fetchClient = Effect.fn("CacheConformance.fetchClient")(function* (
  root: string,
  directory: string,
  pin: CacheConformanceClientPin
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Digest.Digest;
  const client = yield* HttpClient.HttpClient;
  const url = registryUrl(pin);
  const response = yield* client.get(url).pipe(CacheCommandError.mapError(`Cannot fetch ${url}.`));
  if (response.status !== 200) return yield* CacheCommandError.new(`Registry answered ${response.status} for ${url}.`);
  const tarball: Uint8Array = yield* response.arrayBuffer.pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.timeout(Duration.minutes(5)),
    CacheCommandError.mapError(`Cannot read ${url}.`)
  );
  const integrity = `sha512-${Base64.encode(yield* crypto.digest(Digest.sha512, tarball))}`;
  if (integrity !== pin.platformIntegrity)
    return yield* CacheCommandError.new(`Tarball ${url} does not match the pinned registry integrity.`);
  yield* fs.makeDirectory(directory, { recursive: true });
  const staging = yield* fs.makeTempDirectoryScoped({ directory, prefix: "fetch-" });
  yield* fs.writeFile(path.join(staging, "package.tgz"), tarball);
  const extracted = yield* runCapturedStreams({
    command: "/usr/bin/tar",
    args: ["-xzf", "package.tgz", "--no-same-owner", "turbo-linux-x64/bin/turbo"],
    cwd: staging,
    extendEnv: false,
    env: { PATH: "/usr/bin:/bin" },
    bound,
  });
  if (extracted.exitCode !== 0)
    return yield* CacheCommandError.new(`Cannot extract turbo-linux-x64/bin/turbo from ${url}.`);
  const candidate = yield* verifyExecutable(path.join(staging, "turbo-linux-x64/bin/turbo"), pin);
  const final = path.join(directory, "turbo");
  yield* fs.rename(candidate, final);
  yield* fs.chmod(final, 0o755);
  return yield* verifyExecutable(final, pin).pipe(Effect.tap(() => Effect.logInfo(`fetched ${url} for ${root}`)));
});

/**
 * Resolve the pinned executable for a channel, verifying its SHA-256 first.
 *
 * **Details**
 * The client cache is `~/.cache/beep/turbo-cache-lab/clients/<version>/turbo`.
 * When it is absent, a repository-installed `@turbo/linux-64` executable with
 * the pinned digest is copied in. Only with `fetch` does the resolver download
 * the exact platform tarball from the npm registry, check its pinned SHA-512
 * integrity, extract its `turbo-linux-x64/bin/turbo` member and check its
 * SHA-256. No floating package-manager command runs.
 *
 * **Example** (Plan client resolution)
 * ```ts
 * import { resolveCacheConformanceClient } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof resolveCacheConformanceClient === "function")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCacheConformanceClient = Effect.fn("CacheConformance.resolveClient")(function* (
  root: string,
  channel: CacheClientChannel,
  fetch: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pins = yield* readCacheExperimentBytes(root, cacheConformancePinsPath).pipe(
    Effect.flatMap(decodeCacheExperimentText),
    Effect.flatMap(JsonStringCodec(PinsDocument).decode)
  );
  const pin = yield* A.findFirst(pins.clients, (client) => client.channel === channel).pipe(
    Effect.fromOption(() => CacheCommandError.new(`${cacheConformancePinsPath} pins no ${channel} client.`))
  );
  const directory = yield* clientDirectory(pin.version);
  const cached = path.join(directory, "turbo");
  if (yield* fs.exists(cached)) return { pin, executable: yield* verifyExecutable(cached, pin) };
  const installed = path.join(root, "node_modules/@turbo/linux-64/bin/turbo");
  const installedMatches =
    (yield* fs.exists(installed)) && (yield* hashCacheExperimentExecutable(installed)) === pin.executableSha256;
  if (installedMatches) {
    yield* fs.makeDirectory(directory, { recursive: true });
    yield* fs.copyFile(installed, cached);
    yield* fs.chmod(cached, 0o755);
    return { pin, executable: yield* verifyExecutable(cached, pin) };
  }
  if (!fetch)
    return yield* CacheCommandError.new(
      `Client ${pin.version} is not cached at ${cached}; rerun with --fetch-client to download ${registryUrl(pin)} and verify it against the pins.`
    );
  return { pin, executable: yield* Effect.scoped(fetchClient(root, directory, pin)) };
}, CacheCommandError.mapError("Cannot resolve the pinned native client."));

const NativeScenario = S.Literals([
  "producer",
  "replay",
  "missing-tag",
  "tampered-tag",
  "tampered-body",
  "foreign-producer",
  "wrong-team",
  "epoch-fresh-namespace",
  "epoch-old-namespace",
]).pipe($I.annoteSchema("CacheConformanceNativeScenario", { description: "One native Turbo run of the matrix." }));
type NativeScenario = typeof NativeScenario.Type;

/**
 * Observed outcome of one native Turbo run.
 *
 * **Example** (Inspect native outcome fields)
 * ```ts
 * import { CacheConformanceNativeOutcome } from "@beep/repo-cli/commands/Cache"
 * console.assert("restoredOutput" in CacheConformanceNativeOutcome.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceNativeOutcome extends S.Opaque<
  CacheConformanceNativeOutcome,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    scenario: NativeScenario,
    exitCode: S.Int,
    cacheStatus: S.Literals(["HIT", "MISS"]),
    cacheSource: S.OptionFromNullOr(S.String),
    restoredOutput: S.Boolean,
    outputSha256: S.OptionFromNullOr(Sha256Hex),
  }).pipe(
    $I.annoteSchema("CacheConformanceNativeOutcome", {
      description: "Exit code, the summary's cache status and whether the declared output exists afterwards.",
    })
  )
) {}

type ScenarioPlan = {
  readonly name: NativeScenario;
  readonly team: string;
  readonly signing: Redacted.Redacted<string>;
  readonly role: "reader" | "writer";
  readonly deny: boolean;
  readonly fault: CacheConformanceFault;
};

const describe = (outcome: CacheConformanceNativeOutcome) =>
  `${outcome.scenario}: exit ${outcome.exitCode}, ${outcome.cacheStatus}${O.match(outcome.cacheSource, { onNone: () => "", onSome: (source) => ` ${source}` })}, output ${outcome.restoredOutput ? "present" : "absent"}`;

const prepareWorkspace = Effect.fn("CacheConformance.prepareNativeWorkspace")(function* (
  directory: string,
  plan: ScenarioPlan
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const work = path.join(directory, plan.name);
  yield* fs.makeDirectory(path.join(work, ".turbo"), { recursive: true });
  yield* writeContainedFileString(
    work,
    "package.json",
    '{"name":"conformance-native-signed-fixture","private":true,"packageManager":"bun@1.4.2","scripts":{"build":"bun build.ts"}}'
  );
  yield* writeContainedFileString(
    work,
    "turbo.json",
    '{"remoteCache":{"signature":true},"tasks":{"build":{"outputs":["dist/**"],"passThroughEnv":["PROBE_DENY_EXECUTION"]}}}'
  );
  yield* writeContainedFileString(
    work,
    "build.ts",
    'if (Bun.env.PROBE_DENY_EXECUTION === "1") process.exit(42);\nawait Bun.write("dist/result.txt", "conformance-native-signed-output\\n");\n'
  );
  return work;
});

const runNative = Effect.fn("CacheConformance.runNative")(function* (
  work: string,
  executable: string,
  proxyUrl: string,
  plan: ScenarioPlan,
  bearers: CacheConformanceBearers,
  pin: CacheConformanceClientPin,
  secrets: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bun = yield* fs.realPath(process.execPath);
  // Unlike `cache protocol-run`, the target lives outside any private network
  // namespace, so Turbo shares the host network and reaches only the loopback
  // proxy (TURBO_API); user, PID, IPC and UTS namespaces stay private.
  const captured = yield* runCapturedStreams({
    command: "/usr/bin/bwrap",
    args: [
      "--unshare-user",
      "--unshare-pid",
      "--unshare-ipc",
      "--unshare-uts",
      ...cacheProtocolSandboxMounts,
      "--dir",
      "/tools",
      "--ro-bind",
      executable,
      "/tools/turbo",
      "--ro-bind",
      bun,
      "/tools/bun",
      "--bind",
      work,
      "/work",
      "--chdir",
      "/work",
      "/tools/turbo",
      "run",
      "build",
      "--skip-infer",
      "--single-package",
      "--cache=remote:rw",
      "--env-mode=strict",
      "--no-daemon",
      "--summarize",
    ],
    cwd: work,
    extendEnv: false,
    env: {
      PATH: "/tools:/usr/bin:/bin",
      HOME: "/tmp",
      CI: "1",
      TURBO_TELEMETRY_DISABLED: "1",
      TURBO_API: proxyUrl,
      // The team rides in the environment, not `.turbo/config.json`: the
      // config file is hashed, the variable is not (strict env mode), so every
      // team and key sees the same task hash and wrong-team and epoch probes
      // isolate the namespace alone.
      TURBO_TEAMID: plan.team,
      TURBO_TOKEN: Redacted.value(plan.role === "writer" ? bearers.writer : bearers.reader),
      TURBO_REMOTE_CACHE_SIGNATURE_KEY: Redacted.value(plan.signing),
      PROBE_DENY_EXECUTION: plan.deny ? "1" : "0",
    },
    bound,
  }).pipe(Effect.timeout(Duration.seconds(120)));
  if (captured.truncated) return yield* CacheCommandError.new("Native capture exceeded its bound.");
  if (A.some(secrets, (secret) => Str.includes(secret)(captured.stdout) || Str.includes(secret)(captured.stderr)))
    return yield* CacheCommandError.new(`Native ${plan.name} output contains a bearer or signing key.`);
  const names = yield* fs.readDirectory(path.join(work, ".turbo/runs"));
  const summaryName = yield* A.match(names, {
    onEmpty: () => CacheCommandError.new(`Native ${plan.name} wrote no run summary.`),
    onNonEmpty: (all) =>
      all.length === 1
        ? Effect.succeed(all[0])
        : Effect.fail(CacheCommandError.new(`Native ${plan.name} wrote more than one run summary.`)),
  });
  const summary = yield* readCacheExperimentBytes(work, path.join(".turbo/runs", summaryName)).pipe(
    Effect.flatMap(decodeCacheExperimentText),
    Effect.flatMap(JsonStringCodec(CacheProtocolNativeSummary).decode)
  );
  const task = yield* A.head(summary.tasks).pipe(
    Effect.fromOption(() => CacheCommandError.new(`Native ${plan.name} summary has no task.`))
  );
  if (summary.turboVersion !== pin.version || task.execution.exitCode !== captured.exitCode)
    return yield* CacheCommandError.new(`Native ${plan.name} summary disagrees with its process or client pin.`);
  const output = path.join(work, "dist/result.txt");
  const restoredOutput = yield* fs.exists(path.join(work, "dist"));
  const outputSha256 = (yield* fs.exists(output))
    ? O.some(yield* readCacheExperimentBytes(work, "dist/result.txt", 4096).pipe(Effect.flatMap(hashBytes)))
    : O.none<Sha256Hex>();
  return CacheConformanceNativeOutcome.make({
    scenario: plan.name,
    exitCode: captured.exitCode,
    cacheStatus: task.cache.status,
    cacheSource: task.cache.source,
    restoredOutput,
    outputSha256,
  });
});

const check = (id: string, ok: boolean, detail: string) => CacheConformanceWireCheck.make({ id, ok, detail });

const rejected = (outcome: CacheConformanceNativeOutcome) =>
  outcome.exitCode === 42 && !outcome.restoredOutput && outcome.cacheStatus === "MISS";

const nativeCases: ReadonlyArray<CacheConformanceCaseId> = [
  "RC-009",
  "RC-010",
  "RC-017",
  "RC-018",
  "RC-019",
  "RC-020",
  "RC-021",
  "RC-022",
];

const scenarioCases = HashMap.make<ReadonlyArray<readonly [CacheConformanceCaseId, ReadonlyArray<NativeScenario>]>>(
  ["RC-009", ["producer", "replay"]],
  ["RC-010", ["producer"]],
  ["RC-017", ["producer", "replay"]],
  ["RC-018", ["missing-tag"]],
  ["RC-019", ["tampered-tag"]],
  ["RC-020", ["tampered-body"]],
  ["RC-021", ["foreign-producer", "wrong-team"]],
  ["RC-022", ["epoch-fresh-namespace", "epoch-old-namespace"]]
);

// A fault rejection only counts when the clean replay of the same artifact
// restored: otherwise the client may have rejected it for another reason.
const faultExpectation = (
  outcomes: HashMap.HashMap<NativeScenario, CacheConformanceNativeOutcome>,
  events: ReadonlyArray<CacheConformanceProxyEvent>,
  control: boolean,
  name: NativeScenario,
  fault: CacheConformanceFault
) => {
  const outcome = HashMap.get(outcomes, name);
  const applied = A.some(
    events,
    (event) =>
      event.scenario === name &&
      event.fault === fault &&
      event.exchange.route === "/v8/artifacts/{hash}" &&
      O.contains(event.upstreamStatus, 200)
  );
  return [
    check(
      "control-replay-restored",
      control,
      "the unfaulted signed replay must restore before a fault rejection can be attributed to the fault"
    ),
    check(
      `${name}-applied-to-stored-artifact`,
      applied,
      "the proxy applied the fault to a 200 upstream read of the uploaded artifact"
    ),
    check(
      `${name}-rejected-before-restore`,
      O.exists(outcome, rejected),
      O.match(outcome, { onNone: () => `${name} did not run`, onSome: describe })
    ),
  ];
};

const clientChecks = (
  id: CacheConformanceCaseId,
  outcomes: HashMap.HashMap<NativeScenario, CacheConformanceNativeOutcome>,
  events: ReadonlyArray<CacheConformanceProxyEvent>
): ReadonlyArray<CacheConformanceWireCheck> => {
  const get = (name: NativeScenario) => HashMap.get(outcomes, name);
  const text = (name: NativeScenario) => O.match(get(name), { onNone: () => `${name} did not run`, onSome: describe });
  const producer = get("producer");
  const produced = O.exists(
    producer,
    (outcome) => outcome.exitCode === 0 && outcome.cacheStatus === "MISS" && O.isSome(outcome.outputSha256)
  );
  const replayed = O.exists(
    get("replay"),
    (outcome) =>
      outcome.exitCode === 0 &&
      outcome.cacheStatus === "HIT" &&
      O.contains(outcome.cacheSource, "REMOTE") &&
      O.isSome(outcome.outputSha256) &&
      O.exists(producer, (made) =>
        S.toEquivalence(S.OptionFromNullOr(Sha256Hex))(made.outputSha256, outcome.outputSha256)
      )
  );
  const uploads = A.filter(events, (event) => event.scenario === "producer" && event.exchange.method === "PUT");
  const uploadText = A.join(
    A.map(uploads, (event) =>
      O.match(event.exchange.status, { onNone: () => event.exchange.outcome, onSome: (code) => `${code}` })
    ),
    ", "
  );
  return Match.value(id).pipe(
    Match.when("RC-009", () => [
      check(
        "producer-uploaded",
        produced && A.isReadonlyArrayNonEmpty(uploads),
        `${text("producer")}; upload ${uploadText || "absent"}`
      ),
      check("client-accepted-upload", replayed, `upload answered ${uploadText || "nothing"}; ${text("replay")}`),
    ]),
    Match.when("RC-010", () => [
      check(
        "genuine-miss-before-upload",
        A.some(
          events,
          (event) =>
            event.scenario === "producer" &&
            event.exchange.route === "/v8/artifacts/{hash}" &&
            event.exchange.outcome === "miss"
        ),
        "the proxy delivered a 404 for a hash never uploaded in the fresh namespace"
      ),
      check("miss-executed-task", produced, text("producer")),
    ]),
    Match.when("RC-017", () => [
      check("signed-producer", produced, text("producer")),
      check("signed-remote-replay", replayed, text("replay")),
    ]),
    Match.when("RC-018", () => faultExpectation(outcomes, events, replayed, "missing-tag", "missing-tag")),
    Match.when("RC-019", () => faultExpectation(outcomes, events, replayed, "tampered-tag", "tampered-tag")),
    Match.when("RC-020", () => faultExpectation(outcomes, events, replayed, "tampered-body", "tampered-body")),
    Match.when("RC-021", () => [
      check("control-replay-restored", replayed, text("replay")),
      check(
        "foreign-team-producer",
        O.exists(get("foreign-producer"), (outcome) => outcome.exitCode === 0 && O.isSome(outcome.outputSha256)),
        text("foreign-producer")
      ),
      check(
        "foreign-tag-replayed",
        A.some(
          events,
          (event) =>
            event.scenario === "wrong-team" &&
            event.exchange.route === "/v8/artifacts/{hash}" &&
            O.contains(event.exchange.status, 200)
        ),
        "the proxy delivered the other team's captured body and tag"
      ),
      check("wrong-team-rejected-before-restore", O.exists(get("wrong-team"), rejected), text("wrong-team")),
    ]),
    Match.when("RC-022", () => [
      check("control-replay-restored", replayed, text("replay")),
      check(
        "fresh-namespace-not-restored",
        O.exists(get("epoch-fresh-namespace"), rejected),
        text("epoch-fresh-namespace")
      ),
      check(
        "old-namespace-new-key-rejected",
        O.exists(get("epoch-old-namespace"), rejected),
        text("epoch-old-namespace")
      ),
    ]),
    Match.orElse(() => [])
  );
};

const policyChecks = (events: ReadonlyArray<CacheConformanceProxyEvent>) => {
  const fresh = A.filter(
    events,
    (event) =>
      event.scenario === "epoch-fresh-namespace" &&
      event.exchange.route === "/v8/artifacts/{hash}" &&
      event.exchange.method !== "PUT"
  );
  return [
    check(
      "fresh-namespace-served-nothing",
      A.isReadonlyArrayNonEmpty(fresh) && !A.some(fresh, (event) => O.contains(event.upstreamStatus, 200)),
      `fresh-namespace upstream reads: ${
        A.join(
          A.map(fresh, (event) => O.match(event.upstreamStatus, { onNone: () => "none", onSome: (code) => `${code}` })),
          ", "
        ) || "none"
      }`
    ),
    check(
      "old-namespace-artifact-still-present",
      A.some(
        events,
        (event) =>
          event.scenario === "epoch-old-namespace" &&
          event.exchange.route === "/v8/artifacts/{hash}" &&
          O.contains(event.upstreamStatus, 200)
      ),
      "the rotation probe read the old artifact, so its rejection is the client refusing a downgrade"
    ),
  ];
};

const scoreNativeCase = (
  entry: CacheConformanceCase,
  channel: CacheClientChannel,
  outcomes: HashMap.HashMap<NativeScenario, CacheConformanceNativeOutcome>,
  events: ReadonlyArray<CacheConformanceProxyEvent>
) => {
  if (!A.contains(nativeCases, entry.id))
    return skippedCacheConformanceCase(entry, "Not part of the native run; the wire and lab runs score it.");
  const scenarios = O.getOrElse(HashMap.get(scenarioCases, entry.id), () => []);
  const dimension: CacheConformanceDimension =
    channel === "stable" ? "published-stable-client" : "published-canary-client";
  return CacheConformanceCaseResult.make({
    id: entry.id,
    executor: "native",
    exchanges: A.map(
      A.filter(events, (event) => A.contains(scenarios, event.scenario)),
      (event) => event.exchange
    ),
    notes: A.getSomes(A.map(scenarios, (name) => O.map(HashMap.get(outcomes, name), describe))),
    verdicts: cacheConformanceCaseVerdicts(
      entry,
      (scored): CacheConformanceVerdict =>
        scored === dimension
          ? cacheConformanceVerdictOf(clientChecks(entry.id, outcomes, events))
          : scored === "beep-security-policy" && entry.id === "RC-022"
            ? cacheConformanceVerdictOf(policyChecks(events))
            : {
                verdict: "not-executed",
                reason:
                  scored === "published-stable-client" || scored === "published-canary-client"
                    ? "Scored by the other channel's native run."
                    : "The native run scores only client dimensions and RC-022 namespace isolation.",
              }
    ),
  });
};

/**
 * Run the native signed-cache matrix for one exact client channel.
 *
 * **Details**
 * Each run draws a fresh namespace epoch per channel and per-run synthetic
 * signing keys. A writer producer uploads; a reader replay with an empty
 * local cache must be a remote hit with identical output; missing-tag,
 * tampered-tag, tampered-body and wrong-team replays (faults applied by the
 * proxy) must restore nothing, with fallback execution denied. Epoch rotation
 * checks that a fresh namespace and key restore nothing and that the old
 * namespace under a new key is rejected rather than downgraded. Turbo runs in
 * bubblewrap user, PID, IPC and UTS namespaces but shares the host network,
 * because the target is outside any private namespace; it is pointed only at
 * the loopback proxy.
 *
 * **Example** (Plan a native run)
 * ```ts
 * import { runCacheConformanceNative } from "@beep/repo-cli/commands/Cache"
 * console.assert(typeof runCacheConformanceNative === "function")
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCacheConformanceNative = Effect.fn("CacheConformance.runNativeMatrix")(
  function* (
    root: string,
    corpus: CacheConformanceCorpus,
    target: CacheConformanceTarget,
    bearers: CacheConformanceBearers,
    client: { readonly pin: CacheConformanceClientPin; readonly executable: string }
  ) {
    yield* requireCacheLinuxX64("Native conformance requires Linux x64.");
    yield* assertCacheConformanceTargetBoundary(target);
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const crypto = yield* SecureRandom.SecureRandom;
    const startedAt = DateTime.formatIso(yield* DateTime.now);
    const executable = yield* verifyExecutable(client.executable, client.pin);
    const random = (bytes: number) => crypto.randomBytes(bytes).pipe(Effect.map(Hex.encode));
    const epoch = yield* random(4);
    const rotated = yield* random(4);
    const key = Redacted.make(yield* random(32));
    const rotatedKey = Redacted.make(yield* random(32));
    const channel = client.pin.channel;
    const team = `${target.namespace.teamId}_${channel}_${epoch}`;
    const foreignTeam = `${target.namespace.foreignTeamId}_${channel}_${epoch}`;
    const freshTeam = `${target.namespace.teamId}_${channel}_${rotated}`;
    const plans: ReadonlyArray<ScenarioPlan> = [
      { name: "producer", team, signing: key, role: "writer", deny: false, fault: "none" },
      { name: "replay", team, signing: key, role: "reader", deny: true, fault: "none" },
      { name: "missing-tag", team, signing: key, role: "reader", deny: true, fault: "missing-tag" },
      { name: "tampered-tag", team, signing: key, role: "reader", deny: true, fault: "tampered-tag" },
      { name: "tampered-body", team, signing: key, role: "reader", deny: true, fault: "tampered-body" },
      { name: "foreign-producer", team: foreignTeam, signing: key, role: "writer", deny: false, fault: "none" },
      { name: "wrong-team", team, signing: key, role: "reader", deny: true, fault: "wrong-team" },
      {
        name: "epoch-fresh-namespace",
        team: freshTeam,
        signing: rotatedKey,
        role: "reader",
        deny: true,
        fault: "none",
      },
      { name: "epoch-old-namespace", team, signing: rotatedKey, role: "reader", deny: true, fault: "none" },
    ];
    const secrets = [
      Redacted.value(bearers.reader),
      Redacted.value(bearers.writer),
      Redacted.value(key),
      Redacted.value(rotatedKey),
    ];
    const proxy = yield* makeCacheConformanceFaultProxy(
      CacheConformanceProxyOptions.make({ target, bearers, holdMs: 1000 })
    );
    const parent = path.join(root, ".beep/cache-conformance-native");
    yield* fs.makeDirectory(parent, { recursive: true });
    const directory = yield* fs.makeTempDirectoryScoped({ directory: parent, prefix: `${channel}-` });
    const outcomes = yield* Effect.forEach(
      plans,
      Effect.fnUntraced(function* (plan) {
        yield* proxy.setScenario(plan.name, plan.fault);
        const work = yield* prepareWorkspace(directory, plan);
        return [plan.name, yield* runNative(work, executable, proxy.url, plan, bearers, client.pin, secrets)] as const;
      })
    );
    yield* proxy.setScenario("native-done", "none");
    const events = yield* proxy.events;
    const byScenario = HashMap.fromIterable(outcomes);
    const cases = A.map(corpus.cases, (entry) => scoreNativeCase(entry, channel, byScenario, events));
    if ((yield* hashCacheExperimentExecutable(executable)) !== client.pin.executableSha256)
      return yield* CacheCommandError.new("The native client changed during the run.");
    return assembleCacheConformanceRun({
      corpus,
      target,
      startedAt,
      executors: ["native"],
      clients: [
        CacheConformanceClientRecord.make({
          channel,
          version: client.pin.version,
          executableSha256: client.pin.executableSha256,
        }),
      ],
      representative: false,
      cases,
    });
  },
  Effect.scoped,
  CacheCommandError.mapError("Native conformance execution failed.")
);
