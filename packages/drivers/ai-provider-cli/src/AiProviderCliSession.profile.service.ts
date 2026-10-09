/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Errors as AcpErrors } from "@beep/acp";
import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type { ManagedLaunchProfile } from "./AiProviderCliSession.models.ts";

const $I = $AiProviderCliId.create("AiProviderCliSession.profile.service");
const ProtocolJson = S.fromJsonString(S.Unknown).annotate(
  $I.annote("ProtocolJson", { description: "Serialized native protocol payload without provider-specific decoding." })
);
const encodeProtocolJson = S.encodeEffect(ProtocolJson);
const ForbiddenEnvironmentKey = LiteralKit([
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "XAI_API_KEY",
  "GROK_API_KEY",
  "GROK_BASE_URL",
]).annotate(
  $I.annote("ForbiddenEnvironmentKey", {
    description: "Environment selectors excluded from approved subscription launches.",
  })
);
const forbiddenEnvironmentKey = S.is(ForbiddenEnvironmentKey);

/**
 * Constructs typed managed-session errors from a safe operation, reason and message.
 *
 * **Example** (Inspect a classified timeout)
 * ```ts
 * import { failure } from "../../src/AiProviderCliSession.profile.service.ts"
 * console.log(failure.make("prompt", "timeout", "Native request timed out").reason) // timeout
 * ```
 * @internal
 * @category error-handling
 * @since 0.0.0
 */
export const failure = {
  make: (operation: string, reason: ManagedSessionError["reason"], message: string) =>
    ManagedSessionError.make({ operation, reason, message }),
};
/**
 * Preserves typed session failures and redacts unclassified native transport errors.
 *
 * **Example** (Preserve a known timeout)
 * ```ts
 * import { failure, transportFailure } from "../../src/AiProviderCliSession.profile.service.ts"
 * import * as Effect from "effect/Effect"
 * const error = Effect.runSync(Effect.fail(failure.make("prompt", "timeout", "Native request timed out")).pipe(transportFailure("receive"), Effect.flip))
 * console.log(error.reason) // timeout
 * ```
 * @internal
 * @category error-handling
 * @since 0.0.0
 */
export const transportFailure = (operation: string) =>
  Effect.mapError((error) =>
    S.is(ManagedSessionError)(error)
      ? error
      : failure.make(
          operation,
          "transport",
          S.is(AcpErrors.AcpRequestError)(error)
            ? `Native RPC failed with code ${error.code}`
            : "Native runtime transport failed"
        )
  );
/**
 * Encodes protocol payloads as JSON through the schema encoder.
 *
 * **Example** (Encode a synthetic message identifier)
 * ```ts
 * import { encodeJson } from "../../src/AiProviderCliSession.profile.service.ts"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(encodeJson({ messageId: "synthetic" }))) // {"messageId":"synthetic"}
 * ```
 * @internal
 * @category encoding
 * @since 0.0.0
 */
export const encodeJson = Effect.fn("ManagedSession.encodeJson")((input: unknown) => encodeProtocolJson(input));

/**
 * Exclusively writes an owned Codex configuration with explicit policy and scoped MCP servers.
 *
 * **Example** (Compose private Codex preparation)
 * ```ts
 * import { prepareCodex } from "../../src/AiProviderCliSession.profile.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "codex", executable: "codex", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const operation = prepareCodex(profile)
 * console.log(Effect.isEffect(operation)) // true; no process or filesystem effect runs
 * ```
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const prepareCodex = Effect.fn("AiProviderCliSession.prepareCodex")(function* (profile: ManagedLaunchProfile) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const home = path.join(profile.profileRoot, ".codex");
  if (profile.env.CODEX_HOME !== home)
    return yield* failure.make("open", "invalid-profile", "CODEX_HOME must name the owned profile .codex directory");
  yield* fs.makeDirectory(home, { recursive: true });
  const config = path.join(home, "config.toml");
  if (yield* fs.exists(config))
    return yield* failure.make(
      "open",
      "invalid-profile",
      "Owned Codex config must be absent before launch preparation"
    );
  const sections = yield* Effect.forEach(
    profile.tools,
    Effect.fnUntraced(function* (tool) {
      const name = yield* encodeJson(tool.name);
      const command = yield* encodeJson(tool.command);
      const args = yield* encodeJson(tool.args);
      const env = yield* Effect.forEach(
        R.toEntries(tool.env),
        Effect.fnUntraced(function* ([key, value]) {
          return `${yield* encodeJson(key)} = ${yield* encodeJson(value)}`;
        }),
        { concurrency: 1 }
      );
      return `[mcp_servers.${name}]\ncommand = ${command}\nargs = ${args}\n[mcp_servers.${name}.env]\n${A.join(env, "\n")}`;
    }),
    { concurrency: 1 }
  );
  yield* fs
    .writeFileString(
      config,
      `model = "gpt-6.1-sol"\nmodel_reasoning_effort = "medium"\nforced_login_method = "chatgpt"\nproject_doc_max_bytes = 0\napproval_policy = "never"\nsandbox_mode = "read-only"\n[features]\nplugins = false\nhooks = false\napps = false\nmemories = false\nmulti_agent = false\nshell_snapshot = false\n${A.join(sections, "\n")}`,
      { mode: 0o600, flag: "wx" }
    )
    .pipe(
      Effect.mapError(() =>
        failure.make("prepare-profile", "invalid-profile", "Owned Codex configuration could not be created exclusively")
      )
    );
});

/**
 * Validates private writable directories and exclusively writes the named Grok sandbox configuration.
 *
 * **Example** (Compose private Grok preparation)
 * ```ts
 * import { prepareGrok } from "../../src/AiProviderCliSession.profile.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "grok", executable: "grok", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const operation = prepareGrok(profile)
 * console.log(Effect.isEffect(operation)) // true; no process or filesystem effect runs
 * ```
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const prepareGrok = Effect.fn("AiProviderCliSession.prepareGrok")(function* (profile: ManagedLaunchProfile) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const owner = yield* fs.realPath(path.dirname(profile.profileRoot)).pipe(transportFailure("prepare-profile"));
  const validateContainment = Effect.fn("ManagedGrok.validateContainment")(function* (
    writable: string,
    actual: string
  ) {
    const relative = path.relative(owner, actual);
    if (
      actual !== writable ||
      relative === "" ||
      path.isAbsolute(relative) ||
      Str.startsWith(`..${path.sep}`)(relative) ||
      relative === ".." ||
      owner === path.sep
    )
      return yield* failure.make(
        "open",
        "invalid-profile",
        "Grok writable directories must stay strictly inside the owned profile parent"
      );
  });
  const validateDirectory = Effect.fn("ManagedGrok.validateDirectory")(function* (writable: string) {
    if (!path.isAbsolute(writable))
      return yield* failure.make("open", "invalid-profile", "Grok writable directories must be canonical owned paths");
    const actual = yield* fs.realPath(writable).pipe(transportFailure("prepare-profile"));
    const info = yield* fs.stat(actual).pipe(transportFailure("prepare-profile"));
    if (info.type !== "Directory" || (info.mode & 0o077) !== 0)
      return yield* failure.make("open", "invalid-profile", "Grok writable paths must be private directories");
    yield* validateContainment(writable, actual);
  });
  yield* Effect.forEach(profile.sandboxWritablePaths, validateDirectory, { discard: true });
  const home = path.join(profile.profileRoot, ".grok");
  yield* fs.makeDirectory(home, { recursive: true }).pipe(transportFailure("prepare-profile"));
  const config = path.join(home, "sandbox.toml");
  if (yield* fs.exists(config).pipe(transportFailure("prepare-profile")))
    return yield* failure.make("open", "invalid-profile", "Owned Grok sandbox configuration already exists");
  const paths = yield* encodeJson(profile.sandboxWritablePaths).pipe(transportFailure("prepare-profile"));
  const configText = `[profiles.beep-messaging]\nextends = "read-only"\nrestrict_network = true\nread_write = ${paths}\n`;
  yield* fs
    .writeFileString(config, configText, { mode: 0o600, flag: "wx" })
    .pipe(
      Effect.mapError(() =>
        failure.make(
          "prepare-profile",
          "invalid-profile",
          "Owned Grok sandbox configuration could not be created exclusively"
        )
      )
    );
  return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(paths)).pipe(
    transportFailure("prepare-profile")
  );
});

/**
 * Rejects nonisolated profiles and environment selectors that would change the approved auth route.
 *
 * **Example** (Compose launch validation)
 * ```ts
 * import { validateProfile } from "../../src/AiProviderCliSession.profile.service.ts"
 * import * as Effect from "effect/Effect"
 * import { ManagedLaunchProfile } from "@beep/ai-provider-cli"
 * const profile = ManagedLaunchProfile.make({
 *   provider: "codex", executable: "codex", prefixArgs: [],
 *   workspace: "/owned/workspace", profileRoot: "/owned/profile",
 *   env: { HOME: "/owned/profile" }, authLane: "existing-subscription", tools: []
 * })
 * const operation = validateProfile(profile)
 * console.log(Effect.isEffect(operation)) // true; no process or filesystem effect runs
 * ```
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const validateProfile = Effect.fn("ManagedSession.validateProfile")(function* (profile: ManagedLaunchProfile) {
  const path = yield* Path.Path;
  if (
    !path.isAbsolute(profile.workspace) ||
    !path.isAbsolute(profile.profileRoot) ||
    profile.env.HOME !== profile.profileRoot ||
    profile.workspace === profile.profileRoot
  ) {
    return yield* failure.make(
      "open",
      "invalid-profile",
      "Explicit absolute workspace and distinct owned HOME are required"
    );
  }

  if (A.some(R.keys(profile.env), forbiddenEnvironmentKey))
    return yield* failure.make(
      "open",
      "invalid-profile",
      "Managed subscription launch rejects API credentials and alternative billing endpoints"
    );
});
