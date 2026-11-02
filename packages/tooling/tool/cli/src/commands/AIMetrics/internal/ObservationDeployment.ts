/**
 * Bounded, explicit user-service deployment plans for the observation worker.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { SystemdUnitPath } from "../../../internal/systemd/index.ts";
import { AiMetricsCommandError } from "../AIMetrics.errors.ts";

const $I = $RepoCliId.create("commands/AIMetrics/internal/ObservationDeployment");
const AbsolutePath = SystemdUnitPath.check(S.isMaxLength(240));
const CredentialPath = AbsolutePath.check(S.isPattern(/^\/[A-Za-z0-9_./-]+$/)).pipe(
  $I.annoteSchema("CredentialPath", {
    description: "Space-free absolute credential source supported by the installed systemd user manager.",
  })
);

/**
 * Explicit locations and lifetime for a new bounded observation installation.
 * **Details** Contains only credential file locations. Systemd supplies a dedicated
 * hash-salt credential and an optional Phoenix query credential. Processes start
 * with a positive environment allowlist; secret values never enter argv or env.
 * Plans never install files, enable startup, resume intake or change held units.
 * **Example** (Inspect deployment input)
 * ```ts
 * import { ObservationDeploymentRequest } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationDeployment"
 * console.log(typeof ObservationDeploymentRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationDeploymentRequest extends S.Opaque<
  ObservationDeploymentRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-deployment-request/v1"),
    unitBase: S.String.check(S.isPattern(/^beep-observation-[a-z0-9][a-z0-9-]{0,39}$/)),
    stateDirectory: AbsolutePath.check(S.isPattern(/^\/[A-Za-z0-9_./-]{1,79}$/)),
    artifactDirectory: AbsolutePath,
    bunPath: AbsolutePath,
    hashSaltFile: CredentialPath,
    phoenixApiKeyFile: CredentialPath.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    intakePort: S.Int.check(S.isBetween({ minimum: 1024, maximum: 65535 })),
    runtimeMaxSeconds: S.Int.check(S.isBetween({ minimum: 30, maximum: 3600 })),
    journalMaxDatabasePages: TranscriptIntakeConfig.fields.maxDatabasePages
      .check(S.isLessThanOrEqualTo(8192))
      .pipe(S.withConstructorDefault(Effect.succeed(256)), S.withDecodingDefaultKey(Effect.succeed(256))),
  }).pipe(
    $I.annoteSchema("ObservationDeploymentRequest", {
      description: "New paused worker and loopback intake deployment with explicit finite lifetime.",
    })
  )
) {}

/**
 * Rendered units and intake configuration, without installation authority.
 * **Example** (Inspect the output model)
 * ```ts
 * import { ObservationDeploymentPlan } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationDeployment"
 * console.log(typeof ObservationDeploymentPlan.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationDeploymentPlan extends S.Opaque<ObservationDeploymentPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-deployment-plan/v1"),
    workerUnitName: S.String,
    intakeUnitName: S.String,
    workerUnit: S.String,
    intakeUnit: S.String,
    intakeConfig: S.String,
  }).pipe($I.annoteSchema("ObservationDeploymentPlan", { description: "Reviewable bounded deployment artifacts." }))
) {}

const refusal = () =>
  AiMetricsCommandError.make({
    message: "Observation deployment requires distinct canonical absolute paths and bounded explicit settings.",
    cause: "Invalid observation deployment request",
  });
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

/**
 * Render paused worker and intake-only frontend units with enforced ceilings.
 * **Details** Install worker.mjs, its worker.sha256 manifest, pinned caddy and its
 * intake.sha256 manifest in the artifact directory. Manifests must bind all
 * executable/configuration bytes, including the selected Bun binary. The plan is
 * not filesystem validation, a backup policy or permission to restore claims.
 * journalMaxDatabasePages must match the launch configuration; the worker
 * independently refuses a file ceiling below its configured journal requirement.
 * This bounded deployment supports up to 8192 pages (32 MiB database), with
 * twice that space per file for rollback-journal overhead, at most 64 MiB.
 * **Example** (Inspect the renderer)
 * ```ts
 * import { renderObservationDeployment } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationDeployment"
 * console.log(typeof renderObservationDeployment)
 * ```
 * @category programs
 * @since 0.0.0
 */
export const renderObservationDeployment = Effect.fn("AIMetrics.renderObservationDeployment")(function* (
  request: ObservationDeploymentRequest
) {
  const path = yield* Path.Path;
  const { artifactDirectory, stateDirectory, hashSaltFile, phoenixApiKeyFile, bunPath, unitBase } = request;
  const secretFiles = [hashSaltFile, ...O.toArray(phoenixApiKeyFile)];
  for (const value of [artifactDirectory, stateDirectory, ...secretFiles, bunPath]) {
    if (!path.isAbsolute(value) || path.normalize(value) !== value || Str.trim(value) !== value || value === "/")
      return yield* refusal();
  }
  if (
    artifactDirectory === stateDirectory ||
    Str.startsWith(`${artifactDirectory}/`)(stateDirectory) ||
    Str.startsWith(`${stateDirectory}/`)(artifactDirectory) ||
    A.some([artifactDirectory, stateDirectory], (directory) =>
      A.some([...secretFiles, bunPath], (file) => file === directory || Str.startsWith(`${directory}/`)(file))
    )
  )
    return yield* refusal();
  const workerUnitName = `${unitBase}.service`;
  const intakeUnitName = `${unitBase}-intake.service`;
  const common = [
    "Type=exec",
    "Slice=agent-runs.slice",
    "Restart=no",
    `RuntimeMaxSec=${request.runtimeMaxSeconds}`,
    "TimeoutStopSec=10",
    "KillMode=control-group",
    "OOMPolicy=stop",
    "MemorySwapMax=0",
    "TasksMax=64",
    "LimitCORE=0",
    "UMask=0077",
    "NoNewPrivileges=yes",
    "StandardOutput=null",
    "StandardError=journal",
    "LogRateLimitIntervalSec=30s",
    "LogRateLimitBurst=10",
  ];
  const workerUnit = A.join(
    [
      "[Unit]",
      "Description=Bounded private observation worker (starts paused)",
      "[Service]",
      ...common,
      `LimitFSIZE=${request.journalMaxDatabasePages * 8192}`,
      "MemoryHigh=402653184",
      "MemoryMax=536870912",
      "CPUQuota=50%",
      "LimitNOFILE=256",
      `WorkingDirectory=${artifactDirectory}`,
      `LoadCredential=hash-salt:${hashSaltFile}`,
      ...O.toArray(O.map(phoenixApiKeyFile, (file) => `LoadCredential=phoenix-api-key:${file}`)),
      `ExecStartPre=/usr/bin/sha256sum --check --status "${artifactDirectory}/worker.sha256"`,
      `ExecStart=/usr/bin/env --ignore-environment PATH=/usr/bin:/bin "CREDENTIALS_DIRECTORY=%d" /usr/bin/flock --nonblock --no-fork --conflict-exit-code 73 "${stateDirectory}/worker.lock" "${bunPath}" --no-env-file --max-http-header-size=16384 "${artifactDirectory}/worker.mjs" "${stateDirectory}"`,
      "",
    ],
    "\n"
  );
  const intakeUnit = A.join(
    [
      "[Unit]",
      "Description=Bounded loopback observation intake (POST traces only)",
      `Requires=${workerUnitName}`,
      `After=${workerUnitName}`,
      `BindsTo=${workerUnitName}`,
      `PartOf=${workerUnitName}`,
      "[Service]",
      ...common,
      "LimitFSIZE=2097152",
      "MemoryMax=134217728",
      "CPUQuota=25%",
      "LimitNOFILE=128",
      `WorkingDirectory=${artifactDirectory}`,
      `ExecStartPre=/usr/bin/sha256sum --check --status "${artifactDirectory}/intake.sha256"`,
      `ExecStart=/usr/bin/env --ignore-environment PATH=/usr/bin:/bin GOMEMLIMIT=96MiB GOMAXPROCS=2 "XDG_CONFIG_HOME=${stateDirectory}/frontend-config" "XDG_DATA_HOME=${stateDirectory}/frontend-data" "${artifactDirectory}/caddy" run --config "${artifactDirectory}/intake.json"`,
      "",
    ],
    "\n"
  );
  const intakeConfig = yield* encodeJsonValue({
    admin: { disabled: true, config: { persist: false } },
    logging: { logs: { default: { writer: { output: "discard" } } } },
    apps: {
      http: {
        servers: {
          intake: {
            listen: [`127.0.0.1:${request.intakePort}`],
            protocols: ["h1"],
            automatic_https: { disable: true },
            read_header_timeout: "2s",
            read_timeout: "4s",
            write_timeout: "8s",
            idle_timeout: "2s",
            max_header_bytes: 16384,
            routes: [
              {
                match: [
                  {
                    path: ["/v1/traces"],
                    method: ["POST"],
                    expression:
                      "{http.request.header.Content-Length} != '' && int({http.request.header.Content-Length}) > 262144",
                  },
                ],
                terminal: true,
                handle: [{ handler: "static_response", status_code: 413 }],
              },
              {
                match: [{ path: ["/v1/traces"], method: ["POST"] }],
                terminal: true,
                handle: [
                  { handler: "request_body", max_size: 262144 },
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: `unix/${stateDirectory}/worker.sock` }],
                    transport: {
                      protocol: "http",
                      versions: ["1.1"],
                      dial_timeout: "1s",
                      response_header_timeout: "5s",
                      read_timeout: "5s",
                      write_timeout: "2s",
                      keep_alive: { enabled: false },
                    },
                  },
                ],
              },
              { handle: [{ handler: "static_response", status_code: 404 }] },
            ],
          },
        },
      },
    },
  }).pipe(Effect.mapError(refusal));
  return ObservationDeploymentPlan.make({ workerUnitName, intakeUnitName, workerUnit, intakeUnit, intakeConfig });
});
const decodeObservationDeploymentRequestJson = S.decodeEffect(S.fromJsonString(ObservationDeploymentRequest), {
  onExcessProperty: "error",
});
const encodeObservationDeploymentPlanJson = S.encodeEffect(S.fromJsonString(ObservationDeploymentPlan));

/**
 * Print a strict bounded deployment plan without modifying files or services.
 * **Example** (Inspect the command program)
 * ```ts
 * import { makeObservationDeploymentProgram } from "@beep/repo-cli/commands/AIMetrics/internal/ObservationDeployment"
 * console.log(typeof makeObservationDeploymentProgram)
 * ```
 * @category programs
 * @since 0.0.0
 */
export const makeObservationDeploymentProgram = Effect.fn("AIMetrics.observationDeployment")(function* (input: string) {
  const fs = yield* FileSystem.FileSystem;
  const chunks = yield* fs.stream(input, { bytesToRead: 16385 }).pipe(Stream.runCollect, Effect.mapError(refusal));
  const length = A.reduce(chunks, 0, (total, chunk) => total + chunk.byteLength);
  if (length > 16384) return yield* refusal();
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = yield* Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    catch: refusal,
  });
  const request = yield* decodeObservationDeploymentRequestJson(text).pipe(Effect.mapError(refusal));
  const plan = yield* renderObservationDeployment(request);
  yield* Console.log(yield* encodeObservationDeploymentPlanJson(plan).pipe(Effect.mapError(refusal)));
});
