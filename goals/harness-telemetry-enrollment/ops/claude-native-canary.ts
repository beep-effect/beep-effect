/**
 * Fixed, at-most-once subscription Claude canary and immutable metadata delivery.
 * No sessions, resume, arbitrary prompts, tool access or generic messaging API.
 * @packageDocumentation
 * @since 0.0.0
 */

import { createHash } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Atomic O_EXCL/O_NOFOLLOW flags pin the at-most-once filesystem fence.
import { constants } from "node:fs";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Owner/inode/no-follow and directory fsync are the private durable-attempt boundary.
import * as Fs from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Pinned private Unix-socket transport has no network destination.
import * as Http from "node:http";
import { AiProviderCliHome } from "@beep/ai-provider-cli";
import { $RepoCliId } from "@beep/identity/packages";
import {
  encodeManagedControllerObservation,
  ManagedControllerObservation,
} from "@beep/repo-ai-metrics/managed-controller";
import { NativeTraceRequest, projectNativeTraceRequest } from "@beep/repo-ai-metrics/native-trace";
import {
  ObservationLaunchFact,
  ObservationLaunchIdentity,
  ObservationLaunchReceipt,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchContext, ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ClaudePolicySnapshot, qualifyClaudeManagedPolicy } from "./claude-native-policy.ts";
import { ClaudeCanarySource, decodeClaudeCanaryOutput } from "./claude-print-wire.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/claude-native-canary");
const absolute = S.String.check(S.isPattern(/^\/[^\u0000-\u001f"\\]*$/), S.isMaxLength(4096)).pipe(
  $I.annoteSchema("ClaudeCanaryAbsolutePath", {
    description: "Restricted absolute path; control characters, quotes and backslashes are refused at admission.",
  })
);
/**
 * Private owner admission, with fixed purpose/model and separately declared ingress/launch routes.
 * **Example** (Inspect the admission schema)
 * ```ts
 * console.log(typeof ClaudeNativeCanaryRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaudeNativeCanaryRequest extends S.Opaque<ClaudeNativeCanaryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("claude-native-canary-request/v1"),
    launchId: Sha256Hex,
    identity: ObservationLaunchIdentity,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    ingressRouteId: Sha256Hex,
    hashSalt: S.RedactedFromValue(S.NonEmptyString),
    executable: absolute,
    workspace: absolute,
    attemptDirectory: absolute,
    nativeHome: absolute,
    sharedClaudeConfigDirectory: absolute,
    temporaryDirectory: absolute,
    nativePolicySha256: Sha256Hex,
    executableSha256: Sha256Hex,
    socketPath: absolute.check(S.isMaxLength(100)),
    admission: S.tag("owner-approved-fixed-canary-no-tools"),
  }).pipe(
    $I.annoteSchema("ClaudeNativeCanaryRequest", {
      description:
        "Private paths and namespace salt are local inputs only; no arbitrary argv/env/prompt or auth values.",
    })
  )
) {}

/**
 * Safe fixed refusal; underlying filesystem/process/protocol text never crosses this boundary.
 * **Example** (Inspect refusal schema)
 * ```ts
 * console.log(typeof ClaudeNativeCanaryError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ClaudeNativeCanaryError extends S.TaggedError<ClaudeNativeCanaryError, { readonly brand: unique symbol }>(
  $I`ClaudeNativeCanaryError`
)(
  "ClaudeNativeCanaryError",
  { phase: S.Literals(["admission", "attempted-unknown", "source", "delivery"]) },
  $I.annote("ClaudeNativeCanaryError", { description: "Bounded canary failure; attempted never implies zero work." })
) {}
const failed = (phase: ClaudeNativeCanaryError["phase"]) => ClaudeNativeCanaryError.make({ phase });

const qualification = ClaudePolicySnapshot;
const encodeQualification = S.encodeEffect(S.fromJsonString(qualification));

/**
 * Immutable source completion, independent from receipt/backend visibility.
 * **Example** (Inspect immutable source schema)
 * ```ts
 * console.log(typeof ClaudeNativeCanaryEvidence.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaudeNativeCanaryEvidence extends S.Opaque<
  ClaudeNativeCanaryEvidence,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("claude-native-canary-evidence/v1"),
    requestBinding: Sha256Hex,
    observation: ManagedControllerObservation,
    source: ClaudeCanarySource,
    qualification,
  }).pipe(
    $I.annoteSchema("ClaudeNativeCanaryEvidence", {
      description: "No response, reasoning, raw session, argv, paths or auth; source completion is not backend proof.",
    })
  )
) {}
const encodeEvidence = S.encodeEffect(S.fromJsonString(ClaudeNativeCanaryEvidence));
const decodeEvidence = S.decodeEffect(S.fromJsonString(ClaudeNativeCanaryEvidence), { onExcessProperty: "error" });
const encodeRequest = S.encodeEffect(S.fromJsonString(ClaudeNativeCanaryRequest));
const io = <A>(thunk: () => Promise<A>, phase: ClaudeNativeCanaryError["phase"] = "admission") =>
  Effect.tryPromise({ try: thunk, catch: () => failed(phase) });

// Node-only mechanics remain inside a fixed purpose adapter, not an exported transport client.
// @effect-diagnostics-next-line asyncFunction:off -- Atomic filesystem mechanics are lifted by the typed io boundary; no source text is retained.
const privateEntry = async (path: string, kind: "directory" | "socket" | "file") => {
  const stat = await Fs.lstat(path);
  const mode = kind === "directory" ? 0o700 : 0o600;
  if (
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o777) !== mode ||
    (kind === "directory" ? !stat.isDirectory() : kind === "socket" ? !stat.isSocket() : !stat.isFile()) ||
    (await Fs.realpath(path)) !== path
  )
    throw new Error("private-entry");
  return `${stat.dev}:${stat.ino}`;
};
// @effect-diagnostics-next-line asyncFunction:off -- Atomic filesystem mechanics are lifted by the typed io boundary; no source text is retained.
const durableCreate = async (directory: string, name: string, text: string) => {
  const file = await Fs.open(
    `${directory}/${name}`,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600
  );
  try {
    await file.writeFile(text, "utf8");
    await file.sync();
  } finally {
    await file.close();
  }
  const dir = await Fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY);
  try {
    await dir.sync();
  } finally {
    await dir.close();
  }
};
// @effect-diagnostics-next-line asyncFunction:off -- Atomic filesystem mechanics are lifted by the typed io boundary; no source text is retained.
const readEvidence = async (directory: string) => {
  const filename = `${directory}/source.json`;
  try {
    await privateEntry(filename, "file");
  } catch (error) {
    // Only a truly absent source is treated as absent; unsafe entries remain failures.
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return O.none<string>();
    throw error;
  }
  const stat = await Fs.lstat(filename);
  if (stat.size > 16384) throw new Error("source-size");
  return O.some(await Fs.readFile(filename, "utf8"));
};
const fixedTransport = Effect.fn("ClaudeCanary.privateTransport")(function* (socketPath: string) {
  const path = yield* Path.Path;
  const directory = path.dirname(socketPath);
  const dirPin = yield* io(() => privateEntry(directory, "directory"));
  const socketPin = yield* io(() => privateEntry(socketPath, "socket"));
  return (path: "/v1/launch-context" | "/v1/launch-facts" | "/v1/traces", body: O.Option<Uint8Array>) =>
    Effect.gen(function* () {
      const currentDir = yield* io(() => privateEntry(directory, "directory"), "delivery");
      const currentSocket = yield* io(() => privateEntry(socketPath, "socket"), "delivery");
      if (currentDir !== dirPin || currentSocket !== socketPin) return yield* failed("delivery");
      return yield* Effect.callback<
        { readonly body: string; readonly receipt: O.Option<string> },
        ClaudeNativeCanaryError
      >((resume) => {
        const refuse = () => resume(Effect.fail(failed("delivery")));
        const request = Http.request(
          {
            socketPath,
            path,
            method: O.isNone(body) ? "GET" : "POST",
            agent: false,
            headers: O.isNone(body)
              ? {}
              : {
                  "content-type": path === "/v1/traces" ? "application/x-protobuf" : "application/json",
                  "content-length": body.value.byteLength,
                },
          },
          (response) => {
            let data = "";
            response.setEncoding("utf8");
            response.on("data", (chunk: string) => {
              data += chunk;
              if (Buffer.byteLength(data) > 16384) {
                request.destroy();
                refuse();
              }
            });
            response.on("error", refuse);
            response.on("end", () => {
              const receipt = response.headers["x-observation-receipt"];
              if (response.statusCode !== 200) refuse();
              else
                resume(
                  Effect.succeed({ body: data, receipt: typeof receipt === "string" ? O.some(receipt) : O.none() })
                );
            });
          }
        );
        request.on("error", refuse);
        request.end(O.getOrUndefined(body));
        return Effect.sync(() => {
          request.destroy();
        });
      });
    }).pipe(
      Effect.timeout("3 seconds"),
      Effect.mapError(() => failed("delivery"))
    );
});
const bytes = (text: string) => new TextEncoder().encode(text);
const boundedText = <E>(stream: Stream.Stream<Uint8Array, E>, maximum: number) =>
  stream.pipe(
    Stream.mapError(() => failed("source")),
    Stream.decodeText(),
    Stream.runFoldEffect(
      () => "",
      (text, chunk) =>
        Buffer.byteLength(text) + Buffer.byteLength(chunk) <= maximum
          ? Effect.succeed(`${text}${chunk}`)
          : Effect.fail(failed("source"))
    )
  );

// Version-bound flags; no caller-controlled prompt, tools or resume surface.
const args = [
  "--safe-mode",
  "--restricted",
  "--tools",
  "",
  "--strict-mcp-config",
  "--mcp-config",
  '{"mcpServers":{}}',
  "--disable-slash-commands",
  "--no-chrome",
  "--no-session-persistence",
  "--system-prompt-snapshot",
  "off",
  "--permission-mode",
  "dontAsk",
  "--permission-prompts",
  "none",
  "--model",
  "claude-opus-5-5",
  "--effort",
  "medium",
  "--output-format",
  "stream-json",
  "--verbose",
  "--print",
  "Reply with exactly ENROLLMENT_CANARY_OK. Do not use tools, inspect files, or perform any other work.",
];

/**
 * Run one admitted fixed canary, or retry only its immutable metadata delivery.
 *
 * **Details**
 * An attempted marker without a complete source receipt refuses execution. Failure is unknown,
 * never zero. A source receipt permits only exact lifecycle/AGENT replay in its original epoch.
 * Receipt acceptance proves local durability; backend remains unknown until worker readback.
 * Native OAuth is consumed by the CLI in its existing home; no credentials are read or copied.
 * No-session-persistence suppresses native transcripts/resume. Ancillary native home writes remain Unknown.
 *
 * **Example** (Inspect the fixed launcher)
 * ```ts
 * console.log(typeof runClaudeNativeCanary)
 * ```
 * @param request - Owner-admitted private request; no generic prompt interface.
 * @returns Safe immutable source and local-delivery status; never model response text.
 * @category orchestration
 * @since 0.0.0
 */
export const runClaudeNativeCanary = Effect.fn("HarnessEnrollment.claudeNativeCanary")(function* (
  request: ClaudeNativeCanaryRequest
) {
  if (request.identity.harness !== "claude-code" || request.identity.surface !== "cli")
    return yield* failed("admission");
  yield* io(() => privateEntry(request.attemptDirectory, "directory"));
  yield* io(() => privateEntry(request.temporaryDirectory, "directory"));
  const requestBinding = yield* hashPublicTextSha256(yield* encodeRequest(request));
  const send = yield* fixedTransport(request.socketPath);
  const context = yield* S.decodeEffect(S.fromJsonString(ObservationLaunchContext))(
    (yield* send("/v1/launch-context", O.none())).body
  ).pipe(Effect.mapError(() => failed("admission")));
  if (
    !context.accepting ||
    context.hostId !== request.hostId ||
    context.namespaceId !== request.namespaceId ||
    context.evidenceEpoch !== request.evidenceEpoch ||
    !A.some(
      context.routes,
      (route) =>
        route.routeId === request.identity.routeId && route.harness === "claude-code" && route.surface === "cli"
    )
  )
    return yield* failed("admission");
  const postFact = Effect.fn("ClaudeCanary.postFact")(function* (fact: ObservationLaunchFact) {
    const submission = ObservationLaunchSubmission.make({
      hostId: request.hostId,
      namespaceId: request.namespaceId,
      evidenceEpoch: request.evidenceEpoch,
      fact,
    });
    const body = yield* S.encodeEffect(S.fromJsonString(ObservationLaunchSubmission))(submission);
    const receipt = yield* S.decodeEffect(S.fromJsonString(ObservationLaunchReceipt))(
      (yield* send("/v1/launch-facts", O.some(bytes(body)))).body
    ).pipe(Effect.mapError(() => failed("delivery")));
    if (
      receipt.hostId !== request.hostId ||
      receipt.namespaceId !== request.namespaceId ||
      receipt.evidenceEpoch !== request.evidenceEpoch ||
      (yield* S.encodeEffect(S.fromJsonString(ObservationLaunchFact))(receipt.fact)) !==
        (yield* S.encodeEffect(S.fromJsonString(ObservationLaunchFact))(fact))
    )
      return yield* failed("delivery");
  });
  const prepared = ObservationLaunchFact.cases.Prepared.make({
    launchId: request.launchId,
    identity: request.identity,
  });
  const saved = yield* io(() => readEvidence(request.attemptDirectory));
  let evidence: ClaudeNativeCanaryEvidence;
  if (O.isSome(saved)) {
    // @effect-diagnostics-next-line asyncFunction:off -- Atomic filesystem mechanics are lifted by the typed io boundary; no source text is retained.
    yield* io(async () => {
      const marker = `${request.attemptDirectory}/attempted`;
      await privateEntry(marker, "file");
      if ((await Fs.lstat(marker)).size !== 64 || (await Fs.readFile(marker, "utf8")) !== requestBinding)
        throw new Error("marker-binding");
    }, "attempted-unknown");
    evidence = yield* decodeEvidence(saved.value).pipe(Effect.mapError(() => failed("attempted-unknown")));
    if (
      evidence.requestBinding !== requestBinding ||
      evidence.observation.launchId !== request.launchId ||
      evidence.observation.launchRouteId !== request.identity.routeId ||
      evidence.observation.sourceSessionId !== evidence.source.sourceSessionId
    )
      return yield* failed("attempted-unknown");
    const sourceJson = yield* S.encodeEffect(S.fromJsonString(ClaudeCanarySource))(evidence.source);
    const observation = evidence.observation;
    const qualificationJson = yield* encodeQualification(evidence.qualification);
    if (
      observation.evidenceId !==
      (yield* hashPublicTextSha256(
        `${requestBinding}:${qualificationJson}:${sourceJson}:${BigInt(observation.startTimeUnixNano) / 1000000n}:${BigInt(observation.endTimeUnixNano) / 1000000n}:${observation.elapsedNanos}`
      ))
    )
      return yield* failed("attempted-unknown");
  } else {
    // Exclusive fsynced marker wins before any process (including probes) is spawned.
    yield* io(() => durableCreate(request.attemptDirectory, "attempted", requestBinding), "attempted-unknown");
    const home = yield* AiProviderCliHome;
    const nativeHome = home.resolveClaudeHome(O.some(request.nativeHome));
    if (nativeHome !== request.nativeHome) return yield* failed("admission");
    const env = home.makeClaudeEnv({
      homePath: O.some(nativeHome),
      baseEnv: {
        HOME: nativeHome,
        CLAUDE_CONFIG_DIR: request.sharedClaudeConfigDirectory,
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        NO_COLOR: "1",
        TMPDIR: request.temporaryDirectory,
        DISABLE_UPDATES: "1",
        DISABLE_AUTOUPDATER: "1",
        DISABLE_TELEMETRY: "1",
        DISABLE_ERROR_REPORTING: "1",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        CLAUDE_CODE_ENABLE_TELEMETRY: "0",
        CLAUDE_CODE_SKIP_PROMPT_HISTORY: "1",
        CLAUDE_CODE_EFFORT_LEVEL: "medium",
        CLAUDE_CODE_DISABLE_FAST_MODE: "1",
        ENABLE_CLAUDEAI_MCP_SERVERS: "false",
        ENABLE_BETA_TRACING_DETAILED: "0",
        OTEL_LOG_USER_PROMPTS: "0",
        OTEL_LOG_ASSISTANT_RESPONSES: "0",
        OTEL_LOG_RAW_API_BODIES: "0",
        OTEL_LOG_TOOL_CONTENT: "0",
        OTEL_LOG_TOOL_DETAILS: "0",
        OTEL_LOG_MANAGED_SETTINGS: "0",
        OTEL_TRACES_EXPORTER: "none",
        OTEL_LOGS_EXPORTER: "none",
        OTEL_METRICS_EXPORTER: "none",
      },
    });
    if (env.HOME !== nativeHome || env.CLAUDE_CONFIG_DIR !== request.sharedClaudeConfigDirectory)
      return yield* failed("admission");
    const pinExecutable = Effect.fn("ClaudeCanary.pinExecutable")(function* () {
      const content = yield* io(async () => {
        const stat = await Fs.lstat(request.executable);
        if (
          !stat.isFile() ||
          stat.isSymbolicLink() ||
          (stat.mode & 0o111) === 0 ||
          (stat.mode & 0o022) !== 0 ||
          stat.size > 536870912 ||
          (stat.uid !== 0 && stat.uid !== process.getuid?.()) ||
          (await Fs.realpath(request.executable)) !== request.executable
        )
          throw new Error("unsafe-executable");
        // Executable bytes only, never a native credential/config file.
        return await Fs.readFile(request.executable);
      });
      const digest = Sha256Hex.make(createHash("sha256").update(content).digest("hex"));
      if (digest !== request.executableSha256) return yield* failed("admission");
    });
    yield* pinExecutable();
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const version = yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawner.spawn(
          ChildProcess.make(request.executable, ["--version"], {
            cwd: request.workspace,
            env,
            extendEnv: false,
            stdin: "ignore",
            stderr: "ignore",
            forceKillAfter: "3 seconds",
          })
        );
        const text = yield* boundedText(child.stdout, 1024);
        if (Number(yield* child.exitCode) !== 0) return yield* failed("admission");
        return text;
      })
    ).pipe(
      Effect.timeout("15 seconds"),
      Effect.mapError(() => failed("admission"))
    );
    if (Str.trim(version) !== "2.1.318 (Claude Code)") return yield* failed("admission");
    const isolation = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory);
    if (isolation.digest !== request.nativePolicySha256) return yield* failed("admission");
    const qualificationJson = yield* encodeQualification(isolation);
    yield* io(() => durableCreate(request.attemptDirectory, "preflight.json", qualificationJson));
    yield* postFact(prepared);
    const immediatePolicy = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory);
    if (immediatePolicy.digest !== isolation.digest) return yield* failed("admission");
    yield* pinExecutable();
    evidence = yield* Effect.scoped(
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis;
        const mono = yield* Clock.monotonicTimeNanos;
        const child = yield* spawner.spawn(
          ChildProcess.make(request.executable, args, {
            cwd: request.workspace,
            env,
            extendEnv: false,
            stdin: "ignore",
            stderr: "ignore",
            forceKillAfter: "3 seconds",
          })
        );
        const processInstanceId = yield* hashPrivateIdentifier(
          `claude-canary-process/v1:${request.launchId}:${child.pid}:${start}`,
          O.some(Redacted.value(request.hashSalt))
        );
        yield* postFact(ObservationLaunchFact.cases.Started.make({ launchId: request.launchId, processInstanceId }));
        const stdout = yield* boundedText(child.stdout, 262144);
        if (Number(yield* child.exitCode) !== 0) return yield* failed("source");
        const source = yield* decodeClaudeCanaryOutput(stdout, request.hashSalt, request.workspace);
        const afterPolicy = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory);
        if (afterPolicy.digest !== isolation.digest) return yield* failed("source");
        const end = yield* Clock.currentTimeMillis;
        const elapsed = (yield* Clock.monotonicTimeNanos) - mono;
        const sourceJson = yield* S.encodeEffect(S.fromJsonString(ClaudeCanarySource))(source);
        const observation = yield* S.decodeEffect(ManagedControllerObservation)({
          version: "managed-controller-observation/v1",
          launchId: request.launchId,
          launchRouteId: request.identity.routeId,
          processInstanceId,
          sourceSessionId: source.sourceSessionId,
          evidenceId: yield* hashPublicTextSha256(
            `${requestBinding}:${qualificationJson}:${sourceJson}:${start}:${end}:${elapsed}`
          ),
          startTimeUnixNano: String(BigInt(start) * 1000000n),
          endTimeUnixNano: String(BigInt(end) * 1000000n),
          elapsedNanos: String(elapsed),
          outcome: "completed",
          response: "exact-constant-matched",
        });
        return ClaudeNativeCanaryEvidence.make({ requestBinding, observation, source, qualification: isolation });
      })
    ).pipe(
      Effect.timeout("110 seconds"),
      Effect.mapError(() => failed("source"))
    );
    const encoded = yield* encodeEvidence(evidence);
    yield* io(() => durableCreate(request.attemptDirectory, "source.json", encoded), "source");
  }
  yield* postFact(prepared);
  yield* postFact(
    ObservationLaunchFact.cases.Started.make({
      launchId: request.launchId,
      processInstanceId: evidence.observation.processInstanceId,
    })
  );
  yield* postFact(
    ObservationLaunchFact.cases.SessionBound.make({
      launchId: request.launchId,
      sourceSessionId: evidence.source.sourceSessionId,
    })
  );
  yield* postFact(ObservationLaunchFact.cases.Finished.make({ launchId: request.launchId, outcome: "succeeded" }));
  const payload = yield* encodeManagedControllerObservation(evidence.observation);
  const expected = yield* projectNativeTraceRequest(
    NativeTraceRequest.make({
      routeId: request.ingressRouteId,
      producer: O.some("managed-controller"),
      hashSalt: request.hashSalt,
      approvedModels: [],
      usageConvention: "unknown",
      contentType: "application/x-protobuf",
      body: payload,
    })
  );
  const expectedEventId = expected.spans[0]?.eventId;
  if (expected.rejections.length !== 0 || expected.spans.length !== 1 || expectedEventId === undefined)
    return yield* failed("delivery");
  const response = yield* send("/v1/traces", O.some(payload));
  if (response.body !== "" || O.isNone(response.receipt) || !S.is(Sha256Hex)(response.receipt.value))
    return yield* failed("delivery");
  return { source: evidence, localReceiptId: response.receipt.value, expectedEventId, backend: "Unknown" as const };
});

const report = S.Struct({
  status: S.tag("local-accepted"),
  backend: S.tag("Unknown"),
  localReceiptId: Sha256Hex,
  expectedEventId: Sha256Hex,
  sourceEvidenceId: Sha256Hex,
  sourceSessionId: Sha256Hex,
}).pipe(
  $I.annoteSchema("ClaudeCanaryDeliveryReport", {
    description: "Local delivery only; source text and native counters are absent from stdout.",
  })
);

if (import.meta.main) {
  NodeRuntime.runMain(
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const filename = process.argv[2];
      if (process.argv.length !== 3 || filename === undefined || !path.isAbsolute(filename))
        return yield* failed("admission");
      // @effect-diagnostics-next-line asyncFunction:off -- Atomic filesystem mechanics are lifted by the typed io boundary; no source text is retained.
      const raw = yield* io(async () => {
        await privateEntry(filename, "file");
        if ((await Fs.lstat(filename)).size > 32768) throw new Error("request-size");
        return await Fs.readFile(filename, "utf8");
      });
      const request = yield* S.decodeEffect(S.fromJsonString(ClaudeNativeCanaryRequest), { onExcessProperty: "error" })(
        raw
      ).pipe(Effect.mapError(() => failed("admission")));
      const result = yield* runClaudeNativeCanary(request).pipe(
        Effect.mapError((error) => (S.is(ClaudeNativeCanaryError)(error) ? error : failed("source")))
      );
      yield* Console.log(
        yield* S.encodeEffect(S.fromJsonString(report))(
          report.make({
            localReceiptId: result.localReceiptId,
            expectedEventId: result.expectedEventId,
            sourceEvidenceId: result.source.observation.evidenceId,
            sourceSessionId: result.source.source.sourceSessionId,
          })
        )
      );
    }).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off -- Fixed executable entrypoint owns these platform layers.
      Effect.provide(
        Layer.mergeAll(AiProviderCliHome.layer, NodeCrypto.layer).pipe(Layer.provideMerge(NodeServices.layer))
      )
    )
  );
}
