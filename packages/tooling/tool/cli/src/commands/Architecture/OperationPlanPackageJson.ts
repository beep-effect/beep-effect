/**
 * Architecture operation-plan package manifest rendering.
 *
 * @packageDocumentation
 * @category cli-commands
 * @since 0.0.0
 */

import { scaffoldPackageScripts } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas";
import { DomainError, encodePackageJsonCanonicalPrettyEffect, jsonStringifyPretty } from "@beep/repo-utils";
import { A, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { CreatePackageScripts } from "../CreatePackage/CreatePackage.command.ts";
import { ArchitectureContextRole } from "./Architecture.schemas.ts";
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

const isContextRole = S.is(ArchitectureContextRole);

const exactExportMapFor = (
  exports: ReadonlyArray<string>,
  outDir: "src" | "dist",
  extension: "ts" | "js"
): R.ReadonlyRecord<string, string> =>
  pipe(
    exports,
    A.map((subpath) => [subpath, `./${outDir}/${Str.replace("./", "")(subpath)}.${extension}`] as const),
    (entries) => [...entries, ["./package.json", "./package.json"] as const],
    R.fromEntries
  );

const renderLegacyPackageJson = (operation: WritePackageJsonOperation, role: ArchitecturePackageRole) =>
  jsonStringifyPretty({
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
      "beep:check:tests": "tsrs -p tsconfig.test.json --noEmit",
      coverage: "bunx vitest run --coverage --exclude=test/integration/**",
    },
    exports: packageExportMapFor(role, operation.exports, false),
    files: ["src/**/*.ts", "dist/**/*.js", "dist/**/*.js.map", "dist/**/*.d.ts", "dist/**/*.d.ts.map"],
    sideEffects: [],
    publishConfig: {
      access: "public",
      provenance: true,
      exports: packageExportMapFor(role, operation.exports, true),
    },
    dependencies: operation.dependencies,
    devDependencies: operation.devDependencies,
  });

const renderContextPackageJson = (operation: WritePackageJsonOperation) =>
  encodePackageJsonCanonicalPrettyEffect({
    name: operation.packageName,
    version: "0.0.0",
    type: "module",
    private: true,
    license: "MIT",
    description: operation.packageDescription,
    homepage: `https://github.com/beep-effect/beep-effect/tree/main/${operation.repositoryDirectory}`,
    repository: {
      type: "git",
      url: "git@github.com:beep-effect/beep-effect.git",
      directory: operation.repositoryDirectory,
    },
    sideEffects: [],
    exports: exactExportMapFor(operation.exports, "src", "ts"),
    files: ["src/**/*.ts", "dist/**/*.js", "dist/**/*.js.map", "dist/**/*.d.ts", "dist/**/*.d.ts.map"],
    publishConfig: {
      access: "public",
      provenance: true,
      exports: exactExportMapFor(operation.exports, "dist", "js"),
    },
    scripts: CreatePackageScripts.package("library", false),
    dependencies: operation.dependencies,
    devDependencies: operation.devDependencies,
  }).pipe(
    Effect.mapBoth({
      onSuccess: (json) => `${json}\n`,
      onFailure: DomainError.newCause(`Failed to render the "${operation.packageName}" package manifest`),
    })
  );

/**
 * Render a structured package manifest operation.
 *
 * **Details**
 *
 * A model-first role (`contract`, `model`, `host`, `web`) renders the manifest
 * `beep create-package` emits for a library, with exact exports; a legacy
 * role keeps the legacy shell manifest.
 *
 * **Example** (Render a domain package manifest)
 *
 * ```ts
 * import { renderPackageJsonOperation, WritePackageJsonOperation } from "@beep/repo-cli/commands/Architecture"
 * import * as Effect from "effect/Effect";
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
  const role = operation.role;
  return isContextRole(role)
    ? yield* renderContextPackageJson(operation)
    : yield* renderLegacyPackageJson(operation, role);
});
