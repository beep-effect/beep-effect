/**
 * Package creation command - scaffold new packages following Effect v4 conventions.
 *
 * Generates package files via reusable services:
 * - TemplateService for template rendering
 * - FileGenerationPlanService for deterministic plan/execute
 * - Shared repo config synchronization after scaffolding
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeURL from "node:url";
import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { formatJsonValue } from "@beep/repo-cli-kit/cli/Json";
import { applyJsoncModification, JsoncModification } from "@beep/repo-cli-kit/cli/Jsonc";
import {
  encodeLabManifestJson,
  isLabsWorkspacePath,
  LAB_MANIFEST_FILENAME,
  LABS_WORKSPACE_GLOB,
  LABS_WORKSPACE_ROOT,
  LabManifest,
  RETIRED_REGISTRY_PATH,
  readRetiredPackageNames,
} from "@beep/repo-cli-kit/cli/Labs/index";
import { printLines } from "@beep/repo-cli-kit/cli/Printer";
import { buildServedCheck, scaffoldPackageScripts } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { runToExit } from "@beep/repo-cli-kit/process/StepExec";
import {
  DomainError,
  encodePackageJsonCanonicalPrettyEffect,
  findRepoRoot,
  readPackageJsonFile,
} from "@beep/repo-utils";
import { WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { LiteralKit } from "@beep/schema";
import { today } from "@beep/schema/LocalDate";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { withJournalFileLock } from "../../internal/repo-run/AdmissionJournal.ts";
import { syncTsconfigAtRoot } from "../TsconfigSync/index.ts";
import { TsconfigSyncRunOptionsSync } from "../TsconfigSync/TsconfigSync.schemas.ts";
import {
  createFileGenerationPlanService,
  FileGenerationPlanInput,
  PlannedAsset,
  PlannedFile,
  PlannedSymlink,
} from "./FileGenerationPlanService.ts";
import { registerMissingWorkspaceIdentityPackages } from "./internal/IdentityBulkRegistration.ts";
import { CreatePackageIdentityRegistration } from "./internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "./internal/LabIdentitySegment.ts";
import * as RetiredNameRegistry from "./internal/RetiredNameRegistry.ts";
import { createTemplateService, StaticAssetSpec, TemplateRenderRequest, TemplateSpec } from "./TemplateService.ts";
import type { PackageKind as ScriptsPackageKind } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";

const $I = $RepoCliId.create("commands/CreatePackage/CreatePackage.command");
const {
  ensureIdentityPackageRegistration,
  identityPackageRegistrationNeeded,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
} = CreatePackageIdentityRegistration;

const templateDirCandidates = (baseDir: string, path: Path.Path): ReadonlyArray<string> => {
  const join = (...on: A.NonEmptyArray<string>) => path.join(baseDir, ...on);
  return A.make(join("..", "..", "..", "src", "commands", "CreatePackage", "templates"), join("templates"));
};

/**
 * Resolve create-package template directory for both src and dist runtimes.
 *
 * In source execution (`bun run src/bin.ts`), templates live beside this file.
 * In built execution (`dist/bin.js`), template resolution prefers packaged
 * source templates under `src/.../templates`.
 * A legacy dist fallback is retained so existing copied templates still work
 * in environments that already have them on disk.
 *
 * **Example** (Run the create-package command)
 *
 * ```ts
 * import { resolveCreatePackageTemplateDir } from "@beep/repo-cli/commands/CreatePackage"
 * import * as Effect from "effect/Effect";
 * const program = Effect.succeed(resolveCreatePackageTemplateDir)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param baseDir - Optional command module directory override (defaults to current module directory).
 * @returns Resolved template directory path.
 * @category models
 * @since 0.0.0
 */
export const resolveCreatePackageTemplateDir = Effect.fn(function* (
  baseDir: string = NodeURL.fileURLToPath(new URL(".", import.meta.url))
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = templateDirCandidates(baseDir, path);

  for (const candidate of candidates) {
    const exists = yield* fs.exists(candidate).pipe(Effect.orElseSucceed(thunkFalse));
    if (exists) {
      return candidate;
    }
  }

  return yield* DomainError.make({
    message: `Unable to resolve create-package templates. Checked:\n${Text.joinLines(
      A.map(candidates, (candidate) => `  - ${candidate}`)
    )}`,
  });
});

const VALID_TYPES = ["library", "tool", "app"] as const;
const VALID_APP_KINDS = ["nextjs", "vite", "service", "tauri", "runtime-proof"] as const;
const VALID_FAMILIES = ["drivers", "ecosystem", "foundation", "tooling"] as const;
const VALID_FOUNDATION_KINDS = ["primitive", "modeling", "capability", "ui-system"] as const;
const VALID_TOOLING_KINDS = ["library", "tool", "policy-pack", "test-kit", "infra"] as const;
const PACKAGE_NAME_PATTERN = /^[a-z_][a-z0-9._-]*$/;
const PARENT_DIR_PATTERN = /^(?!.*\/\/)(?!.*\/$)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-z0-9][a-z0-9/_-]*$/;
const TypeScriptPluginsConfig = S.Struct({
  compilerOptions: S.Struct({
    plugins: S.Array(S.Record(S.String, S.Unknown)),
  }),
}).pipe(
  $I.annoteSchema("TypeScriptPluginsConfig", {
    description: "TypeScript configuration boundary containing the canonical compiler plugin array.",
  })
);
type TypeScriptPluginsConfig = typeof TypeScriptPluginsConfig.Type;
type TypeScriptPluginConfig = TypeScriptPluginsConfig["compilerOptions"]["plugins"][number];
const EFFECT_LANGUAGE_SERVICE_PLUGIN_NAME = "@effect/language-service";
const EMPTY_LANGUAGE_SERVICE_PLUGIN_PROFILES = {
  effectLanguageServicePlugins: "[]",
  nextjsLanguageServicePlugins: "[]",
} as const;

const renderTemplateJson = flow(formatJsonValue, Str.trim, Str.replaceAll("\n", "\n    "));

const isUnknownRecord = (value: unknown): value is R.ReadonlyRecord<string, unknown> =>
  P.isObject(value) && !A.isArray(value);

const isEffectLanguageServicePlugin = (plugin: TypeScriptPluginConfig): boolean =>
  P.isString(plugin.name) && Str.equivalence(plugin.name, EFFECT_LANGUAGE_SERVICE_PLUGIN_NAME);

const readLanguageServicePluginProfiles = Effect.fn("CreatePackage.readLanguageServicePluginProfiles")(function* (
  repoRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const filePath = path.join(repoRoot, "tsconfig.base.json");
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));
  const config = yield* Jsonc.bind(TypeScriptPluginsConfig)
    .decode(content)
    .pipe(
      Effect.mapError(DomainError.newCauseMessage(`Failed to decode canonical TypeScript plugins in "${filePath}"`))
    );
  const effectLanguageServicePlugins = A.filter(config.compilerOptions.plugins, isEffectLanguageServicePlugin);

  if (!A.isReadonlyArrayNonEmpty(effectLanguageServicePlugins)) {
    return yield* DomainError.newMessage(
      `Canonical TypeScript plugins in "${filePath}" omit ${EFFECT_LANGUAGE_SERVICE_PLUGIN_NAME}`
    );
  }
  if (A.length(effectLanguageServicePlugins) > 1) {
    return yield* DomainError.newMessage(
      `Canonical TypeScript plugins in "${filePath}" contain duplicate ${EFFECT_LANGUAGE_SERVICE_PLUGIN_NAME} entries`
    );
  }

  const effectLanguageServicePlugin = effectLanguageServicePlugins[0];
  if (!isUnknownRecord(effectLanguageServicePlugin.diagnosticSeverity)) {
    return yield* DomainError.newMessage(
      `Canonical ${EFFECT_LANGUAGE_SERVICE_PLUGIN_NAME} plugin in "${filePath}" must define diagnosticSeverity`
    );
  }

  const ecosystemEffectLanguageServicePlugin = {
    ...effectLanguageServicePlugin,
    diagnosticSeverity: {
      ...effectLanguageServicePlugin.diagnosticSeverity,
      missedPipeableOpportunity: "off",
      missingPipeableSignature: "off",
    },
  };
  const ecosystemPlugins = A.map(config.compilerOptions.plugins, (plugin) =>
    isEffectLanguageServicePlugin(plugin) ? ecosystemEffectLanguageServicePlugin : plugin
  );

  return {
    effectLanguageServicePlugins: renderTemplateJson(ecosystemPlugins),
    nextjsLanguageServicePlugins: renderTemplateJson(A.append(config.compilerOptions.plugins, { name: "next" })),
  } as const;
});

const PackageType = LiteralKit(VALID_TYPES).pipe(
  $I.annoteSchema("PackageType", {
    description: "Supported package scaffold type.",
  })
);
type PackageType = typeof PackageType.Type;
const isPackageType = S.is(PackageType);
const packageTypeEquivalence = S.toEquivalence(PackageType);

const AppKind = LiteralKit(VALID_APP_KINDS).pipe(
  $I.annoteSchema("AppKind", {
    description: "Supported app scaffold kinds.",
  })
);
const decodeUnknownAppKind = S.decodeUnknownEffect(AppKind);
type AppKind = typeof AppKind.Type;
const isAppKind = S.is(AppKind);
const decodeAppKindEffect = (input: unknown) =>
  decodeUnknownAppKind(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid app kind "${input}". Must be one of: ${A.join(VALID_APP_KINDS, ", ")}`)
    )
  );
const appKindEquivalence = S.toEquivalence(AppKind);

const PackageFamily = LiteralKit(VALID_FAMILIES).pipe(
  $I.annoteSchema("PackageFamily", {
    description: "Supported canonical package family scaffold targets.",
  })
);
const decodeUnknownPackageFamily = S.decodeUnknownEffect(PackageFamily);
type PackageFamily = typeof PackageFamily.Type;
const isPackageFamily = S.is(PackageFamily);
const decodePackageFamilyEffect = (input: unknown) =>
  decodeUnknownPackageFamily(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid package family "${input}". Must be one of: ${A.join(VALID_FAMILIES, ", ")}`)
    )
  );
const packageFamilyEquivalence = S.toEquivalence(PackageFamily);

const FoundationKind = LiteralKit(VALID_FOUNDATION_KINDS).pipe(
  $I.annoteSchema("FoundationKind", {
    description: "Supported foundation package kinds.",
  })
);
const decodeUnknownFoundationKind = S.decodeUnknownEffect(FoundationKind);

type FoundationKind = typeof FoundationKind.Type;
const isFoundationKind = S.is(FoundationKind);
const decodeFoundationKindEffect = (input: unknown) =>
  decodeUnknownFoundationKind(input).pipe(
    Effect.mapError(
      DomainError.newCause(
        `Invalid foundation kind "${input}". Must be one of: ${A.join(VALID_FOUNDATION_KINDS, ", ")}`
      )
    )
  );

const ToolingKind = LiteralKit(VALID_TOOLING_KINDS).pipe(
  $I.annoteSchema("ToolingKind", {
    description: "Supported tooling package kinds.",
  })
);
const decodeUnknownToolingKind = S.decodeUnknownEffect(ToolingKind);
type ToolingKind = typeof ToolingKind.Type;
const isToolingKind = S.is(ToolingKind);
const decodeToolingKindEffect = (input: unknown) =>
  decodeUnknownToolingKind(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid tooling kind "${input}". Must be one of: ${A.join(VALID_TOOLING_KINDS, ", ")}`)
    )
  );

const PackageKind = S.Union([FoundationKind, ToolingKind]);
type PackageKind = typeof PackageKind.Type;

class BeepPackageMetadata extends S.Opaque<BeepPackageMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    family: PackageFamily,
    kind: S.optionalKey(PackageKind),
  }).pipe(
    $I.annoteSchema("BeepPackageMetadata", {
      description: "Metadata for a Beep package, including its family and optional kind.",
    })
  )
) {}

const ParentDir = S.String.check(S.isPattern(PARENT_DIR_PATTERN)).pipe(
  S.brand("ParentDir"),
  $I.annoteSchema("ParentDir", {
    description: "Validated repo-relative parent directory for package scaffolding.",
  })
);

const PackageName = S.String.check(S.isPattern(PACKAGE_NAME_PATTERN)).pipe(
  S.brand("PackageName"),
  $I.annoteSchema("PackageName", {
    description: "Package name segment used for @beep scoped package creation.",
  })
);

const PACKAGE_TEST_FILE = "test/index.test.ts";
const PACKAGE_TEST_PLACEHOLDER_FILE = "test/.gitkeep";

const PACKAGE_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = [
  TemplateSpec.make({
    templateName: "tsconfig.json.hbs",
    outputPath: "tsconfig.json",
  }),
  TemplateSpec.make({
    templateName: "tsconfig.test.json.hbs",
    outputPath: "tsconfig.test.json",
  }),
  TemplateSpec.make({
    templateName: "tsconfig.check.json.hbs",
    outputPath: "tsconfig.check.json",
  }),
  TemplateSpec.make({
    templateName: "src-index.ts.hbs",
    outputPath: "src/index.ts",
  }),
  TemplateSpec.make({ templateName: "LICENSE.hbs", outputPath: "LICENSE" }),
  TemplateSpec.make({ templateName: "README.md.hbs", outputPath: "README.md" }),
  TemplateSpec.make({ templateName: "AGENTS.md.hbs", outputPath: "AGENTS.md" }),
  TemplateSpec.make({
    templateName: "docgen.json.hbs",
    outputPath: "docgen.json",
  }),
  TemplateSpec.make({
    templateName: "vitest.config.ts.hbs",
    outputPath: "vitest.config.ts",
  }),
  TemplateSpec.make({
    templateName: "docs-index.md.hbs",
    outputPath: "docs/index.md",
  }),
];

const STORIES_TSCONFIG_TEMPLATE_SPEC = TemplateSpec.make({
  templateName: "tsconfig.stories.json.hbs",
  outputPath: "tsconfig.stories.json",
});
const STORIES_DIRECTORY_TSCONFIG_TEMPLATE_SPEC = TemplateSpec.make({
  templateName: "stories-tsconfig.json.hbs",
  outputPath: "stories/tsconfig.json",
});
const STORIES_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = [
  STORIES_TSCONFIG_TEMPLATE_SPEC,
  STORIES_DIRECTORY_TSCONFIG_TEMPLATE_SPEC,
];

type TemplateSpecPair = readonly [templateName: string, outputPath: string];

const templateSpecsFrom = (pairs: ReadonlyArray<TemplateSpecPair>): ReadonlyArray<TemplateSpec> =>
  A.map(pairs, ([templateName, outputPath]) => TemplateSpec.make({ templateName, outputPath }));

const REAL_APP_DOC_TEMPLATE_PAIRS: ReadonlyArray<TemplateSpecPair> = [
  ["LICENSE.hbs", "LICENSE"],
  ["app-real-README.md.hbs", "README.md"],
  ["app-real-AGENTS.md.hbs", "AGENTS.md"],
];

const CHECK_TSCONFIG_TEMPLATE_PAIR: TemplateSpecPair = ["tsconfig.check.json.hbs", "tsconfig.check.json"];

const NOEMIT_TURBO_TEMPLATE_PAIR: TemplateSpecPair = ["app-noemit-turbo.json.hbs", "turbo.json"];
const NOEMIT_TURBO_TEMPLATE_SPEC = TemplateSpec.make({
  templateName: NOEMIT_TURBO_TEMPLATE_PAIR[0],
  outputPath: NOEMIT_TURBO_TEMPLATE_PAIR[1],
});
const NOEMIT_TURBO_FILE = NOEMIT_TURBO_TEMPLATE_PAIR[1];

const BUNDLER_TURBO_TEMPLATE_PAIR: TemplateSpecPair = ["app-bundler-turbo.json.hbs", "turbo.json"];

const NEXTJS_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-next-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
  BUNDLER_TURBO_TEMPLATE_PAIR,
  ["app-next-next-env.d.ts.hbs", "next-env.d.ts"],
  ["app-next-next.config.ts.hbs", "next.config.ts"],
  ["app-next-src-app-globals.css.hbs", "src/app/globals.css"],
  ["app-next-src-app-layout.tsx.hbs", "src/app/layout.tsx"],
  ["app-next-src-app-page.tsx.hbs", "src/app/page.tsx"],
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
  ["app-next-vitest.config.ts.hbs", "vitest.config.ts"],
  ["app-next-test-app.test.tsx.hbs", "test/app.test.tsx"],
]);

const TAURI_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-tauri-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
  BUNDLER_TURBO_TEMPLATE_PAIR,
  ["app-tauri-index.html.hbs", "index.html"],
  ["app-tauri-src-App.tsx.hbs", "src/App.tsx"],
  ["app-tauri-src-main.tsx.hbs", "src/main.tsx"],
  ["app-tauri-vite.config.ts.hbs", "vite.config.ts"],
  ["app-tauri-vitest.config.ts.hbs", "vitest.config.ts"],
  ["app-tauri-test-App.test.tsx.hbs", "test/App.test.tsx"],
  ["app-tauri-src-tauri-Cargo.toml.hbs", "src-tauri/Cargo.toml"],
  ["app-tauri-src-tauri-build.rs.hbs", "src-tauri/build.rs"],
  ["app-tauri-src-tauri-tauri.conf.json.hbs", "src-tauri/tauri.conf.json"],
  ["app-tauri-src-tauri-capabilities-default.json.hbs", "src-tauri/capabilities/default.json"],
  ["app-tauri-src-tauri-src-main.rs.hbs", "src-tauri/src/main.rs"],
  ["app-tauri-src-tauri-src-lib.rs.hbs", "src-tauri/src/lib.rs"],
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
]);

const TAURI_APP_ASSET_SPECS: ReadonlyArray<StaticAssetSpec> = A.of(
  StaticAssetSpec.make({ assetName: "assets/tauri-icon.png", outputPath: "src-tauri/icons/icon.png" })
);

const NEXTJS_LAB_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-next-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
  BUNDLER_TURBO_TEMPLATE_PAIR,
  ["app-next-lab-tsconfig.next.json.hbs", "tsconfig.next.json"],
  ["app-next-next-env.d.ts.hbs", "next-env.d.ts"],
  ["app-next-lab-next.config.ts.hbs", "next.config.ts"],
  ["app-next-lab-postcss.config.mjs.hbs", "postcss.config.mjs"],
  ["app-next-lab-src-app-globals.css.hbs", "src/app/globals.css"],
  ["app-next-src-app-layout.tsx.hbs", "src/app/layout.tsx"],
  ["app-next-src-app-page.tsx.hbs", "src/app/page.tsx"],
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
  ["app-next-vitest.config.ts.hbs", "vitest.config.ts"],
  ["app-next-test-app.test.tsx.hbs", "test/app.test.tsx"],
]);

const VITE_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-vite-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
  BUNDLER_TURBO_TEMPLATE_PAIR,
  ["app-vite-index.html.hbs", "index.html"],
  ["app-vite-src-App.tsx.hbs", "src/App.tsx"],
  ["app-vite-src-main.tsx.hbs", "src/main.tsx"],
  ["app-vite-src-styles-globals.css.hbs", "src/styles/globals.css"],
  ["app-vite-vite.config.ts.hbs", "vite.config.ts"],
  ["app-vite-vitest.config.ts.hbs", "vitest.config.ts"],
  ["app-vite-test-App.test.tsx.hbs", "test/App.test.tsx"],
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
]);

const VITE_LAB_POSTCSS_TEMPLATE_SPEC = TemplateSpec.make({
  templateName: "app-vite-postcss.config.mjs.hbs",
  outputPath: "postcss.config.mjs",
});

const SERVICE_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-service-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
  ["app-service-src-Api.ts.hbs", "src/Api.ts"],
  ["app-service-src-runtime-Layer.ts.hbs", "src/runtime/Layer.ts"],
  ["app-service-src-main.ts.hbs", "src/main.ts"],
  ["app-service-test-health.test.ts.hbs", "test/health.test.ts"],
  ["app-service-vitest.config.ts.hbs", "vitest.config.ts"],
  NOEMIT_TURBO_TEMPLATE_PAIR,
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
]);

class ScaffoldShape extends S.Opaque<ScaffoldShape, { readonly brand: unique symbol }>()(
  S.Struct({
    appKind: S.OptionFromOptionalKey(AppKind),
    lab: S.Boolean,
    withStoriesTsconfig: S.Boolean,
  }).pipe(
    $I.annoteSchema("ScaffoldShape", {
      description: "Decoded scaffold-mode selector threaded through template, file, and manifest planning.",
    })
  )
) {}

const packageTemplateSpecsFor = (withStoriesTsconfig: boolean): ReadonlyArray<TemplateSpec> =>
  withStoriesTsconfig
    ? pipe(A.make(PACKAGE_TEMPLATE_SPECS, STORIES_TEMPLATE_SPECS), A.flatten)
    : PACKAGE_TEMPLATE_SPECS;

const PACKAGE_TEST_TEMPLATE_SPEC = TemplateSpec.make({
  templateName: "test-index.test.ts.hbs",
  outputPath: PACKAGE_TEST_FILE,
});

const appTemplateSpecsFor = (shape: ScaffoldShape, kind: AppKind): ReadonlyArray<TemplateSpec> => {
  if (appKindEquivalence(kind, "nextjs")) return shape.lab ? NEXTJS_LAB_APP_TEMPLATE_SPECS : NEXTJS_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "vite"))
    return shape.lab ? A.append(VITE_APP_TEMPLATE_SPECS, VITE_LAB_POSTCSS_TEMPLATE_SPEC) : VITE_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "service")) return SERVICE_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "tauri")) return TAURI_APP_TEMPLATE_SPECS;
  return A.append(packageTemplateSpecsFor(shape.withStoriesTsconfig), NOEMIT_TURBO_TEMPLATE_SPEC);
};

const templateSpecsFor = (shape: ScaffoldShape): ReadonlyArray<TemplateSpec> =>
  pipe(
    shape.appKind,
    O.match({
      onNone: () => A.append(packageTemplateSpecsFor(shape.withStoriesTsconfig), PACKAGE_TEST_TEMPLATE_SPEC),
      onSome: (kind) => appTemplateSpecsFor(shape, kind),
    })
  );

const assetSpecsFor = (shape: ScaffoldShape): ReadonlyArray<StaticAssetSpec> =>
  pipe(
    shape.appKind,
    O.filter((kind) => appKindEquivalence(kind, "tauri")),
    O.map(() => TAURI_APP_ASSET_SPECS),
    O.getOrElse(A.empty<StaticAssetSpec>)
  );

const PACKAGE_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.test.json",
  "tsconfig.check.json",
  "src/index.ts",
  "test/.gitkeep",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
  "docgen.json",
  "vitest.config.ts",
  "docs/index.md",
] as const;
const STORIES_TSCONFIG_FILE = "tsconfig.stories.json" as const;
const STORIES_DIRECTORY_TSCONFIG_FILE = "stories/tsconfig.json" as const;
const STORIES_TSCONFIG_FILES = [STORIES_TSCONFIG_FILE, STORIES_DIRECTORY_TSCONFIG_FILE] as const;

const NEXTJS_APP_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.check.json",
  "turbo.json",
  "next-env.d.ts",
  "next.config.ts",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "test/app.test.tsx",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
  "vitest.config.ts",
] as const;

const TAURI_APP_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.check.json",
  "turbo.json",
  "index.html",
  "src/App.tsx",
  "src/main.tsx",
  "test/App.test.tsx",
  "vite.config.ts",
  "vitest.config.ts",
  "src-tauri/Cargo.toml",
  "src-tauri/build.rs",
  "src-tauri/tauri.conf.json",
  "src-tauri/capabilities/default.json",
  "src-tauri/icons/icon.png",
  "src-tauri/src/main.rs",
  "src-tauri/src/lib.rs",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
] as const;

const NEXTJS_LAB_APP_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.check.json",
  "turbo.json",
  "tsconfig.next.json",
  "next-env.d.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "src/app/globals.css",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "test/app.test.tsx",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
  "vitest.config.ts",
] as const;

const VITE_APP_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.check.json",
  "turbo.json",
  "index.html",
  "src/App.tsx",
  "src/main.tsx",
  "src/styles/globals.css",
  "test/App.test.tsx",
  "vite.config.ts",
  "vitest.config.ts",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
] as const;
const VITE_LAB_POSTCSS_FILE = "postcss.config.mjs" as const;

const SERVICE_APP_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.check.json",
  "src/Api.ts",
  "src/main.ts",
  "src/runtime/Layer.ts",
  "test/health.test.ts",
  "vitest.config.ts",
  "turbo.json",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
] as const;

const LAB_EXTRA_FILES = [LAB_MANIFEST_FILENAME] as const;

const packageFilesFor = (withStoriesTsconfig: boolean): ReadonlyArray<string> =>
  withStoriesTsconfig ? pipe(A.make(PACKAGE_FILES, STORIES_TSCONFIG_FILES), A.flatten) : PACKAGE_FILES;

const appFilesFor = (shape: ScaffoldShape, kind: AppKind): ReadonlyArray<string> => {
  if (appKindEquivalence(kind, "nextjs")) return shape.lab ? NEXTJS_LAB_APP_FILES : NEXTJS_APP_FILES;
  if (appKindEquivalence(kind, "vite"))
    return shape.lab ? A.append(VITE_APP_FILES, VITE_LAB_POSTCSS_FILE) : VITE_APP_FILES;
  if (appKindEquivalence(kind, "service")) return SERVICE_APP_FILES;
  if (appKindEquivalence(kind, "tauri")) return TAURI_APP_FILES;
  return A.append(packageFilesFor(shape.withStoriesTsconfig), NOEMIT_TURBO_FILE);
};

const filesFor = (shape: ScaffoldShape): ReadonlyArray<string> =>
  pipe(
    shape.appKind,
    O.match({
      onNone: () =>
        A.map(packageFilesFor(shape.withStoriesTsconfig), (file) =>
          file === PACKAGE_TEST_PLACEHOLDER_FILE ? PACKAGE_TEST_FILE : file
        ),
      onSome: (kind) => appFilesFor(shape, kind),
    }),
    (files) => (shape.lab ? pipe(A.make(files, LAB_EXTRA_FILES), A.flatten) : files)
  );

const PACKAGE_DIRECTORIES = ["src", "test", "docs"] as const;
const STORIES_DIRECTORIES = ["stories"] as const;
const NEXTJS_APP_DIRECTORIES = ["src", "src/app", "test"] as const;
const TAURI_APP_DIRECTORIES = [
  "src",
  "test",
  "src-tauri",
  "src-tauri/capabilities",
  "src-tauri/icons",
  "src-tauri/src",
] as const;

const VITE_APP_DIRECTORIES = ["src", "src/styles", "test"] as const;
const SERVICE_APP_DIRECTORIES = ["src", "src/runtime", "test"] as const;

const packageDirectoriesFor = (withStoriesTsconfig: boolean): ReadonlyArray<string> =>
  withStoriesTsconfig ? pipe(A.make(PACKAGE_DIRECTORIES, STORIES_DIRECTORIES), A.flatten) : PACKAGE_DIRECTORIES;

const directoriesFor = (shape: ScaffoldShape): ReadonlyArray<string> =>
  pipe(
    shape.appKind,
    O.match({
      onNone: () => packageDirectoriesFor(shape.withStoriesTsconfig),
      onSome: (kind) => {
        if (appKindEquivalence(kind, "nextjs")) return NEXTJS_APP_DIRECTORIES;
        if (appKindEquivalence(kind, "vite")) return VITE_APP_DIRECTORIES;
        if (appKindEquivalence(kind, "service")) return SERVICE_APP_DIRECTORIES;
        if (appKindEquivalence(kind, "tauri")) return TAURI_APP_DIRECTORIES;
        return packageDirectoriesFor(shape.withStoriesTsconfig);
      },
    })
  );

const gitkeepFilesFor = (appKind: O.Option<AppKind>): ReadonlyArray<PlannedFile> =>
  O.isSome(appKind) && appKindEquivalence(appKind.value, "runtime-proof")
    ? [PlannedFile.make({ relativePath: PACKAGE_TEST_PLACEHOLDER_FILE, content: "" })]
    : A.empty<PlannedFile>();

const appKindIs = (appKind: O.Option<AppKind>, kind: AppKind): boolean =>
  O.isSome(appKind) && appKindEquivalence(appKind.value, kind);

const isRealAppKind = (appKind: O.Option<AppKind>): boolean =>
  O.isSome(appKind) && !appKindEquivalence(appKind.value, "runtime-proof");

const templateService = createTemplateService();
const fileGenerationPlanService = createFileGenerationPlanService();

/**
 * **Example** (Run the create-package command)
 *
 * ```ts
 * import { TemplateContext } from "@beep/repo-cli/commands/CreatePackage"
 * import * as S from "effect/Schema"
 *
 * const candidate = { domain: "foundation", family: "modeling", name: "example", packageName: "@beep/example" }
 * console.log(S.is(TemplateContext)(candidate)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TemplateContext extends S.Opaque<TemplateContext, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    scopedName: S.String,
    type: PackageType,
    description: S.String,
    year: S.String,
    parentDir: ParentDir,
    packagePath: S.String,
    rootRelative: S.String,
    family: S.optionalKey(PackageFamily),
    kind: S.optionalKey(PackageKind),
    appKind: S.optionalKey(AppKind),
    isTool: S.Boolean,
    isApp: S.Boolean,
    isLibrary: S.Boolean,
    isNextjsApp: S.Boolean,
    isTauriApp: S.Boolean,
    isViteApp: S.Boolean,
    isServiceApp: S.Boolean,
    isRuntimeProofApp: S.Boolean,
    isRealApp: S.Boolean,
    isLab: S.Boolean,
    isEcosystem: S.Boolean,
    portlessLabel: S.String,
    rootDirRelative: S.String,
    identityAccessor: S.String,
    effectLanguageServicePlugins: S.String,
    nextjsLanguageServicePlugins: S.String,
  }).pipe(
    $I.annoteSchema("TemplateContext", {
      description: "Variables passed into every template during package scaffolding.",
    })
  )
) {}

const toRootRelative = (packagePath: string): string => Str.repeat("../", A.length(Str.split(packagePath, "/")));

const readRootPackageJsonDocument = Effect.fn(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const filePath = path.join(repoRoot, "package.json");
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));
  const packageJson = yield* readPackageJsonFile(filePath).pipe(
    Effect.mapError(DomainError.newCause(`Failed to read or decode package.json at "${filePath}"`))
  );

  return {
    filePath,
    content,
    packageJson,
  } as const;
});

const pathSegments: (value: string) => ReadonlyArray<string> = flow(Str.split("/"), A.filter(Str.isNonEmpty));

const matchesWorkspacePattern: {
  (pattern: string, targetPath: string): boolean;
  (targetPath: string): (pattern: string) => boolean;
} = dual(2, (pattern: string, targetPath: string): boolean => {
  const patternSegments = pathSegments(pattern);
  const targetSegments = pathSegments(targetPath);

  if (A.length(patternSegments) !== A.length(targetSegments)) {
    return false;
  }

  return A.every(
    A.zip(patternSegments, targetSegments),
    ([patternSegment, targetSegment]) =>
      Str.equivalence(patternSegment, "*") || Str.equivalence(patternSegment, targetSegment)
  );
});

const isPathCoveredByWorkspacePatterns = (patterns: ReadonlyArray<string>, targetPath: string): boolean =>
  A.some(patterns, matchesWorkspacePattern(targetPath));

const appendWorkspaceEntry = (content: string, currentWorkspaces: unknown, packagePath: string): string => {
  if (P.isUndefined(currentWorkspaces)) {
    return applyJsoncModification(JsoncModification.make({ content, path: ["workspaces"], value: [packagePath] }));
  }

  if (A.isArray(currentWorkspaces) && A.every(currentWorkspaces, P.isString)) {
    return applyJsoncModification(
      JsoncModification.make({
        content,
        path: ["workspaces", A.length(currentWorkspaces)],
        value: packagePath,
        isArrayInsertion: true,
      })
    );
  }

  if (
    P.isObject(currentWorkspaces) &&
    P.hasProperty(currentWorkspaces, "packages") &&
    A.isArray(currentWorkspaces.packages) &&
    A.every(currentWorkspaces.packages, P.isString)
  ) {
    return applyJsoncModification(
      JsoncModification.make({
        content,
        path: ["workspaces", "packages", A.length(currentWorkspaces.packages)],
        value: packagePath,
        isArrayInsertion: true,
      })
    );
  }

  return P.isObject(currentWorkspaces)
    ? applyJsoncModification(
        JsoncModification.make({ content, path: ["workspaces", "packages"], value: [packagePath] })
      )
    : applyJsoncModification(JsoncModification.make({ content, path: ["workspaces"], value: [packagePath] }));
};

const ensureRootWorkspaceEntry = Effect.fn(function* (repoRoot: string, packagePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const { content, filePath, packageJson } = yield* readRootPackageJsonDocument(repoRoot);
  const workspacePatterns = WorkspacePatterns.fromManifest(packageJson);

  if (isPathCoveredByWorkspacePatterns(workspacePatterns, packagePath)) {
    return false;
  }

  const currentWorkspaces: unknown = packageJson.workspaces;

  const nextContent = appendWorkspaceEntry(content, currentWorkspaces, packagePath);

  if (Str.equivalence(nextContent, content)) {
    return false;
  }

  yield* fs
    .writeFileString(filePath, nextContent)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to write "${filePath}"`)));
  return true;
});

const rootWorkspaceEntryNeeded = Effect.fn(function* (repoRoot: string, packagePath: string) {
  const { packageJson } = yield* readRootPackageJsonDocument(repoRoot);
  return !isPathCoveredByWorkspacePatterns(WorkspacePatterns.fromManifest(packageJson), packagePath);
});

const portlessLabelFor = (name: string, lab: boolean): string => (lab ? `${name}.labs.beep` : `${name}.beep`);

const toRootDirRelative = (rootRelative: string): string =>
  Str.endsWith("/")(rootRelative) ? Str.slice(0, Str.length(rootRelative) - 1)(rootRelative) : rootRelative;

const labFlagRefusal = (options: {
  readonly appKind: O.Option<AppKind>;
  readonly description: string;
  readonly packageType: PackageType;
  readonly parentDirOverride: string;
}): O.Option<string> =>
  pipe(
    [
      [
        !packageTypeEquivalence(options.packageType, "app"),
        "--lab is only valid with --type app; labs are runnable app workspaces under apps/labs.",
      ],
      [
        appKindIs(options.appKind, "runtime-proof"),
        "--lab --app-kind runtime-proof is not supported: runtime-proof harnesses are package-like scaffolds, not runnable labs.",
      ],
      [
        Str.isNonEmpty(options.parentDirOverride),
        `--lab derives its parent directory (${LABS_WORKSPACE_ROOT}); omit --parent-dir.`,
      ],
      [
        Str.isEmpty(Str.trim(options.description)),
        "--lab requires a non-empty --description; it becomes the lab manifest purpose.",
      ],
    ] as const,
    A.findFirst(([applies]) => applies),
    O.map(([, message]) => message)
  );

const ensureRetiredNameAllowed = Effect.fn(function* (repoRoot: string, name: string, reuseRetiredName: boolean) {
  const retiredNames = yield* readRetiredPackageNames(repoRoot).pipe(
    Effect.mapError(DomainError.newCause(`Failed to read the retired-packages registry at "${RETIRED_REGISTRY_PATH}"`))
  );
  const scopedName = `@beep/${name}`;
  const retired = HashSet.has(retiredNames, scopedName);

  if (retired && !reuseRetiredName) {
    return yield* DomainError.make({
      message: `"${scopedName}" is a retired package name (${RETIRED_REGISTRY_PATH}). Retired names are reserved against accidental reuse; pass --reuse-retired-name only after confirming the recreation is intentional (see the registry rationale).`,
    });
  }

  return retired && reuseRetiredName;
});

const ensureLabsWorkspaceGlobCovers = Effect.fn(function* (repoRoot: string, packagePath: string) {
  const missing = yield* rootWorkspaceEntryNeeded(repoRoot, packagePath);
  if (missing) {
    return yield* DomainError.make({
      message: `Root package.json workspaces are missing the "${LABS_WORKSPACE_GLOB}" glob, so "${packagePath}" would force per-lab root churn. Land the one-time labs membership change before scaffolding labs (lab-apps D5 zero-root-churn).`,
    });
  }
});

const labManifestPlannedFile = Effect.fn(function* (description: string) {
  const manifest = LabManifest.make({
    schemaVersion: "lab-manifest/v1",
    purpose: description,
    created: today(),
    disposition: "active",
    postgresSchema: O.none(),
  });
  const content = yield* encodeLabManifestJson(manifest);
  return PlannedFile.make({ relativePath: LAB_MANIFEST_FILENAME, content: `${content}\n` });
});

const formatGeneratedPackage = Effect.fn("CreatePackage.formatGeneratedPackage")(function* (
  repoRoot: string,
  outputDir: string
) {
  const args = ["biome", "check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched", outputDir];
  const exitCode = yield* runToExit({
    command: "bunx",
    args,
    cwd: repoRoot,
    stdio: "ignore",
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn bunx ${A.join(args, " ")}.`)));

  yield* Console.log(
    `[create-package] biome format pass over ${outputDir} exited ${exitCode}; if nonzero, run "bun run beep:lint:fix" in the package.`
  );
  return exitCode === 0;
});

const refreshBunLockfile = Effect.fn("CreatePackage.refreshBunLockfile")(function* (repoRoot: string) {
  const args = ["install", "--lockfile-only"] as const;
  yield* Console.log(`[create-package] Refreshing bun.lock: bun ${A.join(args, " ")}`);
  const exitCode = yield* runToExit({
    command: "bun",
    args,
    cwd: repoRoot,
    stdio: "inherit",
  }).pipe(Effect.mapError(DomainError.newCause(`Failed to spawn bun ${A.join(args, " ")}.`)));

  if (exitCode !== 0) {
    return yield* DomainError.make({
      message: `bun ${A.join(args, " ")} failed with exit code ${exitCode}. Fix package metadata and rerun the command.`,
    });
  }
});

/**
 * Add root workspace entries and identity composers for package directories
 * another scaffolder already wrote: the registration half of
 * {@link registerScaffoldedWorkspaces}, without the tsconfig sync and the
 * lockfile refresh.
 *
 * **Gotchas**
 *
 * The root manifest and the identity registry are each read, merged and rewritten under one
 * cross-process lock, so two registrations in the same checkout never drop each other's entries.
 *
 * **Example** (Register the entries of a generated context)
 *
 * ```ts
 * import { registerScaffoldedWorkspaceEntries } from "@beep/repo-cli/commands/CreatePackage"
 * import * as Effect from "effect/Effect"
 *
 * const program = registerScaffoldedWorkspaceEntries("/repo", ["packages/notes/contract"])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param packagePaths - Repo-relative package directories to register.
 * @returns The workspace paths added and the identity slugs registered.
 * @effects Edits the root manifest and the identity registry.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const registerScaffoldedWorkspaceEntries = Effect.fn("CreatePackage.registerScaffoldedWorkspaceEntries")(
  function* (repoRoot: string, packagePaths: ReadonlyArray<string>) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const lockDirectory = path.join(repoRoot, ".beep", "locks");
    yield* fs
      .makeDirectory(lockDirectory, { recursive: true })
      .pipe(Effect.mapError(DomainError.newCause(`Failed to create "${lockDirectory}"`)));
    return yield* withJournalFileLock(
      path.join(lockDirectory, "root-workspaces.lock"),
      Effect.fnUntraced(function* () {
        const addedWorkspaces = yield* Effect.filter(
          packagePaths,
          (packagePath) => ensureRootWorkspaceEntry(repoRoot, packagePath),
          { concurrency: 1 }
        );
        const registeredSlugs = yield* registerMissingWorkspaceIdentityPackages(repoRoot);
        return { addedWorkspaces, registeredSlugs } as const;
      }),
      undefined,
      "Another process is registering workspaces in this checkout; retry after it completes."
    ).pipe(Effect.catchTag("QualitySchedulerError", (error) => DomainError.newMessage(error.message)));
  }
);

/**
 * What registration would still add for package directories another
 * scaffolder wrote, without writing anything: the root workspace entries
 * that do not cover them and the identity composers the registry lacks.
 *
 * **Example** (Read the registration gaps of a generated context)
 *
 * ```ts
 * import { scaffoldedRegistrationGaps } from "@beep/repo-cli/commands/CreatePackage"
 * import * as Effect from "effect/Effect"
 *
 * const program = scaffoldedRegistrationGaps("/repo", ["packages/notes/contract"])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param packagePaths - Repo-relative package directories.
 * @returns The paths missing a workspace entry and the slugs missing a composer.
 * @effects Reads the root manifest, each package manifest and the identity registry.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const scaffoldedRegistrationGaps = Effect.fn("CreatePackage.scaffoldedRegistrationGaps")(function* (
  repoRoot: string,
  packagePaths: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const missingWorkspaces = yield* Effect.filter(
    packagePaths,
    (packagePath) => rootWorkspaceEntryNeeded(repoRoot, packagePath),
    { concurrency: 1 }
  );
  const slugs = yield* Effect.forEach(
    packagePaths,
    Effect.fnUntraced(function* (packagePath) {
      const manifest = yield* readPackageJsonFile(path.join(repoRoot, packagePath, "package.json")).pipe(
        Effect.mapError(DomainError.newCause(`Failed to read the "${packagePath}" package manifest`))
      );
      return Str.replace("@beep/", "")(manifest.name);
    }),
    { concurrency: 1 }
  );
  const registryFile = yield* CreatePackageIdentityRegistration.resolveIdentityPackagesFilePath(repoRoot);
  const registryPath = path.join(repoRoot, registryFile);
  const registry = yield* fs
    .readFileString(registryPath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${registryPath}"`)));
  const missingIdentities = CreatePackageIdentityRegistration.missingIdentityRegistrations(registry, slugs);
  return { missingWorkspaces, missingIdentities } as const;
});

/**
 * Register package directories another scaffolder already wrote, the way
 * `create-package` registers its own: root workspace entries, identity
 * composers, the shared tsconfig and alias sync, and a `bun.lock` refresh.
 *
 * **Details**
 *
 * `beep architecture create context` writes its packages through an operation
 * plan and then calls this, so every package it creates carries the same
 * registration as one `create-package` bootstraps.
 *
 * **Example** (Register a generated context)
 *
 * ```ts
 * import { registerScaffoldedWorkspaces } from "@beep/repo-cli/commands/CreatePackage"
 * import * as Effect from "effect/Effect"
 *
 * const program = registerScaffoldedWorkspaces("/repo", ["packages/notes/contract"])
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param repoRoot - Absolute repository root.
 * @param packagePaths - Repo-relative package directories to register.
 * @returns The workspace paths added and the identity slugs registered.
 * @effects Edits the root manifest, the identity registry, root tsconfig and alias files, and `bun.lock`.
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const registerScaffoldedWorkspaces = Effect.fn("CreatePackage.registerScaffoldedWorkspaces")(function* (
  repoRoot: string,
  packagePaths: ReadonlyArray<string>
) {
  const registered = yield* registerScaffoldedWorkspaceEntries(repoRoot, packagePaths);
  yield* syncTsconfigAtRoot(
    repoRoot,
    TsconfigSyncRunOptionsSync.make({
      mode: "sync",
      filter: undefined,
      verbose: false,
    })
  );
  yield* refreshBunLockfile(repoRoot);
  return registered;
});

/**
 * CLI command that scaffolds a new package with templates, a Schema-validated
 * `package.json`, root workspace registration, identity registration, and shared repo config synchronization.
 *
 * **Details**
 *
 * - Every create checks the retired-name registry, dry runs included. `--reuse-retired-name`
 *   reuses a retired name and removes its registry entry, since a live package listed as retired
 *   would also block a later `delete-package` of the recreated name.
 * - `--lab` mints a lab app below `apps/labs` and needs the root `apps/labs/*` workspace glob,
 *   because labs never add per-lab workspace entries. A path inside `apps/labs` without `--lab`
 *   is refused, since it would skip every lab rule and leave a misplaced workspace.
 * - A lab gets a `lab.manifest.json` (purpose from `--description`, created today, disposition
 *   `active`, no Postgres schema until edited by hand), the `<name>.labs.beep` portless label
 *   where other apps get `<name>.beep`, and no `coverage` script.
 * - A library ships one alias smoke test: its entry point starts as an empty barrel, and the
 *   per-package test typecheck fails without a test file. The runtime-proof app has no root
 *   package alias, so it keeps an empty `test/` placeholder.
 * - A scaffold whose build is the `noEmit` check declares `build.outputs: []` in its
 *   `turbo.json`, so Turbo does not warn "no output files found". It and every bundler app keep
 *   `check` off their own build.
 * - A Tauri app gets a generated binary `src-tauri/icons/icon.png`, copied verbatim and never
 *   clobbered: `tauri::generate_context!()` opens it while the macro expands, and no
 *   `bundle.icon` value, `[]` and `bundle.active: false` included, avoids that. Replace it in
 *   place.
 * - Each generated manifest declares only the dependencies its emitted files import, plus
 *   `bun-types`, which `tsconfig.test.json` lists.
 * - The written tree is biome-formatted, so the package passes its own `beep:lint` with no hand
 *   edits. The pass is advisory: its exit code is printed and a nonzero one never fails the
 *   scaffold.
 *
 * **Example** (Run the create-package command)
 *
 * ```ts
 * import { createPackageCommand } from "@beep/repo-cli/commands/CreatePackage"
 * import * as Command from "effect/cli/Command";
 * import * as Effect from "effect/Effect";
 * const run = Command.run(createPackageCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const createPackageCommand = Command.make(
  "create-package",
  {
    name: Argument.String("name").pipe(Argument.withDescription("Package name (e.g. my-utils)")),
    type: Flag.String("type").pipe(
      Flag.withDescription("Package type: library, tool, or app"),
      Flag.withDefault("library")
    ),
    appKind: Flag.String("app-kind").pipe(
      Flag.withDescription(
        "App scaffold kind for --type app. Supports: nextjs, vite, service, tauri, or runtime-proof"
      ),
      Flag.withDefault("")
    ),
    lab: Flag.Boolean("lab").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Scaffold a lab app under apps/labs with a schema-validated lab manifest, the labs portless namespace, and the generated labs identity segment"
      )
    ),
    reuseRetiredName: Flag.Boolean("reuse-retired-name").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Allow reusing a package name recorded in standards/changesets.retired-packages.json")
    ),
    parentDir: Flag.String("parent-dir").pipe(
      Flag.withDescription("Optional output parent directory relative to repo root (e.g. tooling or packages/shared)"),
      Flag.withDefault("")
    ),
    family: Flag.String("family").pipe(
      Flag.withDescription("Optional canonical package family. Supports: drivers, ecosystem, foundation, or tooling"),
      Flag.withDefault("")
    ),
    kind: Flag.String("kind").pipe(
      Flag.withDescription(
        "Package kind for --family foundation or --family tooling. Tooling supports: library, tool, policy-pack, test-kit, infra"
      ),
      Flag.withDefault("")
    ),
    dirName: Flag.String("dir-name").pipe(
      Flag.withDescription(
        "Override folder name (defaults to package name). E.g. --dir-name domain for packages/example/domain"
      ),
      Flag.withDefault("")
    ),
    description: Flag.String("description").pipe(Flag.withDescription("Package description"), Flag.withDefault("")),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Preview changes without writing files")
    ),
    skipLockfile: Flag.Boolean("skip-lockfile").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the default bun.lock refresh after package creation")
    ),
    withStoriesTsconfig: Flag.Boolean("with-stories-tsconfig").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Generate tsconfig.stories.json and wire beep:check:stories for foundation/ui-system packages"
      )
    ),
  },
  // fallow-ignore-next-line complexity -- legacy scaffold handler keeps flag validation and file planning in one transaction (cognitive 92). Owner: @beep/repo-cli. Exit: remove when create-package moves to the operation-plan executor.
  Effect.fn(function* (config) {
    const {
      name,
      type,
      appKind: appKindOption,
      lab,
      reuseRetiredName,
      parentDir: parentDirOverride,
      family: familyOption,
      kind: kindOption,
      dirName: dirNameOverride,
      description,
      dryRun,
      skipLockfile,
      withStoriesTsconfig,
    } = config;

    if (!isPackageType(type)) {
      return yield* DomainError.make({
        message: `Invalid package type "${type}". Must be one of: ${A.join(VALID_TYPES, ", ")}`,
      });
    }
    const packageType = type;

    if (!packageTypeEquivalence(packageType, "app") && Str.isNonEmpty(appKindOption)) {
      return yield* DomainError.make({
        message: `--app-kind is only valid with --type app.`,
      });
    }

    if (packageTypeEquivalence(packageType, "app") && Str.isEmpty(appKindOption)) {
      return yield* DomainError.make({
        message: `--type app requires --app-kind nextjs, vite, service, tauri, or runtime-proof. Use --app-kind runtime-proof for package-like proof harnesses.`,
      });
    }

    if (Str.isNonEmpty(appKindOption) && P.not(isAppKind)(appKindOption)) {
      return yield* DomainError.make({
        message: `Invalid app kind "${appKindOption}". Must be one of: ${A.join(VALID_APP_KINDS, ", ")}`,
      });
    }

    const appKind: O.Option<AppKind> = Str.isNonEmpty(appKindOption)
      ? yield* Effect.asSome(decodeAppKindEffect(appKindOption))
      : O.none();

    if (lab) {
      const refusal = labFlagRefusal({ appKind, description, packageType, parentDirOverride });
      if (O.isSome(refusal)) {
        return yield* DomainError.make({ message: refusal.value });
      }
    }

    if (Str.isNonEmpty(familyOption) && P.not(isPackageFamily)(familyOption)) {
      return yield* DomainError.make({
        message: `Invalid package family "${familyOption}". Must be one of: ${A.join(VALID_FAMILIES, ", ")}`,
      });
    }
    const requestedPackageFamily = Str.isNonEmpty(familyOption)
      ? yield* Effect.asSome(decodePackageFamilyEffect(familyOption))
      : O.none();

    if (packageTypeEquivalence(packageType, "app") && O.isSome(requestedPackageFamily)) {
      return yield* DomainError.make({
        message: `--family is only valid for package scaffolds; --type app uses --app-kind and defaults to apps/.`,
      });
    }

    if (O.isNone(requestedPackageFamily) && Str.isNonEmpty(kindOption)) {
      return yield* DomainError.make({
        message: `Package kind "${kindOption}" requires --family foundation or --family tooling.`,
      });
    }

    if (
      O.isSome(requestedPackageFamily) &&
      packageFamilyEquivalence(requestedPackageFamily.value, "foundation") &&
      !isFoundationKind(kindOption)
    ) {
      return yield* DomainError.make({
        message: `Invalid foundation kind "${kindOption}". Must be one of: ${A.join(VALID_FOUNDATION_KINDS, ", ")}`,
      });
    }
    const foundationKind =
      O.isSome(requestedPackageFamily) && packageFamilyEquivalence(requestedPackageFamily.value, "foundation")
        ? yield* Effect.asSome(decodeFoundationKindEffect(kindOption))
        : O.none<FoundationKind>();
    if (
      O.isSome(requestedPackageFamily) &&
      packageFamilyEquivalence(requestedPackageFamily.value, "tooling") &&
      !isToolingKind(kindOption)
    ) {
      return yield* DomainError.make({
        message: `Invalid tooling kind "${kindOption}". Must be one of: ${A.join(VALID_TOOLING_KINDS, ", ")}`,
      });
    }
    const explicitToolingKind =
      O.isSome(requestedPackageFamily) && packageFamilyEquivalence(requestedPackageFamily.value, "tooling")
        ? yield* Effect.asSome(decodeToolingKindEffect(kindOption))
        : O.none<ToolingKind>();
    if (
      O.isSome(requestedPackageFamily) &&
      packageFamilyEquivalence(requestedPackageFamily.value, "drivers") &&
      Str.isNonEmpty(kindOption)
    ) {
      return yield* DomainError.make({
        message: `Drivers packages are a flat family and do not accept --kind.`,
      });
    }
    if (
      O.isSome(requestedPackageFamily) &&
      packageFamilyEquivalence(requestedPackageFamily.value, "ecosystem") &&
      Str.isNonEmpty(kindOption)
    ) {
      return yield* DomainError.make({
        message: `Ecosystem packages are a flat family and do not accept --kind.`,
      });
    }
    const inferableToolingPackageType = pipe(
      packageType,
      O.liftPredicate(
        (type) =>
          O.isNone(requestedPackageFamily) && Str.isEmpty(parentDirOverride) && !packageTypeEquivalence(type, "app")
      )
    );
    const inferredToolingKind = pipe(
      [
        pipe(inferableToolingPackageType, O.filter(PackageType.is.tool), O.as("tool" as const)),
        pipe(inferableToolingPackageType, O.as("library" as const)),
      ] satisfies ReadonlyArray<O.Option<ToolingKind>>,
      O.firstSomeOf
    );
    const toolingKind = pipe(
      [explicitToolingKind, inferredToolingKind] satisfies ReadonlyArray<O.Option<ToolingKind>>,
      O.firstSomeOf
    );
    const packageFamily = pipe(
      [requestedPackageFamily, pipe(inferredToolingKind, O.as("tooling" as const))] satisfies ReadonlyArray<
        O.Option<PackageFamily>
      >,
      O.firstSomeOf
    );
    const packageKind: O.Option<PackageKind> = pipe(
      [foundationKind, toolingKind] satisfies ReadonlyArray<O.Option<PackageKind>>,
      O.firstSomeOf
    );

    if (
      withStoriesTsconfig &&
      !(
        packageTypeEquivalence(packageType, "library") &&
        O.isSome(requestedPackageFamily) &&
        packageFamilyEquivalence(requestedPackageFamily.value, "foundation") &&
        O.isSome(foundationKind) &&
        Str.equivalence(foundationKind.value, "ui-system")
      )
    ) {
      return yield* DomainError.make({
        message: `--with-stories-tsconfig is only valid for --family foundation --kind ui-system package scaffolds.`,
      });
    }

    if (!S.is(PackageName)(name)) {
      return yield* DomainError.make({
        message: `Invalid package name "${name}". Must start with a lowercase letter or underscore, contain only [a-z0-9._-].`,
      });
    }

    const dirName = Str.isNonEmpty(dirNameOverride) ? dirNameOverride : name;
    if (Str.isNonEmpty(dirNameOverride) && !S.is(PackageName)(dirName)) {
      return yield* DomainError.make({
        message: `Invalid dir name "${dirName}". Must start with a lowercase letter or underscore, contain only [a-z0-9._-].`,
      });
    }

    if (O.isSome(requestedPackageFamily) && Str.isNonEmpty(parentDirOverride)) {
      const kindHint = O.isSome(packageKind) ? ` --kind ${packageKind.value}` : "";
      return yield* DomainError.make({
        message: `${requestedPackageFamily.value} package paths are derived from --family ${requestedPackageFamily.value}${kindHint}; omit --parent-dir.`,
      });
    }

    const defaultParentDir = pipe(
      [
        pipe(
          foundationKind,
          O.map((kind) => `packages/foundation/${kind}`)
        ),
        pipe(
          toolingKind,
          O.map((kind) => `packages/tooling/${kind}`)
        ),
        pipe(requestedPackageFamily, O.filter(PackageFamily.is.drivers), O.as("packages/drivers")),
        pipe(requestedPackageFamily, O.filter(PackageFamily.is.ecosystem), O.as("packages/ecosystem")),
        pipe(
          packageType,
          O.liftPredicate((candidate) => lab && packageTypeEquivalence(candidate, "app")),
          O.as(LABS_WORKSPACE_ROOT)
        ),
        pipe(packageType, O.liftPredicate(PackageType.is.app), O.as("apps")),
      ] satisfies ReadonlyArray<O.Option<string>>,
      O.firstSomeOf,
      O.getOrElse(() => "packages/tooling/library")
    );
    const parentDir = Str.isNonEmpty(parentDirOverride) ? parentDirOverride : defaultParentDir;
    if (!S.is(ParentDir)(parentDir)) {
      return yield* DomainError.make({
        message: `Invalid parent dir "${parentDir}". Use a repo-relative path like "packages/tooling/library", "apps", or "packages/shared".`,
      });
    }
    const packagePath = `${parentDir}/${dirName}`;

    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const repoRoot = yield* findRepoRoot();
    const identityPackagesFilePath = yield* resolveIdentityPackagesFilePath(repoRoot);

    const retiredNameReused = yield* ensureRetiredNameAllowed(repoRoot, name, reuseRetiredName);

    if (lab) {
      yield* ensureLabsWorkspaceGlobCovers(repoRoot, packagePath);
    }

    if (!lab && isLabsWorkspacePath(packagePath)) {
      return yield* DomainError.make({
        message: `"${packagePath}" is inside the ${LABS_WORKSPACE_ROOT} root, which only lab apps may occupy. Pass --lab to mint it as a lab app, or choose a --parent-dir outside ${LABS_WORKSPACE_ROOT}.`,
      });
    }

    const scaffoldShape = ScaffoldShape.make({ appKind, lab, withStoriesTsconfig });

    const outputDir = path.join(repoRoot, packagePath);

    if (!dryRun) {
      const alreadyExists = yield* fs.exists(outputDir).pipe(Effect.orElseSucceed(thunkFalse));
      if (alreadyExists) {
        return yield* DomainError.newMessage(
          `Directory already exists: ${outputDir}\nRemove it first or choose a different package name.`
        );
      }
    }

    if (dryRun) {
      const workspaceEntryNeeded = yield* rootWorkspaceEntryNeeded(repoRoot, packagePath);
      const identityLine = yield* lab
        ? Effect.succeed(`Sync the generated labs identity segment (register "${name}" in generatedLabComposers)`)
        : Effect.map(identityPackageRegistrationNeeded(repoRoot, identityPackagesFilePath, name), (missing) =>
            missing ? `Register "${name}" and export ${toIdentityAccessorName(name)}` : "SKIP (already registered)"
          );

      yield* Console.log(`[dry-run] Would create package @beep/${name} (type: ${type})`);
      if (O.isSome(appKind)) {
        yield* Console.log(`[dry-run] App kind: ${appKind.value}`);
      }
      if (O.isSome(packageFamily)) {
        yield* Console.log(`[dry-run] Family: ${packageFamily.value}`);
      }
      if (O.isSome(packageKind)) {
        yield* Console.log(`[dry-run] Kind: ${packageKind.value}`);
      }
      if (dirName !== name) {
        yield* Console.log(`[dry-run] Directory name: ${dirName} (overridden from package name "${name}")`);
      }

      yield* printLines([
        ...(retiredNameReused ? [`[dry-run] Retired name: reusing "@beep/${name}" (--reuse-retired-name)`] : []),
        `[dry-run] Directory: ${outputDir}`,
        `[dry-run] Files:`,
        ...A.map(filesFor(scaffoldShape), (file) => `  - ${file}`),
        `[dry-run] Root bootstrap updates:`,
        `  - package.json workspaces: ${workspaceEntryNeeded ? `Add "${packagePath}"` : "SKIP (already covered by an existing workspace entry)"}`,
        `  - ${identityPackagesFilePath}: ${identityLine}`,
        `[dry-run] Derived repo configs: shared sync runs after scaffolding to update tsconfig references, aliases, syncpack, and docgen`,
        `[dry-run] Lockfile: ${skipLockfile ? "SKIP (--skip-lockfile)" : "bun install --lockfile-only"}`,
      ]);

      return;
    }

    const currentYear = `${DateTime.getPartUtc(DateTime.nowUnsafe(), "year")}`;
    const rootRelative = toRootRelative(packagePath);
    const portlessLabel = portlessLabelFor(name, lab);
    const isEcosystem = O.exists(packageFamily, PackageFamily.is.ecosystem);
    const languageServicePluginProfiles =
      isEcosystem || appKindIs(appKind, "nextjs")
        ? yield* readLanguageServicePluginProfiles(repoRoot)
        : EMPTY_LANGUAGE_SERVICE_PLUGIN_PROFILES;
    const ctx = TemplateContext.make({
      name,
      scopedName: `@beep/${name}`,
      type: packageType,
      description,
      year: currentYear,
      parentDir,
      packagePath,
      rootRelative,
      ...O.getSomesStruct({ family: packageFamily, kind: packageKind, appKind }),
      isTool: packageTypeEquivalence(packageType, "tool"),
      isApp: packageTypeEquivalence(packageType, "app"),
      isLibrary: packageTypeEquivalence(packageType, "library"),
      isNextjsApp: appKindIs(appKind, "nextjs"),
      isTauriApp: appKindIs(appKind, "tauri"),
      isViteApp: appKindIs(appKind, "vite"),
      isServiceApp: appKindIs(appKind, "service"),
      isRuntimeProofApp: appKindIs(appKind, "runtime-proof"),
      isRealApp: isRealAppKind(appKind),
      isLab: lab,
      isEcosystem,
      portlessLabel,
      rootDirRelative: toRootDirRelative(rootRelative),
      identityAccessor: toIdentityAccessorName(name),
      ...languageServicePluginProfiles,
    });

    const templateDir = yield* resolveCreatePackageTemplateDir();
    const templateFiles = yield* templateService.renderTemplates(
      TemplateRenderRequest.make({
        templateDir,
        templates: templateSpecsFor(scaffoldShape),
        context: { ...ctx },
      })
    );

    const packageMetadata = O.isSome(packageFamily)
      ? O.some<BeepPackageMetadata>(
          BeepPackageMetadata.make({
            family: packageFamily.value,
            ...(O.isSome(packageKind) ? { kind: packageKind.value } : {}),
          })
        )
      : O.none<BeepPackageMetadata>();
    const ecosystemMetadata = pipe(
      packageMetadata,
      O.filter((metadata) => packageFamilyEquivalence(metadata.family, "ecosystem"))
    );
    let ecosystemEffectPeerVersion = O.none<string>();
    if (O.isSome(ecosystemMetadata)) {
      const { packageJson: rootPackageJson } = yield* readRootPackageJsonDocument(repoRoot);
      ecosystemEffectPeerVersion = pipe(O.fromUndefinedOr(rootPackageJson.catalog), O.flatMap(R.get("effect")));
      if (O.isNone(ecosystemEffectPeerVersion)) {
        return yield* DomainError.make({
          message: `Root package.json catalog must define an exact effect version before creating an ecosystem package.`,
        });
      }
    }
    const packageJson = yield* generatePackageJson(
      name,
      packageType,
      description,
      packagePath,
      packageMetadata,
      scaffoldShape,
      portlessLabel,
      ecosystemEffectPeerVersion
    );
    const labManifestFiles = lab
      ? yield* Effect.map(labManifestPlannedFile(description), A.of)
      : A.empty<PlannedFile>();

    const plan = fileGenerationPlanService.createPlan(
      FileGenerationPlanInput.make({
        outputDir,
        directories: directoriesFor(scaffoldShape),
        files: pipe(
          A.make(
            A.of(
              PlannedFile.make({
                relativePath: "package.json",
                content: packageJson,
              })
            ),
            A.map(templateFiles, (file) =>
              PlannedFile.make({
                relativePath: file.outputPath,
                content: file.content,
              })
            ),
            gitkeepFilesFor(appKind),
            labManifestFiles
          ),
          A.flatten
        ),
        assets: A.map(assetSpecsFor(scaffoldShape), (asset) =>
          PlannedAsset.make({
            relativePath: asset.outputPath,
            sourcePath: `${templateDir}/${asset.assetName}`,
          })
        ),
        symlinks: A.of(
          PlannedSymlink.make({
            relativePath: "CLAUDE.md",
            target: "AGENTS.md",
          })
        ),
      })
    );

    yield* fileGenerationPlanService.executePlan(plan);
    yield* formatGeneratedPackage(repoRoot, outputDir);

    const workspaceUpdated = yield* ensureRootWorkspaceEntry(repoRoot, packagePath);
    const identityUpdated = yield* lab
      ? Effect.map(LabIdentitySegment.syncLabIdentitySegment(repoRoot), ({ changed }) => changed)
      : ensureIdentityPackageRegistration(identityPackagesFilePath, name);
    const syncResult = yield* syncTsconfigAtRoot(
      repoRoot,
      TsconfigSyncRunOptionsSync.make({
        mode: "sync",
        filter: undefined,
        verbose: false,
      })
    );
    const retiredNameCleared = retiredNameReused
      ? yield* RetiredNameRegistry.removeRetiredPackageName(repoRoot, `@beep/${name}`)
      : false;
    const lockfileRefreshed = !skipLockfile;
    if (lockfileRefreshed) {
      yield* refreshBunLockfile(repoRoot);
    }

    yield* printLines([
      `Created package @beep/${name} at ${outputDir}`,
      `Files created:`,
      ...A.map(filesFor(scaffoldShape), (file) => `  - ${file}`),
    ]);
    if (
      workspaceUpdated ||
      identityUpdated ||
      retiredNameCleared ||
      syncResult.changedFiles > 0 ||
      lockfileRefreshed ||
      skipLockfile
    ) {
      yield* Console.log(`\nRepo registration and config sync:`);
      if (workspaceUpdated) {
        yield* Console.log(`  - package.json: added workspace "${packagePath}"`);
      }
      if (retiredNameCleared) {
        yield* Console.log(`  - ${RETIRED_REGISTRY_PATH}: removed the retired entry for "@beep/${name}"`);
      }
      if (identityUpdated) {
        yield* Console.log(
          lab
            ? `  - ${identityPackagesFilePath}: synced the generated labs identity segment (registered "${name}")`
            : `  - ${identityPackagesFilePath}: registered "${name}" as ${toIdentityAccessorName(name)}`
        );
      }
      if (lockfileRefreshed) {
        yield* Console.log(`  - bun.lock: refreshed via "bun install --lockfile-only"`);
      }
      if (skipLockfile) {
        yield* Console.log(`  - bun.lock: SKIP (--skip-lockfile)`);
      }
      yield* printLines(
        A.map(
          syncResult.changes,
          (change) => `  - ${path.relative(repoRoot, change.filePath)} [${change.section}] ${change.summary}`
        )
      );
    }
    const packageNextSteps = ['Run "bun install" to link the new package', "Start building in src/index.ts"];
    const nextSteps = pipe(
      appKind,
      O.match({
        onNone: () => packageNextSteps,
        onSome: (kind) =>
          Match.value(kind).pipe(
            Match.when("nextjs", () => [
              'Run "bun install" to link the new app',
              'Run "bun run dev" from the app workspace',
              "Start building in src/app/page.tsx",
            ]),
            Match.when("tauri", () => [
              'Run "bun install" to link the new app',
              'Run "bun run dev" for the web shell or "bun run dev:tauri" for Tauri',
              "Start building in src/App.tsx",
            ]),
            Match.when("vite", () => [
              'Run "bun install" to link the new app',
              'Run "bun run dev" from the app workspace',
              "Start building in src/App.tsx",
            ]),
            Match.when("service", () => [
              'Run "bun install" to link the new app',
              'Run "bun run dev" from the app workspace',
              `Probe http://${portlessLabel}.localhost:1355/health and start building in src/Api.ts`,
            ]),
            Match.orElse(() => packageNextSteps)
          ),
      })
    );

    yield* printLines([`\nNext steps:`, ...A.map(nextSteps, (step, index) => `  ${index + 1}. ${step}`)]);
  })
).pipe(Command.withDescription("Create a new package or app workspace following Effect v4 conventions"));

const generateEcosystemPackageJson = Effect.fn("CreatePackage.generateEcosystemPackageJson")(function* <
  const BaseManifest extends object,
  const Scripts extends object,
>(baseManifest: BaseManifest, scripts: Scripts, metadata: BeepPackageMetadata, effectPeerVersion: O.Option<string>) {
  if (O.isNone(effectPeerVersion)) {
    return yield* DomainError.make({
      message: `Root package.json catalog must define an exact effect version before creating an ecosystem package.`,
    });
  }

  const pkg = {
    ...baseManifest,
    beep: metadata,
    sideEffects: false,
    exports: {
      "./package.json": "./package.json",
      ".": "./src/index.ts",
    },
    files: ["dist/**/*.js", "dist/**/*.js.map", "dist/**/*.d.ts", "dist/**/*.d.ts.map"],
    publishConfig: {
      access: "public",
      provenance: true,
      exports: {
        "./package.json": "./package.json",
        ".": "./dist/index.js",
      },
    },
    scripts,
    peerDependencies: {
      effect: effectPeerVersion.value,
    },
    devDependencies: {
      "@types/node": "catalog:",
      "@effect/vitest": "catalog:",
      "bun-types": "catalog:",
      effect: "catalog:",
    },
  };

  const json = yield* encodePackageJsonCanonicalPrettyEffect(pkg);
  return `${json}\n`;
});

const baseManifestFor = (name: string, description: string, packagePath: string) => ({
  name: `@beep/${name}`,
  version: "0.0.0",
  type: "module",
  private: true,
  license: "MIT",
  description,
  homepage: `https://github.com/beep-effect/beep-effect/tree/main/${packagePath}`,
  repository: {
    type: "git",
    url: "git@github.com:beep-effect/beep-effect.git",
    directory: packagePath,
  },
});

type BaseManifest = ReturnType<typeof baseManifestFor>;

type AppManifestContext = {
  readonly baseManifest: BaseManifest;
  readonly portlessLabel: string;
  readonly lab: boolean;
};

const portlessDev = (portlessLabel: string, command: string): string => `portless ${portlessLabel} ${command}`;

const portlessViteDev = (portlessLabel: string, defaultPort: string): string =>
  portlessDev(portlessLabel, `sh -c 'vite --host 127.0.0.1 --port "\${PORT:-${defaultPort}}" --strictPort'`);

const appBaseScripts = (dev: string, build: string, lab: boolean) => ({
  ...scaffoldPackageScripts(lab ? "lab" : "app", []),
  dev,
  "beep:build": build,
  ...(lab ? {} : { coverage: "bunx vitest run --coverage" }),
});

const NEXTJS_LAB_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@beep/repo-configs": "workspace:^",
  "@beep/ui": "workspace:^",
};

const VITE_LAB_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@beep/ui": "workspace:^",
};

const labDependenciesFor = (
  lab: boolean,
  dependencies: Readonly<Record<string, string>>
): Readonly<Record<string, string>> => (lab ? dependencies : {});

const REACT_APP_DEV_DEPENDENCIES = {
  "@testing-library/dom": "catalog:",
  "@testing-library/react": "catalog:",
  "@types/node": "catalog:",
  "@types/react": "catalog:",
  "@types/react-dom": "catalog:",
  jsdom: "catalog:",
  typescript: "catalog:",
};

const VITE_APP_DEV_DEPENDENCIES = {
  ...REACT_APP_DEV_DEPENDENCIES,
  "@vitejs/plugin-react": "catalog:",
  vite: "catalog:",
};

// One app kind's package.json manifest builder. Named so the four builders
// share a single declared type: without it their differing object-literal
// return types form a union that `appManifestBuilderFor` cannot widen under
// `exactOptionalPropertyTypes`. Both programs run the same patched compiler
// (`.bin/tsc` is `tsgo`); the docgen examples project rejects the union under
// its own generated tsconfig while `tsconfig.check.json` accepts it, and the
// failure moves whenever a dependency table changes.
type AppManifestBuilder = (ctx: AppManifestContext) => unknown;

const nextjsAppManifest: AppManifestBuilder = ({ baseManifest, lab, portlessLabel }: AppManifestContext) => ({
  ...baseManifest,
  scripts: {
    ...appBaseScripts(portlessDev(portlessLabel, "next dev --turbopack"), "next build --turbopack", lab),
    start: "next start",
  },
  dependencies: {
    next: "catalog:",
    react: "catalog:",
    "react-dom": "catalog:",
    ...labDependenciesFor(lab, NEXTJS_LAB_DEPENDENCIES),
  },
  devDependencies: REACT_APP_DEV_DEPENDENCIES,
});

const viteAppManifest: AppManifestBuilder = ({ baseManifest, lab, portlessLabel }: AppManifestContext) => ({
  ...baseManifest,
  scripts: appBaseScripts(portlessViteDev(portlessLabel, "5173"), "vite build", lab),
  dependencies: {
    react: "catalog:",
    "react-dom": "catalog:",
    ...labDependenciesFor(lab, VITE_LAB_DEPENDENCIES),
  },
  devDependencies: VITE_APP_DEV_DEPENDENCIES,
});

const serviceAppManifest: AppManifestBuilder = ({ baseManifest, lab, portlessLabel }: AppManifestContext) => ({
  ...baseManifest,
  scripts: appBaseScripts(
    portlessDev(portlessLabel, "sh -c 'bun --watch src/main.ts'"),
    "tsrs -p tsconfig.check.json",
    lab
  ),
  dependencies: {
    "@beep/identity": "workspace:^",
    "@effect/platform-bun": "catalog:",
    effect: "catalog:",
  },
  devDependencies: {
    "@effect/vitest": "catalog:",
    "@types/node": "catalog:",
    typescript: "catalog:",
  },
});

const tauriAppManifest: AppManifestBuilder = ({ baseManifest, lab, portlessLabel }: AppManifestContext) => ({
  ...baseManifest,
  scripts: {
    ...appBaseScripts(portlessViteDev(portlessLabel, "1420"), "vite build", lab),
    "dev:tauri": "tauri dev",
  },
  dependencies: {
    "@tauri-apps/api": "catalog:",
    react: "catalog:",
    "react-dom": "catalog:",
  },
  devDependencies: {
    ...VITE_APP_DEV_DEPENDENCIES,
    "@tauri-apps/cli": "catalog:",
  },
});

const appManifestBuilderFor = (kind: AppKind): O.Option<AppManifestBuilder> =>
  Match.value(kind).pipe(
    Match.when("nextjs", () => O.some(nextjsAppManifest)),
    Match.when("vite", () => O.some(viteAppManifest)),
    Match.when("service", () => O.some(serviceAppManifest)),
    Match.when("tauri", () => O.some(tauriAppManifest)),
    // Bare `O.none` infers `None<unknown>` here, which docgen's tsc rejects
    // under `exactOptionalPropertyTypes`; the explicit type argument pins it
    // while keeping the direct helper reference.
    Match.when("runtime-proof", O.none<AppManifestBuilder>),
    Match.exhaustive
  );

const encodeManifestJson = (manifest: unknown): Effect.Effect<string, DomainError | S.SchemaError> =>
  Effect.map(encodePackageJsonCanonicalPrettyEffect(manifest), (json) => `${json}\n`);

type PackageScriptsKind = Exclude<ScriptsPackageKind, "lab">;

const STORIES_CHECK = "tsrs -p tsconfig.check.json && bun run beep:check:tests && bun run beep:check:stories";
const storiesCheck = (scripts: Readonly<Record<string, string>>): string =>
  pipe(
    R.get(scripts, "beep:build"),
    O.flatMap((build) => buildServedCheck(STORIES_CHECK, build)),
    O.getOrElse(constant(STORIES_CHECK))
  );

const packageScripts = (kind: PackageScriptsKind, withStoriesTsconfig: boolean) => {
  const scripts = scaffoldPackageScripts(kind, ["lint:fix", "test:integration", "docgen"]);
  return {
    ...scripts,
    "beep:check:tests": "tsrs -p tsconfig.test.json --noEmit",
    ...(withStoriesTsconfig
      ? {
          "beep:check": storiesCheck(scripts),
          "beep:check:stories": "tsrs -p tsconfig.stories.json --noEmit",
        }
      : {}),
    coverage: "bunx vitest run --coverage --exclude=test/integration/**",
  };
};

/**
 * Shared script renderers used by package and application scaffolds.
 *
 * **Example** (Render service app scripts)
 *
 * ```ts
 * import { CreatePackageScripts } from "@beep/repo-cli/commands/CreatePackage"
 * const scripts = CreatePackageScripts.app("portless api.beep bun src/main.ts", "tsrs -p tsconfig.check.json", false)
 * console.log(scripts["beep:build"]) // "tsrs -p tsconfig.check.json"
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const CreatePackageScripts = {
  app: appBaseScripts,
  package: packageScripts,
};

const packageDependencies = (type: PackageType): Readonly<Record<string, string>> => ({
  effect: "catalog:",
  ...(packageTypeEquivalence(type, "tool") ? { "@effect/platform-node": "catalog:" } : {}),
});

const generatePackageJson: (
  name: string,
  type: PackageType,
  description: string,
  packagePath: string,
  packageMetadata: O.Option<BeepPackageMetadata>,
  shape: ScaffoldShape,
  portlessLabel: string,
  ecosystemEffectPeerVersion: O.Option<string>
) => Effect.Effect<string, DomainError | S.SchemaError> = Effect.fn(
  function* (name, type, description, packagePath, packageMetadata, shape, portlessLabel, ecosystemEffectPeerVersion) {
    const { appKind, lab, withStoriesTsconfig } = shape;
    const baseManifest = baseManifestFor(name, description, packagePath);

    const appManifest = pipe(
      appKind,
      O.flatMap(appManifestBuilderFor),
      O.map((build) => build({ baseManifest, lab, portlessLabel }))
    );
    if (O.isSome(appManifest)) {
      return yield* encodeManifestJson(appManifest.value);
    }

    const ecosystemMetadata = pipe(
      packageMetadata,
      O.filter((metadata) => packageFamilyEquivalence(metadata.family, "ecosystem"))
    );
    const kind = Match.value(type).pipe(
      Match.when(
        () => O.isSome(ecosystemMetadata),
        (): PackageScriptsKind => "ecosystem"
      ),
      Match.when(
        () => O.isSome(appKind),
        (): PackageScriptsKind => "app"
      ),
      Match.when("tool", (): PackageScriptsKind => "tool"),
      Match.orElse((): PackageScriptsKind => "library")
    );
    const scripts = packageScripts(kind, withStoriesTsconfig);
    if (O.isSome(ecosystemMetadata)) {
      return yield* generateEcosystemPackageJson(
        baseManifest,
        scripts,
        ecosystemMetadata.value,
        ecosystemEffectPeerVersion
      );
    }

    return yield* encodeManifestJson({
      ...baseManifest,
      ...(O.isSome(packageMetadata)
        ? {
            beep: packageMetadata.value,
          }
        : {}),
      sideEffects: [],
      exports: {
        "./package.json": "./package.json",
        ".": "./src/index.ts",
        "./*": "./src/*.ts",
        "./internal/*": null,
      },
      files: ["src/**/*.ts", "dist/**/*.js", "dist/**/*.js.map", "dist/**/*.d.ts", "dist/**/*.d.ts.map"],
      publishConfig: {
        access: "public",
        provenance: true,
        exports: {
          "./package.json": "./package.json",
          ".": "./dist/index.js",
          "./*": "./dist/*.js",
          "./internal/*": null,
        },
      },
      scripts,
      dependencies: packageDependencies(type),
      devDependencies: {
        "@types/node": "catalog:",
        "@effect/vitest": "catalog:",
        "bun-types": "catalog:",
      },
    });
  }
);
