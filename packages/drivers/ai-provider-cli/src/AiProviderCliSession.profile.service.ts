/**
 * Private managed session implementation.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Errors as AcpErrors } from "@beep/acp";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ManagedSessionError } from "./AiProviderCliSession.errors.ts";
import type { ManagedLaunchProfile } from "./AiProviderCliSession.models.ts";

/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export const failure = {
  make: (operation: string, reason: ManagedSessionError["reason"], message: string) =>
    ManagedSessionError.make({ operation, reason, message }),
};
/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
 * @since 0.0.0
 */
export const encodeJson = Effect.fn("ManagedSession.encodeJson")((input: unknown) =>
  S.encodeEffect(S.fromJsonString(S.Unknown))(input)
);

/**
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
 * Private implementation boundary used by the managed session facade.
 * @internal
 * @category internals
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
  const forbiddenEnvironmentKey = S.is(
    S.Literals([
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
    ])
  );
  if (A.some(R.keys(profile.env), forbiddenEnvironmentKey))
    return yield* failure.make(
      "open",
      "invalid-profile",
      "Managed subscription launch rejects API credentials and alternative billing endpoints"
    );
});
