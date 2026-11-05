/**
 * Linux-only finite non-auth policy preflight for the fixed Claude canary.
 * No credential, native global-config, transcript or arbitrary file reads.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Fs from "node:fs/promises";
import { $RepoCliId } from "@beep/identity/packages";
import { hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/claude-native-policy");
const record = S.Record(S.String, S.Unknown);
const forbidden = [
  "apiKeyHelper",
  "otelHeadersHelper",
  "policyHelper",
  "processWrapper",
  "forceLoginMethod",
  "forceLoginOrgUUID",
  "gateway",
  "gatewayUrl",
  "model",
  "modelOverrides",
  "fallbackModel",
  "modelSettings",
  "effortLevel",
  "maxEffortLevel",
  "hooks",
  "mcpServers",
  "managedMcpServers",
  "enabledPlugins",
  "extraKnownMarketplaces",
  "pluginConfigs",
  "plugins",
  "agents",
  "workflows",
  "statusLine",
  "fileSuggestion",
  "autoConnectIde",
  "enableChrome",
];
const offEnv = S.Record(S.String, S.String);
const approvedOff: Readonly<Record<string, string>> = {
  OTEL_LOG_USER_PROMPTS: "0",
  OTEL_LOG_ASSISTANT_RESPONSES: "0",
  OTEL_LOG_TOOL_CONTENT: "0",
  OTEL_LOG_RAW_API_BODIES: "0",
  OTEL_LOG_TOOL_DETAILS: "0",
  OTEL_LOG_MANAGED_SETTINGS: "0",
  OTEL_TRACES_EXPORTER: "none",
  OTEL_LOGS_EXPORTER: "none",
  OTEL_METRICS_EXPORTER: "none",
  CLAUDE_CODE_ENABLE_TELEMETRY: "0",
  CLAUDE_CODE_EFFORT_LEVEL: "medium",
  DISABLE_TELEMETRY: "1",
  DISABLE_ERROR_REPORTING: "1",
  DISABLE_AUTOUPDATER: "1",
  ENABLE_BETA_TRACING_DETAILED: "0",
};

/**
 * Content-free policy refusal, including unknown/unsafe entries and read races.
 * **Example** (Inspect the error constructor)
 * ```ts
 * console.log(typeof ClaudePolicyError.make)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ClaudePolicyError extends S.TaggedError<ClaudePolicyError, { readonly brand: unique symbol }>(
  $I`ClaudePolicyError`
)("ClaudePolicyError", {}, $I.annote("ClaudePolicyError", { description: "Fixed non-auth policy refusal." })) {}
const refuse = () => ClaudePolicyError.make({});

/**
 * Check selected bootstrap, hooks, MCP and env fields; return no raw configuration.
 * **Example** (Inspect the projector)
 * ```ts
 * console.log(typeof checkClaudeManagedPolicy)
 * ```
 * @param raw - Transient JSON policy, never serialized after inspection.
 * @returns Void after the finite policy check.
 * @category validation
 * @since 0.0.0
 */
export const checkClaudeManagedPolicy = Effect.fn("ClaudeCanary.checkManagedPolicy")(function* (raw: string) {
  const value = yield* S.decodeEffect(S.fromJsonString(record))(raw).pipe(Effect.mapError(refuse));
  for (const key of forbidden) {
    const selected = R.get(value, key);
    if (O.isSome(selected) && selected.value !== null) {
      const emptyObject = S.is(record)(selected.value) && R.size(selected.value) === 0;
      const emptyArray = S.is(S.Array(S.Unknown))(selected.value) && selected.value.length === 0;
      if (!emptyObject && !emptyArray && selected.value !== false) return yield* refuse();
    }
  }
  const environment = R.get(value, "env");
  if (O.isSome(environment)) {
    const env = yield* S.decodeUnknownEffect(offEnv)(environment.value).pipe(Effect.mapError(refuse));
    if (A.some(R.toEntries(env), ([key, val]) => approvedOff[key] !== val)) return yield* refuse();
  }
  // Settings can add new executable bootstrap mechanisms; unknown keys are not silently trusted.
  const safe = [
    "permissions",
    "disableAllHooks",
    "disableClaudeAiConnectors",
    "cleanupPeriodDays",
    "allowManagedPermissionRulesOnly",
    "env",
    ...forbidden,
  ];
  if (A.some(R.keys(value), (key) => !A.contains(safe, key))) return yield* refuse();
  if (R.has(value, "disableAllHooks") && value.disableAllHooks !== true) return yield* refuse();
  if (R.has(value, "disableClaudeAiConnectors") && value.disableClaudeAiConnectors !== true) return yield* refuse();
});

/**
 * Immutable digest of finite selected non-auth paths, never their names or values.
 * **Example** (Inspect the safe snapshot schema)
 * ```ts
 * console.log(typeof ClaudePolicySnapshot.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaudePolicySnapshot extends S.Opaque<ClaudePolicySnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("claude-native-policy/v1"),
    digest: Sha256Hex,
    presentFiles: S.Natural.check(S.isLessThanOrEqualTo(36)),
    selectedBootstrapKeys: S.tag("absent-or-inert"),
    nativeAuthBoundary: S.tag("existing-home-no-credential-inspection"),
    remotePolicyBoundary: S.tag("local-selected-files-only-no-remote-freeze-claim"),
  }).pipe($I.annoteSchema("ClaudePolicySnapshot", { description: "Local selected metadata/policy evidence only." }))
) {}

/**
 * Fingerprint system settings/drop-ins/MCP and one native cached remote policy.
 * **Details**
 * Fixed Linux paths only. Symlinks, unsafe owners/modes, races and oversized files refuse.
 * Native auth files and ~/.claude.json are never opened. Remote refresh is not frozen.
 * **Example** (Inspect the finite qualifier)
 * ```ts
 * console.log(typeof qualifyClaudeManagedPolicy)
 * ```
 * @param sharedConfigDirectory - Existing native configuration directory, not a credential file.
 * @returns A content-free metadata fingerprint for immediate pre/post pinning.
 * @category validation
 * @since 0.0.0
 */
export const qualifyClaudeManagedPolicy = Effect.fn("ClaudeCanary.qualifyManagedPolicy")(function* (
  sharedConfigDirectory: string
) {
  const io = <T>(f: () => Promise<T>) => Effect.tryPromise({ try: f, catch: refuse });
  const missing = (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
  const configIdentity = yield* io(async () => {
    const stat = await Fs.lstat(sharedConfigDirectory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o022) !== 0 ||
      (await Fs.realpath(sharedConfigDirectory)) !== sharedConfigDirectory
    )
      throw new Error("unsafe-native-config-directory");
    return `${stat.dev}:${stat.ino}:${stat.mode}`;
  });
  const files = [
    "/etc/claude-code/managed-settings.json",
    "/etc/claude-code/managed-mcp.json",
    `${sharedConfigDirectory}/remote-settings.json`,
  ];
  const drops = "/etc/claude-code/managed-settings.d";
  let directorySignature = "absent";
  const entries = yield* io(async () => {
    try {
      const stat = await Fs.lstat(drops);
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        (stat.mode & 0o022) !== 0 ||
        stat.uid !== 0 ||
        (await Fs.realpath(drops)) !== drops
      )
        throw new Error("unsafe-policy-directory");
      directorySignature = `${stat.dev}:${stat.ino}:${stat.mtimeMs}:${stat.ctimeMs}`;
      return await Fs.readdir(drops);
    } catch (error) {
      if (missing(error)) return [];
      throw error;
    }
  });
  const names = A.sort(
    A.filter(entries, (name) => !Str.startsWith(".")(name) && Str.endsWith(".json")(name)),
    Str.Order
  );
  if (names.length > 32 || A.some(names, (name) => !/^[A-Za-z0-9_.-]+\.json$/.test(name))) return yield* refuse();
  for (const name of names) files.push(`${drops}/${name}`);
  const rows: Array<string> = [`native-config:${configIdentity}`, `dropins:${directorySignature}`];
  let presentFiles = 0;
  for (const path of files) {
    const file = yield* io(async () => {
      try {
        const before = await Fs.lstat(path, { bigint: true });
        if (
          !before.isFile() ||
          before.isSymbolicLink() ||
          (before.mode & 0o022n) !== 0n ||
          (before.uid !== 0n && before.uid !== BigInt(process.getuid?.() ?? -1)) ||
          before.size > 262144n ||
          (await Fs.realpath(path)) !== path
        )
          throw new Error("unsafe-policy-file");
        const text = await Fs.readFile(path, "utf8");
        const after = await Fs.lstat(path, { bigint: true });
        const signature = (s: typeof before) => `${s.dev}:${s.ino}:${s.mode}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
        if (signature(before) !== signature(after)) throw new Error("policy-changed");
        return O.some({ text, signature: signature(after) });
      } catch (error) {
        if (missing(error)) return O.none();
        throw error;
      }
    });
    if (O.isNone(file)) rows.push(`${path}:absent`);
    else {
      yield* checkClaudeManagedPolicy(file.value.text);
      const contentHash = yield* hashPublicTextSha256(file.value.text);
      rows.push(`${path}:${file.value.signature}:${contentHash}`);
      presentFiles += 1;
    }
  }
  const digest = yield* hashPublicTextSha256(A.join(rows, "\n"));
  return ClaudePolicySnapshot.make({ digest, presentFiles });
});
