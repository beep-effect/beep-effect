/**
 * Fixed, at-most-once canonical Muse proxy canary and immutable metadata delivery.
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
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ClaudePolicySnapshot, qualifyClaudeManagedPolicy } from "./claude-native-policy.ts";
import {
  decodeMuseProxyCanaryOutput,
  inspectMuseProxyCanaryOutput,
  MuseProxyCanarySource,
  MuseProxyCanaryWireError,
} from "./muse-proxy-wire.ts";
import {
  NativeAttemptDiagnostic as diagnostic,
  NativeAttemptPhase,
  writeNativeAttemptDiagnostic,
} from "./native-attempt-diagnostic.ts";
import type { MuseProxyCanaryWireDiagnostics } from "./muse-proxy-wire.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/muse-proxy-canary");
const absolute = S.String.check(S.isPattern(/^\/[^\u0000-\u001f"\\]*$/), S.isMaxLength(4096)).pipe(
  $I.annoteSchema("MuseProxyCanaryAbsolutePath", {
    description: "Restricted absolute path; control characters, quotes and backslashes are refused at admission.",
  })
);
/**
 * Private owner admission, with fixed purpose/model and separately declared ingress/launch routes.
 * **Example** (Inspect the admission schema)
 * ```ts
 * console.log(typeof MuseProxyCanaryRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MuseProxyCanaryRequest extends S.Opaque<MuseProxyCanaryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("muse-proxy-canary-request/v1"),
    launchId: Sha256Hex,
    identity: ObservationLaunchIdentity,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    ingressRouteId: Sha256Hex,
    hashSalt: S.RedactedFromValue(S.NonEmptyString),
    executable: absolute,
    canonicalWrapperFile: absolute,
    nativeCommandDirectory: absolute,
    workspace: absolute,
    attemptDirectory: absolute,
    nativeHome: absolute,
    sharedClaudeConfigDirectory: absolute,
    temporaryDirectory: absolute,
    nativePolicySha256: Sha256Hex,
    executableSha256: Sha256Hex,
    socketPath: absolute.check(S.isMaxLength(100)),
    admission: S.tag("owner-approved-fixed-muse-proxy-canary-no-tools"),
  }).pipe(
    $I.annoteSchema("MuseProxyCanaryRequest", {
      description:
        "Private paths and namespace salt are local inputs only; no arbitrary argv/env/prompt or auth values.",
    })
  )
) {}

/**
 * Safe fixed refusal; underlying filesystem/process/protocol text never crosses this boundary.
 * **Example** (Inspect refusal schema)
 * ```ts
 * console.log(typeof MuseProxyCanaryError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class MuseProxyCanaryError extends S.TaggedError<MuseProxyCanaryError, { readonly brand: unique symbol }>(
  $I`MuseProxyCanaryError`
)(
  "MuseProxyCanaryError",
  { phase: NativeAttemptPhase },
  $I.annote("MuseProxyCanaryError", { description: "Bounded canary failure; attempted never implies zero work." })
) {}
const failed = (phase: MuseProxyCanaryError["phase"]) => MuseProxyCanaryError.make({ phase });

const qualification = ClaudePolicySnapshot;
const canonicalWrapperSha256 = "9e8c6deec7455c51dbd28449e6669d296372a438af31cdd52d795742bed86648";
const shellSha256 = "382a43b012110a2253cfeea126b31716f5f74819943755c43f445bee4a9dbdb8";
const encodeQualification = S.encodeEffect(S.fromJsonString(qualification));

const nativeProcessProof = S.Struct({
  nativeInstanceId: Sha256Hex,
  shellInstanceId: Sha256Hex,
  startTicksHash: Sha256Hex,
  cwdHash: Sha256Hex,
  executableSha256: Sha256Hex,
  relation: S.Literals(["shell-exec-native", "owned-shell-descendant"]),
}).pipe(
  $I.annoteSchema("MuseNativeProcessProof", {
    description: "Owned actual native process, never shell PID mislabeled native; no raw process/path.",
  })
);

/**
 * Immutable source completion, independent from receipt/backend visibility.
 * **Example** (Inspect immutable source schema)
 * ```ts
 * console.log(typeof MuseProxyCanaryEvidence.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class MuseProxyCanaryEvidence extends S.Opaque<MuseProxyCanaryEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("muse-proxy-canary-evidence/v1"),
    requestBinding: Sha256Hex,
    observation: ManagedControllerObservation,
    source: MuseProxyCanarySource,
    process: nativeProcessProof,
    qualification,
  }).pipe(
    $I.annoteSchema("MuseProxyCanaryEvidence", {
      description: "No response, reasoning, raw session, argv, paths or auth; source completion is not backend proof.",
    })
  )
) {}
const encodeEvidence = S.encodeEffect(S.fromJsonString(MuseProxyCanaryEvidence));
const decodeEvidence = S.decodeEffect(S.fromJsonString(MuseProxyCanaryEvidence), { onExcessProperty: "error" });
const encodeRequest = S.encodeEffect(S.fromJsonString(MuseProxyCanaryRequest));
const io = <A>(thunk: () => Promise<A>, phase: MuseProxyCanaryError["phase"] = "admission") =>
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
const fixedTransport = Effect.fn("MuseProxyCanary.privateTransport")(function* (socketPath: string) {
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
        MuseProxyCanaryError
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
  "--output-format",
  "stream-json",
  "--verbose",
  "--max-turns",
  "1",
  "--print",
  "Reply with exactly ENROLLMENT_CANARY_OK. Do not use tools, inspect files, or perform any other work.",
];

const observeNativeDescendant = Effect.fn("MuseProxyCanary.observeNativeDescendant")(function* (
  request: MuseProxyCanaryRequest,
  shellPid: number
) {
  const expected = yield* io(() => Fs.stat(request.executable, { bigint: true }), "source");
  const snapshotIdentity = async (pid: number) => {
    const raw = await Fs.readFile(`/proc/${pid}/stat`, "utf8");
    const fields = raw
      .slice(raw.lastIndexOf(")") + 2)
      .trim()
      .split(/\s+/);
    const ticks = fields[19];
    const parent = Number(fields[1]);
    if (ticks === undefined || !/^[1-9][0-9]*$/.test(ticks)) throw new Error("native-process-stat");
    const owner = await Fs.stat(`/proc/${pid}`);
    if (owner.uid !== process.getuid?.()) throw new Error("foreign-process");
    return { pid, parent, ticks };
  };
  const snapshot = async (pid: number) => {
    const identity = await snapshotIdentity(pid);
    const executable = await Fs.stat(`/proc/${pid}/exe`, { bigint: true });
    const cwd = await Fs.readlink(`/proc/${pid}/cwd`);
    return { ...identity, executable, cwd };
  };
  // Pin ownership/start ticks before any retryable exe/cwd read. Failure to obtain
  // this baseline refuses admission; a later PID must never become the baseline.
  const shell = yield* io(() => snapshotIdentity(shellPid), "source");
  if (shell.parent !== process.pid) return yield* failed("source");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const observed = yield* io(async () => {
      try {
        const queue = [shellPid];
        const seen = new Set<number>();
        const matches: Array<Awaited<ReturnType<typeof snapshot>>> = [];
        while (queue.length > 0) {
          const pid = queue.shift();
          if (pid === undefined || seen.has(pid)) throw new Error("process-cycle");
          seen.add(pid);
          if (seen.size > 32) throw new Error("process-bound");
          const row = await snapshot(pid);
          if (pid === shellPid && (row.ticks !== shell.ticks || row.parent !== process.pid))
            throw new Error("shell-replaced");
          if (pid !== shellPid && !seen.has(row.parent)) throw new Error("foreign-ancestry");
          if (
            row.executable.dev === expected.dev &&
            row.executable.ino === expected.ino &&
            row.cwd === request.workspace
          )
            matches.push(row);
          const children = (await Fs.readFile(`/proc/${pid}/task/${pid}/children`, "utf8")).trim();
          if (children !== "")
            for (const child of children.split(/\s+/)) {
              if (!/^[1-9][0-9]*$/.test(child)) throw new Error("process-child");
              queue.push(Number(child));
            }
        }
        if (matches.length > 1) throw new Error("ambiguous-native");
        const found = matches[0];
        if (found === undefined) return O.none<Awaited<ReturnType<typeof snapshot>>>();
        const after = await snapshot(found.pid);
        if (
          after.ticks !== found.ticks ||
          after.parent !== found.parent ||
          after.executable.dev !== expected.dev ||
          after.executable.ino !== expected.ino ||
          after.cwd !== request.workspace
        )
          throw new Error("native-replaced");
        return O.some(after);
      } catch (error) {
        // Canonical startup runs short-lived metadata helpers. Their disappearance is
        // an incomplete process snapshot, never a native match or another source launch.
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
          return O.none<Awaited<ReturnType<typeof snapshot>>>();
        throw error;
      }
    }, "source");
    if (O.isSome(observed)) {
      const native = observed.value;
      const salt = O.some(Redacted.value(request.hashSalt));
      return nativeProcessProof.make({
        nativeInstanceId: yield* hashPrivateIdentifier(
          `muse-native/v1:${request.launchId}:${native.pid}:${native.ticks}:${expected.dev}:${expected.ino}`,
          salt
        ),
        shellInstanceId: yield* hashPrivateIdentifier(
          `muse-shell/v1:${request.launchId}:${shellPid}:${shell.ticks}`,
          salt
        ),
        startTicksHash: yield* hashPrivateIdentifier(native.ticks, salt),
        cwdHash: yield* hashPrivateIdentifier(request.workspace, salt),
        executableSha256: request.executableSha256,
        relation: native.pid === shellPid ? "shell-exec-native" : "owned-shell-descendant",
      });
    }
    yield* Effect.sleep("20 millis");
  }
  return yield* failed("source");
});

/**
 * Run one admitted fixed canary, or retry only its immutable metadata delivery.
 *
 * **Details**
 * An attempted marker without a complete source receipt refuses execution. Failure is unknown,
 * never zero. A source receipt permits only exact lifecycle/AGENT replay in its original epoch.
 * Receipt acceptance proves local durability; backend remains unknown until worker readback.
 * The canonical wrapper consumes the existing proxy credential; the adapter reads or copies no credentials.
 * No-session-persistence suppresses native transcripts/resume. Ancillary native home writes remain Unknown.
 *
 * **Example** (Inspect the fixed launcher)
 * ```ts
 * console.log(typeof runMuseProxyCanary)
 * ```
 * @param request - Owner-admitted private request; no generic prompt interface.
 * @returns Safe immutable source and local-delivery status; never model response text.
 * @category orchestration
 * @since 0.0.0
 */
export const runMuseProxyCanary = Effect.fn("HarnessEnrollment.claudeNativeCanary")(function* (
  request: MuseProxyCanaryRequest
) {
  if (request.identity.harness !== "muse" || request.identity.surface !== "cli") return yield* failed("admission");
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
      (route) => route.routeId === request.identity.routeId && route.harness === "muse" && route.surface === "cli"
    )
  )
    return yield* failed("admission");
  const postFact = Effect.fn("MuseProxyCanary.postFact")(function* (fact: ObservationLaunchFact) {
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
  let evidence: MuseProxyCanaryEvidence;
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
      evidence.observation.sourceSessionId !== evidence.source.sourceSessionId ||
      evidence.observation.processInstanceId !== evidence.process.nativeInstanceId ||
      evidence.process.executableSha256 !== request.executableSha256
    )
      return yield* failed("attempted-unknown");
    const sourceJson = yield* S.encodeEffect(S.fromJsonString(MuseProxyCanarySource))(evidence.source);
    const observation = evidence.observation;
    const qualificationJson = yield* encodeQualification(evidence.qualification);
    if (
      observation.evidenceId !==
      (yield* hashPublicTextSha256(
        `${requestBinding}:${qualificationJson}:${sourceJson}:${yield* S.encodeEffect(S.fromJsonString(nativeProcessProof))(evidence.process)}:${BigInt(observation.startTimeUnixNano) / 1000000n}:${BigInt(observation.endTimeUnixNano) / 1000000n}:${observation.elapsedNanos}`
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
        PATH: `${request.nativeCommandDirectory}:/usr/bin:/bin`,
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
    const pinExecutable = Effect.fn("MuseProxyCanary.pinExecutable")(function* () {
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
    yield* io(async () => {
      await privateEntry(request.canonicalWrapperFile, "file");
      await privateEntry(request.nativeCommandDirectory, "directory");
      if (
        createHash("sha256")
          .update(await Fs.readFile(request.canonicalWrapperFile))
          .digest("hex") !== canonicalWrapperSha256 ||
        createHash("sha256")
          .update(await Fs.readFile("/usr/bin/zsh"))
          .digest("hex") !== shellSha256 ||
        (await Fs.realpath(`${request.nativeCommandDirectory}/claude`)) !== request.executable ||
        (await Fs.readdir(request.nativeCommandDirectory)).join("\n") !== "claude"
      )
        throw new Error("canonical-consumer-drift");
      // zsh -f still loads global zshenv. This finite host contract admits only its absence.
      for (const name of ["/etc/zshenv", "/etc/zsh/zshenv"]) {
        try {
          await Fs.lstat(name);
        } catch (e) {
          if (typeof e === "object" && e !== null && "code" in e && e.code === "ENOENT") continue;
          throw e;
        }
        throw new Error("unqualified-system-zshenv");
      }
    });
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    let versionSpawned = O.none<boolean>();
    let versionExit = O.none<number>();
    let versionBytes = 0;
    let versionOutputComplete = false;
    const saveVersion = (
      stage: (typeof diagnostic.Type)["stage"],
      failurePhase = O.none<MuseProxyCanaryError["phase"]>()
    ) =>
      writeNativeAttemptDiagnostic(
        request.attemptDirectory,
        diagnostic.make({
          requestBinding,
          purpose: "version",
          stage,
          nativeSpawned: versionSpawned,
          nativeExitStatus: versionExit,
          observedStdoutBytes: versionBytes,
          outputComplete: versionOutputComplete,
          protocol: O.none(),
          failurePhase,
          protocolFailure: O.none(),
        })
      ).pipe(Effect.mapError(() => failed("diagnostic")));
    yield* saveVersion("dispatch-intent");
    const versionResult = yield* Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawner
          .spawn(
            ChildProcess.make(request.executable, ["--version"], {
              cwd: request.workspace,
              env,
              extendEnv: false,
              stdin: "ignore",
              stderr: "ignore",
              forceKillAfter: "3 seconds",
            })
          )
          .pipe(Effect.mapError(() => failed("version-dispatch")));
        versionSpawned = O.some(true);
        yield* saveVersion("spawn-observed");
        const text = yield* boundedText(child.stdout, 1024).pipe(Effect.mapError(() => failed("version-output")));
        versionBytes = Buffer.byteLength(text);
        versionOutputComplete = true;
        const code = Number(yield* child.exitCode.pipe(Effect.mapError(() => failed("version-exit"))));
        versionExit = O.some(code);
        if (code !== 0) return yield* failed("version-exit");
        if (Str.trim(text) !== "2.1.318 (Claude Code)") return yield* failed("version-mismatch");
      })
    ).pipe(
      Effect.timeout("15 seconds"),
      Effect.catchTag("TimeoutError", () => failed("version-timeout")),
      Effect.mapError((error) => (S.is(MuseProxyCanaryError)(error) ? error : failed("admission"))),
      Effect.result
    );
    yield* saveVersion(
      Result.isSuccess(versionResult) ? "validated" : "failed",
      Result.isFailure(versionResult) ? O.some(versionResult.failure.phase) : O.none()
    );
    yield* Effect.fromResult(versionResult);
    const isolation = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory);
    if (isolation.digest !== request.nativePolicySha256) return yield* failed("admission");
    const qualificationJson = yield* encodeQualification(isolation);
    yield* io(() => durableCreate(request.attemptDirectory, "preflight.json", qualificationJson));
    yield* postFact(prepared);
    const immediatePolicy = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory);
    if (immediatePolicy.digest !== isolation.digest) return yield* failed("admission");
    yield* pinExecutable();
    let nativeSpawned = O.none<boolean>();
    let nativeExit = O.none<number>();
    let observedBytes = 0;
    let outputComplete = false;
    let boundedOutput = "";
    let protocolFailure = O.none<MuseProxyCanaryWireError["reason"]>();
    let postPolicyDigest = O.none<Sha256Hex>();
    let policyUnchanged = O.none<boolean>();
    const saveSource = Effect.fn("MuseProxyCanary.saveSourceDiagnostic")(function* (
      stage: (typeof diagnostic.Type)["stage"],
      failurePhase = O.none<MuseProxyCanaryError["phase"]>()
    ) {
      let protocol = O.none<MuseProxyCanaryWireDiagnostics>();
      if (stage !== "dispatch-intent" && stage !== "spawn-observed") {
        const inspected = yield* inspectMuseProxyCanaryOutput(boundedOutput, request.workspace);
        protocol = O.some(inspected);
      }
      yield* writeNativeAttemptDiagnostic(
        request.attemptDirectory,
        diagnostic.make({
          requestBinding,
          purpose: "source",
          stage,
          nativeSpawned,
          nativeExitStatus: nativeExit,
          observedStdoutBytes: observedBytes,
          outputComplete,
          protocol,
          failurePhase,
          protocolFailure,
          prePolicyDigest: O.some(isolation.digest),
          postPolicyDigest,
          policyUnchanged,
        })
      ).pipe(Effect.mapError(() => failed("diagnostic")));
    });
    yield* saveSource("dispatch-intent");
    const sourceResult = yield* Effect.scoped(
      Effect.gen(function* () {
        const start = yield* Clock.currentTimeMillis;
        const mono = yield* Clock.monotonicTimeNanos;
        const child = yield* spawner
          .spawn(
            ChildProcess.make(
              "/usr/bin/zsh",
              [
                "-f",
                "-c",
                'source "$1"; shift; claudem "$@"',
                "muse-proxy-fixed",
                request.canonicalWrapperFile,
                ...args,
              ],
              {
                cwd: request.workspace,
                env,
                extendEnv: false,
                stdin: "ignore",
                stderr: "ignore",
                forceKillAfter: "3 seconds",
              }
            )
          )
          .pipe(Effect.mapError(() => failed("source-dispatch")));
        const process = yield* observeNativeDescendant(request, Number(child.pid)).pipe(
          Effect.mapError(() => failed("source-identity"))
        );
        // This is the verified native executable, not the wrapper shell.
        nativeSpawned = O.some(true);
        yield* saveSource("spawn-observed");
        const processInstanceId = process.nativeInstanceId;
        yield* postFact(ObservationLaunchFact.cases.Started.make({ launchId: request.launchId, processInstanceId }));
        const stdout = yield* child.stdout.pipe(
          Stream.mapError(() => failed("source-output")),
          Stream.decodeText(),
          Stream.runFoldEffect(
            () => "",
            (text, chunk) => {
              observedBytes = Math.min(Number.MAX_SAFE_INTEGER, observedBytes + Buffer.byteLength(chunk));
              if (Buffer.byteLength(text) + Buffer.byteLength(chunk) > 262144)
                return Effect.fail(failed("source-output"));
              boundedOutput = `${text}${chunk}`;
              return Effect.succeed(boundedOutput);
            }
          )
        );
        outputComplete = true;
        const code = Number(yield* child.exitCode.pipe(Effect.mapError(() => failed("source-exit"))));
        nativeExit = O.some(code);
        if (code !== 0) return yield* failed("source-exit");
        const source = yield* decodeMuseProxyCanaryOutput(stdout, request.hashSalt, request.workspace).pipe(
          Effect.mapError((error) => {
            if (S.is(MuseProxyCanaryWireError)(error)) {
              protocolFailure = O.some(error.reason);
              return failed("source-protocol");
            }
            return failed("source-identity");
          })
        );
        const afterPolicy = yield* qualifyClaudeManagedPolicy(request.sharedClaudeConfigDirectory).pipe(
          Effect.mapError(() => failed("source-policy"))
        );
        postPolicyDigest = O.some(afterPolicy.digest);
        policyUnchanged = O.some(afterPolicy.digest === isolation.digest);
        if (afterPolicy.digest !== isolation.digest) return yield* failed("source-policy");
        const end = yield* Clock.currentTimeMillis;
        const elapsed = (yield* Clock.monotonicTimeNanos) - mono;
        const sourceJson = yield* S.encodeEffect(S.fromJsonString(MuseProxyCanarySource))(source);
        const observation = yield* S.decodeEffect(ManagedControllerObservation)({
          version: "managed-controller-observation/v1",
          launchId: request.launchId,
          launchRouteId: request.identity.routeId,
          processInstanceId,
          sourceSessionId: source.sourceSessionId,
          evidenceId: yield* hashPublicTextSha256(
            `${requestBinding}:${qualificationJson}:${sourceJson}:${yield* S.encodeEffect(S.fromJsonString(nativeProcessProof))(process)}:${start}:${end}:${elapsed}`
          ),
          startTimeUnixNano: String(BigInt(start) * 1000000n),
          endTimeUnixNano: String(BigInt(end) * 1000000n),
          elapsedNanos: String(elapsed),
          outcome: "completed",
          response: "exact-constant-matched",
        });
        return MuseProxyCanaryEvidence.make({ requestBinding, observation, source, qualification: isolation, process });
      })
    ).pipe(
      Effect.flatMap((value) =>
        encodeEvidence(value).pipe(
          Effect.flatMap((encoded) =>
            io(() => durableCreate(request.attemptDirectory, "source.json", encoded), "source-receipt")
          ),
          Effect.as(value)
        )
      ),
      Effect.timeout("110 seconds"),
      Effect.catchTag("TimeoutError", () => failed("source-timeout")),
      Effect.mapError((error) => (S.is(MuseProxyCanaryError)(error) ? error : failed("source"))),
      // Effect.result retains typed failures; interruption needs its own post-cleanup terminal fact.
      Effect.onExit((exit) =>
        Effect.gen(function* () {
          if (!Exit.hasInterrupts(exit) || !O.getOrElse(nativeSpawned, () => false)) return;
          const outcome = O.isSome(nativeExit) ? (nativeExit.value !== 0 ? "failed" : "unknown") : "cancelled";
          const writeLifecycle = (stage: (typeof diagnostic.Type)["stage"], delivery: "pending" | "acknowledged") =>
            writeNativeAttemptDiagnostic(
              request.attemptDirectory,
              diagnostic.make({
                requestBinding,
                purpose: "lifecycle",
                stage,
                nativeSpawned,
                nativeExitStatus: nativeExit,
                observedStdoutBytes: observedBytes,
                outputComplete,
                protocol: O.none(),
                failurePhase: O.some("source"),
                protocolFailure,
                lifecycleOutcome: O.some(outcome),
                lifecycleDelivery: O.some(delivery),
              })
            );
          yield* writeLifecycle("dispatch-intent", "pending").pipe(Effect.ignoreCause);
          const terminal = yield* postFact(
            ObservationLaunchFact.cases.Finished.make({ launchId: request.launchId, outcome })
          ).pipe(Effect.exit);
          yield* writeLifecycle(
            Exit.isSuccess(terminal) ? "validated" : "pending",
            Exit.isSuccess(terminal) ? "acknowledged" : "pending"
          ).pipe(Effect.ignoreCause);
        })
      ),
      Effect.result
    );
    const sourceDiagnostic = yield* saveSource(
      Result.isSuccess(sourceResult) ? "validated" : "failed",
      Result.isFailure(sourceResult) ? O.some(sourceResult.failure.phase) : O.none()
    ).pipe(Effect.result);
    if (Result.isFailure(sourceResult)) {
      // Native process completion and collection refusal are different facts. Never infer task quality from exit0.
      // A deadline without an observed exit is a cancellation, as in the Codex and Grok canaries.
      const outcome = O.isSome(nativeExit)
        ? nativeExit.value !== 0
          ? "failed"
          : "unknown"
        : sourceResult.failure.phase === "source-timeout"
          ? "cancelled"
          : "unknown";
      const failurePhase = O.some(sourceResult.failure.phase);
      const writeLifecycle = (stage: (typeof diagnostic.Type)["stage"], delivery: "pending" | "acknowledged") =>
        writeNativeAttemptDiagnostic(
          request.attemptDirectory,
          diagnostic.make({
            requestBinding,
            purpose: "lifecycle",
            stage,
            nativeSpawned,
            nativeExitStatus: nativeExit,
            observedStdoutBytes: observedBytes,
            outputComplete,
            protocol: O.none(),
            failurePhase,
            protocolFailure,
            lifecycleOutcome: O.some(outcome),
            lifecycleDelivery: O.some(delivery),
          })
        );
      // A durable pending intent survives a refused/uncertain fact delivery. Secondary failures cannot mask the source refusal.
      yield* writeLifecycle("dispatch-intent", "pending").pipe(Effect.result);
      const finish = yield* postFact(
        ObservationLaunchFact.cases.Finished.make({ launchId: request.launchId, outcome })
      ).pipe(Effect.result);
      yield* writeLifecycle(
        Result.isSuccess(finish) ? "validated" : "pending",
        Result.isSuccess(finish) ? "acknowledged" : "pending"
      ).pipe(Effect.result);
      return yield* sourceResult.failure;
    }
    yield* Effect.fromResult(sourceDiagnostic);
    evidence = sourceResult.success;
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
  $I.annoteSchema("MuseProxyCanaryDeliveryReport", {
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
      const request = yield* S.decodeEffect(S.fromJsonString(MuseProxyCanaryRequest), { onExcessProperty: "error" })(
        raw
      ).pipe(Effect.mapError(() => failed("admission")));
      const result = yield* runMuseProxyCanary(request).pipe(
        Effect.mapError((error) => (S.is(MuseProxyCanaryError)(error) ? error : failed("source")))
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
