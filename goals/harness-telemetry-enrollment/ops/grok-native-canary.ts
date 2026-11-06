/**
 * One fixed native Grok canary; immutable metadata replay never re-invokes Grok.
 * Native title metadata and vendor HTTP retries are not additional controller source invocations.
 * @packageDocumentation
 * @since 0.0.0
 */
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Native file digests are streamed without reading provider authentication material.
import { createHash } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Exclusive no-follow attempt fence and native process identity are the fixed filesystem boundary.
import { constants, createReadStream } from "node:fs";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Fixed private files and /proc identity are observed without argv/env reads.
import * as Fs from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Fixed private Unix-socket transport has no network destination.
import * as Http from "node:http";
// @effect-diagnostics-next-line nodeBuiltinImport:off -- Public same-UID username/login-shell metadata validates the fixed native session context; no credentials are read.
import * as Os from "node:os";
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
import * as Toml from "effect/encoding/Toml";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  decodeGrokCanaryOutput,
  GrokCanarySource,
  GrokNativeFailureClass,
  GrokNativeFailureUnknownReason,
  observeGrokNativeFailure,
  observeGrokReportedNotSignedIn,
} from "./grok-exec-wire.ts";
import { NativeAttemptDiagnostic, writeNativeAttemptDiagnostic } from "./native-attempt-diagnostic.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/grok-native-canary");
const absolute = S.String.check(S.isPattern(/^\/[^\u0000-\u001f"\\]*$/), S.isMaxLength(4096)).pipe(
  $I.annoteSchema("GrokCanaryAbsolutePath", {
    description: "Restricted absolute native path, pinned separately by owner admission.",
  })
);
/** Exact private profile pins the approved Responses model and medium reasoning contract; no auth, endpoint, provider key or arbitrary hook is configured.
 * **Example** (Inspect fixed profile text length)
 * ```ts
 * console.log(grokCanaryProfile.length > 0)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const grokCanaryProfile =
  '[models]\nsession_summary="grok-4.7"\ndefault_reasoning_effort="medium"\n[cli]\nauto_update=false\nuse_leader=false\n[features]\ntelemetry=false\nfeedback=false\ncodebase_indexing=false\nremote_fetch=false\nauto_wake=false\ntitle_refresh=false\nturn_summary=false\n[session]\nload_envrc=false\n\n[marketplace]\ndefault_skills_installs_purged = true\n\n[model."grok-4.7"]\nmodel = "grok-4.7"\napi_backend = "responses"\nreasoning_efforts = [{ id = "medium", value = "medium", label = "Medium", description = "", default = false }]\n';
/** Fixed local-only pilot project MCP bytes; never publish this override into the ordinary repository.
 * **Example** (Inspect empty MCP content)
 * ```ts
 * console.log(grokCanaryProjectMcp.length > 0)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const grokCanaryProjectMcp = '{"mcpServers":{}}\n';
/** Exact Biome-formatted empty MCP fixture; no other JSON serialization is admitted.
 * **Example** (Inspect canonical empty MCP content)
 * ```ts
 * console.log(grokCanaryProjectMcpFormatted.length > 0)
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const grokCanaryProjectMcpFormatted = '{\n  "mcpServers": {}\n}\n';
const denyTools = [
  "run_terminal_command",
  "read_file",
  "search_replace",
  "list_dir",
  "grep",
  "kill_command_or_subagent",
  "todo_write",
  "get_command_or_subagent_output",
  "scheduler_create",
  "scheduler_delete",
  "scheduler_list",
  "monitor",
  "search_tool",
  "use_tool",
  "update_goal",
  "enter_plan_mode",
  "exit_plan_mode",
  "ask_user_question",
  "image_gen",
  "image_edit",
  "image_to_video",
  "reference_to_video",
  "write",
];
const args = [
  "-m",
  "grok-4.7",
  "--effort",
  "medium",
  "--max-turns",
  "1",
  "--no-subagents",
  "--disable-web-search",
  "--tools",
  "",
  "--disallowed-tools",
  A.join(denyTools, ","),
  "--no-plan",
  "--permission-mode",
  "dontAsk",
  "--sandbox",
  "read-only",
  "--verbatim",
  "--output-format",
  "streaming-json",
  "-p",
  "Reply with exactly ENROLLMENT_CANARY_OK. Do not use tools, inspect files, or perform any other work.",
];
/** Fixed public desktop-session context; no arbitrary environment entries are admitted.
 * **Example** (Inspect the context constructor)
 * ```ts
 * console.log(typeof GrokNativeSessionContext.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GrokNativeSessionContext extends S.Opaque<GrokNativeSessionContext, { readonly brand: unique symbol }>()(
  S.Struct({
    USER: S.String.check(S.isPattern(/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/)),
    LOGNAME: S.String.check(S.isPattern(/^[A-Za-z_][A-Za-z0-9_.-]{0,127}$/)),
    SHELL: S.tag("/usr/bin/zsh"),
    TERM: S.tag("xterm-256color"),
    XDG_RUNTIME_DIR: absolute,
    DBUS_SESSION_BUS_ADDRESS: S.String.check(S.isPattern(/^unix:path=\/run\/user\/[0-9]+\/bus$/)),
  }).pipe(
    $I.annoteSchema("GrokNativeSessionContext", {
      description:
        "Six public fields only; same-UID runtime directory, native session bus and login-shell metadata are checked before native dispatch.",
    })
  )
) {}
/** Serialized owner admission; telemetry salt decodes from JSON into Redacted.
 * **Example** (Inspect the request constructor)
 * ```ts
 * console.log(typeof GrokNativeCanaryRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GrokNativeCanaryRequest extends S.Opaque<GrokNativeCanaryRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("grok-native-canary-request/v2"),
    launchId: Sha256Hex,
    identity: ObservationLaunchIdentity,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    ingressRouteId: Sha256Hex,
    hashSalt: S.RedactedFromValue(S.NonEmptyString),
    executable: absolute,
    executableSha256: Sha256Hex,
    workspace: absolute,
    attemptDirectory: absolute,
    isolatedHome: absolute,
    sessionContext: GrokNativeSessionContext,
    nativeHome: absolute,
    nativeAuthFile: absolute,
    nativeAuthIdentitySha256: Sha256Hex,
    originalUserConfigSha256: S.OptionFromOptionalKey(Sha256Hex),
    socketPath: absolute.check(S.isMaxLength(100)),
    admission: S.tag("owner-approved-fixed-grok-canary-no-tools"),
  }).pipe(
    $I.annoteSchema("GrokNativeCanaryRequest", {
      description: "One admitted fixed purpose; no prompt, extra args, arbitrary env or API key accepted.",
    })
  )
) {}
/** Finite failure; native error text and request values never cross this boundary.
 * **Example** (Inspect the fixed error)
 * ```ts
 * console.log(typeof GrokNativeCanaryError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class GrokNativeCanaryError extends S.TaggedError<GrokNativeCanaryError, { readonly brand: unique symbol }>(
  $I`GrokNativeCanaryError`
)(
  "GrokNativeCanaryError",
  { phase: S.Literals(["admission", "attempted-unknown", "source", "delivery"]) },
  $I.annote("GrokNativeCanaryError", { description: "Content-free failure; uncertainty never grants source replay." })
) {}
const diagnosticCount = S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER)).pipe(
  $I.annoteSchema("GrokDiagnosticCount", { description: "Bounded safe integer metadata counter; no native content." })
);
const protocolTagCounts = S.Struct({
  rowsObserved: diagnosticCount,
  rowsClassified: diagnosticCount,
  rowsOmitted: diagnosticCount,
  catalog: diagnosticCount,
  text: diagnosticCount,
  thought: diagnosticCount,
  usage: diagnosticCount,
  end: diagnosticCount,
  error: diagnosticCount,
  toolCall: diagnosticCount,
  toolUpdate: diagnosticCount,
  plan: diagnosticCount,
  other: diagnosticCount,
  invalidJson: diagnosticCount,
}).pipe(
  $I.annoteSchema("GrokDiagnosticTagCounts", {
    description: "Fixed tag counters only; unknown tag names and all native bodies are discarded.",
  })
);
/** Atomic finite diagnostic checkpoint. No raw errors, text, argv, paths or auth values are admitted.
 * **Example** (Inspect the diagnostic schema)
 * ```ts
 * console.log(typeof GrokNativeCanaryDiagnostic.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GrokNativeCanaryDiagnostic extends S.Opaque<
  GrokNativeCanaryDiagnostic,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("grok-native-canary-diagnostic/v1"),
    requestBinding: Sha256Hex,
    stage: S.Literals(["attempt", "inventory-exit", "dispatch", "native-exit", "outcome"]),
    operation: S.Literals(["preflight", "inspect-1", "inspect-2", "main"]),
    category: S.Literals([
      "not-run",
      "accepted",
      "admission-refused",
      "inventory-refused",
      "process-binding-refused",
      "native-exit-refused",
      "wire-refused",
      "output-bound",
      "post-policy-refused",
      "retention-refused",
      "timeout-or-operational",
    ]),
    producerDispatchAttempts: S.Natural.check(S.isLessThanOrEqualTo(1)),
    nativeExitStatus: S.OptionFromOptionalKey(S.Int.check(S.isBetween({ minimum: -4096, maximum: 4096 }))),
    stdoutBytes: S.OptionFromOptionalKey(diagnosticCount),
    stderrBytes: S.OptionFromOptionalKey(diagnosticCount),
    protocolTags: S.OptionFromOptionalKey(protocolTagCounts),
    nativeFailureClass: S.OptionFromOptionalKey(GrokNativeFailureClass).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    nativeFailureUnknownReason: S.OptionFromOptionalKey(GrokNativeFailureUnknownReason).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    nativeReportedNotSignedIn: S.OptionFromOptionalKey(S.Literal(true)).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
  })
    .check(
      S.makeFilter(
        (value) =>
          (O.isNone(value.nativeReportedNotSignedIn) &&
            O.isNone(value.nativeFailureClass) &&
            O.isNone(value.nativeFailureUnknownReason)) ||
          (value.operation === "main" &&
            (value.stage === "native-exit" || value.stage === "outcome") &&
            value.producerDispatchAttempts === 1 &&
            O.isSome(value.protocolTags) &&
            value.protocolTags.value.error > 0 &&
            O.isSome(value.nativeExitStatus) &&
            value.nativeExitStatus.value !== 0),
        { description: "A reported literal is retained only after a main native error stream and known nonzero exit." }
      )
    )
    .check(
      S.makeFilter(
        (value) => O.isNone(value.nativeFailureUnknownReason) || O.contains("Unknown")(value.nativeFailureClass),
        {
          description: "Structural reason requires an explicitly Unknown native class.",
        }
      )
    )
    .pipe(
      $I.annoteSchema("GrokNativeCanaryDiagnostic", {
        description: "Positive metadata schema; missing exit or stream measurements remain unknown, never zero-filled.",
      })
    )
) {}
const failed = (phase: GrokNativeCanaryError["phase"]) => GrokNativeCanaryError.make({ phase });
const io = <A>(thunk: () => Promise<A>, phase: GrokNativeCanaryError["phase"] = "admission") =>
  Effect.tryPromise({ try: thunk, catch: () => failed(phase) });
const authTransition = S.Struct({
  operation: S.Literals(["inspect-1", "inspect-2", "main"]),
  before: Sha256Hex,
  after: Sha256Hex,
  change: S.tag("changed-during-native-phase"),
  cause: S.tag("Unknown"),
  authHealth: S.tag("Unknown"),
});
const qualification = S.Struct({
  version: S.tag("grok-native-isolation/v1"),
  executableSha256: Sha256Hex,
  profileSha256: Sha256Hex,
  projectMcpSha256: Sha256Hex,
  originalPolicySha256: Sha256Hex,
  authIdentitySha256: Sha256Hex,
  authTransitions: S.OptionFromOptionalKey(S.Array(authTransition).check(S.isMaxLength(3))),
  sessionContextSha256: Sha256Hex,
  inspectSha256: Sha256Hex,
  argvSha256: Sha256Hex,
  executableTools: S.tag(0),
  sourceInvocations: S.tag(1),
  nativeHttpRequests: S.tag("Unknown"),
  titleModel: S.tag("grok-4.7"),
}).pipe(
  $I.annoteSchema("GrokNativeIsolation", {
    description: "Finite exact-profile/native inventory qualification, not remote-policy or cloud-retention proof.",
  })
);
const processProof = S.Struct({
  version: S.tag("grok-native-process/v1"),
  instanceId: Sha256Hex,
  executableSha256: Sha256Hex,
  startTicksHash: Sha256Hex,
  cwdHash: Sha256Hex,
  directOwnedNativeProcess: S.tag(true),
}).pipe(
  $I.annoteSchema("GrokNativeProcessProof", {
    description: "Direct owned native PID/exe/startticks/cwd proof; no launcher PID is labeled native.",
  })
);
/** Immutable safe source evidence; retry only its original metadata delivery.
 * **Example** (Inspect retained evidence)
 * ```ts
 * console.log(typeof GrokNativeCanaryEvidence.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class GrokNativeCanaryEvidence extends S.Opaque<GrokNativeCanaryEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("grok-native-canary-evidence/v1"),
    requestBinding: Sha256Hex,
    observation: ManagedControllerObservation,
    source: GrokCanarySource,
    qualification,
    process: processProof,
  }).pipe(
    $I.annoteSchema("GrokNativeCanaryEvidence", {
      description: "No native content, raw PID/path/session, argv/env or auth values are retained.",
    })
  )
) {}
const encodeEvidence = S.encodeEffect(S.fromJsonString(GrokNativeCanaryEvidence));
const decodeEvidence = S.decodeEffect(S.fromJsonString(GrokNativeCanaryEvidence), { onExcessProperty: "error" });
const encodeRequest = S.encodeEffect(S.fromJsonString(GrokNativeCanaryRequest));
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
  const dir = await Fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const identity = await dir.stat();
    if (identity.uid !== process.getuid?.() || (identity.mode & 0o777) !== 0o700) throw new Error("private-directory");
    // Linux /proc pins the same directory inode across create and fsync.
    const file = await Fs.open(
      `/proc/self/fd/${dir.fd}/${name}`,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    try {
      await file.writeFile(text, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await dir.sync();
  } finally {
    await dir.close();
  }
};
// @effect-diagnostics-next-line asyncFunction:off -- Write+fsync temporary metadata, then atomically publish without replacement in the same pinned directory.
const publishDiagnostic = async (directory: string, name: string, text: string) => {
  const dir = await Fs.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const identity = await dir.stat();
    if (identity.uid !== process.getuid?.() || (identity.mode & 0o777) !== 0o700) throw new Error("private-directory");
    const prefix = `/proc/self/fd/${dir.fd}`;
    const temporary = `${prefix}/.${name}.pending`;
    const file = await Fs.open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600
    );
    try {
      await file.writeFile(text, "utf8");
      await file.sync();
    } finally {
      await file.close();
    }
    await Fs.link(temporary, `${prefix}/${name}`);
    await Fs.unlink(temporary);
    await dir.sync();
  } finally {
    await dir.close();
  }
};
const writeDiagnostic = Effect.fn("GrokCanary.writeDiagnostic")(function* (
  directory: string,
  name: string,
  value: GrokNativeCanaryDiagnostic
) {
  const text = yield* S.encodeEffect(S.fromJsonString(GrokNativeCanaryDiagnostic))(value).pipe(
    Effect.mapError(() => failed("source"))
  );
  yield* io(() => publishDiagnostic(directory, name, text), "source");
});
const countProtocolTags = Effect.fn("GrokCanary.countProtocolTags")(function* (stdout: string) {
  const lines = A.filter(Str.split(stdout, "\n"), Str.isNonEmpty);
  const selected = A.take(lines, 2048);
  const counts = {
    rowsObserved: lines.length,
    rowsClassified: selected.length,
    rowsOmitted: lines.length - selected.length,
    catalog: 0,
    text: 0,
    thought: 0,
    usage: 0,
    end: 0,
    error: 0,
    toolCall: 0,
    toolUpdate: 0,
    plan: 0,
    other: 0,
    invalidJson: 0,
  };
  const tag = S.Struct({ type: S.String }).pipe(
    $I.annoteSchema("GrokDiagnosticTransientTag", {
      description: "Transient discriminator only; its value is never retained.",
    })
  );
  for (const line of selected) {
    const decoded = yield* S.decodeEffect(S.fromJsonString(tag))(line).pipe(Effect.option);
    if (O.isNone(decoded)) {
      counts.invalidJson += 1;
      continue;
    }
    const kind = decoded.value.type;
    if (kind === "available_commands") counts.catalog += 1;
    else if (kind === "text") counts.text += 1;
    else if (kind === "thought") counts.thought += 1;
    else if (kind === "usage") counts.usage += 1;
    else if (kind === "end") counts.end += 1;
    else if (kind === "error") counts.error += 1;
    else if (kind === "tool_call") counts.toolCall += 1;
    else if (kind === "tool_call_update") counts.toolUpdate += 1;
    else if (kind === "plan") counts.plan += 1;
    else counts.other += 1;
  }
  return protocolTagCounts.make(counts);
});
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
const fixedTransport = Effect.fn("GrokCanary.privateTransport")(function* (socketPath: string) {
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
        GrokNativeCanaryError
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
const captureNative = Effect.fn("GrokCanary.captureNative")(function* (
  child: ChildProcessSpawner.ChildProcessHandle,
  measure: (kind: "stdout" | "stderr", bytes: number) => void
) {
  let stdoutBytes = 0;
  let stderrBytes = 0;
  measure("stdout", 0);
  measure("stderr", 0);
  const stdout = child.stdout.pipe(
    Stream.mapError(() => failed("source")),
    Stream.tap((chunk) =>
      Effect.gen(function* () {
        stdoutBytes += chunk.byteLength;
        measure("stdout", stdoutBytes);
        if (stdoutBytes > 1048576) return yield* failed("source");
      })
    ),
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (text, chunk) => `${text}${chunk}`
    )
  );
  const stderr = child.stderr.pipe(
    Stream.mapError(() => failed("source")),
    Stream.runForEach((chunk) =>
      Effect.gen(function* () {
        stderrBytes += chunk.byteLength;
        measure("stderr", stderrBytes);
        if (stderrBytes > 65536) return yield* failed("source");
      })
    )
  );
  const captured = yield* Effect.all({ stdout, stderr }, { concurrency: 2 });
  return { stdout: captured.stdout, exitStatus: Number(yield* child.exitCode) };
});
// @effect-diagnostics-next-line asyncFunction:off -- Non-auth executable/config bytes are streamed solely into a digest at this fixed boundary.
const fileDigest = async (filename: string) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
};
// @effect-diagnostics-next-line asyncFunction:off -- Metadata only: authentication contents are never opened or read by this adapter.
const authIdentity = async (filename: string) => {
  const parent = filename.slice(0, filename.lastIndexOf("/"));
  const directory = await Fs.open(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try {
    const initialParent = await directory.stat({ bigint: true });
    const parentIdentity = `${initialParent.dev}:${initialParent.ino}:${initialParent.uid}:${initialParent.mode}`;
    if (initialParent.uid !== BigInt(process.getuid?.() ?? -1) || (initialParent.mode & 0o022n) !== 0n)
      throw new Error("auth-parent");
    if ((await Fs.realpath(parent)) !== parent) throw new Error("auth-parent-link");
    const anchored = `/proc/self/fd/${directory.fd}/auth.json`;
    const descriptor = await Fs.open(anchored, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const value = await descriptor.stat({ bigint: true });
      if (
        !value.isFile() ||
        value.uid !== initialParent.uid ||
        (value.mode & 0o777n) !== 0o600n ||
        value.size <= 0n ||
        value.size > 1048576n ||
        value.nlink !== 1n
      )
        throw new Error("auth-entry");
      const entry = await Fs.lstat(anchored, { bigint: true });
      const currentEntry = await Fs.lstat(filename, { bigint: true });
      const finalParent = await Fs.lstat(parent, { bigint: true });
      const identity = `${value.dev}:${value.ino}:${value.uid}:${value.mode}:${value.size}:${value.mtimeNs}:${value.ctimeNs}`;
      if (
        entry.isSymbolicLink() ||
        currentEntry.isSymbolicLink() ||
        finalParent.isSymbolicLink() ||
        `${entry.dev}:${entry.ino}:${entry.uid}:${entry.mode}:${entry.size}:${entry.mtimeNs}:${entry.ctimeNs}` !==
          identity ||
        `${currentEntry.dev}:${currentEntry.ino}:${currentEntry.uid}:${currentEntry.mode}:${currentEntry.size}:${currentEntry.mtimeNs}:${currentEntry.ctimeNs}` !==
          identity ||
        `${finalParent.dev}:${finalParent.ino}:${finalParent.uid}:${finalParent.mode}` !== parentIdentity ||
        (await Fs.realpath(filename)) !== filename
      )
        throw new Error("auth-entry-race");
      const finalValue = await descriptor.stat({ bigint: true });
      if (
        `${finalValue.dev}:${finalValue.ino}:${finalValue.uid}:${finalValue.mode}:${finalValue.size}:${finalValue.mtimeNs}:${finalValue.ctimeNs}` !==
        identity
      )
        throw new Error("auth-descriptor-drift");
      return { identity, parentIdentity };
    } finally {
      await descriptor.close();
    }
  } finally {
    await directory.close();
  }
};
// @effect-diagnostics-next-line asyncFunction:off -- Existing required policy must be absent for this finite host qualification; appearance is a refusal, never a bypass.
const requireAbsent = async (filename: string) => {
  try {
    await Fs.lstat(filename);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("required-policy-or-private-auth-present");
};
const originalConfig = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("GrokOriginalConfigMetadata", {
    description: "Transient parse solely to reject original security-policy tables; values are never retained.",
  })
);
const pinRuntime = Effect.fn("GrokCanary.pinRuntime")(function* (
  request: GrokNativeCanaryRequest,
  expectedAuth: O.Option<Sha256Hex> = O.some(request.nativeAuthIdentitySha256)
) {
  const path = yield* Path.Path;
  const shared = path.dirname(request.nativeAuthFile);
  if (
    path.basename(request.nativeAuthFile) !== "auth.json" ||
    request.nativeHome === shared ||
    request.isolatedHome === process.env.HOME
  )
    return yield* failed("admission");
  const sessionIdentity = yield* io(async () => {
    const uid = process.getuid?.();
    const user = Os.userInfo();
    const context = request.sessionContext;
    if (
      uid === undefined ||
      process.geteuid?.() !== uid ||
      context.USER !== user.username ||
      context.LOGNAME !== user.username ||
      user.shell === null ||
      context.XDG_RUNTIME_DIR !== `/run/user/${uid}` ||
      context.DBUS_SESSION_BUS_ADDRESS !== `unix:path=/run/user/${uid}/bus` ||
      (await Fs.realpath(context.SHELL)) !== (await Fs.realpath(user.shell))
    )
      throw new Error("public-session-context");
    const directory = await Fs.lstat(context.XDG_RUNTIME_DIR);
    if (
      directory.isSymbolicLink() ||
      !directory.isDirectory() ||
      directory.uid !== uid ||
      (directory.mode & 0o777) !== 0o700 ||
      (await Fs.realpath(context.XDG_RUNTIME_DIR)) !== context.XDG_RUNTIME_DIR
    )
      throw new Error("public-runtime-entry");
    const busPath = `${context.XDG_RUNTIME_DIR}/bus`;
    const bus = await Fs.lstat(busPath);
    if (bus.isSymbolicLink() || !bus.isSocket() || bus.uid !== uid || (await Fs.realpath(busPath)) !== busPath)
      throw new Error("public-session-entry");
    return `${uid}:${directory.dev}:${directory.ino}:${bus.dev}:${bus.ino}`;
  });
  const sessionContextSha256 = yield* hashPrivateIdentifier(
    `${yield* S.encodeEffect(S.fromJsonString(GrokNativeSessionContext))(request.sessionContext)}:${sessionIdentity}`,
    O.some(Redacted.value(request.hashSalt))
  );
  const projectMcpBytes = yield* io(async () => {
    for (const directory of [request.nativeHome, request.isolatedHome]) await privateEntry(directory, "directory");
    if ((await Fs.realpath(request.workspace)) !== request.workspace) throw new Error("workspace-link");
    for (const filename of [
      "/etc/grok/managed_config.toml",
      "/etc/grok/requirements.toml",
      `${shared}/managed_config.toml`,
      `${shared}/requirements.toml`,
      `${request.nativeHome}/managed_config.toml`,
      `${request.nativeHome}/requirements.toml`,
      `${request.nativeHome}/auth.json`,
    ])
      await requireAbsent(filename);
    const stat = await Fs.lstat(request.executable);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o111) === 0 ||
      (stat.mode & 0o022) !== 0 ||
      stat.size > 536870912 ||
      (await Fs.realpath(request.executable)) !== request.executable
    )
      throw new Error("executable-entry");
    await privateEntry(`${request.nativeHome}/config.toml`, "file");
    if ((await Fs.readFile(`${request.nativeHome}/config.toml`, "utf8")) !== grokCanaryProfile)
      throw new Error("profile-drift");
    const mcp = `${request.workspace}/.mcp.json`;
    const info = await Fs.lstat(mcp);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.uid !== process.getuid?.() ||
      (info.mode & 0o022) !== 0 ||
      info.size > 128
    )
      throw new Error("pilot-mcp-required");
    const mcpBytes = await Fs.readFile(mcp, "utf8");
    if (mcpBytes !== grokCanaryProjectMcp && mcpBytes !== grokCanaryProjectMcpFormatted)
      throw new Error("pilot-mcp-required");
    return mcpBytes;
  });
  const auth = yield* io(() => authIdentity(request.nativeAuthFile));
  const nativeAuthIdentitySha256 = yield* hashPublicTextSha256(auth.identity);
  if (
    (O.isSome(expectedAuth) && nativeAuthIdentitySha256 !== expectedAuth.value) ||
    (yield* io(() => fileDigest(request.executable))) !== request.executableSha256
  )
    return yield* failed("admission");
  const filename = `${shared}/config.toml`;
  let originalPolicy = "absent";
  if (O.isSome(request.originalUserConfigSha256)) {
    const text = yield* io(async () => {
      const info = await Fs.lstat(filename);
      if (
        info.isSymbolicLink() ||
        !info.isFile() ||
        info.size > 1048576 ||
        info.uid !== process.getuid?.() ||
        (info.mode & 0o022) !== 0
      )
        throw new Error("original-config-entry");
      return await Fs.readFile(filename, "utf8");
    });
    const digest = yield* hashPublicTextSha256(text);
    if (digest !== request.originalUserConfigSha256.value) return yield* failed("admission");
    const parsed = yield* Toml.parse(text).pipe(
      Effect.fromResult,
      Effect.mapError(() => failed("admission"))
    );
    const config = yield* S.decodeUnknownEffect(originalConfig)(parsed).pipe(
      Effect.mapError(() => failed("admission"))
    );
    if (
      A.some(["permission", "permissions", "sandbox", "security", "privacy", "requirements"], (key) =>
        R.has(config, key)
      )
    )
      return yield* failed("admission");
    originalPolicy = digest;
  } else yield* io(() => requireAbsent(filename));
  return {
    profileSha256: yield* hashPublicTextSha256(grokCanaryProfile),
    projectMcpSha256: yield* hashPublicTextSha256(projectMcpBytes),
    originalPolicySha256: yield* hashPublicTextSha256(originalPolicy),
    authIdentitySha256: nativeAuthIdentitySha256,
    authParentIdentitySha256: yield* hashPublicTextSha256(auth.parentIdentity),
    sessionContextSha256,
  };
});
const inventory = S.Struct({
  grokVersion: S.tag("1.0.77"),
  cwd: absolute,
  projectRoot: absolute,
  projectTrusted: S.tag(false),
  projectInstructions: S.Array(S.Unknown).check(S.isMaxLength(0)),
  hooks: S.Array(S.Unknown).check(S.isMaxLength(0)),
  skills: S.Array(S.Unknown).check(S.isMaxLength(0)),
  plugins: S.Array(S.Unknown).check(S.isMaxLength(0)),
  marketplaces: S.Array(S.Unknown).check(S.isMaxLength(0)),
  mcpServers: S.Array(S.Unknown).check(S.isMaxLength(0)),
  lspServers: S.Array(S.Unknown).check(S.isMaxLength(0)),
  configSources: S.Struct({
    layers: S.Array(S.Struct({ role: S.NonEmptyString.check(S.isMaxLength(64)), path: absolute })).check(
      S.isMinLength(1),
      S.isMaxLength(1)
    ),
  }),
  externalCompat: S.Struct({
    remoteSettingsLoaded: S.tag(false),
    cells: S.Array(S.Struct({ enabled: S.tag(false) })).check(S.isMaxLength(64)),
  }),
}).pipe(
  $I.annoteSchema("GrokFiniteNativeInventory", {
    description:
      "Exact native discovery must contain no hooks, executable extensions or project context; native built-in agents are not tool admission.",
  })
);
const encodePin = S.encodeEffect(
  S.fromJsonString(
    S.Struct({
      profileSha256: Sha256Hex,
      projectMcpSha256: Sha256Hex,
      originalPolicySha256: Sha256Hex,
      authIdentitySha256: Sha256Hex,
      authParentIdentitySha256: Sha256Hex,
      sessionContextSha256: Sha256Hex,
    })
  )
);
const makeEnv = (request: GrokNativeCanaryRequest) => {
  const env: Record<string, string> = {
    HOME: request.isolatedHome,
    USER: request.sessionContext.USER,
    LOGNAME: request.sessionContext.LOGNAME,
    SHELL: request.sessionContext.SHELL,
    TERM: request.sessionContext.TERM,
    XDG_RUNTIME_DIR: request.sessionContext.XDG_RUNTIME_DIR,
    DBUS_SESSION_BUS_ADDRESS: request.sessionContext.DBUS_SESSION_BUS_ADDRESS,
    GROK_HOME: request.nativeHome,
    GROK_AUTH_PATH: request.nativeAuthFile,
    GROK_SESSION_SUMMARY_MODEL: "grok-4.7",
    GROK_TITLE_REFRESH: "0",
    GROK_DISABLE_AUTOUPDATER: "1",
    GROK_DISABLE_EXPERIMENTS: "1",
    GROK_MEMORY: "0",
    GROK_GOAL: "0",
    GROK_WORKFLOWS: "0",
    GROK_SUBAGENTS: "0",
    GROK_MANAGED_MCPS_ENABLED: "0",
    GROK_MANAGED_MCP_GATEWAY_TOOLS_ENABLED: "0",
    GROK_TELEMETRY_ENABLED: "0",
    GROK_FEEDBACK_ENABLED: "0",
    RUST_LOG: "off",
    PATH: "/usr/bin:/bin",
    LANG: "C.UTF-8",
    GIT_OPTIONAL_LOCKS: "0",
  };
  for (const vendor of ["CURSOR", "CLAUDE", "CODEX"])
    for (const surface of ["SKILLS", "RULES", "AGENTS", "MCPS", "HOOKS", "SESSIONS"])
      env[`GROK_${vendor}_${surface}_ENABLED`] = "0";
  return env;
};
const inspectNative = Effect.fn("GrokCanary.inspectNative")(function* (
  request: GrokNativeCanaryRequest,
  measure: (kind: "stdout" | "stderr", bytes: number) => void,
  recordExit: (code: number) => Effect.Effect<void, GrokNativeCanaryError>
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const raw = yield* Effect.scoped(
    Effect.gen(function* () {
      const child = yield* spawner.spawn(
        ChildProcess.make(request.executable, ["inspect", "--json"], {
          cwd: request.workspace,
          env: makeEnv(request),
          extendEnv: false,
          stdin: "ignore",
          stderr: "pipe",
          forceKillAfter: "3 seconds",
        })
      );
      const captured = yield* captureNative(child, measure);
      yield* recordExit(captured.exitStatus);
      if (captured.exitStatus !== 0) return yield* failed("admission");
      return captured.stdout;
    })
  ).pipe(
    Effect.timeout("15 seconds"),
    Effect.mapError(() => failed("admission"))
  );
  const observed = yield* S.decodeEffect(S.fromJsonString(inventory))(raw).pipe(
    Effect.mapError(() => failed("admission"))
  );
  if (
    Str.replace(/\/+$/, "")(observed.cwd) !== request.workspace ||
    Str.replace(/\/+$/, "")(observed.projectRoot) !== request.workspace ||
    observed.configSources.layers[0]?.path !== `${request.nativeHome}/config.toml`
  )
    return yield* failed("admission");
  return yield* hashPublicTextSha256(yield* S.encodeEffect(S.fromJsonString(inventory))(observed));
});
const observeProcess = Effect.fn("GrokCanary.observeNativeProcess")(function* (
  request: GrokNativeCanaryRequest,
  pid: number
) {
  const identity = yield* io(async () => {
    const before = await Fs.readFile(`/proc/${pid}/stat`, "utf8");
    const fields = before
      .slice(before.lastIndexOf(")") + 2)
      .trim()
      .split(/\s+/);
    const ticks = fields[19];
    if (Number(fields[1]) !== process.pid || ticks === undefined || !/^[1-9][0-9]*$/.test(ticks))
      throw new Error("owned-process-stat");
    const expected = await Fs.stat(request.executable, { bigint: true });
    const executable = await Fs.stat(`/proc/${pid}/exe`, { bigint: true });
    if (
      expected.dev !== executable.dev ||
      expected.ino !== executable.ino ||
      (await Fs.readlink(`/proc/${pid}/cwd`)) !== request.workspace
    )
      throw new Error("native-process-binding");
    const after = await Fs.readFile(`/proc/${pid}/stat`, "utf8");
    const current = after
      .slice(after.lastIndexOf(")") + 2)
      .trim()
      .split(/\s+/);
    if (current[19] !== ticks || Number(current[1]) !== process.pid) throw new Error("process-replaced");
    return { ticks, signature: `${pid}:${ticks}:${executable.dev}:${executable.ino}` };
  }, "source");
  const salt = O.some(Redacted.value(request.hashSalt));
  return processProof.make({
    instanceId: yield* hashPrivateIdentifier(`grok-canary-process/v1:${request.launchId}:${identity.signature}`, salt),
    executableSha256: request.executableSha256,
    startTicksHash: yield* hashPrivateIdentifier(identity.ticks, salt),
    cwdHash: yield* hashPrivateIdentifier(request.workspace, salt),
  });
});

const sourceDigest = Effect.fn("GrokCanary.sourceDigest")(function* (
  binding: string,
  isolation: typeof qualification.Type,
  source: GrokCanarySource,
  process: typeof processProof.Type,
  start: string,
  end: string,
  elapsed: string
) {
  const qualified = yield* S.encodeEffect(S.fromJsonString(qualification))(isolation);
  const safeSource = yield* S.encodeEffect(S.fromJsonString(GrokCanarySource))(source);
  const safeProcess = yield* S.encodeEffect(S.fromJsonString(processProof))(process);
  return yield* hashPublicTextSha256(`${binding}:${qualified}:${safeSource}:${safeProcess}:${start}:${end}:${elapsed}`);
});
/** Launch one fixed native user turn, or replay only already immutable metadata.
 * **Details**
 * One fsynced fence covers native qualification and source dispatch. An incomplete
 * attempt never retries. A saved source permits exact original-epoch metadata
 * delivery only. Native title operations use Grok4.7 and remain private; native
 * HTTP requests/retries are unknown, not equated with the controller invocation.
 * The owner must use a dedicated pilot worktree whose local-only MCP commit is
 * never published into main. No ordinary worktree configuration is changed here.
 * **Example** (Inspect the fixed producer)
 * ```ts
 * console.log(typeof runGrokNativeCanary)
 * ```
 * @param request - Fixed owner admission with canonical native auth path and exact process/config pins.
 * @returns Immutable safe source and local acceptance only; backend remains unknown.
 * @category orchestration
 * @since 0.0.0
 */
export const runGrokNativeCanary = Effect.fn("HarnessEnrollment.grokNativeCanary")(function* (
  request: GrokNativeCanaryRequest
) {
  if (request.identity.harness !== "grok" || request.identity.surface !== "cli") return yield* failed("admission");
  yield* io(() => privateEntry(request.attemptDirectory, "directory"));
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
      (route) => route.routeId === request.identity.routeId && route.harness === "grok" && route.surface === "cli"
    )
  )
    return yield* failed("admission");
  const postFact = Effect.fn("GrokCanary.postFact")(function* (fact: ObservationLaunchFact) {
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
  let evidence: GrokNativeCanaryEvidence;
  if (O.isSome(saved)) {
    yield* io(async () => {
      const marker = `${request.attemptDirectory}/attempted`;
      await privateEntry(marker, "file");
      if ((await Fs.lstat(marker)).size !== 64 || (await Fs.readFile(marker, "utf8")) !== requestBinding)
        throw new Error("attempt-marker-binding");
    }, "attempted-unknown");
    evidence = yield* decodeEvidence(saved.value).pipe(Effect.mapError(() => failed("attempted-unknown")));
    const observation = evidence.observation;
    if (
      evidence.requestBinding !== requestBinding ||
      observation.launchId !== request.launchId ||
      observation.launchRouteId !== request.identity.routeId ||
      observation.sourceSessionId !== evidence.source.sourceSessionId ||
      observation.processInstanceId !== evidence.process.instanceId ||
      evidence.process.executableSha256 !== request.executableSha256 ||
      evidence.qualification.executableSha256 !== request.executableSha256 ||
      evidence.qualification.authIdentitySha256 !== request.nativeAuthIdentitySha256 ||
      observation.evidenceId !==
        (yield* sourceDigest(
          requestBinding,
          evidence.qualification,
          evidence.source,
          evidence.process,
          observation.startTimeUnixNano,
          observation.endTimeUnixNano,
          observation.elapsedNanos
        ))
    )
      return yield* failed("attempted-unknown");
  } else {
    // A previous incomplete attempt refuses before any new checkpoint or native invocation.
    yield* io(() => durableCreate(request.attemptDirectory, "attempted", requestBinding), "attempted-unknown");
    let operation: GrokNativeCanaryDiagnostic["operation"] = "preflight";
    let category: GrokNativeCanaryDiagnostic["category"] = "admission-refused";
    let dispatches = 0;
    let nativeExitStatus = O.none<number>();
    let stdoutBytes = O.none<number>();
    let stderrBytes = O.none<number>();
    let protocolTags = O.none<typeof protocolTagCounts.Type>();
    let nativeReportedNotSignedIn = O.none<true>();
    let nativeFailureClass = O.none<typeof GrokNativeFailureClass.Type>();
    let nativeFailureUnknownReason = O.none<typeof GrokNativeFailureUnknownReason.Type>();
    let sourceProcessId = O.none<Sha256Hex>();
    let sourceTimedOut = false;
    const measure = (kind: "stdout" | "stderr", bytes: number) => {
      if (kind === "stdout") stdoutBytes = O.some(bytes);
      else stderrBytes = O.some(bytes);
      if (bytes > (kind === "stdout" ? 1048576 : 65536)) category = "output-bound";
    };
    const checkpoint = (
      name: string,
      stage: GrokNativeCanaryDiagnostic["stage"],
      result: GrokNativeCanaryDiagnostic["category"]
    ) =>
      writeDiagnostic(
        request.attemptDirectory,
        name,
        GrokNativeCanaryDiagnostic.make({
          requestBinding,
          stage,
          operation,
          category: result,
          producerDispatchAttempts: dispatches,
          nativeExitStatus,
          stdoutBytes,
          stderrBytes,
          protocolTags,
          nativeReportedNotSignedIn,
          nativeFailureClass,
          nativeFailureUnknownReason,
        })
      );
    evidence = yield* Effect.gen(function* () {
      yield* checkpoint("diagnostic-000-attempt.json", "attempt", "not-run");
      const first = yield* pinRuntime(request);
      const firstPin = yield* encodePin(first);
      let currentAuth = first.authIdentitySha256;
      const transitions: Array<typeof authTransition.Type> = [];
      const requalify = Effect.fnUntraced(function* (after: O.Option<(typeof authTransition.Type)["operation"]>) {
        const next = yield* pinRuntime(request, O.isSome(after) ? O.none() : O.some(currentAuth));
        if ((yield* encodePin({ ...next, authIdentitySha256: first.authIdentitySha256 })) !== firstPin)
          return yield* failed("admission");
        if (next.authIdentitySha256 !== currentAuth) {
          if (O.isNone(after) || transitions.length >= 3) return yield* failed("admission");
          transitions.push(
            authTransition.make({ operation: after.value, before: currentAuth, after: next.authIdentitySha256 })
          );
          currentAuth = next.authIdentitySha256;
        }
      });
      operation = "inspect-1";
      category = "inventory-refused";
      const inspected = yield* inspectNative(request, measure, (code) => {
        nativeExitStatus = O.some(code);
        return checkpoint(
          "diagnostic-010-inspect.json",
          "inventory-exit",
          code === 0 ? "not-run" : "native-exit-refused"
        );
      });
      category = "post-policy-refused";
      yield* requalify(O.some("inspect-1"));
      operation = "inspect-2";
      category = "inventory-refused";
      nativeExitStatus = O.none();
      stdoutBytes = O.none();
      stderrBytes = O.none();
      const second = yield* inspectNative(request, measure, (code) => {
        nativeExitStatus = O.some(code);
        return checkpoint(
          "diagnostic-020-inspect.json",
          "inventory-exit",
          code === 0 ? "not-run" : "native-exit-refused"
        );
      });
      category = "post-policy-refused";
      if (second !== inspected) return yield* failed("admission");
      yield* requalify(O.some("inspect-2"));
      const isolation = qualification.make({
        ...first,
        authTransitions: O.some(transitions.slice()),
        executableSha256: request.executableSha256,
        inspectSha256: inspected,
        argvSha256: yield* hashPublicTextSha256(yield* S.encodeEffect(S.fromJsonString(S.Array(S.String)))(args)),
      });
      const qualified = yield* S.encodeEffect(S.fromJsonString(qualification))(isolation);
      yield* io(() => durableCreate(request.attemptDirectory, "preflight.json", qualified));
      yield* postFact(prepared);
      yield* requalify(O.none());
      operation = "main";
      category = "timeout-or-operational";
      dispatches = 1;
      nativeExitStatus = O.none();
      stdoutBytes = O.none();
      stderrBytes = O.none();
      yield* checkpoint("diagnostic-030-dispatch.json", "dispatch", "not-run");
      yield* requalify(O.none());
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const completed = yield* Effect.scoped(
        Effect.gen(function* () {
          const start = yield* Clock.currentTimeMillis;
          const mono = yield* Clock.monotonicTimeNanos;
          const child = yield* spawner.spawn(
            ChildProcess.make(request.executable, args, {
              cwd: request.workspace,
              env: makeEnv(request),
              extendEnv: false,
              stdin: "ignore",
              stderr: "pipe",
              forceKillAfter: "3 seconds",
            })
          );
          category = "process-binding-refused";
          const process = yield* observeProcess(request, Number(child.pid));
          sourceProcessId = O.some(process.instanceId);
          category = "timeout-or-operational";
          yield* postFact(
            ObservationLaunchFact.cases.Started.make({
              launchId: request.launchId,
              processInstanceId: process.instanceId,
            })
          );
          const captured = yield* captureNative(child, measure);
          nativeExitStatus = O.some(captured.exitStatus);
          protocolTags = O.some(yield* countProtocolTags(captured.stdout));
          nativeReportedNotSignedIn = yield* observeGrokReportedNotSignedIn(captured.stdout, captured.exitStatus);
          if (captured.exitStatus !== 0 && O.getOrThrow(protocolTags).error > 0) {
            const observedFailure = yield* observeGrokNativeFailure(captured.stdout, captured.exitStatus);
            nativeFailureClass = O.some(observedFailure.classification);
            nativeFailureUnknownReason = observedFailure.unknownReason;
          }
          yield* checkpoint(
            "diagnostic-040-native-exit.json",
            "native-exit",
            captured.exitStatus === 0 ? "not-run" : "native-exit-refused"
          );
          category = "native-exit-refused";
          if (captured.exitStatus !== 0) return yield* failed("source");
          category = "wire-refused";
          const source = yield* decodeGrokCanaryOutput(captured.stdout, request.hashSalt, request.workspace);
          const end = yield* Clock.currentTimeMillis;
          const elapsed = String((yield* Clock.monotonicTimeNanos) - mono);
          const started = String(BigInt(start) * 1000000n);
          const ended = String(BigInt(end) * 1000000n);
          category = "post-policy-refused";
          yield* requalify(O.some("main"));
          const finalIsolation = qualification.make({ ...isolation, authTransitions: O.some(transitions.slice()) });
          const evidenceId = yield* sourceDigest(
            requestBinding,
            finalIsolation,
            source,
            process,
            started,
            ended,
            elapsed
          );
          const observation = yield* S.decodeEffect(ManagedControllerObservation)({
            version: "managed-controller-observation/v1",
            launchId: request.launchId,
            launchRouteId: request.identity.routeId,
            processInstanceId: process.instanceId,
            sourceSessionId: source.sourceSessionId,
            evidenceId,
            startTimeUnixNano: started,
            endTimeUnixNano: ended,
            elapsedNanos: elapsed,
            outcome: "completed",
            response: "exact-constant-matched",
          }).pipe(Effect.mapError(() => failed("source")));
          return GrokNativeCanaryEvidence.make({
            requestBinding,
            observation,
            source,
            qualification: finalIsolation,
            process,
          });
        })
      ).pipe(
        Effect.timeout("110 seconds"),
        Effect.catchTag("TimeoutError", () => {
          sourceTimedOut = true;
          return failed("source");
        })
      );
      category = "retention-refused";
      const encoded = yield* encodeEvidence(completed);
      yield* io(() => durableCreate(request.attemptDirectory, "source.json", encoded), "source");
      return completed;
    }).pipe(
      Effect.onExit((exit) =>
        Effect.gen(function* () {
          // This hook runs after the owned process scope has released its child.
          if (Exit.isFailure(exit)) {
            if (O.isSome(sourceProcessId)) {
              const outcome = O.isSome(nativeExitStatus)
                ? nativeExitStatus.value !== 0
                  ? "failed"
                  : "unknown"
                : Exit.hasInterrupts(exit) || sourceTimedOut
                  ? "cancelled"
                  : "unknown";
              const lifecycle = (
                stage: "dispatch-intent" | "validated" | "pending",
                delivery: "pending" | "acknowledged"
              ) =>
                writeNativeAttemptDiagnostic(
                  request.attemptDirectory,
                  NativeAttemptDiagnostic.make({
                    requestBinding,
                    purpose: "lifecycle",
                    stage,
                    nativeSpawned: O.some(true),
                    nativeExitStatus,
                    observedStdoutBytes: O.getOrElse(stdoutBytes, () => 0),
                    outputComplete: O.isSome(nativeExitStatus),
                    protocol: O.none(),
                    failurePhase: O.some(sourceTimedOut ? "source-timeout" : "source"),
                    protocolFailure: O.none(),
                    lifecycleOutcome: O.some(outcome),
                    lifecycleDelivery: O.some(delivery),
                  })
                );
              // Intent and uncertain ACKs survive privately; secondary failures never replace the source cause.
              yield* lifecycle("dispatch-intent", "pending").pipe(Effect.ignoreCause);
              const terminal = yield* postFact(
                ObservationLaunchFact.cases.Finished.make({ launchId: request.launchId, outcome })
              ).pipe(Effect.exit);
              yield* lifecycle(
                Exit.isSuccess(terminal) ? "validated" : "pending",
                Exit.isSuccess(terminal) ? "acknowledged" : "pending"
              ).pipe(Effect.ignoreCause);
            }
            yield* checkpoint("diagnostic-090-outcome.json", "outcome", category).pipe(Effect.ignoreCause);
          } else yield* checkpoint("diagnostic-090-outcome.json", "outcome", "accepted");
        })
      ),
      Effect.mapError(() => failed("source"))
    );
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
  $I.annoteSchema("GrokCanaryDeliveryReport", {
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
      const request = yield* S.decodeEffect(S.fromJsonString(GrokNativeCanaryRequest), { onExcessProperty: "error" })(
        raw
      ).pipe(Effect.mapError(() => failed("admission")));
      const result = yield* runGrokNativeCanary(request).pipe(
        Effect.mapError((error) => (S.is(GrokNativeCanaryError)(error) ? error : failed("source")))
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
      Effect.provide(NodeCrypto.layer.pipe(Layer.provideMerge(NodeServices.layer)))
    )
  );
}
