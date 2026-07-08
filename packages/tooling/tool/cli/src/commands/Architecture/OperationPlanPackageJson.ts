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
import type { ArchitecturePackageRole, WritePackageJsonOperation } from "./Architecture.schemas.js";

const packageExportEntrypointFor = (
  role: ArchitecturePackageRole,
  subpath: string,
  outDir: "src" | "dist",
  extension: "ts" | "js"
): string => {
  const strippedSubpath = Str.replace("./", "")(subpath);

  if (subpath === ".") return `./${outDir}/index.${extension}`;
  if (subpath === "./layer" && role === "server") return `./${outDir}/Layer.${extension}`;
  if (Str.endsWith("/*")(subpath)) {
    return `./${outDir}/${Str.replace("/*", `/*/index.${extension}`)(strippedSubpath)}`;
  }
  if (
    role === "domain" &&
    (subpath === "./aggregates" || subpath === "./entities" || subpath === "./identity" || subpath === "./values")
  ) {
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
 * @internal
 * @example
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
      audit: "bun run --if-present beep:audit",
      babel: "babel dist --plugins annotate-pure-calls --out-dir dist --source-maps",
      "beep:audit":
        "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run beep:lint",
      "beep:build": "tsc -b tsconfig.json && bun run babel",
      "beep:check": "tsgo -b tsconfig.json && bun run beep:check:tests",
      "beep:check:tests": "tsgo -p tsconfig.test.json --noEmit",
      "beep:lint": "biome check .",
      "beep:lint:fix": "biome check . --write",
      "beep:test": "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
      "beep:test:integration": "bunx --bun vitest run test/integration --passWithNoTests",
      build: "bun run beep:build",
      check: "bun run beep:check",
      coverage: "bunx vitest run --coverage --exclude=test/integration/**",
      docgen: "bun run ../../../packages/tooling/tool/docgen/src/bin.ts",
      lint: "bun run beep:lint",
      "lint:fix": "bun run beep:lint:fix",
      test: "bun run beep:test",
      "test:integration": "bun run beep:test:integration",
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
