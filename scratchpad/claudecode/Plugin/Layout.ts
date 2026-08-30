/**
 * Internal helpers for plugin layout and manifest path normalization.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type { PluginDefinition } from "./Define.ts";

import {
  type ComponentPathSpec,
  ExperimentalSpec,
  type HooksSpec,
  PluginManifest,
  type ServerConfigSpec,
} from "./Manifest.ts";

const canonicalComponentPaths = {
  commands: "commands",
  agents: "agents",
  skills: "skills",
  outputStyles: "output-styles",
} as const;

const canonicalConfigPaths = {
  hooks: "hooks/hooks.json",
  mcpServers: ".mcp.json",
  lspServers: ".lsp.json",
} as const;

const canonicalExperimentalPaths = {
  themes: "themes",
  monitors: "monitors/monitors.json",
} as const;

type ComponentKey = keyof typeof canonicalComponentPaths;
type ConfigKey = keyof typeof canonicalConfigPaths;

const isStringArray = (value: unknown): value is ReadonlyArray<string> =>
  A.isArray(value) && A.every(value, P.isString);

/**
 * Normalizes a manifest-relative path to its unprefixed, untrailed form.
 *
 * **Example** (Normalize a component path)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.normalizeManifestPath("./commands/")) // "commands"
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const normalizeManifestPath = (value: string): string => {
  const withoutDotSlash = Str.startsWith("./")(value) ? Str.slice(2)(value) : value;
  const withoutTrailingSlash = Str.replace(/\/+$/, "")(withoutDotSlash);
  return withoutTrailingSlash === "." ? "" : withoutTrailingSlash;
};

/**
 * Converts a normalized path into Claude Code's manifest-relative form.
 *
 * **Example** (Prefix a manifest path)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.toManifestPath("commands")) // "./commands"
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const toManifestPath = (value: string): string => {
  const normalized = normalizeManifestPath(value);
  return normalized === "" ? "./" : `./${normalized}`;
};

const normalizePathSpecForManifest = (spec: string | ReadonlyArray<string>): string | ReadonlyArray<string> =>
  P.isString(spec) ? toManifestPath(spec) : A.map(spec, toManifestPath);

const isDefaultComponentSpec = (key: ComponentKey, spec: string): boolean =>
  normalizeManifestPath(spec) === canonicalComponentPaths[key];

const isDefaultConfigSpec = (key: ConfigKey, spec: string): boolean =>
  normalizeManifestPath(spec) === canonicalConfigPaths[key];

const normalizedComponentSpec = (spec: O.Option<ComponentPathSpec>, key: ComponentKey): O.Option<ComponentPathSpec> => {
  if (O.isNone(spec)) {
    return O.none();
  }
  const specValue = spec.value;
  if (P.isString(specValue)) {
    return isDefaultComponentSpec(key, specValue) ? O.none() : O.some(toManifestPath(specValue));
  }
  if (specValue.length === 1 && isDefaultComponentSpec(key, specValue[0] ?? "")) {
    return O.none();
  }
  return O.some(normalizePathSpecForManifest(specValue));
};

const keepOrDefaultComponentSpec = (
  spec: O.Option<ComponentPathSpec>,
  hasEntries: boolean,
  key: ComponentKey
): O.Option<ComponentPathSpec> => (hasEntries ? normalizedComponentSpec(spec, key) : O.none());

const normalizeServerSpec = (spec: O.Option<ServerConfigSpec>, key: ConfigKey): O.Option<ServerConfigSpec> =>
  O.match(spec, {
    onNone: () => O.none(),
    onSome: (specValue) => {
      if (!P.isString(specValue) && !isStringArray(specValue)) {
        return O.some(specValue);
      }
      if (P.isString(specValue)) {
        return isDefaultConfigSpec(key, specValue) ? O.none() : O.some(toManifestPath(specValue));
      }
      if (specValue.length === 1 && isDefaultConfigSpec(key, specValue[0] ?? "")) {
        return O.none();
      }
      return O.some(normalizePathSpecForManifest(specValue));
    },
  });

const normalizeHooksPathSpec = (specValue: string | ReadonlyArray<string>): O.Option<HooksSpec> => {
  if (P.isString(specValue)) {
    return isDefaultConfigSpec("hooks", specValue) ? O.none() : O.some(toManifestPath(specValue));
  }
  if (specValue.length === 1 && isDefaultConfigSpec("hooks", specValue[0] ?? "")) {
    return O.none();
  }
  return O.some(normalizePathSpecForManifest(specValue));
};

const keepOrDefaultHooksSpec = (spec: O.Option<HooksSpec>, hasConfig: boolean): O.Option<HooksSpec> =>
  O.match(spec, {
    onNone: () => O.none(),
    onSome: (specValue) => {
      if (!P.isString(specValue) && !isStringArray(specValue)) {
        return O.some(specValue);
      }
      if (!hasConfig) {
        return O.none();
      }
      if (isStringArray(specValue) && A.length(specValue) > 1) {
        return O.some(toManifestPath(canonicalConfigPaths.hooks));
      }
      return normalizeHooksPathSpec(specValue);
    },
  });

const keepOrDefaultServerSpec = (
  spec: O.Option<ServerConfigSpec>,
  hasConfig: boolean,
  key: ConfigKey
): O.Option<ServerConfigSpec> =>
  O.match(spec, {
    onNone: () => O.none(),
    onSome: (specValue) => {
      if (!P.isString(specValue) && !isStringArray(specValue)) {
        return O.some(specValue);
      }
      if (!hasConfig) {
        return O.none();
      }
      if (isStringArray(specValue) && A.length(specValue) > 1) {
        return O.some(toManifestPath(canonicalConfigPaths[key]));
      }
      return normalizeServerSpec(O.some(specValue), key);
    },
  });

const normalizedExperimentalPathSpec = (
  spec: O.Option<ComponentPathSpec>,
  fallback: string
): O.Option<ComponentPathSpec> =>
  O.flatMap(spec, (specValue) => {
    if (P.isString(specValue)) {
      return normalizeManifestPath(specValue) === fallback
        ? O.none<ComponentPathSpec>()
        : O.some(toManifestPath(specValue));
    }
    if (specValue.length === 1 && normalizeManifestPath(specValue[0] ?? "") === fallback) {
      return O.none<ComponentPathSpec>();
    }
    return O.some(normalizePathSpecForManifest(specValue));
  });

const normalizedExperimentalSpec = (spec: O.Option<ExperimentalSpec>): O.Option<ExperimentalSpec> =>
  O.flatMap(spec, (value) => {
    const themes = normalizedExperimentalPathSpec(value.themes, canonicalExperimentalPaths.themes);
    const monitors = normalizedExperimentalPathSpec(value.monitors, canonicalExperimentalPaths.monitors);
    if (O.isNone(themes) && O.isNone(monitors)) {
      return O.none<ExperimentalSpec>();
    }
    return O.some(
      ExperimentalSpec.make({
        themes,
        monitors,
      })
    );
  });

/**
 * Expands an optional manifest path specification into a path list.
 *
 * **Example** (Expand a path specification)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.pathSpecs(O.some(["./one", "./two"])))
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const pathSpecs = (spec: O.Option<string | ReadonlyArray<string>>): ReadonlyArray<string> =>
  O.match(spec, {
    onNone: () => [],
    onSome: (specValue) => A.filter(P.isString(specValue) ? [specValue] : specValue, isSafePluginPath),
  });

/**
 * Tests whether a plugin manifest path remains within the plugin root.
 *
 * **Example** (Reject path traversal)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.isSafePluginPath("commands/review.md")) // true
 * console.log(Plugin.Layout.isSafePluginPath("../secrets.txt")) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isSafePluginPath = (value: string): boolean => {
  const normalized = Str.replaceAll("\\", "/")(value);
  return (
    Str.isNonEmpty(normalized) &&
    !Str.startsWith("/")(normalized) &&
    !/^[A-Za-z]:\//u.test(normalized) &&
    A.every(Str.split("/")(normalized), (segment) => segment !== "..")
  );
};

/**
 * Tests whether a path names a Markdown file.
 *
 * **Example** (Recognize Markdown paths)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.isMarkdownFilePath("commands/review.md")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isMarkdownFilePath = (path: string): boolean => Str.endsWith(".md")(path);

/**
 * Tests whether a path names a JSON file.
 *
 * **Example** (Recognize JSON paths)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.isJsonFilePath(".mcp.json")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isJsonFilePath = (path: string): boolean => Str.endsWith(".json")(path);

/**
 * Tests whether a path names a canonical skill entry file.
 *
 * **Example** (Recognize skill entry paths)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 *
 * console.log(Plugin.Layout.isSkillFilePath("skills/review/SKILL.md")) // true
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isSkillFilePath = (path: string): boolean => path === "SKILL.md" || Str.endsWith("/SKILL.md")(path);

/**
 * Synchronizes manifest path fields with a plugin definition's materialized components.
 *
 * **Example** (Synchronize command and hook path specs)
 *
 * ```ts
 * import { Plugin } from "effect-claudecode"
 * import * as O from "effect/Option"
 *
 * const manifest = Plugin.Layout.syncManifest(
 *   Plugin.define({
 *     manifest: {
 *       name: "review-tools",
 *       commands: "./slash",
 *       hooks: ["./hooks/a.json", "./hooks/b.json"]
 *     },
 *     commands: [Plugin.command({ name: "hi", body: "# /hi\n" })],
 *     hooksConfig: { PostToolUse: [] }
 *   })
 * )
 *
 * console.log(O.getOrUndefined(manifest.commands)) // "./slash"
 * console.log(O.getOrUndefined(manifest.hooks)) // "./hooks/hooks.json"
 * ```
 *
 * @internal
 * @category normalization
 * @since 0.0.0
 */
export const syncManifest = (definition: PluginDefinition): PluginManifest =>
  PluginManifest.make({
    name: definition.manifest.name,
    $schema: definition.manifest.$schema,
    version: definition.manifest.version,
    description: definition.manifest.description,
    displayName: definition.manifest.displayName,
    defaultEnabled: definition.manifest.defaultEnabled,
    author: definition.manifest.author,
    homepage: definition.manifest.homepage,
    repository: definition.manifest.repository,
    license: definition.manifest.license,
    keywords: definition.manifest.keywords,
    dependencies: definition.manifest.dependencies,
    experimental: normalizedExperimentalSpec(definition.manifest.experimental),
    userConfig: definition.manifest.userConfig,
    channels: definition.manifest.channels,
    commands: keepOrDefaultComponentSpec(definition.manifest.commands, definition.commands.length > 0, "commands"),
    agents: keepOrDefaultComponentSpec(definition.manifest.agents, definition.agents.length > 0, "agents"),
    skills: keepOrDefaultComponentSpec(definition.manifest.skills, definition.skills.length > 0, "skills"),
    outputStyles: keepOrDefaultComponentSpec(
      definition.manifest.outputStyles,
      definition.outputStyles.length > 0,
      "outputStyles"
    ),
    hooks: keepOrDefaultHooksSpec(definition.manifest.hooks, O.isSome(definition.hooksConfig)),
    mcpServers: keepOrDefaultServerSpec(definition.manifest.mcpServers, O.isSome(definition.mcpConfig), "mcpServers"),
    lspServers: keepOrDefaultServerSpec(
      definition.manifest.lspServers,
      O.isSome(definition.manifest.lspServers),
      "lspServers"
    ),
  });
