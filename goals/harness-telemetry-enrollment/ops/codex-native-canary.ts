/**
 * Fixed, at-most-once subscription Codex canary and immutable metadata delivery.
 * No sessions, resume, arbitrary prompts, tool access or generic messaging API.
 * @packageDocumentation
 * @since 0.0.0
 */

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
import * as Toml from "effect/encoding/Toml";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CodexCanarySource, decodeCodexCanaryOutput } from "./codex-exec-wire.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/codex-native-canary");
const absolute = S.String.check(S.isPattern(/^\/[^\u0000-\u001f"\\]*$/), S.isMaxLength(4096)).pipe(
  $I.annoteSchema("CodexCanaryAbsolutePath", {
    description: "Restricted absolute path; control characters, quotes and backslashes are refused at admission.",
  })
);
const encodeTomlPath = S.encodeEffect(S.fromJsonString(absolute));
/**
 * Private owner admission, with fixed purpose/model and separately declared ingress/launch routes.
 * **Example** (Inspect the admission schema)
 * ```ts
 * console.log(typeof CodexNativeCanaryRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CodexNativeCanaryRequest extends S.Opaque<CodexNativeCanaryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("codex-native-canary-request/v1"),
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
    isolatedHome: absolute,
    sharedCodexHome: absolute,
    authMode: S.Literals(["preprovisioned-shadow", "existing-native-auth-home"]),
    shadowCodexHome: S.OptionFromOptionalKey(absolute),
    nativeLogDirectory: absolute,
    nativeConfigSha256: Sha256Hex,
    socketPath: absolute.check(S.isMaxLength(100)),
    admission: S.tag("owner-approved-fixed-canary-no-tools"),
  }).pipe(
    $I.annoteSchema("CodexNativeCanaryRequest", {
      description:
        "Private paths and namespace salt are local inputs only; no arbitrary argv/env/prompt or auth values.",
    })
  )
) {}

/**
 * Safe fixed refusal; underlying filesystem/process/protocol text never crosses this boundary.
 * **Example** (Inspect refusal schema)
 * ```ts
 * console.log(typeof CodexNativeCanaryError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CodexNativeCanaryError extends S.TaggedError<CodexNativeCanaryError, { readonly brand: unique symbol }>(
  $I`CodexNativeCanaryError`
)(
  "CodexNativeCanaryError",
  { phase: S.Literals(["admission", "attempted-unknown", "source", "delivery"]) },
  $I.annote("CodexNativeCanaryError", { description: "Bounded canary failure; attempted never implies zero work." })
) {}
const failed = (phase: CodexNativeCanaryError["phase"]) => CodexNativeCanaryError.make({ phase });

const mcpServer = S.Struct({
  name: S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,128}$/)),
  enabled: S.Boolean,
  transport: S.Struct({ type: S.Literals(["stdio", "streamable_http"]) }),
}).pipe(
  $I.annoteSchema("CodexMcpMetadata", {
    description: "Transient safe projection from native mcp list; all other fields are discarded, never serialized.",
  })
);
const mcpServers = S.Array(mcpServer)
  .check(S.isMaxLength(64))
  .pipe(
    $I.annoteSchema("CodexMcpServers", {
      description:
        "Bounded transient native MCP metadata, with unknown fields discarded before the projection leaves the decoder.",
    })
  );
const qualification = S.Struct({
  version: S.tag("codex-native-isolation/v1"),
  configSha256: Sha256Hex,
  configIdentitySha256: Sha256Hex,
  mcpNamesSha256: Sha256Hex,
  mcpTableSha256: Sha256Hex,
  qualifiedArgsSha256: Sha256Hex,
  configuredCount: S.Natural.check(S.isLessThanOrEqualTo(64)),
  baselineEnabledCount: S.Natural.check(S.isLessThanOrEqualTo(64)),
  qualifiedEnabledCount: S.tag(0),
}).pipe(
  $I.annoteSchema("CodexNativeIsolation", {
    description:
      "Finite immediate native consumer qualification; no raw IDs, config, transport or cloud snapshot claim.",
  })
);
const encodeQualification = S.encodeEffect(S.fromJsonString(qualification));
const forbiddenBootstrap = [
  "cli_auth_credentials_store",
  "chatgpt_base_url",
  "forced_login_method",
  "forced_chatgpt_workspace_id",
  "config_server",
  "model_provider",
  "model_providers",
  "profile",
  "profiles",
];
const forbiddenFeatures = ["secret_auth_storage", "respect_system_proxy", "system_proxy_fallback"];
const configRecord = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("CodexPrivateConfigRecord", {
    description: "Transient non-auth configuration parsed solely to reject the reviewed bootstrap override keys.",
  })
);
const pinNativeConfig = Effect.fn("CodexCanary.pinNativeConfig")(function* (
  request: CodexNativeCanaryRequest,
  effectiveHome: string
) {
  // @effect-diagnostics-next-line asyncFunction:off -- Fixed non-auth config files are fingerprinted atomically at the filesystem boundary.
  const textAndIdentity = yield* io(async () => {
    for (const path of ["/etc/codex/config.toml", "/etc/codex/managed_config.toml", "/etc/codex/requirements.toml"]) {
      try {
        await Fs.lstat(path);
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") continue;
        throw error;
      }
      throw new Error("unexpected-system-config");
    }
    const path = `${effectiveHome}/config.toml`;
    const before = await Fs.lstat(path, { bigint: true });
    if (
      before.isSymbolicLink() ||
      !before.isFile() ||
      before.uid !== BigInt(process.getuid?.() ?? -1) ||
      (before.mode & 0o022n) !== 0n ||
      before.size > 1048576n ||
      (await Fs.realpath(path)) !== path
    )
      throw new Error("config-entry");
    const text = await Fs.readFile(path, "utf8");
    const after = await Fs.lstat(path, { bigint: true });
    const signature = (stat: typeof before) =>
      `${stat.dev}:${stat.ino}:${stat.mode}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
    if (signature(before) !== signature(after)) throw new Error("config-changed");
    return { text, identity: signature(after) };
  });
  const digest = yield* hashPublicTextSha256(textAndIdentity.text);
  if (digest !== request.nativeConfigSha256) return yield* failed("admission");
  const parsed = yield* Toml.parse(textAndIdentity.text).pipe(
    Effect.fromResult,
    Effect.mapError(() => failed("admission"))
  );
  const config = yield* S.decodeEffect(configRecord)(parsed).pipe(Effect.mapError(() => failed("admission")));
  if (A.some(forbiddenBootstrap, (key) => R.has(config, key))) return yield* failed("admission");
  const featureValue = R.get(config, "features");
  if (O.isSome(featureValue)) {
    const features = yield* S.decodeUnknownEffect(configRecord)(featureValue.value).pipe(
      Effect.mapError(() => failed("admission"))
    );
    if (A.some(forbiddenFeatures, (key) => R.has(features, key))) return yield* failed("admission");
  }
  return yield* hashPublicTextSha256(textAndIdentity.identity);
});

/**
 * Immutable source completion, independent from receipt/backend visibility.
 * **Example** (Inspect immutable source schema)
 * ```ts
 * console.log(typeof CodexNativeCanaryEvidence.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CodexNativeCanaryEvidence extends S.Opaque<CodexNativeCanaryEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("codex-native-canary-evidence/v1"),
    requestBinding: Sha256Hex,
    observation: ManagedControllerObservation,
    source: CodexCanarySource,
    qualification,
  }).pipe(
    $I.annoteSchema("CodexNativeCanaryEvidence", {
      description: "No response, reasoning, raw session, argv, paths or auth; source completion is not backend proof.",
    })
  )
) {}
const encodeEvidence = S.encodeEffect(S.fromJsonString(CodexNativeCanaryEvidence));
const decodeEvidence = S.decodeEffect(S.fromJsonString(CodexNativeCanaryEvidence), { onExcessProperty: "error" });
const encodeRequest = S.encodeEffect(S.fromJsonString(CodexNativeCanaryRequest));
const io = <A>(thunk: () => Promise<A>, phase: CodexNativeCanaryError["phase"] = "admission") =>
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
const fixedTransport = Effect.fn("CodexCanary.privateTransport")(function* (socketPath: string) {
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
        CodexNativeCanaryError
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

// Fixed rust-v0.166.0 flags. No caller-controlled prompt/options and no resume/session attach.
const args = [
  "exec",
  "--json",
  "--ephemeral",
  "--ignore-user-config",
  "--ignore-rules",
  "--strict-config",
  "--skip-git-repo-check",
  "--sandbox",
  "read-only",
  "--model",
  "gpt-6.1-sol",
  "-c",
  'model_reasoning_effort="medium"',
  "-c",
  'forced_login_method="chatgpt"',
  "-c",
  "project_doc_max_bytes=0",
  "-c",
  'web_search="disabled"',
  "--disable",
  "shell_tool",
  "--disable",
  "unified_exec",
  "--disable",
  "hooks",
  "--disable",
  "apps",
  "--disable",
  "plugins",
  "--disable",
  "multi_agent",
  "--disable",
  "multi_agent_v2",
  "--disable",
  "view_image",
  "Reply with exactly ENROLLMENT_CANARY_OK. Do not use tools, inspect files, or perform any other work.",
];

/**
 * Run one admitted fixed canary, or retry only its immutable metadata delivery.
 *
 * **Details**
 * An attempted marker without a complete source receipt refuses execution. Failure is unknown,
 * never zero. A source receipt permits only exact lifecycle/AGENT replay in its original epoch.
 * Receipt acceptance proves local durability; backend remains unknown until worker readback.
 * Native auth is consumed in its existing home or an already provisioned shadow; no secrets are copied.
 * Ephemeral suppresses native session files. Other native retention remains Unknown.
 *
 * **Example** (Inspect the fixed launcher)
 * ```ts
 * console.log(typeof runCodexNativeCanary)
 * ```
 * @param request - Owner-admitted private request; no generic prompt interface.
 * @returns Safe immutable source and local-delivery status; never model response text.
 * @category orchestration
 * @since 0.0.0
 */
export const runCodexNativeCanary = Effect.fn("HarnessEnrollment.codexNativeCanary")(function* (
  request: CodexNativeCanaryRequest
) {
  if (request.identity.harness !== "codex-cli" || request.identity.surface !== "cli") return yield* failed("admission");
  yield* io(() => privateEntry(request.attemptDirectory, "directory"));
  yield* io(() => privateEntry(request.isolatedHome, "directory"));
  yield* io(() => privateEntry(request.nativeLogDirectory, "directory"));
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
      (route) => route.routeId === request.identity.routeId && route.harness === "codex-cli" && route.surface === "cli"
    )
  )
    return yield* failed("admission");
  const postFact = Effect.fn("CodexCanary.postFact")(function* (fact: ObservationLaunchFact) {
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
  let evidence: CodexNativeCanaryEvidence;
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
    const sourceJson = yield* S.encodeEffect(S.fromJsonString(CodexCanarySource))(evidence.source);
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
    const layout = home.resolveCodexHomeLayout({
      homePath: O.some(request.sharedCodexHome),
      shadowHomePath: request.authMode === "preprovisioned-shadow" ? request.shadowCodexHome : O.none(),
    });
    if (request.authMode === "preprovisioned-shadow") {
      if (
        layout.mode !== "authOverlay" ||
        O.isNone(request.shadowCodexHome) ||
        O.isNone(layout.effectiveHomePath) ||
        layout.effectiveHomePath.value !== request.shadowCodexHome.value
      )
        return yield* failed("admission");
      yield* home.ensureCodexShadowHome(layout).pipe(Effect.mapError(() => failed("admission")));
      yield* io(() => privateEntry(O.getOrThrow(request.shadowCodexHome), "directory"));
      yield* io(() => privateEntry(`${O.getOrThrow(request.shadowCodexHome)}/auth.json`, "file"));
    } else if (
      layout.mode !== "direct" ||
      O.isSome(request.shadowCodexHome) ||
      layout.sharedHomePath !== request.sharedCodexHome
    )
      return yield* failed("admission");
    const env = home.makeCodexEnv({
      baseEnv: {
        HOME: request.isolatedHome,
        CODEX_HOME: request.sharedCodexHome,
        PATH: "/usr/bin:/bin",
        LANG: "C.UTF-8",
        NO_COLOR: "1",
        RUST_LOG: "off",
      },
      layout,
    });
    const effectiveHome = O.getOrElse(layout.effectiveHomePath, () => request.sharedCodexHome);
    if (env.CODEX_HOME !== effectiveHome) return yield* failed("admission");
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const probe = (probeArgs: ReadonlyArray<string>, capture: boolean, maximum = 1024) =>
      Effect.scoped(
        Effect.gen(function* () {
          const child = yield* spawner.spawn(
            ChildProcess.make(request.executable, probeArgs, {
              cwd: request.workspace,
              env,
              extendEnv: false,
              stdin: "ignore",
              stderr: "ignore",
              forceKillAfter: "3 seconds",
            })
          );
          const text = yield* boundedText(child.stdout, maximum);
          if (Number(yield* child.exitCode) !== 0) return yield* failed("admission");
          return capture ? text : "";
        })
      ).pipe(
        Effect.timeout("15 seconds"),
        Effect.mapError(() => failed("admission"))
      );
    if (Str.trim(yield* probe(["--version"], true)) !== "codex-cli 0.166.0") return yield* failed("admission");
    yield* probe(["login", "status"], false);
    const configIdentitySha256 = yield* pinNativeConfig(request, effectiveHome);
    const quotedWorkspace = yield* encodeTomlPath(request.workspace);
    const quotedLogDirectory = yield* encodeTomlPath(request.nativeLogDirectory);
    const projectOverride = `projects={${quotedWorkspace}={trust_level="untrusted"}}`;
    const listArgs = [
      "mcp",
      "list",
      "--json",
      "-c",
      'forced_login_method="chatgpt"',
      "-c",
      `log_dir=${quotedLogDirectory}`,
      "-c",
      projectOverride,
      "--disable",
      "apps",
      "--disable",
      "plugins",
      "--disable",
      "hooks",
      "-c",
      'otel.exporter="none"',
      "-c",
      'otel.trace_exporter="none"',
      "-c",
      'otel.metrics_exporter="none"',
    ];
    const list = Effect.fn("CodexCanary.listMcp")(function* (overrides: ReadonlyArray<string>) {
      const raw = yield* probe([...listArgs, ...overrides], true, 1048576);
      // Native list includes credential-bearing transport fields. Decode only safe metadata and discard raw text.
      const servers = yield* S.decodeEffect(S.fromJsonString(mcpServers))(raw).pipe(
        Effect.mapError(() => failed("admission"))
      );
      const sorted = A.sort(
        servers,
        Order.mapInput(Str.Order, (server: typeof mcpServer.Type) => server.name)
      );
      for (let index = 1; index < sorted.length; index += 1)
        if (sorted[index]?.name === sorted[index - 1]?.name) return yield* failed("admission");
      return sorted;
    });
    const baseline = yield* list([]);
    const disabledTable = `mcp_servers={${A.join(
      A.map(
        baseline,
        (server) =>
          `"${server.name}"={enabled=false,${server.transport.type === "stdio" ? 'command="/usr/bin/false"' : 'url="https://127.0.0.1:9"'}}`
      ),
      ","
    )}}`;
    const disabled = yield* list(["-c", disabledTable]);
    const nameProjection = S.Array(
      S.Struct({ name: mcpServer.fields.name, transport: mcpServer.fields.transport })
    ).pipe(
      $I.annoteSchema("CodexMcpNameProjection", {
        description:
          "Canonical transient server names/kinds for exact native before/after comparison and digesting only.",
      })
    );
    const nameJson = (servers: typeof mcpServers.Type) =>
      S.encodeEffect(S.fromJsonString(nameProjection))(A.map(servers, ({ name, transport }) => ({ name, transport })));
    const baselineNames = yield* nameJson(baseline);
    if (baselineNames !== (yield* nameJson(disabled)) || A.some(disabled, (server) => server.enabled))
      return yield* failed("admission");
    const qualifiedArgs = [
      ...args.slice(0, -1),
      "-c",
      `log_dir=${quotedLogDirectory}`,
      "-c",
      projectOverride,
      "-c",
      disabledTable,
      "-c",
      "otel.log_user_prompt=false",
      "-c",
      "otel.log_agent_responses=false",
      "-c",
      'otel.exporter="none"',
      "-c",
      'otel.trace_exporter="none"',
      "-c",
      'otel.metrics_exporter="none"',
      args[args.length - 1] ?? "",
    ];
    const encodeArgs = S.encodeEffect(S.fromJsonString(S.Array(S.String)));
    const isolation = qualification.make({
      configSha256: request.nativeConfigSha256,
      configIdentitySha256,
      mcpNamesSha256: yield* hashPublicTextSha256(baselineNames),
      mcpTableSha256: yield* hashPublicTextSha256(disabledTable),
      qualifiedArgsSha256: yield* hashPublicTextSha256(yield* encodeArgs(qualifiedArgs)),
      configuredCount: baseline.length,
      baselineEnabledCount: A.filter(baseline, (server) => server.enabled).length,
    });
    const qualificationJson = yield* encodeQualification(isolation);
    yield* io(() => durableCreate(request.attemptDirectory, "preflight.json", qualificationJson));
    yield* postFact(prepared);
    if ((yield* pinNativeConfig(request, effectiveHome)) !== configIdentitySha256) return yield* failed("admission");
    evidence = yield* Effect.scoped(
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis;
        const mono = yield* Clock.monotonicTimeNanos;
        const child = yield* spawner.spawn(
          ChildProcess.make(request.executable, qualifiedArgs, {
            cwd: request.workspace,
            env,
            extendEnv: false,
            stdin: "ignore",
            stderr: "ignore",
            forceKillAfter: "3 seconds",
          })
        );
        const processInstanceId = yield* hashPrivateIdentifier(
          `codex-canary-process/v1:${request.launchId}:${child.pid}:${start}`,
          O.some(Redacted.value(request.hashSalt))
        );
        yield* postFact(ObservationLaunchFact.cases.Started.make({ launchId: request.launchId, processInstanceId }));
        const stdout = yield* boundedText(child.stdout, 262144);
        if (Number(yield* child.exitCode) !== 0) return yield* failed("source");
        const source = yield* decodeCodexCanaryOutput(stdout, request.hashSalt);
        const end = yield* Clock.currentTimeMillis;
        const elapsed = (yield* Clock.monotonicTimeNanos) - mono;
        const sourceJson = yield* S.encodeEffect(S.fromJsonString(CodexCanarySource))(source);
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
        return CodexNativeCanaryEvidence.make({ requestBinding, observation, source, qualification: isolation });
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
  $I.annoteSchema("CodexCanaryDeliveryReport", {
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
      const request = yield* S.decodeEffect(S.fromJsonString(CodexNativeCanaryRequest), { onExcessProperty: "error" })(
        raw
      ).pipe(Effect.mapError(() => failed("admission")));
      const result = yield* runCodexNativeCanary(request).pipe(
        Effect.mapError((error) => (S.is(CodexNativeCanaryError)(error) ? error : failed("source")))
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
