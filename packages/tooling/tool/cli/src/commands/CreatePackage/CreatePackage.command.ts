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

import { fileURLToPath } from "node:url";
import { $RepoCliId } from "@beep/identity/packages";
import {
  DomainError,
  encodePackageJsonCanonicalPrettyEffect,
  findRepoRoot,
  readPackageJsonFile,
} from "@beep/repo-utils";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { today } from "@beep/schema/LocalDate";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, DateTime, Effect, FileSystem, flow, HashSet, Match, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { formatJsonValue } from "../../internal/cli/Json.ts";
import { applyJsoncModification as applySharedJsoncModification, decodeJsoncTextAs } from "../../internal/cli/Jsonc.ts";
import {
  encodeLabManifestJson,
  isLabsWorkspacePath,
  LAB_MANIFEST_FILENAME,
  LABS_WORKSPACE_GLOB,
  LABS_WORKSPACE_ROOT,
  LabManifest,
  RETIRED_REGISTRY_PATH,
  readRetiredPackageNames,
} from "../../internal/cli/Labs/index.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { syncTsconfigAtRoot } from "../TsconfigSync/index.ts";
import {
  createFileGenerationPlanService,
  FileGenerationPlanInput,
  PlannedAsset,
  PlannedFile,
  PlannedSymlink,
} from "./FileGenerationPlanService.ts";
import { CreatePackageIdentityRegistration } from "./internal/IdentityRegistration.ts";
import { LabIdentitySegment } from "./internal/LabIdentitySegment.ts";
import * as RetiredNameRegistry from "./internal/RetiredNameRegistry.ts";
import { createTemplateService, StaticAssetSpec, TemplateRenderRequest, TemplateSpec } from "./TemplateService.ts";

const $I = $RepoCliId.create("commands/CreatePackage/CreatePackage.command");
const {
  ensureIdentityPackageRegistration,
  identityPackageRegistrationNeeded,
  resolveIdentityPackagesFilePath,
  toIdentityAccessorName,
} = CreatePackageIdentityRegistration;

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Build ordered template directory candidates for create-package execution.
 *
 * @param baseDir - Directory of the currently executing command module.
 * @param path - Path service used to compose normalized candidate paths.
 * @returns Candidate directories in preferred lookup order.
 * @category models
 * @since 0.0.0
 */

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
 * import { Effect } from "effect"
 *
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
  baseDir: string = fileURLToPath(new URL(".", import.meta.url))
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

/**
 * Valid package types.
 *
 * @category configuration
 * @since 0.0.0
 */
const VALID_TYPES = ["library", "tool", "app"] as const;
const VALID_APP_KINDS = ["nextjs", "vite", "service", "tauri", "runtime-proof"] as const;
const VALID_FAMILIES = ["drivers", "ecosystem", "foundation", "tooling"] as const;
const VALID_FOUNDATION_KINDS = ["primitive", "modeling", "capability", "ui-system"] as const;
const VALID_TOOLING_KINDS = ["library", "tool", "policy-pack", "test-kit"] as const;
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
  const config = yield* decodeJsoncTextAs(TypeScriptPluginsConfig)(content).pipe(
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
const packageTypeEquivalence = SchemaUtils.toEquivalence(PackageType);

const AppKind = LiteralKit(VALID_APP_KINDS).pipe(
  $I.annoteSchema("AppKind", {
    description: "Supported app scaffold kinds.",
  })
);
type AppKind = typeof AppKind.Type;
const isAppKind = S.is(AppKind);
const decodeAppKindEffect = (input: unknown) =>
  S.decodeUnknownEffect(AppKind)(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid app kind "${input}". Must be one of: ${A.join(VALID_APP_KINDS, ", ")}`)
    )
  );
const appKindEquivalence = SchemaUtils.toEquivalence(AppKind);

const PackageFamily = LiteralKit(VALID_FAMILIES).pipe(
  $I.annoteSchema("PackageFamily", {
    description: "Supported canonical package family scaffold targets.",
  })
);
type PackageFamily = typeof PackageFamily.Type;
const isPackageFamily = S.is(PackageFamily);
const decodePackageFamilyEffect = (input: unknown) =>
  S.decodeUnknownEffect(PackageFamily)(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid package family "${input}". Must be one of: ${A.join(VALID_FAMILIES, ", ")}`)
    )
  );
const packageFamilyEquivalence = SchemaUtils.toEquivalence(PackageFamily);

const FoundationKind = LiteralKit(VALID_FOUNDATION_KINDS).pipe(
  $I.annoteSchema("FoundationKind", {
    description: "Supported foundation package kinds.",
  })
);

type FoundationKind = typeof FoundationKind.Type;
const isFoundationKind = S.is(FoundationKind);
const decodeFoundationKindEffect = (input: unknown) =>
  S.decodeUnknownEffect(FoundationKind)(input).pipe(
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
type ToolingKind = typeof ToolingKind.Type;
const isToolingKind = S.is(ToolingKind);
const decodeToolingKindEffect = (input: unknown) =>
  S.decodeUnknownEffect(ToolingKind)(input).pipe(
    Effect.mapError(
      DomainError.newCause(`Invalid tooling kind "${input}". Must be one of: ${A.join(VALID_TOOLING_KINDS, ", ")}`)
    )
  );

const PackageKind = S.Union([FoundationKind, ToolingKind]);
type PackageKind = typeof PackageKind.Type;

class BeepPackageMetadata extends S.Class<BeepPackageMetadata>($I`BeepPackageMetadata`)(
  {
    family: PackageFamily,
    kind: S.optionalKey(PackageKind),
  },
  $I.annote("BeepPackageMetadata", {
    description: "Metadata for a Beep package, including its family and optional kind.",
  })
) {}

const ParentDir = S.String.check(S.isPattern(PARENT_DIR_PATTERN)).pipe(
  S.brand("ParentDir"),
  $I.annoteSchema("ParentDir", {
    description: "Validated repo-relative parent directory for package scaffolding.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

const PackageName = S.String.check(S.isPattern(PACKAGE_NAME_PATTERN)).pipe(
  S.brand("PackageName"),
  $I.annoteSchema("PackageName", {
    description: "Package name segment used for @beep scoped package creation.",
  }),
  SchemaUtils.withCodecStatics(["is"])
);

/**
 * Mapping from template source to output path.
 *
 * @category configuration
 * @since 0.0.0
 */
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

// [templateName, outputPath] data pair backing one TemplateSpec.
type TemplateSpecPair = readonly [templateName: string, outputPath: string];

// Expand [templateName, outputPath] data pairs into TemplateSpec values.
const templateSpecsFrom = (pairs: ReadonlyArray<TemplateSpecPair>): ReadonlyArray<TemplateSpec> =>
  A.map(pairs, ([templateName, outputPath]) => TemplateSpec.make({ templateName, outputPath }));

// LICENSE/README/AGENTS docs shared by every real app scaffold.
const REAL_APP_DOC_TEMPLATE_PAIRS: ReadonlyArray<TemplateSpecPair> = [
  ["LICENSE.hbs", "LICENSE"],
  ["app-real-README.md.hbs", "README.md"],
  ["app-real-AGENTS.md.hbs", "AGENTS.md"],
];

const CHECK_TSCONFIG_TEMPLATE_PAIR: TemplateSpecPair = ["tsconfig.check.json.hbs", "tsconfig.check.json"];

const NEXTJS_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-next-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
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

// `tauri::generate_context!()` opens `src-tauri/icons/icon.png` while the macro
// expands, so a Tauri crate does not compile without a real icon on disk — no
// `bundle.icon` value avoids this, including `[]` and `bundle.active: false`.
// The icon is therefore a generated file, and being binary it is copied
// verbatim rather than rendered. Authors replace it in place; regeneration
// never clobbers an existing icon.
const TAURI_APP_ASSET_SPECS: ReadonlyArray<StaticAssetSpec> = A.of(
  StaticAssetSpec.make({ assetName: "assets/tauri-icon.png", outputPath: "src-tauri/icons/icon.png" })
);

const NEXTJS_LAB_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = templateSpecsFrom([
  ["app-next-tsconfig.json.hbs", "tsconfig.json"],
  CHECK_TSCONFIG_TEMPLATE_PAIR,
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
  ...REAL_APP_DOC_TEMPLATE_PAIRS,
]);

/**
 * Decoded scaffold-mode selector threaded through template, file, directory,
 * and manifest planning so lab/kind dispatch never travels as loose booleans.
 */
class ScaffoldShape extends S.Class<ScaffoldShape>($I`ScaffoldShape`)(
  {
    appKind: S.OptionFromOptionalKey(AppKind),
    lab: S.Boolean,
    withStoriesTsconfig: S.Boolean,
  },
  $I.annote("ScaffoldShape", {
    description: "Decoded scaffold-mode selector threaded through template, file, and manifest planning.",
  })
) {}

const packageTemplateSpecsFor = (withStoriesTsconfig: boolean): ReadonlyArray<TemplateSpec> =>
  withStoriesTsconfig
    ? pipe(A.make(PACKAGE_TEMPLATE_SPECS, STORIES_TEMPLATE_SPECS), A.flatten)
    : PACKAGE_TEMPLATE_SPECS;

const appTemplateSpecsFor = (shape: ScaffoldShape, kind: AppKind): ReadonlyArray<TemplateSpec> => {
  if (appKindEquivalence(kind, "nextjs")) return shape.lab ? NEXTJS_LAB_APP_TEMPLATE_SPECS : NEXTJS_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "vite"))
    return shape.lab ? A.append(VITE_APP_TEMPLATE_SPECS, VITE_LAB_POSTCSS_TEMPLATE_SPEC) : VITE_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "service")) return SERVICE_APP_TEMPLATE_SPECS;
  if (appKindEquivalence(kind, "tauri")) return TAURI_APP_TEMPLATE_SPECS;
  return packageTemplateSpecsFor(shape.withStoriesTsconfig);
};

const templateSpecsFor = (shape: ScaffoldShape): ReadonlyArray<TemplateSpec> =>
  pipe(
    shape.appKind,
    O.match({
      onNone: () => packageTemplateSpecsFor(shape.withStoriesTsconfig),
      onSome: (kind) => appTemplateSpecsFor(shape, kind),
    })
  );

// Only the Tauri kinds carry verbatim assets today; every other scaffold is
// fully expressible as rendered text.
const assetSpecsFor = (shape: ScaffoldShape): ReadonlyArray<StaticAssetSpec> =>
  pipe(
    shape.appKind,
    O.filter((kind) => appKindEquivalence(kind, "tauri")),
    O.map(() => TAURI_APP_ASSET_SPECS),
    O.getOrElse(A.empty<StaticAssetSpec>)
  );

/**
 * Ordered list of all generated files for dry-run and summary output.
 *
 * @category configuration
 * @since 0.0.0
 */
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
  return packageFilesFor(shape.withStoriesTsconfig);
};

const filesFor = (shape: ScaffoldShape): ReadonlyArray<string> =>
  pipe(
    shape.appKind,
    O.match({
      onNone: () => packageFilesFor(shape.withStoriesTsconfig),
      onSome: (kind) => appFilesFor(shape, kind),
    }),
    (files) => (shape.lab ? pipe(A.make(files, LAB_EXTRA_FILES), A.flatten) : files)
  );

/**
 * Root-relative directories created for each package.
 *
 * @category configuration
 * @since 0.0.0
 */
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
  O.isSome(appKind) && !appKindEquivalence(appKind.value, "runtime-proof")
    ? A.empty<PlannedFile>()
    : [PlannedFile.make({ relativePath: "test/.gitkeep", content: "" })];

const appKindIs = (appKind: O.Option<AppKind>, kind: AppKind): boolean =>
  O.isSome(appKind) && appKindEquivalence(appKind.value, kind);

const isRealAppKind = (appKind: O.Option<AppKind>): boolean =>
  O.isSome(appKind) && !appKindEquivalence(appKind.value, "runtime-proof");

const templateService = createTemplateService();
const fileGenerationPlanService = createFileGenerationPlanService();
// ── Template context ──────────────────────────────────────────────────────────

/**
 * Variables passed into every template during package scaffolding.
 *
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
export class TemplateContext extends S.Class<TemplateContext>($I`TemplateContext`)(
  {
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
  },
  $I.annote("TemplateContext", {
    description: "Variables passed into every template during package scaffolding.",
  })
) {}

/**
 * Validate an optional parent directory override like `packages/foundation/modeling`.
 *
 * Must be repo-relative, normalized, and free of traversal segments.
 *
 * @param value - Parent directory override to validate.
 * @returns True when the override is safe and repo-relative.
 */
/**
 * Compute the path from a package directory back to repo root.
 *
 * Examples:
 * - `packages/tooling/tool/cli` maps to `../../`
 * - `packages/foundation/primitive/types` maps to `../../../../`
 *
 * @param packagePath - Repo-relative package path.
 * @returns Relative path from the package directory to repo root.
 */
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

const workspacePatternsFromPackageJson = (
  workspaces: O.Option<
    | ReadonlyArray<string>
    | {
        readonly packages?: ReadonlyArray<string>;
      }
  >
): ReadonlyArray<string> => {
  if (O.isNone(workspaces)) {
    return A.empty();
  }

  const value: unknown = workspaces.value;
  if (A.isArray(value) && A.every(value, P.isString)) {
    return value;
  }

  if (
    P.isObject(value) &&
    P.hasProperty(value, "packages") &&
    A.isArray(value.packages) &&
    A.every(value.packages, P.isString)
  ) {
    return value.packages;
  }

  return A.empty();
};

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

// fallow-ignore-next-line code-duplication -- config-updater helper twins converged after the tstyche removal + JSDoc grammar migration; consolidation onto @beep/repo-utils is a recorded quality-speedup follow-up
const isPathCoveredByWorkspacePatterns = (patterns: ReadonlyArray<string>, targetPath: string): boolean =>
  A.some(patterns, matchesWorkspacePattern(targetPath));

const applyJsoncModification = (
  content: string,
  path: ReadonlyArray<string | number>,
  value: unknown,
  options?: { readonly isArrayInsertion?: boolean }
): string =>
  applySharedJsoncModification({
    content,
    path,
    value,
    ...(options?.isArrayInsertion === true ? { isArrayInsertion: true } : {}),
  });

const appendWorkspaceEntry = (content: string, currentWorkspaces: unknown, packagePath: string): string => {
  if (P.isUndefined(currentWorkspaces)) {
    return applyJsoncModification(content, ["workspaces"], [packagePath]);
  }

  if (A.isArray(currentWorkspaces) && A.every(currentWorkspaces, P.isString)) {
    return applyJsoncModification(content, ["workspaces", A.length(currentWorkspaces)], packagePath, {
      isArrayInsertion: true,
    });
  }

  if (
    P.isObject(currentWorkspaces) &&
    P.hasProperty(currentWorkspaces, "packages") &&
    A.isArray(currentWorkspaces.packages) &&
    A.every(currentWorkspaces.packages, P.isString)
  ) {
    return applyJsoncModification(
      content,
      ["workspaces", "packages", A.length(currentWorkspaces.packages)],
      packagePath,
      {
        isArrayInsertion: true,
      }
    );
  }

  return P.isObject(currentWorkspaces)
    ? applyJsoncModification(content, ["workspaces", "packages"], [packagePath])
    : applyJsoncModification(content, ["workspaces"], [packagePath]);
};

const ensureRootWorkspaceEntry = Effect.fn(function* (repoRoot: string, packagePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const { content, filePath, packageJson } = yield* readRootPackageJsonDocument(repoRoot);
  const workspacePatterns = workspacePatternsFromPackageJson(packageJson.workspaces);

  if (isPathCoveredByWorkspacePatterns(workspacePatterns, packagePath)) {
    return false;
  }

  const currentWorkspaces: unknown = O.getOrUndefined(packageJson.workspaces);

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
  return !isPathCoveredByWorkspacePatterns(workspacePatternsFromPackageJson(packageJson.workspaces), packagePath);
});

/**
 * Portless route label for an app scaffold: labs get the `<name>.labs.beep`
 * namespace, every other app keeps the flat `<name>.beep` label.
 *
 * @param name - Package name that leads the portless host label.
 * @param lab - Whether the scaffold targets the labs namespace.
 * @returns The portless label used by generated `dev` scripts.
 */
const portlessLabelFor = (name: string, lab: boolean): string => (lab ? `${name}.labs.beep` : `${name}.beep`);

/**
 * Convert the trailing-slash `rootRelative` prefix into the slash-free
 * `rootDir` form used by app tsconfig templates (`../../` becomes `../..`).
 *
 * @param rootRelative - Trailing-slash repo-root prefix from the template context.
 * @returns The prefix without its trailing slash.
 */
const toRootDirRelative = (rootRelative: string): string =>
  Str.endsWith("/")(rootRelative) ? Str.slice(0, Str.length(rootRelative) - 1)(rootRelative) : rootRelative;

/**
 * First applicable `--lab` misuse refusal, if any (lab-apps P2-D20).
 *
 * @param options - Decoded create-package flag facts consulted by the refusal rules.
 * @returns The first refusal message, or none when `--lab` usage is legal.
 */
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

/**
 * Refuse reusing a retired package name unless `--reuse-retired-name` is set;
 * returns whether a retired name is being intentionally reused.
 */
const ensureRetiredNameAllowed = Effect.fn(function* (repoRoot: string, name: string, reuseRetiredName: boolean) {
  const retiredNames = yield* readRetiredPackageNames(repoRoot).pipe(
    Effect.mapError(DomainError.newCause(`Failed to read the retired-packages registry at "${RETIRED_REGISTRY_PATH}"`))
  );
  const scopedName = `@beep/${name}`;
  const retired = HashSet.has(retiredNames, scopedName);

  if (retired && !reuseRetiredName) {
    return yield* DomainError.make({
      message: `"${scopedName}" is a retired package name (${RETIRED_REGISTRY_PATH}). Retired names keep historical changesets; pass --reuse-retired-name only after confirming the recreation is intentional (see the registry rationale).`,
    });
  }

  return retired && reuseRetiredName;
});

/**
 * Refuse lab scaffolding while the root workspaces lack the `apps/labs/*`
 * glob (lab-apps D5 zero-root-churn: labs never append per-lab entries).
 */
const ensureLabsWorkspaceGlobCovers = Effect.fn(function* (repoRoot: string, packagePath: string) {
  const missing = yield* rootWorkspaceEntryNeeded(repoRoot, packagePath);
  if (missing) {
    return yield* DomainError.make({
      message: `Root package.json workspaces are missing the "${LABS_WORKSPACE_GLOB}" glob, so "${packagePath}" would force per-lab root churn. Land the one-time labs membership change before scaffolding labs (lab-apps D5 zero-root-churn).`,
    });
  }
});

/**
 * Build the planned `lab.manifest.json` file for a new lab (lab-apps P2-D2):
 * purpose from `--description`, created today, disposition `active`, and no
 * Postgres schema (labs opt in later by hand-editing the manifest).
 */
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

/**
 * Format the freshly-scaffolded tree so a generated package passes its own
 * `beep:lint` with no hand edits.
 *
 * Templates and JSON renderers cannot reliably predict biome's line-width
 * decisions — an injected plugin array or an `include` list formats one way in
 * the template and another way under `biome check`. Formatting the output is
 * the durable fix: it holds for every app kind and survives future template
 * edits, instead of hand-tuning each array until the next one drifts.
 *
 * Advisory by design: a formatter that cannot run must not fail a scaffold that
 * is otherwise complete, so a non-zero exit warns and continues.
 */
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

  // Reported unconditionally rather than warned-on-failure. The pass is advisory
  // either way, and a failure-only branch is a line no test can reach without
  // making `bunx biome` fail on demand, which the ratchet reads as a regression.
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

// ── Command ───────────────────────────────────────────────────────────────────

/**
 * CLI command that scaffolds a new package with templates, a Schema-validated
 * `package.json`, root workspace registration, identity registration, and shared repo config synchronization.
 *
 * **Example** (Run the create-package command)
 *
 * ```ts
 * import { createPackageCommand } from "@beep/repo-cli/commands/CreatePackage"
 * import { Command } from "effect/unstable/cli"
 * import { Effect } from "effect"
 *
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
    name: Argument.string("name").pipe(Argument.withDescription("Package name (e.g. my-utils)")),
    type: Flag.string("type").pipe(
      Flag.withDescription("Package type: library, tool, or app"),
      Flag.withDefault("library")
    ),
    appKind: Flag.string("app-kind").pipe(
      Flag.withDescription(
        "App scaffold kind for --type app. Supports: nextjs, vite, service, tauri, or runtime-proof"
      ),
      Flag.withDefault("")
    ),
    lab: Flag.boolean("lab").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Scaffold a lab app under apps/labs with a schema-validated lab manifest, the labs portless namespace, and the generated labs identity segment"
      )
    ),
    reuseRetiredName: Flag.boolean("reuse-retired-name").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Allow reusing a package name recorded in standards/changesets.retired-packages.json")
    ),
    parentDir: Flag.string("parent-dir").pipe(
      Flag.withDescription("Optional output parent directory relative to repo root (e.g. tooling or packages/shared)"),
      Flag.withDefault("")
    ),
    family: Flag.string("family").pipe(
      Flag.withDescription("Optional canonical package family. Supports: drivers, ecosystem, foundation, or tooling"),
      Flag.withDefault("")
    ),
    kind: Flag.string("kind").pipe(
      Flag.withDescription(
        "Package kind for --family foundation or --family tooling. Tooling supports: library, tool, policy-pack, test-kit"
      ),
      Flag.withDefault("")
    ),
    dirName: Flag.string("dir-name").pipe(
      Flag.withDescription(
        "Override folder name (defaults to package name). E.g. --dir-name domain for packages/example/domain"
      ),
      Flag.withDefault("")
    ),
    description: Flag.string("description").pipe(Flag.withDescription("Package description"), Flag.withDefault("")),
    dryRun: Flag.boolean("dry-run").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Preview changes without writing files")
    ),
    skipLockfile: Flag.boolean("skip-lockfile").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Skip the default bun.lock refresh after package creation")
    ),
    withStoriesTsconfig: Flag.boolean("with-stories-tsconfig").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Generate tsconfig.stories.json and wire beep:check:stories for foundation/ui-system packages"
      )
    ),
  },
  // Pre-existing complexity debt: this handler predates the fallow audit gate
  // and only re-entered the diff via a one-line registry fix (2026-06-12).
  // fallow-ignore-next-line complexity -- legacy scaffold handler keeps flag validation and file planning in one transaction
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

    // ── Validate type ──────────────────────────────────────────────────
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
      ? O.some(yield* decodeAppKindEffect(appKindOption))
      : O.none();

    // ── Validate lab mode (lab-apps P2-D20) ────────────────────────────
    if (lab) {
      const refusal = labFlagRefusal({ appKind, description, packageType, parentDirOverride });
      if (O.isSome(refusal)) {
        return yield* DomainError.make({ message: refusal.value });
      }
    }

    // ── Validate family/kind ──────────────────────────────────────────
    if (Str.isNonEmpty(familyOption) && P.not(isPackageFamily)(familyOption)) {
      return yield* DomainError.make({
        message: `Invalid package family "${familyOption}". Must be one of: ${A.join(VALID_FAMILIES, ", ")}`,
      });
    }
    const requestedPackageFamily = Str.isNonEmpty(familyOption)
      ? O.some(yield* decodePackageFamilyEffect(familyOption))
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
        ? O.some(yield* decodeFoundationKindEffect(kindOption))
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
        ? O.some(yield* decodeToolingKindEffect(kindOption))
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
        pipe(inferableToolingPackageType, O.filter(packageTypeEquivalence("tool")), O.as("tool" as const)),
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

    // ── Validate package name ─────────────────────────────────────────
    if (!PackageName.is(name)) {
      return yield* DomainError.make({
        message: `Invalid package name "${name}". Must start with a lowercase letter or underscore, contain only [a-z0-9._-].`,
      });
    }

    // ── Resolve directory name ─────────────────────────────────────────
    const dirName = Str.isNonEmpty(dirNameOverride) ? dirNameOverride : name;
    if (Str.isNonEmpty(dirNameOverride) && !PackageName.is(dirName)) {
      return yield* DomainError.make({
        message: `Invalid dir name "${dirName}". Must start with a lowercase letter or underscore, contain only [a-z0-9._-].`,
      });
    }

    // ── Resolve parent directory ───────────────────────────────────────
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
        pipe(requestedPackageFamily, O.filter(packageFamilyEquivalence("drivers")), O.as("packages/drivers")),
        pipe(requestedPackageFamily, O.filter(packageFamilyEquivalence("ecosystem")), O.as("packages/ecosystem")),
        pipe(
          packageType,
          O.liftPredicate((candidate) => lab && packageTypeEquivalence(candidate, "app")),
          O.as(LABS_WORKSPACE_ROOT)
        ),
        pipe(packageType, O.liftPredicate(packageTypeEquivalence("app")), O.as("apps")),
      ] satisfies ReadonlyArray<O.Option<string>>,
      O.firstSomeOf,
      O.getOrElse(() => "packages/tooling/library")
    );
    const parentDir = Str.isNonEmpty(parentDirOverride) ? parentDirOverride : defaultParentDir;
    if (!ParentDir.is(parentDir)) {
      return yield* DomainError.make({
        message: `Invalid parent dir "${parentDir}". Use a repo-relative path like "packages/tooling/library", "apps", or "packages/shared".`,
      });
    }
    const packagePath = `${parentDir}/${dirName}`;

    // ── Resolve services ───────────────────────────────────────────────
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    // ── Discover repo root ─────────────────────────────────────────────
    const repoRoot = yield* findRepoRoot();
    const identityPackagesFilePath = yield* resolveIdentityPackagesFilePath(repoRoot);

    // ── Retired-name gate (every create, dry-run included) ─────────────
    const retiredNameReused = yield* ensureRetiredNameAllowed(repoRoot, name, reuseRetiredName);

    // ── Labs membership guard (lab-apps D5 zero-root-churn) ────────────
    if (lab) {
      yield* ensureLabsWorkspaceGlobCovers(repoRoot, packagePath);
    }

    // The inverse of the D5 guard: `--parent-dir apps/labs` without `--lab`
    // would land inside the labs root while skipping every lab construction
    // rule (manifest, labs portless label, generated identity segment,
    // ceremony exemptions), leaving a workspace the identity-registry lint
    // classifies as misplaced.
    if (!lab && isLabsWorkspacePath(packagePath)) {
      return yield* DomainError.make({
        message: `"${packagePath}" is inside the ${LABS_WORKSPACE_ROOT} root, which only lab apps may occupy. Pass --lab to mint it as a lab app, or choose a --parent-dir outside ${LABS_WORKSPACE_ROOT}.`,
      });
    }

    const scaffoldShape = ScaffoldShape.make({ appKind, lab, withStoriesTsconfig });

    // ── Determine output directory ─────────────────────────────────────
    const outputDir = path.join(repoRoot, packagePath);

    // ── Check if directory already exists (skip for dry-run) ───────────
    if (!dryRun) {
      const alreadyExists = yield* fs.exists(outputDir).pipe(Effect.orElseSucceed(thunkFalse));
      if (alreadyExists) {
        return yield* DomainError.newMessage(
          `Directory already exists: ${outputDir}\nRemove it first or choose a different package name.`
        );
      }
    }

    // ── Dry-run: preview output and bootstrap repo mutations ───────────
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

    // ── Build template context ─────────────────────────────────────────
    const currentYear = `${DateTime.getPartUtc(DateTime.nowUnsafe(), "year")}`;
    const rootRelative = toRootRelative(packagePath);
    const portlessLabel = portlessLabelFor(name, lab);
    const isEcosystem = O.exists(packageFamily, packageFamilyEquivalence("ecosystem"));
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

    // ── Render templates and generate plan ─────────────────────────────
    const templateDir = yield* resolveCreatePackageTemplateDir();
    const templateFiles = yield* templateService.renderTemplates(
      TemplateRenderRequest.make({
        templateDir,
        templates: templateSpecsFor(scaffoldShape),
        context: { ...ctx },
      })
    );

    const packageMetadata = O.isSome(packageFamily)
      ? O.some<BeepPackageMetadata>({
          family: packageFamily.value,
          ...(O.isSome(packageKind) ? { kind: packageKind.value } : {}),
        })
      : O.none<BeepPackageMetadata>();
    const ecosystemMetadata = pipe(
      packageMetadata,
      O.filter((metadata) => packageFamilyEquivalence(metadata.family, "ecosystem"))
    );
    let ecosystemEffectPeerVersion = O.none<string>();
    if (O.isSome(ecosystemMetadata)) {
      const { packageJson: rootPackageJson } = yield* readRootPackageJsonDocument(repoRoot);
      ecosystemEffectPeerVersion = pipe(
        rootPackageJson.catalog,
        O.flatMap((catalog) => R.get(catalog, "effect"))
      );
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
    const labManifestFiles = lab ? A.of(yield* labManifestPlannedFile(description)) : A.empty<PlannedFile>();

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

    // ── Execute plan and repo mutations ────────────────────────────────
    yield* fileGenerationPlanService.executePlan(plan);
    yield* formatGeneratedPackage(repoRoot, outputDir);

    const workspaceUpdated = yield* ensureRootWorkspaceEntry(repoRoot, packagePath);
    const identityUpdated = yield* lab
      ? Effect.map(LabIdentitySegment.syncLabIdentitySegment(repoRoot), ({ changed }) => changed)
      : ensureIdentityPackageRegistration(identityPackagesFilePath, name);
    const syncResult = yield* syncTsconfigAtRoot(repoRoot, {
      mode: "sync",
      filter: undefined,
      verbose: false,
    });
    // Sanctioned reuse restores the name's provenance: leaving the entry behind
    // would leave the registry claiming a live package is retired, and would
    // wedge the later `delete-package` retirement of the recreated name.
    const retiredNameCleared = retiredNameReused
      ? yield* RetiredNameRegistry.removeRetiredPackageName(repoRoot, `@beep/${name}`)
      : false;
    const lockfileRefreshed = !skipLockfile;
    if (lockfileRefreshed) {
      yield* refreshBunLockfile(repoRoot);
    }

    // ── Print summary ──────────────────────────────────────────────────
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

// ── Template generators ────────────────────────────────────────────────────

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
      effect: "catalog:",
    },
  };

  const json = yield* encodePackageJsonCanonicalPrettyEffect(pkg);
  return `${json}\n`;
});

// ── Manifest builders ─────────────────────────────────────────────────────

// Shared identity/repository fields for every generated package.json manifest.
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

// Inputs shared by the per-app-kind manifest builders.
type AppManifestContext = {
  readonly baseManifest: BaseManifest;
  readonly portlessLabel: string;
  readonly lab: boolean;
};

// Portless-wrapped dev script for app manifests.
const portlessDev = (portlessLabel: string, command: string): string => `portless ${portlessLabel} ${command}`;

// Portless-wrapped strict-port Vite dev script (vite and tauri web shells).
const portlessViteDev = (portlessLabel: string, defaultPort: string): string =>
  portlessDev(portlessLabel, `sh -c 'vite --host 127.0.0.1 --port "\${PORT:-${defaultPort}}" --strictPort'`);

// Script table shared by every real app manifest; kind-specific entries layer on top.
// Labs carry no `coverage` script: ratified lab-apps-lifecycle row 7 requires both
// the coverage-discovery/disposition exclusions AND omitting the script from lab
// templates (research/04-governance-gates.md: "Never give labs a `coverage` script").
const appBaseScripts = (dev: string, build: string, lab: boolean) => ({
  audit: "bun run --if-present beep:audit",
  codegen: "echo 'no codegen needed'",
  dev,
  "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  "beep:build": build,
  "beep:check": "tsgo -p tsconfig.check.json",
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
  "beep:test": "bunx --bun vitest run",
  build: "bun run beep:build",
  check: "bun run beep:check",
  ...(lab ? {} : { coverage: "bunx vitest run --coverage" }),
  lint: "bun run beep:lint",
  "lint:fix": "bun run beep:lint:fix",
  "package-test-typecheck": "beep-cli quality test-tsgo-package",
  test: "bun run beep:test",
});

// Lab-only workspace dependencies layered onto Next.js lab app manifests.
// Only what the emitted templates actually consume: `@beep/repo-configs` in
// next.config.ts, `@beep/ui` via postcss.config.mjs and the globals.css import.
// Declaring more would fail the required Knip context on the first lab — labs
// are ceremony-exempt, never code-law exempt (D2). Lab authors add what they
// import, like any other workspace.
const NEXTJS_LAB_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@beep/repo-configs": "workspace:^",
  "@beep/ui": "workspace:^",
};

// Lab-only workspace dependencies layered onto Vite lab app manifests.
// `@beep/ui` only: postcss.config.mjs re-exports its config and
// src/styles/globals.css imports its stylesheet. See NEXTJS_LAB_DEPENDENCIES.
const VITE_LAB_DEPENDENCIES: Readonly<Record<string, string>> = {
  "@beep/ui": "workspace:^",
};

// Lab-conditional dependency fragment (empty outside lab mode).
const labDependenciesFor = (
  lab: boolean,
  dependencies: Readonly<Record<string, string>>
): Readonly<Record<string, string>> => (lab ? dependencies : {});

// Dev-dependency table shared by React-flavored app manifests.
// No `@effect/vitest`: the React app test templates use plain `vitest` plus
// @testing-library. Only the `service` kind's test imports it, and that kind
// declares it in its own devDependencies. Declaring it here fails Knip on the
// generated app.
const REACT_APP_DEV_DEPENDENCIES = {
  "@testing-library/dom": "catalog:",
  "@testing-library/react": "catalog:",
  "@types/node": "catalog:",
  "@types/react": "catalog:",
  "@types/react-dom": "catalog:",
  jsdom: "catalog:",
  typescript: "catalog:",
};

// Vite-stack additions layered onto the React app dev dependencies.
const VITE_APP_DEV_DEPENDENCIES = {
  ...REACT_APP_DEV_DEPENDENCIES,
  "@vitejs/plugin-react": "catalog:",
  vite: "catalog:",
};

// One app kind's package.json manifest builder. Named so the four builders
// share a single declared type: without it their differing object-literal
// return types form a union that `appManifestBuilderFor` cannot widen under
// `exactOptionalPropertyTypes` (docgen's tsc rejects it even though tsgo
// accepts it), and the failure moves whenever a dependency table changes.
type AppManifestBuilder = (ctx: AppManifestContext) => unknown;

// package.json manifest for a Next.js app workspace.
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

// package.json manifest for a Vite app workspace.
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

// package.json manifest for a service app workspace.
const serviceAppManifest: AppManifestBuilder = ({ baseManifest, lab, portlessLabel }: AppManifestContext) => ({
  ...baseManifest,
  scripts: appBaseScripts(
    portlessDev(portlessLabel, "sh -c 'bun --watch src/main.ts'"),
    "tsgo -p tsconfig.check.json",
    lab
  ),
  dependencies: {
    // src/Api.ts imports the identity accessor; main.ts imports platform-bun
    // and effect. `@beep/schema`/`@beep/utils` are not imported by any emitted
    // file (the `S` in the templates is `effect/Schema`), so declaring them
    // would fail the required Knip context on the first service app.
    "@beep/identity": "workspace:^",
    "@effect/platform-bun": "catalog:",
    effect: "catalog:",
  },
  devDependencies: {
    // test/health.test.ts uses `provideScopedLayer` to satisfy the effect-LSP's
    // strictEffectProvide rule.
    "@beep/test-utils": "workspace:^",
    "@effect/vitest": "catalog:",
    "@types/node": "catalog:",
    typescript: "catalog:",
  },
});

// package.json manifest for a Tauri app workspace.
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

// App kinds that emit a dedicated app manifest; runtime-proof falls through to the package manifest.
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

// Encode a manifest object to its pretty package.json payload with trailing newline.
const encodeManifestJson = (manifest: unknown): Effect.Effect<string, DomainError | S.SchemaError> =>
  Effect.map(encodePackageJsonCanonicalPrettyEffect(manifest), (json) => `${json}\n`);

// beep:check lane for library/tool packages (stories tsconfig adds a stories lane).
const packageCheckScript = (withStoriesTsconfig: boolean): string =>
  withStoriesTsconfig
    ? "tsgo -p tsconfig.check.json && bun run beep:check:tests && bun run beep:check:stories"
    : "tsgo -p tsconfig.check.json && bun run beep:check:tests";

// Script table for library/tool package manifests.
const packageScripts = (rootRelative: string, packagePath: string, withStoriesTsconfig: boolean) => ({
  audit: "bun run --if-present beep:audit",
  babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
  "beep:audit":
    "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run beep:policy && bun run beep:docgen && bun run beep:lint",
  "beep:build": "tsc -p tsconfig.json && bun run babel",
  "beep:check": packageCheckScript(withStoriesTsconfig),
  "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
  "beep:docgen": `bun run ${rootRelative}packages/tooling/tool/docgen/src/bin.ts`,
  ...(withStoriesTsconfig ? { "beep:check:stories": "tsc -p tsconfig.stories.json --noEmit" } : {}),
  "beep:lint": "biome check .",
  "beep:lint:fix": "biome check . --write",
  "beep:policy": `bun --cwd ${rootRelative} run beep lint package-test-imports --include-root ${packagePath}`,
  "beep:test": "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  "beep:test:integration": "bunx --bun vitest run test/integration --passWithNoTests",
  build: "bun run beep:build",
  check: "bun run beep:check",
  coverage: "bunx vitest run --coverage --exclude=test/integration/**",
  docgen: "bun run beep:docgen",
  lint: "bun run beep:lint",
  "lint:fix": "bun run beep:lint:fix",
  "package-test-typecheck": "beep-cli quality test-tsgo-package",
  test: "bun run beep:test",
  "test:integration": "bun run beep:test:integration",
});

// Dependency table for library/tool package manifests (tools also get platform-node).
const packageDependencies = (type: PackageType): Readonly<Record<string, string>> => ({
  effect: "catalog:",
  ...(packageTypeEquivalence(type, "tool") ? { "@effect/platform-node": "catalog:" } : {}),
});

/**
 * Build a pretty-printed `package.json` string for a new package.
 *
 * Constructs the package manifest object with standard scripts, exports map,
 * and publish configuration, then encodes it through the repo-utils canonical
 * package.json encoder to guarantee structural validity and stable formatting.
 *
 * @param name - The unscoped package name (e.g. `"my-utils"`). Will be prefixed with `@beep/`.
 * @param type - One of `"library"`, `"tool"`, or `"app"`. Tools receive an extra `@effect/platform-node` dependency.
 * @param description - Human-readable package description for the `"description"` field.
 * @param packagePath - Package path relative to repo root (e.g. `"packages/tooling/library/my-utils"`).
 * @param packageMetadata - Optional canonical family/kind metadata for the `"beep"` field.
 * @param shape - Decoded scaffold shape (app kind, lab mode, stories tsconfig opt-in).
 * @param portlessLabel - Portless route label used by app `dev` scripts (`<name>.beep` or `<name>.labs.beep`).
 * @param ecosystemEffectPeerVersion - Exact root-catalog Effect version for ecosystem package peers.
 * @returns A JSON string (with trailing newline) ready to be written to disk.
 * @category utilities
 * @since 0.0.0
 */
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

    const scripts = packageScripts(toRootRelative(packagePath), packagePath, withStoriesTsconfig);

    const ecosystemMetadata = pipe(
      packageMetadata,
      O.filter((metadata) => packageFamilyEquivalence(metadata.family, "ecosystem"))
    );
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
          ".": "./dist/index.ts",
          "./*": "./dist/*.js",
          "./internal/*": null,
        },
      },
      scripts,
      dependencies: packageDependencies(type),
      devDependencies: {
        "@types/node": "catalog:",
        "@effect/vitest": "catalog:",
      },
    });
  }
);
