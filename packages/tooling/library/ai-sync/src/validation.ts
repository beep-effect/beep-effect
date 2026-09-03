/**
 * Repo-local agent configuration validation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiSyncId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { decodeTomlTextAs } from "@beep/schema/Toml";
import { O, Str } from "@beep/utils";
import { Effect, FileSystem, Match, Path, SchemaIssue } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { AiSyncError, AiSyncValidationResult, ValidateRepoConfig } from "./models.ts";
import { ClaudeMcpJson, ClaudeSettings, CodexConfig, NormalizedAgentInstructionDocument } from "./schemas.ts";
import type { AiSyncValidatedConfigPath, AiSyncValidationSchemaId, ValidateRepoConfigInput } from "./models.ts";

const $I = $AiSyncId.create("validation");

const decodeJsonTextAs = <Schema extends S.Top>(schema: Schema) => S.decodeUnknownEffect(S.fromJsonString(schema));

const decodeCodexToml = decodeTomlTextAs(CodexConfig);
const decodeClaudeMcpJson = decodeJsonTextAs(ClaudeMcpJson);
const decodeClaudeSettingsJson = decodeJsonTextAs(ClaudeSettings);

class CodexRepoWorkspaceWritePolicy extends S.Class<CodexRepoWorkspaceWritePolicy>($I`CodexRepoWorkspaceWritePolicy`)(
  {
    network_access: S.Boolean.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    writable_roots: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CodexRepoWorkspaceWritePolicy", {
    description: "Checked-in Codex workspace-write egress and external writable-root policy.",
  })
) {}

class CodexRepoSafetyPolicy extends S.Class<CodexRepoSafetyPolicy>($I`CodexRepoSafetyPolicy`)(
  {
    approval_policy: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sandbox_mode: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    sandbox_workspace_write: CodexRepoWorkspaceWritePolicy.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("CodexRepoSafetyPolicy", {
    description: "Repository safety-policy projection of Codex config, separate from native schema validation.",
  })
) {}

const decodeCodexRepoSafetyPolicy = decodeTomlTextAs(CodexRepoSafetyPolicy);

const ClaudeRepoPermissionMode = LiteralKit([
  "default",
  "acceptEdits",
  "plan",
  "auto",
  "dontAsk",
  "bypassPermissions",
]).pipe(
  $I.annoteSchema("ClaudeRepoPermissionMode", {
    description: "Claude Code permission modes inspected for repository-safe approval defaults.",
  })
);

class ClaudeRepoPermissions extends S.Class<ClaudeRepoPermissions>($I`ClaudeRepoPermissions`)(
  {
    allow: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    defaultMode: ClaudeRepoPermissionMode.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    deny: S.Array(S.String).pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaudeRepoPermissions", {
    description: "Checked-in Claude approval mode, Bash allowlist, and deny rules inspected by the repo policy.",
  })
) {}

class ClaudeRepoPermissionPolicy extends S.Class<ClaudeRepoPermissionPolicy>($I`ClaudeRepoPermissionPolicy`)(
  {
    permissions: ClaudeRepoPermissions.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ClaudeRepoPermissionPolicy", {
    description: "Repository safety-policy projection of Claude settings, separate from native schema validation.",
  })
) {}

const decodeClaudeRepoPermissionPolicy = decodeJsonTextAs(ClaudeRepoPermissionPolicy);

const ApprovedClaudeRepoBashPermission = LiteralKit([
  "Bash(rg:*)",
  "Bash(fd:*)",
  "Bash(ls:*)",
  "Bash(wc:*)",
  "Bash(jq:*)",
  "Bash(git status:*)",
  "Bash(git log:*)",
  "Bash(git diff:*)",
  "Bash(git show:*)",
  "Bash(git branch:*)",
  "Bash(git worktree list:*)",
  "Bash(git worktree prune:*)",
  "Bash(gh pr view:*)",
  "Bash(gh pr checks:*)",
  "Bash(gh pr list:*)",
  "Bash(gh run list:*)",
  "Bash(gh run view:*)",
  "Bash(bun run beep yeet status:*)",
  "Bash(bun run beep yeet verify:*)",
  "Bash(bun run beep quality dev:*)",
  "Bash(bun run docgen:local:*)",
  "Bash(bunx turbo ls:*)",
  "Bash(bunx --bun vitest run:*)",
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git fetch:*)",
  "Bash(git rebase:*)",
  "Bash(git switch:*)",
  "Bash(git checkout -b:*)",
  "Bash(git rev-parse:*)",
  "Bash(git merge-base:*)",
  "Bash(git stash push:*)",
  "Bash(git stash show:*)",
  "Bash(git stash list:*)",
  "Bash(git stash drop:*)",
  "Bash(git worktree remove:*)",
  "Bash(git update-ref:*)",
  "Bash(git push origin --delete:*)",
  "Bash(bun run beep yeet repair:*)",
  "Bash(bun run beep yeet publish:*)",
  "Bash(bun run beep yeet monitor:*)",
  "Bash(bun run beep yeet closeout:*)",
  "Bash(bun run beep worktree new:*)",
  "Bash(bun run beep worktree doctor:*)",
  "Bash(bun run beep worktree remove:*)",
  "Bash(bun run beep goals:*)",
  "Bash(bun run beep lint:*)",
  "Bash(bun run beep laws:*)",
  "Bash(rm -rf .beep/fallow)",
  "Bash(bunx commitlint:*)",
  "Bash(bun install:*)",
]).pipe(
  $I.annoteSchema("ApprovedClaudeRepoBashPermission", {
    description:
      "Exact 51-value Bash grant domain approved for this repository, including named read-only GitHub queries, intentional Yeet publication commands, and stale-lane cleanup (stash drop, worktree removal, archive refs, and remote branch deletion).",
  })
);

const isApprovedClaudeRepoBashPermission = S.is(ApprovedClaudeRepoBashPermission);

const RequiredClaudeRepoDenyPermission = LiteralKit([
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(git push --force-with-lease:*)",
  "Bash(git push --mirror:*)",
  "Bash(git stash clear:*)",
  "Bash(git stash pop:*)",
  "Bash(git clean:*)",
  "Bash(git reset --hard:*)",
  "Bash(git checkout .)",
  "Bash(git checkout -- .)",
  "Bash(gh pr merge --admin:*)",
  "Bash(gh repo delete:*)",
  "Edit(**/.github/workflows/**)",
  "Edit(**/docs/_internal/**)",
  "Edit(**/.claude/settings.json)",
]).pipe(
  $I.annoteSchema("RequiredClaudeRepoDenyPermission", {
    description:
      "Exact 15-value Claude deny domain required to block history rewrites, working-tree destruction, stash clearing and popping, admin merges, repository deletion, and protected-file edits.",
  })
);

const isRequiredClaudeRepoDenyPermission = S.is(RequiredClaudeRepoDenyPermission);

const unapprovedClaudePermission = (permission: string): boolean => !isApprovedClaudeRepoBashPermission(permission);

const renderValidationCause = (cause: unknown): string => Str.replaceAll(/, got [^\n)]+/g, "")(String(cause));

const validationError =
  (relativePath: AiSyncValidatedConfigPath, schemaId: AiSyncValidationSchemaId) => (cause: unknown) =>
    AiSyncError.make({
      message: `Agent config validation failed for ${relativePath} using ${schemaId}: ${renderValidationCause(cause)}`,
      relativePath: O.some(relativePath),
      schemaId: O.some(schemaId),
      cause: O.some(cause),
    });

const repoSafetyPolicyError = (relativePath: AiSyncValidatedConfigPath, message: string, cause?: unknown) =>
  AiSyncError.make({
    message: `Agent config safety policy failed for ${relativePath}: ${message}`,
    relativePath: O.some(relativePath),
    cause: O.fromNullishOr(cause),
  });

const explicitSettingSafetyFinding = (
  settingName: string,
  expectedValue: string,
  value: string | undefined
): O.Option<string> =>
  O.match(O.fromNullishOr(value), {
    onNone: () => O.some(`${settingName} must be explicitly set to "${expectedValue}"`),
    onSome: (actual) =>
      O.liftPredicate(actual, (candidate) => !Str.equivalence(expectedValue)(candidate)).pipe(
        O.as(`${settingName} must be "${expectedValue}"`)
      ),
  });

const codexSettingOmittedFinding = (settingName: string, value: O.Option<string>): O.Option<string> =>
  O.as(value, `${settingName} must be omitted so sessions inherit the user's ~/.codex/config.toml`);

const validateCodexRepoSafetyPolicy = (content: string) =>
  decodeCodexRepoSafetyPolicy(content).pipe(
    Effect.mapError(validationError(".codex/config.toml", "codex-config")),
    Effect.flatMap((config) => {
      const networkAccessFinding = config.sandbox_workspace_write.pipe(
        O.flatMap((workspaceWrite) => workspaceWrite.network_access),
        O.filter((networkAccess) => networkAccess),
        O.as("sandbox_workspace_write.network_access must be false or omitted")
      );
      const writableRootsFinding = config.sandbox_workspace_write.pipe(
        O.flatMap((workspaceWrite) => workspaceWrite.writable_roots),
        O.filter(A.isReadonlyArrayNonEmpty),
        O.as("sandbox_workspace_write.writable_roots must be empty or omitted")
      );
      const findings = A.getSomes([
        codexSettingOmittedFinding("approval_policy", config.approval_policy),
        codexSettingOmittedFinding("sandbox_mode", config.sandbox_mode),
        networkAccessFinding,
        writableRootsFinding,
      ]);

      return A.match(findings, {
        onEmpty: () => Effect.void,
        onNonEmpty: (messages) => Effect.fail(repoSafetyPolicyError(".codex/config.toml", A.join(messages, "; "))),
      });
    })
  );

const validateClaudeRepoSafetyPolicy = (content: string) =>
  decodeClaudeRepoPermissionPolicy(content).pipe(
    Effect.mapError((cause) =>
      repoSafetyPolicyError(".claude/settings.json", "unable to decode the permissions policy", cause)
    ),
    Effect.flatMap((settings) => {
      const allowedPermissions = O.flatMap(settings.permissions, (permissions) => permissions.allow).pipe(
        O.getOrElse(A.empty<string>)
      );
      const deniedPermissions = O.flatMap(settings.permissions, (permissions) => permissions.deny).pipe(
        O.getOrElse(A.empty<string>)
      );
      const unapprovedPermissions = A.filter(allowedPermissions, unapprovedClaudePermission);
      const missingRequiredDenyPermissions = A.filter(
        RequiredClaudeRepoDenyPermission.Options,
        (permission) => !A.contains(deniedPermissions, permission)
      );
      const unexpectedDenyPermissions = A.filter(
        deniedPermissions,
        (permission) => !isRequiredClaudeRepoDenyPermission(permission)
      );
      const defaultModeFinding = explicitSettingSafetyFinding(
        "permissions.defaultMode",
        "default",
        settings.permissions.pipe(
          O.flatMap((permissions) => permissions.defaultMode),
          O.getOrUndefined
        )
      );
      const findings = A.flatten([
        A.map(unapprovedPermissions, (permission) => `unapproved auto-approved permission: ${permission}`),
        A.map(missingRequiredDenyPermissions, (permission) => `missing required deny rule: ${permission}`),
        A.map(
          unexpectedDenyPermissions,
          (permission) => `unexpected deny rule outside exact repository policy: ${permission}`
        ),
        O.toArray(defaultModeFinding),
      ]);
      return A.match(findings, {
        onEmpty: () => Effect.void,
        onNonEmpty: (messages) => Effect.fail(repoSafetyPolicyError(".claude/settings.json", A.join(messages, "; "))),
      });
    })
  );

const validateByRelativePath = (relativePath: ValidateRepoConfigInput["config"], content: string) => {
  if (relativePath === ".codex/config.toml") {
    return decodeCodexToml(content).pipe(
      Effect.as(AiSyncValidationResult.make({ relativePath, schemaId: "codex-config" })),
      Effect.mapError(validationError(relativePath, "codex-config"))
    );
  }
  if (relativePath === ".mcp.json") {
    return decodeClaudeMcpJson(content).pipe(
      Effect.as(AiSyncValidationResult.make({ relativePath, schemaId: "claude-mcp-json" })),
      Effect.mapError(validationError(relativePath, "claude-mcp-json"))
    );
  }
  if (relativePath === ".claude/settings.json") {
    return decodeClaudeSettingsJson(content).pipe(
      Effect.as(AiSyncValidationResult.make({ relativePath, schemaId: "claude-settings" })),
      Effect.mapError(validationError(relativePath, "claude-settings"))
    );
  }
  if (relativePath === "AGENTS.md" || relativePath === "CLAUDE.md") {
    return NormalizedAgentInstructionDocument.decodeEffect(content).pipe(
      Effect.as(AiSyncValidationResult.make({ relativePath, schemaId: "agent-instruction-document" })),
      Effect.mapError(validationError(relativePath, "agent-instruction-document"))
    );
  }
  return Effect.fail(
    AiSyncError.make({
      message: `No V1 AI sync schema is registered for ${relativePath}.`,
      relativePath: O.some(relativePath),
    })
  );
};

const validateRepoConfigContract = ValidateRepoConfig.implementEffect(
  Effect.fn("AiSync.validateRepoConfig.contract")(function* (options) {
    const content = yield* readRepoConfigContent(options);
    return yield* validateByRelativePath(options.config, content);
  })
);

const readRepoConfigContent = Effect.fn("AiSync.readRepoConfigContent")(function* (options: {
  readonly repoRoot: string;
  readonly config: string;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(options.repoRoot, options.config)).pipe(
    Effect.mapError((cause) =>
      AiSyncError.make({
        message: `Unable to read agent config file ${options.config}.`,
        relativePath: O.some(options.config),
        cause: O.some(cause),
      })
    )
  );
});

const mapValidateRepoConfigError = (cause: AiSyncError | SchemaIssue.Issue): AiSyncError =>
  SchemaIssue.isIssue(cause)
    ? AiSyncError.make({
        message: `Repo config validation contract failed: ${renderValidationCause(cause)}`,
        cause: O.some(cause),
      })
    : cause;

const validateRepoConfigContent = Effect.fn("AiSync.validateRepoConfigContent")(function* (
  options: { readonly config: string },
  content: string
) {
  return yield* validateByRelativePath(options.config, content).pipe(Effect.mapError(mapValidateRepoConfigError));
});

const validateRepoSafetyPolicyContent = Effect.fn("AiSync.validateRepoSafetyPolicyContent")(function* (
  config: ".codex/config.toml" | ".claude/settings.json",
  content: string
) {
  return yield* Match.value(config).pipe(
    Match.when(".codex/config.toml", () => validateCodexRepoSafetyPolicy(content)),
    Match.when(".claude/settings.json", () => validateClaudeRepoSafetyPolicy(content)),
    Match.exhaustive
  );
});

/**
 * Validate one repo-local config file through its native schema.
 *
 * **Example** (Validate repo config schemaId)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { validateRepoConfig } from "@beep/ai-sync"
 *
 * const program = validateRepoConfig({
 *   repoRoot: "/workspace/repo",
 *   config: ".codex/config.toml"
 * }).pipe(
 *   Effect.map((result) => result.schemaId),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Reads the requested repo-local config file through `FileSystem` and
 * `Path`, then decodes it with the registered native V1 schema.
 * @category validation
 * @since 0.0.0
 */
export const validateRepoConfig = Effect.fn("AiSync.validateRepoConfig")(function* (options: {
  readonly repoRoot: string;
  readonly config: string;
}) {
  return yield* validateRepoConfigContract(options).pipe(Effect.mapError(mapValidateRepoConfigError));
});

/**
 * Validate the repository safety policy for a checked-in agent config.
 *
 * **Details**
 *
 * The Codex repo config must omit `approval_policy` and `sandbox_mode`
 * entirely — permission posture belongs to each user's `~/.codex/config.toml`,
 * and the repository neither narrows nor widens it. It must also disable
 * workspace-write network access and grant no additional writable roots.
 * Claude must explicitly set `permissions.defaultMode` to
 * `default`, and every Bash allow entry must belong to the repository's exact
 * 46-value grant domain. Its deny rules must exactly cover the repository's
 * 19-value destructive-operation domain without out-of-policy additions. Named
 * read-only GitHub queries and intentional Yeet publication commands remain
 * approved members of the allow domain; direct Git pushes require approval.
 *
 * **Example** (Reject ambient agent authority)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { validateRepoSafetyPolicy } from "@beep/ai-sync"
 *
 * const program = validateRepoSafetyPolicy({
 *   repoRoot: "/workspace/repo",
 *   config: ".codex/config.toml"
 * }).pipe(Effect.provide(NodeServices.layer))
 *
 * Effect.runPromise(program)
 * ```
 *
 * @effects Reads either the Codex or Claude repo-local config and applies the
 * repository's exact approval, sandbox, and Bash-grant policy.
 * @category validation
 * @since 0.0.0
 */
export const validateRepoSafetyPolicy = Effect.fn("AiSync.validateRepoSafetyPolicy")(function* (options: {
  readonly repoRoot: string;
  readonly config: ".codex/config.toml" | ".claude/settings.json";
}) {
  const content = yield* readRepoConfigContent(options);
  return yield* validateRepoSafetyPolicyContent(options.config, content);
});

const validateRepoConfigWithSafetyPolicy = Effect.fn("AiSync.validateRepoConfigWithSafetyPolicy")(function* (options: {
  readonly repoRoot: string;
  readonly config: ".codex/config.toml" | ".claude/settings.json";
}) {
  const content = yield* readRepoConfigContent(options);
  const result = yield* validateRepoConfigContent(options, content);
  yield* validateRepoSafetyPolicyContent(options.config, content);
  return result;
});

/**
 * Validate the mandatory V1 dogfood config.
 *
 * **Example** (Validate dogfood relative path)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { validateDogfoodConfig } from "@beep/ai-sync"
 *
 * const program = validateDogfoodConfig("/workspace/repo").pipe(
 *   Effect.map((result) => result.relativePath),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Reads `.codex/config.toml` from the supplied repository root,
 * validates its native schema, and applies the repository safety policy.
 * @category validation
 * @since 0.0.0
 */
export const validateDogfoodConfig = Effect.fn("AiSync.validateDogfoodConfig")(function* (repoRoot: string) {
  return yield* validateRepoConfigWithSafetyPolicy({ repoRoot, config: ".codex/config.toml" });
});

/**
 * Validate every mandatory repo-local agent config.
 *
 * **Example** (Validate Codex and Claude dogfood configs)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import * as A from "effect/Array"
 * import { validateDogfoodConfigs } from "@beep/ai-sync"
 *
 * const program = validateDogfoodConfigs("/workspace/repo").pipe(
 *   Effect.map(A.map((result) => result.relativePath)),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Reads the checked-in Codex and Claude configs, validates each
 * native schema, then applies the repository safety policy to both.
 * @category validation
 * @since 0.0.0
 */
export const validateDogfoodConfigs = Effect.fn("AiSync.validateDogfoodConfigs")(function* (repoRoot: string) {
  return yield* Effect.all([
    validateRepoConfigWithSafetyPolicy({ repoRoot, config: ".codex/config.toml" }),
    validateRepoConfigWithSafetyPolicy({ repoRoot, config: ".claude/settings.json" }),
  ]);
});

/**
 * Resolve the repository root from the package source directory.
 *
 * **Example** (Resolve default repository root)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { defaultRepoRoot } from "@beep/ai-sync"
 *
 * const program = defaultRepoRoot().pipe(Effect.provide(NodeServices.layer))
 * Effect.runPromise(program).then((repoRoot) => console.log(repoRoot.endsWith("beep-effect2")))
 * ```
 *
 * @effects Resolves a path using the active `Path` service; it does not read or
 * write the filesystem.
 * @category validation
 * @since 0.0.0
 */
export const defaultRepoRoot = Effect.fn("AiSync.defaultRepoRoot")(function* () {
  const path = yield* Path.Path;
  return path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
});

/**
 * Validate the mandatory V1 config from the current checkout.
 *
 * **Example** (Validate current checkout dogfood)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import { validateCurrentCheckoutDogfood } from "@beep/ai-sync"
 *
 * const program = validateCurrentCheckoutDogfood().pipe(
 *   Effect.map((result) => result.schemaId),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Resolves this package's checkout root and validates the mandatory
 * Codex config through its native schema and repository safety policy.
 * @category validation
 * @since 0.0.0
 */
export const validateCurrentCheckoutDogfood = Effect.fn("AiSync.validateCurrentCheckoutDogfood")(function* () {
  const repoRoot = yield* defaultRepoRoot();
  return yield* validateDogfoodConfig(repoRoot);
});

/**
 * Validate all mandatory agent configs from the current checkout.
 *
 * **Example** (Validate current Codex and Claude dogfood)
 *
 * ```ts
 * import * as NodeServices from "@effect/platform-node/NodeServices"
 * import { Effect } from "effect"
 * import * as A from "effect/Array"
 * import { validateCurrentCheckoutDogfoodConfigs } from "@beep/ai-sync"
 *
 * const program = validateCurrentCheckoutDogfoodConfigs().pipe(
 *   Effect.map(A.length),
 *   Effect.provide(NodeServices.layer)
 * )
 *
 * Effect.runPromise(program).then(console.log)
 * ```
 *
 * @effects Resolves this package's checkout root and validates both mandatory
 * agent configs through their native schemas and repository safety policies.
 * @category validation
 * @since 0.0.0
 */
export const validateCurrentCheckoutDogfoodConfigs = Effect.fn("AiSync.validateCurrentCheckoutDogfoodConfigs")(
  function* () {
    const repoRoot = yield* defaultRepoRoot();
    return yield* validateDogfoodConfigs(repoRoot);
  }
);
