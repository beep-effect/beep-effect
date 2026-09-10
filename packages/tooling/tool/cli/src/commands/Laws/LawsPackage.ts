/**
 * Single-project package law worker.
 * @packageDocumentation
 * @since 0.0.0
 */
import { FsUtils } from "@beep/repo-utils/FsUtils";
import { TSMorphService, TsMorphProjectInspectionRequest } from "@beep/repo-utils/TSMorph/index";
import { normalizePath } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { inspectPackageTestImports } from "../Lint/PackageTestImports.ts";
import { EffectFnRulesOptions, runEffectFnRules } from "./EffectFn.ts";
import { FrozenGrantSetRulesOptions, runFrozenGrantSetRules } from "./FrozenGrantSet.ts";
import { LawScanProject } from "./internal/LawScan.ts";
import { LawsPackageFinding, LawsPackageLaw, LawsPackageReport, LawsPackageScope } from "./LawsPackage.model.ts";
import { NoNativeRuntimeRulesOptions, runNoNativeRuntimeRules } from "./NoNativeRuntime.ts";
import { runTerseEffectRules, TerseEffectRulesOptions } from "./TerseEffect.ts";

/**
 * Resolve a package's law inventory and explicit syntax overlay.
 *
 * **Details**
 * Prefers tsconfig.test.json. Packages without that overlay use their own
 * tsconfig.json for compiler options; file loading still uses the explicitly
 * discovered package surface, with config preload and dependency loading disabled.
 *
 * **Example** (Resolve package scope)
 * ```ts
 * import { resolveLawsPackageScope } from "@beep/repo-cli/commands/Laws/LawsPackage"
 * console.log(resolveLawsPackageScope("/repo", "packages/demo"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const resolveLawsPackageScope = Effect.fn("LawsPackage.resolveScope")(function* (
  repoRoot: string,
  packageDir: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const testOverlay = path.join(packageDir, "tsconfig.test.json");
  const overlayPath = (yield* fs.exists(path.join(repoRoot, testOverlay)))
    ? testOverlay
    : path.join(packageDir, "tsconfig.json");
  return LawsPackageScope.make({
    repoRoot,
    packageDir,
    overlayPath,
    laws: Str.startsWith("packages/")(packageDir)
      ? LawsPackageLaw.Options
      : LawsPackageLaw.omitOptions(["package-test-imports"]),
  });
});

/**
 * Run all package laws against one syntax project without loading dependency sources.
 *
 * **Example** (Compose a package scan)
 * ```ts
 * import { Effect } from "effect"
 * import { resolveLawsPackageScope, scanLawsPackage } from "@beep/repo-cli/commands/Laws/LawsPackage"
 * console.log(resolveLawsPackageScope("/repo", "packages/demo").pipe(Effect.flatMap(scanLawsPackage)))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const scanLawsPackage = Effect.fn("LawsPackage.scan")(function* (scope: LawsPackageScope) {
  const fsUtils = yield* FsUtils;
  const path = yield* Path.Path;
  const service = yield* TSMorphService;
  const files = A.sort(
    yield* fsUtils.globFiles([`${scope.packageDir}/**/*.{ts,tsx}`], {
      cwd: scope.repoRoot,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.turbo/**",
        "**/coverage/**",
        "**/*.d.ts",
        "**/*.d.tsx",
      ],
    }),
    Order.String
  );
  if (A.isReadonlyArrayEmpty(files)) {
    yield* Console.log(`lint laws: skipping four laws for ${scope.packageDir}; no TypeScript source files.`);
    const findings = A.empty<LawsPackageFinding>();
    if (A.contains(scope.laws, "package-test-imports")) {
      yield* inspectPackageTestImports(scope.repoRoot, []);
      return LawsPackageReport.make({
        projectSourceFileCount: 0,
        findings: [
          LawsPackageFinding.make({
            law: "package-test-imports",
            findingCount: 0,
            advisory: false,
            strictFailure: false,
            diagnostics: [],
          }),
        ],
      });
    }
    return LawsPackageReport.make({ projectSourceFileCount: 0, findings });
  }
  const request = yield* TsMorphProjectInspectionRequest.packageSyntax(
    scope.repoRoot,
    scope.overlayPath,
    A.map(files, (file) => path.join(scope.repoRoot, file))
  );
  const context = yield* service.inspectProject(request, (context) => context);
  const program = Effect.gen(function* () {
    let findings = A.empty<LawsPackageFinding>();
    for (const law of scope.laws) {
      const finding = yield* LawsPackageLaw.$match({
        "terse-effect": () =>
          runTerseEffectRules(TerseEffectRulesOptions.make({ includePaths: files })).pipe(
            Effect.map((result) =>
              LawsPackageFinding.make({
                law,
                findingCount: result.blockingFindings.length,
                advisory: true,
                strictFailure: false,
                diagnostics: result.blockingFindings,
              })
            )
          ),
        "native-runtime": () =>
          runNoNativeRuntimeRules(NoNativeRuntimeRulesOptions.make({ strictCheck: true, includePaths: files })).pipe(
            Effect.map((result) =>
              LawsPackageFinding.make({
                law,
                findingCount: result.diagnostics.length,
                advisory: false,
                strictFailure: result.strictFailure,
                diagnostics: A.map(
                  result.diagnostics,
                  (d) => `[${d.severity}] ${d.file}:${d.line}:${d.column} ${d.message}`
                ),
              })
            )
          ),
        "frozen-grant-set": () =>
          runFrozenGrantSetRules(FrozenGrantSetRulesOptions.make({ strictCheck: true, includePaths: files })).pipe(
            Effect.map((result) =>
              LawsPackageFinding.make({
                law,
                findingCount: result.violationCount,
                advisory: false,
                strictFailure: result.strictFailure,
                diagnostics: A.map(result.diagnostics, (d) => `${d.file}:${d.line}:${d.column} ${d.message}`),
              })
            )
          ),
        "effect-fn": () =>
          runEffectFnRules(EffectFnRulesOptions.make({ strictCheck: true, includePaths: files })).pipe(
            Effect.map((result) =>
              LawsPackageFinding.make({
                law,
                findingCount: result.violationCount,
                advisory: false,
                strictFailure: result.strictFailure,
                diagnostics: A.map(result.diagnostics, (d) => `${d.file}:${d.line}:${d.column} ${d.message}`),
              })
            )
          ),
        "package-test-imports": () =>
          inspectPackageTestImports(scope.repoRoot, context.sourceFiles).pipe(
            Effect.map((result) =>
              LawsPackageFinding.make({
                law,
                findingCount: result.length,
                advisory: false,
                strictFailure: A.isReadonlyArrayNonEmpty(result),
                diagnostics: A.map(
                  result,
                  (d) =>
                    `${normalizePath(path.relative(scope.repoRoot, d.file))}:${d.line} ${d.specifier} -> ${d.replacement}`
                ),
              })
            )
          ),
      })(law);
      findings = A.append(findings, finding);
    }
    return LawsPackageReport.make({ projectSourceFileCount: context.project.getSourceFiles().length, findings });
  });
  return yield* program.pipe(
    Effect.provideService(LawScanProject, { project: context.project, repoRoot: scope.repoRoot })
  );
});
