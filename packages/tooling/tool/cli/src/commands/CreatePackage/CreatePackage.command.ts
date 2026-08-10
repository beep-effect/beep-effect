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
  decodePackageJsonEffect,
  encodePackageJsonCanonicalPrettyEffect,
  findRepoRoot,
} from "@beep/repo-utils";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str, Text, thunkFalse } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Console, DateTime, Effect, FileSystem, flow, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Argument, Command, Flag } from "effect/unstable/cli";
import { applyJsoncModification as applySharedJsoncModification } from "../../internal/cli/Jsonc.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { runToExit } from "../../internal/process/StepExec.ts";
import { syncTsconfigAtRoot } from "../TsconfigSync/index.ts";
import {
  createFileGenerationPlanService,
  FileGenerationPlanInput,
  PlannedFile,
  PlannedSymlink,
} from "./FileGenerationPlanService.ts";
import { CreatePackageIdentityRegistration } from "./internal/IdentityRegistration.ts";
import { createTemplateService, TemplateRenderRequest, TemplateSpec } from "./TemplateService.ts";

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
const VALID_APP_KINDS = ["nextjs", "tauri", "runtime-proof"] as const;
const VALID_FAMILIES = ["drivers", "foundation", "tooling"] as const;
const VALID_FOUNDATION_KINDS = ["primitive", "modeling", "capability", "ui-system"] as const;
const VALID_TOOLING_KINDS = ["library", "tool", "policy-pack", "test-kit"] as const;
const PACKAGE_NAME_PATTERN = /^[a-z_][a-z0-9._-]*$/;
const PARENT_DIR_PATTERN = /^(?!.*\/\/)(?!.*\/$)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[a-z0-9][a-z0-9/_-]*$/;

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
  SchemaUtils.withCodecStatics
);

const PackageName = S.String.check(S.isPattern(PACKAGE_NAME_PATTERN)).pipe(
  S.brand("PackageName"),
  $I.annoteSchema("PackageName", {
    description: "Package name segment used for @beep scoped package creation.",
  }),
  SchemaUtils.withCodecStatics
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

const NEXTJS_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = [
  TemplateSpec.make({
    templateName: "app-next-tsconfig.json.hbs",
    outputPath: "tsconfig.json",
  }),
  TemplateSpec.make({
    templateName: "app-next-next-env.d.ts.hbs",
    outputPath: "next-env.d.ts",
  }),
  TemplateSpec.make({
    templateName: "app-next-next.config.ts.hbs",
    outputPath: "next.config.ts",
  }),
  TemplateSpec.make({
    templateName: "app-next-src-app-globals.css.hbs",
    outputPath: "src/app/globals.css",
  }),
  TemplateSpec.make({
    templateName: "app-next-src-app-layout.tsx.hbs",
    outputPath: "src/app/layout.tsx",
  }),
  TemplateSpec.make({
    templateName: "app-next-src-app-page.tsx.hbs",
    outputPath: "src/app/page.tsx",
  }),
  TemplateSpec.make({ templateName: "LICENSE.hbs", outputPath: "LICENSE" }),
  TemplateSpec.make({ templateName: "app-real-README.md.hbs", outputPath: "README.md" }),
  TemplateSpec.make({ templateName: "app-real-AGENTS.md.hbs", outputPath: "AGENTS.md" }),
  TemplateSpec.make({
    templateName: "app-next-vitest.config.ts.hbs",
    outputPath: "vitest.config.ts",
  }),
  TemplateSpec.make({
    templateName: "app-next-test-app.test.tsx.hbs",
    outputPath: "test/app.test.tsx",
  }),
];

const TAURI_APP_TEMPLATE_SPECS: ReadonlyArray<TemplateSpec> = [
  TemplateSpec.make({
    templateName: "app-tauri-tsconfig.json.hbs",
    outputPath: "tsconfig.json",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-index.html.hbs",
    outputPath: "index.html",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-App.tsx.hbs",
    outputPath: "src/App.tsx",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-main.tsx.hbs",
    outputPath: "src/main.tsx",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-vite.config.ts.hbs",
    outputPath: "vite.config.ts",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-vitest.config.ts.hbs",
    outputPath: "vitest.config.ts",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-test-App.test.tsx.hbs",
    outputPath: "test/App.test.tsx",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-Cargo.toml.hbs",
    outputPath: "src-tauri/Cargo.toml",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-build.rs.hbs",
    outputPath: "src-tauri/build.rs",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-tauri.conf.json.hbs",
    outputPath: "src-tauri/tauri.conf.json",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-capabilities-default.json.hbs",
    outputPath: "src-tauri/capabilities/default.json",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-src-main.rs.hbs",
    outputPath: "src-tauri/src/main.rs",
  }),
  TemplateSpec.make({
    templateName: "app-tauri-src-tauri-src-lib.rs.hbs",
    outputPath: "src-tauri/src/lib.rs",
  }),
  TemplateSpec.make({ templateName: "LICENSE.hbs", outputPath: "LICENSE" }),
  TemplateSpec.make({ templateName: "app-real-README.md.hbs", outputPath: "README.md" }),
  TemplateSpec.make({ templateName: "app-real-AGENTS.md.hbs", outputPath: "AGENTS.md" }),
];

const packageTemplateSpecsFor = (withStoriesTsconfig: boolean): ReadonlyArray<TemplateSpec> =>
  withStoriesTsconfig
    ? pipe(A.make(PACKAGE_TEMPLATE_SPECS, STORIES_TEMPLATE_SPECS), A.flatten)
    : PACKAGE_TEMPLATE_SPECS;

const templateSpecsFor: (appKind: O.Option<AppKind>, withStoriesTsconfig: boolean) => ReadonlyArray<TemplateSpec> = (
  appKind,
  withStoriesTsconfig
) =>
  pipe(
    appKind,
    O.match({
      onNone: () => packageTemplateSpecsFor(withStoriesTsconfig),
      onSome: (kind) => {
        if (appKindEquivalence(kind, "nextjs")) return NEXTJS_APP_TEMPLATE_SPECS;
        if (appKindEquivalence(kind, "tauri")) return TAURI_APP_TEMPLATE_SPECS;
        return packageTemplateSpecsFor(withStoriesTsconfig);
      },
    })
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
  "src-tauri/src/main.rs",
  "src-tauri/src/lib.rs",
  "LICENSE",
  "README.md",
  "AGENTS.md",
  "CLAUDE.md -> AGENTS.md (symlink)",
] as const;

const packageFilesFor = (withStoriesTsconfig: boolean): ReadonlyArray<string> =>
  withStoriesTsconfig ? pipe(A.make(PACKAGE_FILES, STORIES_TSCONFIG_FILES), A.flatten) : PACKAGE_FILES;

const filesFor: (appKind: O.Option<AppKind>, withStoriesTsconfig: boolean) => ReadonlyArray<string> = (
  appKind,
  withStoriesTsconfig
) =>
  pipe(
    appKind,
    O.match({
      onNone: () => packageFilesFor(withStoriesTsconfig),
      onSome: (kind) => {
        if (appKindEquivalence(kind, "nextjs")) return NEXTJS_APP_FILES;
        if (appKindEquivalence(kind, "tauri")) return TAURI_APP_FILES;
        return packageFilesFor(withStoriesTsconfig);
      },
    })
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
const TAURI_APP_DIRECTORIES = ["src", "test", "src-tauri", "src-tauri/capabilities", "src-tauri/src"] as const;

const packageDirectoriesFor = (withStoriesTsconfig: boolean): ReadonlyArray<string> =>
  withStoriesTsconfig ? pipe(A.make(PACKAGE_DIRECTORIES, STORIES_DIRECTORIES), A.flatten) : PACKAGE_DIRECTORIES;

const directoriesFor: (appKind: O.Option<AppKind>, withStoriesTsconfig: boolean) => ReadonlyArray<string> = (
  appKind,
  withStoriesTsconfig
) =>
  pipe(
    appKind,
    O.match({
      onNone: () => packageDirectoriesFor(withStoriesTsconfig),
      onSome: (kind) => {
        if (appKindEquivalence(kind, "nextjs")) return NEXTJS_APP_DIRECTORIES;
        if (appKindEquivalence(kind, "tauri")) return TAURI_APP_DIRECTORIES;
        return packageDirectoriesFor(withStoriesTsconfig);
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
    isRuntimeProofApp: S.Boolean,
    isRealApp: S.Boolean,
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

const parseJsonDocument: {
  (content: string, filePath: string): Effect.Effect<unknown, DomainError>;
  (filePath: string): (content: string) => Effect.Effect<unknown, DomainError>;
} = dual(
  2,
  Effect.fn(function* (content: string, filePath: string) {
    return yield* S.decodeEffect(S.fromJsonString(S.Unknown))(content).pipe(
      Effect.mapError(DomainError.newCause(`Failed to parse JSON in "${filePath}"`))
    );
  })
);

// fallow-ignore-next-line code-duplication -- converged with TsconfigSync's twin after the tstyche removal; consolidation onto @beep/repo-utils workspaceGlobsFrom/readPackageJsonFile is a recorded quality-speedup follow-up
const readRootPackageJsonDocument = Effect.fn(function* (repoRoot: string) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const filePath = path.join(repoRoot, "package.json");
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError(DomainError.newCause(`Failed to read "${filePath}"`)));
  const parsed = yield* parseJsonDocument(content, filePath);
  const packageJson = yield* decodePackageJsonEffect(parsed).pipe(
    Effect.mapError(DomainError.newCause(`Failed to decode package.json at "${filePath}"`))
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
      Flag.withDescription("App scaffold kind for --type app. Supports: nextjs, tauri, or runtime-proof"),
      Flag.withDefault("")
    ),
    parentDir: Flag.string("parent-dir").pipe(
      Flag.withDescription("Optional output parent directory relative to repo root (e.g. tooling or packages/shared)"),
      Flag.withDefault("")
    ),
    family: Flag.string("family").pipe(
      Flag.withDescription("Optional canonical package family. Supports: drivers, foundation, or tooling"),
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
    dryRun: Flag.boolean("dry-run").pipe(Flag.withDescription("Preview changes without writing files")),
    skipLockfile: Flag.boolean("skip-lockfile").pipe(
      Flag.withDescription("Skip the default bun.lock refresh after package creation")
    ),
    withStoriesTsconfig: Flag.boolean("with-stories-tsconfig").pipe(
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
        message: `--type app requires --app-kind nextjs, tauri, or runtime-proof. Use --app-kind runtime-proof for package-like proof harnesses.`,
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
      const identityRegistrationMissing = yield* identityPackageRegistrationNeeded(
        repoRoot,
        identityPackagesFilePath,
        name
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
        `[dry-run] Directory: ${outputDir}`,
        `[dry-run] Files:`,
        ...A.map(filesFor(appKind, withStoriesTsconfig), (file) => `  - ${file}`),
        `[dry-run] Root bootstrap updates:`,
        `  - package.json workspaces: ${workspaceEntryNeeded ? `Add "${packagePath}"` : "SKIP (already covered by an existing workspace entry)"}`,
        `  - ${identityPackagesFilePath}: ${
          identityRegistrationMissing
            ? `Register "${name}" and export ${toIdentityAccessorName(name)}`
            : "SKIP (already registered)"
        }`,
        `[dry-run] Derived repo configs: shared sync runs after scaffolding to update tsconfig references, aliases, syncpack, and docgen`,
        `[dry-run] Lockfile: ${skipLockfile ? "SKIP (--skip-lockfile)" : "bun install --lockfile-only"}`,
      ]);

      return;
    }

    // ── Build template context ─────────────────────────────────────────
    const currentYear = `${DateTime.getPartUtc(DateTime.nowUnsafe(), "year")}`;
    const ctx = TemplateContext.make({
      name,
      scopedName: `@beep/${name}`,
      type: packageType,
      description,
      year: currentYear,
      parentDir,
      packagePath,
      rootRelative: toRootRelative(packagePath),
      ...O.getSomesStruct({ family: packageFamily, kind: packageKind, appKind }),
      isTool: packageTypeEquivalence(packageType, "tool"),
      isApp: packageTypeEquivalence(packageType, "app"),
      isLibrary: packageTypeEquivalence(packageType, "library"),
      isNextjsApp: appKindIs(appKind, "nextjs"),
      isTauriApp: appKindIs(appKind, "tauri"),
      isRuntimeProofApp: appKindIs(appKind, "runtime-proof"),
      isRealApp: isRealAppKind(appKind),
    });

    // ── Render templates and generate plan ─────────────────────────────
    const templateDir = yield* resolveCreatePackageTemplateDir();
    const templateFiles = yield* templateService.renderTemplates(
      TemplateRenderRequest.make({
        templateDir,
        templates: templateSpecsFor(appKind, withStoriesTsconfig),
        context: { ...ctx },
      })
    );

    const packageMetadata = O.isSome(packageFamily)
      ? O.some<BeepPackageMetadata>({
          family: packageFamily.value,
          ...(O.isSome(packageKind) ? { kind: packageKind.value } : {}),
        })
      : O.none<BeepPackageMetadata>();
    const packageJson = yield* generatePackageJson(
      name,
      packageType,
      description,
      packagePath,
      packageMetadata,
      appKind,
      withStoriesTsconfig
    );

    const plan = fileGenerationPlanService.createPlan(
      FileGenerationPlanInput.make({
        outputDir,
        directories: directoriesFor(appKind, withStoriesTsconfig),
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
            gitkeepFilesFor(appKind)
          ),
          A.flatten
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

    const workspaceUpdated = yield* ensureRootWorkspaceEntry(repoRoot, packagePath);
    const identityUpdated = yield* ensureIdentityPackageRegistration(identityPackagesFilePath, name);
    const syncResult = yield* syncTsconfigAtRoot(repoRoot, {
      mode: "sync",
      filter: undefined,
      verbose: false,
    });
    const lockfileRefreshed = !skipLockfile;
    if (lockfileRefreshed) {
      yield* refreshBunLockfile(repoRoot);
    }

    // ── Print summary ──────────────────────────────────────────────────
    yield* printLines([
      `Created package @beep/${name} at ${outputDir}`,
      `Files created:`,
      ...A.map(filesFor(appKind, withStoriesTsconfig), (file) => `  - ${file}`),
    ]);
    if (workspaceUpdated || identityUpdated || syncResult.changedFiles > 0 || lockfileRefreshed || skipLockfile) {
      yield* Console.log(`\nRepo registration and config sync:`);
      if (workspaceUpdated) {
        yield* Console.log(`  - package.json: added workspace "${packagePath}"`);
      }
      if (identityUpdated) {
        yield* Console.log(`  - ${identityPackagesFilePath}: registered "${name}" as ${toIdentityAccessorName(name)}`);
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
    const nextSteps = appKindIs(appKind, "nextjs")
      ? [
          'Run "bun install" to link the new app',
          'Run "bun run dev" from the app workspace',
          "Start building in src/app/page.tsx",
        ]
      : appKindIs(appKind, "tauri")
        ? [
            'Run "bun install" to link the new app',
            'Run "bun run dev" for the web shell or "bun run dev:tauri" for Tauri',
            "Start building in src/App.tsx",
          ]
        : ['Run "bun install" to link the new package', "Start building in src/index.ts"];

    yield* printLines([`\nNext steps:`, ...A.map(nextSteps, (step, index) => `  ${index + 1}. ${step}`)]);
  })
).pipe(Command.withDescription("Create a new package or app workspace following Effect v4 conventions"));

// ── Template generators ────────────────────────────────────────────────────

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
 * @param appKind - Optional app scaffold kind. Real app kinds generate framework manifests without package exports.
 * @param withStoriesTsconfig - Whether to add package-local Storybook story typechecking scripts.
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
  appKind: O.Option<AppKind>,
  withStoriesTsconfig: boolean
) => Effect.Effect<string, DomainError | S.SchemaError> = Effect.fn(
  function* (name, type, description, packagePath, packageMetadata, appKind, withStoriesTsconfig) {
    const rootRelative = toRootRelative(packagePath);
    const babelScript = "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps";
    const baseManifest = {
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
    };

    if (appKindIs(appKind, "nextjs")) {
      const pkg = {
        ...baseManifest,
        scripts: {
          audit: "bun run --if-present beep:audit",
          codegen: "echo 'no codegen needed'",
          dev: `portless ${name}.beep next dev --turbopack`,
          "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
          "beep:build": "next build --turbopack",
          start: "next start",
          "beep:check": "tsgo -b tsconfig.json",
          "beep:lint": "biome check .",
          "beep:lint:fix": "biome check . --write",
          "beep:test": "bunx --bun vitest run",
          build: "bun run beep:build",
          check: "bun run beep:check",
          coverage: "bunx vitest run --coverage",
          lint: "bun run beep:lint",
          "lint:fix": "bun run beep:lint:fix",
          test: "bun run beep:test",
        },
        dependencies: {
          next: "catalog:",
          react: "catalog:",
          "react-dom": "catalog:",
        },
        devDependencies: {
          "@effect/vitest": "catalog:",
          "@testing-library/dom": "catalog:",
          "@testing-library/react": "catalog:",
          "@types/node": "catalog:",
          "@types/react": "catalog:",
          "@types/react-dom": "catalog:",
          jsdom: "catalog:",
          typescript: "catalog:",
        },
      };

      const json = yield* encodePackageJsonCanonicalPrettyEffect(pkg);
      return `${json}\n`;
    }

    if (appKindIs(appKind, "tauri")) {
      const pkg = {
        ...baseManifest,
        scripts: {
          audit: "bun run --if-present beep:audit",
          codegen: "echo 'no codegen needed'",
          dev: `portless ${name}.beep sh -c 'vite --host 127.0.0.1 --port "\${PORT:-1420}" --strictPort'`,
          "dev:tauri": "tauri dev",
          "beep:audit": "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
          "beep:build": "vite build",
          "beep:check": "tsgo -b tsconfig.json",
          "beep:lint": "biome check .",
          "beep:lint:fix": "biome check . --write",
          "beep:test": "bunx --bun vitest run",
          build: "bun run beep:build",
          check: "bun run beep:check",
          coverage: "bunx vitest run --coverage",
          lint: "bun run beep:lint",
          "lint:fix": "bun run beep:lint:fix",
          test: "bun run beep:test",
        },
        dependencies: {
          "@tauri-apps/api": "catalog:",
          react: "catalog:",
          "react-dom": "catalog:",
        },
        devDependencies: {
          "@effect/vitest": "catalog:",
          "@tauri-apps/cli": "catalog:",
          "@testing-library/dom": "catalog:",
          "@testing-library/react": "catalog:",
          "@types/node": "catalog:",
          "@types/react": "catalog:",
          "@types/react-dom": "catalog:",
          "@vitejs/plugin-react": "catalog:",
          jsdom: "catalog:",
          typescript: "catalog:",
          vite: "catalog:",
        },
      };

      const json = yield* encodePackageJsonCanonicalPrettyEffect(pkg);
      return `${json}\n`;
    }

    const dependencies: Record<string, string> = {
      effect: "catalog:",
    };

    if (packageTypeEquivalence(type, "tool")) {
      dependencies["@effect/platform-node"] = "catalog:";
    }

    const checkScript = withStoriesTsconfig
      ? "tsgo -b tsconfig.json && bun run beep:check:tests && bun run beep:check:stories"
      : "tsgo -b tsconfig.json && bun run beep:check:tests";
    const storyCheckScripts = withStoriesTsconfig
      ? {
          "beep:check:stories": "tsc -p tsconfig.stories.json --noEmit",
        }
      : {};

    const pkg = {
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
      scripts: {
        audit: "bun run --if-present beep:audit",
        babel: babelScript,
        "beep:audit":
          "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run beep:lint",
        "beep:build": "tsc -b tsconfig.json && bun run babel",
        "beep:check": checkScript,
        "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
        ...storyCheckScripts,
        "beep:lint": "biome check .",
        "beep:lint:fix": "biome check . --write",
        "beep:test": "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
        "beep:test:integration": "bunx --bun vitest run test/integration --passWithNoTests",
        build: "bun run beep:build",
        check: "bun run beep:check",
        coverage: "bunx vitest run --coverage --exclude=test/integration/**",
        docgen: `bun run ${rootRelative}packages/tooling/tool/docgen/src/bin.ts`,
        lint: "bun run beep:lint",
        "lint:fix": "bun run beep:lint:fix",
        test: "bun run beep:test",
        "test:integration": "bun run beep:test:integration",
      },
      dependencies,
      devDependencies: {
        "@types/node": "catalog:",
        "@effect/vitest": "catalog:",
      },
    };

    const json = yield* encodePackageJsonCanonicalPrettyEffect(pkg);
    return `${json}\n`;
  }
);
