/**
 * Cross-file plugin validation, linting, and on-disk diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Effect, Order } from "effect";
import * as A from "effect/Array";
import type * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import type * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PluginLoadError } from "../Errors.ts";
import { McpJsonFile } from "../Mcp.ts";
import { HooksSection } from "../Settings/HooksSection.ts";
import type { PluginAgentEntry, PluginCommandEntry, PluginDefinition, PluginOutputStyleEntry } from "./Define.ts";
import { isMarkdownFilePath, isSkillFilePath, pathSpecs } from "./Layout.ts";
import { LoadedPlugin, load, PluginScan, scan } from "./Load.ts";

const $I = $ScratchpadId.create("claudecode/Plugin/Validate");

/**
 * Severity level for plugin issues.
 *
 * **Example** (Use a plugin issue severity)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.PluginIssueSeverity.is.error("error"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PluginIssueSeverity = LiteralKit(["error", "warning"]).pipe(
  $I.annoteSchema("PluginIssueSeverity", {
    description: "Severity assigned to a plugin validation issue.",
  })
);

/**
 * Runtime type represented by {@link PluginIssueSeverity}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PluginIssueSeverity = typeof PluginIssueSeverity.Type;

/**
 * A validation or lint finding for a plugin definition.
 *
 * **Example** (Create a validation issue)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const finding = Plugin.PluginIssue.make({
 *   code: "duplicate-command-name",
 *   severity: "error",
 *   message: "Duplicate command name."
 * })
 *
 * console.log(finding.code) // "duplicate-command-name"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginIssue extends S.Class<PluginIssue>($I`PluginIssue`)(
  {
    code: S.String,
    severity: PluginIssueSeverity,
    message: S.String,
    path: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("PluginIssue", {
    description: "A validation or lint finding for a Claude Code plugin.",
  })
) {}

/**
 * Companion types for {@link PluginIssue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginIssue {
  /**
   * Runtime type represented by {@link PluginIssue}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginIssue;

  /**
   * JSON representation accepted by {@link PluginIssue}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginIssue.Encoded;
}

/**
 * Raised when `Plugin.validate` encounters one or more error-severity issues.
 *
 * **Example** (Create a validation failure)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const error = Plugin.PluginValidationError.make({ issues: [] })
 *
 * console.log(error._tag) // "PluginValidationError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PluginValidationError extends S.TaggedError<PluginValidationError>($I`PluginValidationError`)(
  "PluginValidationError",
  { issues: S.Array(PluginIssue) },
  $I.annote("PluginValidationError", {
    description: "A plugin validation failure containing every error-level issue.",
  })
) {}

/**
 * Companion types for {@link PluginValidationError}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginValidationError {
  /**
   * Runtime type represented by {@link PluginValidationError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginValidationError;

  /**
   * JSON representation accepted by {@link PluginValidationError}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginValidationError.Encoded;
}

/**
 * Structured lint report for an in-memory plugin definition.
 *
 * **Example** (Create an empty lint report)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const report = Plugin.PluginLintReport.make({
 *   issues: [],
 *   errors: [],
 *   warnings: []
 * })
 *
 * console.log(report.issues.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginLintReport extends S.Class<PluginLintReport>($I`PluginLintReport`)(
  {
    issues: S.Array(PluginIssue),
    errors: S.Array(PluginIssue),
    warnings: S.Array(PluginIssue),
  },
  $I.annote("PluginLintReport", {
    description: "All plugin lint issues partitioned by severity.",
  })
) {}

/**
 * Companion types for {@link PluginLintReport}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PluginLintReport {
  /**
   * Runtime type represented by {@link PluginLintReport}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Type = PluginLintReport;

  /**
   * JSON representation accepted by {@link PluginLintReport}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PluginLintReport.Encoded;
}

/**
 * Structured on-disk diagnostic report for a plugin root.
 *
 * **Example** (Name a doctor report)
 *
 * ```ts
 * import type { Plugin } from "effect-claudecode"
 *
 * type Report = Plugin.PluginDoctorReport
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PluginDoctorReport extends S.Class<PluginDoctorReport>($I`PluginDoctorReport`)(
  {
    ...PluginLintReport.fields,
    scanned: PluginScan,
    loaded: LoadedPlugin,
  },
  $I.annote("PluginDoctorReport", {
    description: "Validated plugin scan and loaded definition paired with the complete lint partition.",
  })
) {}

type FlatEntry = PluginCommandEntry | PluginAgentEntry | PluginOutputStyleEntry;

const hooksEquivalence = S.toEquivalence(HooksSection);
const mcpEquivalence = S.toEquivalence(McpJsonFile);

const issue = (options: {
  readonly code: string;
  readonly severity: PluginIssueSeverity;
  readonly message: string;
  readonly path?: string;
}): PluginIssue =>
  PluginIssue.make({
    code: options.code,
    severity: options.severity,
    message: options.message,
    path: O.fromUndefinedOr(options.path),
  });

const splitIssues = (issues: ReadonlyArray<PluginIssue>): PluginLintReport =>
  PluginLintReport.make({
    issues,
    errors: A.filter(issues, (item) => PluginIssueSeverity.is.error(item.severity)),
    warnings: A.filter(issues, (item) => PluginIssueSeverity.is.warning(item.severity)),
  });

const duplicateValues = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(
    A.filter(A.dedupe(values), (value) => A.length(A.filter(values, (candidate) => candidate === value)) > 1),
    Order.String
  );

const entryPathOption = (entry: { readonly path?: string }): O.Option<string> => O.fromUndefinedOr(entry.path);

const entryPaths = (entries: ReadonlyArray<{ readonly path?: string }>): ReadonlyArray<string> =>
  A.flatMap(entries, (entry) =>
    O.match(entryPathOption(entry), {
      onNone: (): ReadonlyArray<string> => [],
      onSome: (entryPath) => [entryPath],
    })
  );

const matchesFlatSpec = (entryPath: string, spec: O.Option<string | ReadonlyArray<string>>): boolean => {
  const specs = pathSpecs(spec);
  if (specs.length === 0) {
    return true;
  }
  return A.some(specs, (candidate) =>
    isMarkdownFilePath(candidate) ? entryPath === candidate : Str.startsWith(`${candidate}/`)(entryPath)
  );
};

const matchesSkillSpec = (entryPath: string, spec: O.Option<string | ReadonlyArray<string>>): boolean => {
  const specs = pathSpecs(spec);
  if (specs.length === 0) {
    return true;
  }
  return A.some(specs, (candidate) =>
    isSkillFilePath(candidate) ? entryPath === candidate : Str.startsWith(`${candidate}/`)(entryPath)
  );
};

const inlineHooksFromManifest = (definition: PluginDefinition | LoadedPlugin): O.Option<HooksSection> =>
  O.filter(definition.manifest.hooks, S.is(HooksSection));

const inlineMcpFromManifest = (definition: PluginDefinition | LoadedPlugin): O.Option<McpJsonFile> =>
  O.flatMap(definition.manifest.mcpServers, (mcpServers) =>
    P.isString(mcpServers) || A.isArray(mcpServers) ? O.none() : S.decodeUnknownOption(McpJsonFile)({ mcpServers })
  );

const validateFlatEntries = (options: {
  readonly kind: "command" | "agent" | "outputStyle";
  readonly manifestField: O.Option<string | ReadonlyArray<string>>;
  readonly entries: ReadonlyArray<FlatEntry>;
}): ReadonlyArray<PluginIssue> => {
  const pluralKind = `${options.kind}s`;
  const declaredPaths = pathSpecs(options.manifestField);

  const duplicateNameIssues = A.map(duplicateValues(A.map(options.entries, (entry) => entry.name)), (duplicate) =>
    issue({
      code: `duplicate-${options.kind}-name`,
      severity: "error",
      message: `Duplicate ${options.kind} name \`${duplicate}\`.`,
    })
  );

  const duplicatePathIssues = A.map(duplicateValues(entryPaths(options.entries)), (duplicate) =>
    issue({
      code: `duplicate-${options.kind}-path`,
      severity: "error",
      message: `Duplicate ${options.kind} path \`${duplicate}\`.`,
      path: duplicate,
    })
  );

  const ambiguousLayoutIssues =
    declaredPaths.length > 1
      ? A.map(
          A.filter(options.entries, (candidate) => O.isNone(entryPathOption(candidate))),
          (entry) =>
            issue({
              code: `${pluralKind}-layout-ambiguous`,
              severity: "error",
              message: `${pluralKind} declares multiple target paths, so ${options.kind} \`${entry.name}\` needs an explicit entry.path.`,
            })
        )
      : [];

  const invalidPathIssues = A.flatMap(options.entries, (entry) =>
    O.match(entryPathOption(entry), {
      onNone: (): ReadonlyArray<PluginIssue> => [],
      onSome: (entryPath) =>
        Str.endsWith(".md")(entryPath)
          ? []
          : [
              issue({
                code: `${pluralKind}-path-invalid`,
                severity: "error",
                message: `${options.kind} \`${entry.name}\` path must point to a markdown file.`,
                path: entryPath,
              }),
            ],
    })
  );

  const outsideLayoutIssues = A.flatMap(options.entries, (entry) =>
    O.match(entryPathOption(entry), {
      onNone: (): ReadonlyArray<PluginIssue> => [],
      onSome: (entryPath) =>
        matchesFlatSpec(entryPath, options.manifestField)
          ? []
          : [
              issue({
                code: `${pluralKind}-path-outside-layout`,
                severity: "error",
                message: `${options.kind} \`${entry.name}\` path falls outside the manifest-declared ${pluralKind} layout.`,
                path: entryPath,
              }),
            ],
    })
  );

  return [
    ...duplicateNameIssues,
    ...duplicatePathIssues,
    ...ambiguousLayoutIssues,
    ...invalidPathIssues,
    ...outsideLayoutIssues,
  ];
};

const validateSkillEntries = (definition: PluginDefinition | LoadedPlugin): ReadonlyArray<PluginIssue> => {
  const manifestSkills = definition.manifest.skills;
  const declaredPaths = pathSpecs(manifestSkills);

  const duplicateNameIssues = A.map(duplicateValues(A.map(definition.skills, (entry) => entry.name)), (duplicate) =>
    issue({
      code: "duplicate-skill-name",
      severity: "error",
      message: `Duplicate skill name \`${duplicate}\`.`,
    })
  );

  const duplicatePathIssues = A.map(duplicateValues(entryPaths(definition.skills)), (duplicate) =>
    issue({
      code: "duplicate-skill-path",
      severity: "error",
      message: `Duplicate skill path \`${duplicate}\`.`,
      path: duplicate,
    })
  );

  const ambiguousLayoutIssues =
    declaredPaths.length > 1
      ? A.map(
          A.filter(definition.skills, (candidate) => O.isNone(entryPathOption(candidate))),
          (entry) =>
            issue({
              code: "skills-layout-ambiguous",
              severity: "error",
              message: `skills declares multiple target paths, so skill \`${entry.name}\` needs an explicit entry.path.`,
            })
        )
      : [];

  const invalidPathIssues = A.flatMap(definition.skills, (entry) =>
    O.match(entryPathOption(entry), {
      onNone: (): ReadonlyArray<PluginIssue> => [],
      onSome: (entryPath) =>
        isSkillFilePath(entryPath)
          ? []
          : [
              issue({
                code: "skills-path-invalid",
                severity: "error",
                message: `Skill \`${entry.name}\` path must point to a SKILL.md file.`,
                path: entryPath,
              }),
            ],
    })
  );

  const outsideLayoutIssues = A.flatMap(definition.skills, (entry) =>
    O.match(entryPathOption(entry), {
      onNone: (): ReadonlyArray<PluginIssue> => [],
      onSome: (entryPath) =>
        matchesSkillSpec(entryPath, manifestSkills)
          ? []
          : [
              issue({
                code: "skills-path-outside-layout",
                severity: "error",
                message: `Skill \`${entry.name}\` path falls outside the manifest-declared skills layout.`,
                path: entryPath,
              }),
            ],
    })
  );

  return [
    ...duplicateNameIssues,
    ...duplicatePathIssues,
    ...ambiguousLayoutIssues,
    ...invalidPathIssues,
    ...outsideLayoutIssues,
  ];
};

/**
 * Lint a plugin definition and return all errors and warnings without failing.
 *
 * **Example** (Inspect lint)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * const report = Plugin.lint(
 *   Plugin.define({ manifest: { name: "example-plugin" } })
 * )
 * console.log(report.errors)
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const lint = (definition: PluginDefinition | LoadedPlugin): PluginLintReport => {
  const inlineHooks = inlineHooksFromManifest(definition);
  const inlineMcp = inlineMcpFromManifest(definition);
  const hookSpecs = definition.manifest.hooks;
  const mcpSpecs = definition.manifest.mcpServers;
  const channels = O.getOrElse(definition.manifest.channels, A.empty);
  const servers = O.match(definition.mcpConfig, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (config) => R.keys(config.mcpServers),
  });

  const inlineHookIssues =
    O.isSome(inlineHooks) &&
    O.isSome(definition.hooksConfig) &&
    !hooksEquivalence(inlineHooks.value, definition.hooksConfig.value)
      ? [
          issue({
            code: "inline-hooks-mismatch",
            severity: "error",
            message: "manifest.hooks inline config does not match hooksConfig.",
          }),
        ]
      : [];

  const inlineMcpIssues =
    O.isSome(inlineMcp) &&
    O.isSome(definition.mcpConfig) &&
    !mcpEquivalence(inlineMcp.value, definition.mcpConfig.value)
      ? [
          issue({
            code: "inline-mcp-mismatch",
            severity: "error",
            message: "manifest.mcpServers inline config does not match mcpConfig.",
          }),
        ]
      : [];

  const hookCollapseIssues = O.match(hookSpecs, {
    onNone: () => [],
    onSome: (spec) =>
      A.isArray(spec) && A.length(spec) > 1
        ? [
            issue({
              code: "hooks-layout-collapses-on-sync",
              severity: "warning",
              message:
                "Multiple hook config files are mergeable for load, but Plugin.sync will collapse them to one JSON file for writing.",
            }),
          ]
        : [],
  });

  const mcpCollapseIssues = O.match(mcpSpecs, {
    onNone: () => [],
    onSome: (spec) =>
      A.isArray(spec) && A.length(spec) > 1
        ? [
            issue({
              code: "mcp-layout-collapses-on-sync",
              severity: "warning",
              message:
                "Multiple MCP config files are mergeable for load, but Plugin.sync will collapse them to one JSON file for writing.",
            }),
          ]
        : [],
  });

  const channelIssues = A.flatMap(channels, (channel) =>
    A.contains(servers, channel.server)
      ? []
      : [
          issue({
            code: "channel-missing-server",
            severity: "error",
            message: `Channel server \`${channel.server}\` is not present in mcpConfig.`,
          }),
        ]
  );

  return splitIssues([
    ...validateFlatEntries({
      kind: "command",
      manifestField: definition.manifest.commands,
      entries: definition.commands,
    }),
    ...validateFlatEntries({
      kind: "agent",
      manifestField: definition.manifest.agents,
      entries: definition.agents,
    }),
    ...validateSkillEntries(definition),
    ...validateFlatEntries({
      kind: "outputStyle",
      manifestField: definition.manifest.outputStyles,
      entries: definition.outputStyles,
    }),
    ...inlineHookIssues,
    ...inlineMcpIssues,
    ...hookCollapseIssues,
    ...mcpCollapseIssues,
    ...channelIssues,
  ]);
};

/**
 * Validate a plugin definition and fail when any error-severity issue is found.
 *
 * **Example** (Fail validation on duplicate command names)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 * import * as Exit from "effect/Exit"
 *
 * const exit = Effect.runSyncExit(
 *   Plugin.validate(
 *     Plugin.define({
 *       manifest: { name: "review-tools" },
 *       commands: [
 *         Plugin.command({ name: "hi", body: "# /hi\n" }),
 *         Plugin.command({ name: "hi", body: "# /hi again\n" })
 *       ]
 *     })
 *   )
 * )
 *
 * console.log(Exit.isFailure(exit)) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const validate = (
  definition: PluginDefinition | LoadedPlugin
): Effect.Effect<PluginDefinition | LoadedPlugin, PluginValidationError> => {
  const report = lint(definition);
  return A.isReadonlyArrayEmpty(report.errors)
    ? Effect.succeed(definition)
    : Effect.fail(PluginValidationError.make({ issues: report.errors }));
};

/**
 * Load a plugin directory from disk and return a structured diagnostic report.
 *
 * **Example** (Doctor a plugin written in memory)
 *
 * ```ts
 * import { Plugin, Testing } from "effect-claudecode"
 * import * as Effect from "effect/Effect"
 *
 * const definition = Plugin.define({
 *   manifest: { name: "review-tools" },
 *   commands: [Plugin.command({ name: "hi", body: "# /hi\n" })]
 * })
 * const fileSystem = await Effect.runPromise(Testing.writePluginToMemory(definition))
 * const report = await Effect.runPromise(
 *   Effect.provide(Plugin.doctor("/plugin"), fileSystem.layer)
 * )
 *
 * console.log(report.loaded.manifest.name) // "review-tools"
 * console.log(report.errors) // []
 * console.log(report.warnings) // []
 * ```
 *
 * @effects Reads and decodes the plugin tree through `FileSystem.FileSystem` and `Path.Path`, failing with `PluginLoadError` on invalid sources.
 * @category diagnostics
 * @since 0.0.0
 */
export const doctor = Effect.fn("Plugin.doctor")(function* (
  rootDir: string
): Effect.fn.Return<PluginDoctorReport, PluginLoadError, FileSystem.FileSystem | Path.Path> {
  const scanned = yield* scan(rootDir);
  const loaded = yield* load(rootDir);
  const report = lint(loaded);
  return PluginDoctorReport.make({
    scanned,
    loaded,
    ...report,
  });
});
