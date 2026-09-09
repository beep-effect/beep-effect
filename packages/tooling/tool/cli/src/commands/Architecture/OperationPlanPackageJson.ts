/**
 * Architecture operation-plan package manifest rendering.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { jsonStringifyPretty } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as R from "effect/Record";
import { scaffoldPackageScripts } from "../../internal/package-scripts/PackageScripts.schemas.ts";
import type { ArchitecturePackageRole, WritePackageJsonOperation } from "./Architecture.schemas.ts";

const isRootExportSubpath = (subpath: string): boolean => subpath === ".";
const isServerLayerExportSubpath = (role: ArchitecturePackageRole, subpath: string): boolean =>
  role === "server" && subpath === "./layer";
const isWildcardExportSubpath = Str.endsWith("/*");
const domainDirectoryExportSubpaths = A.make("./aggregates", "./entities", "./identity", "./values");
const isDomainDirectoryExportSubpath = (role: ArchitecturePackageRole, subpath: string): boolean =>
  role === "domain" && A.some(domainDirectoryExportSubpaths, (candidate) => candidate === subpath);

const packageExportEntrypointFor = (
  role: ArchitecturePackageRole,
  subpath: string,
  outDir: "src" | "dist",
  extension: "ts" | "js"
): string => {
  const strippedSubpath = Str.replace("./", "")(subpath);

  if (isRootExportSubpath(subpath)) return `./${outDir}/index.${extension}`;
  if (isServerLayerExportSubpath(role, subpath)) return `./${outDir}/Layer.${extension}`;
  if (isWildcardExportSubpath(subpath)) {
    return `./${outDir}/${Str.replace("/*", `/*/index.${extension}`)(strippedSubpath)}`;
  }
  if (isDomainDirectoryExportSubpath(role, subpath)) {
    return `./${outDir}/${strippedSubpath}/index.${extension}`;
  }
  return `./${outDir}/${strippedSubpath}.${extension}`;
};

const packageExportMapFor = (
  role: ArchitecturePackageRole,
  exports: ReadonlyArray<string>,
  publish: boolean
): R.ReadonlyRecord<string, string | null> =>
  pipe(
    exports,
    A.map(
      (subpath) =>
        [
          subpath,
          publish
            ? packageExportEntrypointFor(role, subpath, "dist", "js")
            : packageExportEntrypointFor(role, subpath, "src", "ts"),
        ] as const
    ),
    (entries) => [...entries, ["./internal/*", null] as const, ["./package.json", "./package.json"] as const],
    R.fromEntries
  );

/**
 * Render a structured package manifest operation.
 *
 * **Example** (Render a domain package manifest)
 *
 * ```ts
 * import { renderPackageJsonOperation, WritePackageJsonOperation } from "@beep/repo-cli/commands/Architecture"
 * import { Effect } from "effect"
 *
 * const operation = WritePackageJsonOperation.make({
 *   kind: "write-package-json",
 *   role: "domain",
 *   path: "packages/research-lab/domain/package.json",
 *   packageName: "@beep/research-lab-domain",
 *   packageDescription: "Research lab domain package.",
 *   repositoryDirectory: "packages/research-lab/domain",
 *   exports: ["."],
 *   dependencies: {},
 *   devDependencies: {},
 *   description: "Write the research-lab domain package manifest.",
 * })
 *
 * const manifestText = Effect.runSync(renderPackageJsonOperation(operation))
 * console.log(manifestText.includes("@beep/research-lab-domain"))
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const renderPackageJsonOperation = Effect.fn(function* (operation: WritePackageJsonOperation) {
  return yield* jsonStringifyPretty({
    name: operation.packageName,
    version: "0.0.0",
    description: operation.packageDescription,
    license: "MIT",
    private: true,
    type: "module",
    homepage: `https://github.com/beep-effect/beep-effect/tree/main/${operation.repositoryDirectory}`,
    repository: {
      type: "git",
      url: "git@github.com:beep-effect/beep-effect.git",
      directory: operation.repositoryDirectory,
    },
    scripts: {
      ...scaffoldPackageScripts("library", ["lint:fix", "test:integration"]),
      babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
      "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
      "beep:policy": `bun --cwd ${pipe(
        operation.repositoryDirectory,
        Str.split("/"),
        A.map(() => "../"),
        A.join("")
      )} run beep lint package-test-imports --include-root ${operation.repositoryDirectory}`,
      coverage: "bunx vitest run --coverage --exclude=test/integration/**",
    },
    exports: packageExportMapFor(operation.role, operation.exports, false),
    files: ["src/**/*.ts", "dist/**/*.js", "dist/**/*.js.map", "dist/**/*.d.ts", "dist/**/*.d.ts.map"],
    sideEffects: [],
    publishConfig: {
      access: "public",
      provenance: true,
      exports: packageExportMapFor(operation.role, operation.exports, true),
    },
    dependencies: operation.dependencies,
    devDependencies: operation.devDependencies,
  });
});
