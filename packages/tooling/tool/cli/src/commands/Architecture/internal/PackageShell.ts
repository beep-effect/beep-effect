/**
 * Architecture package-shell operation builders.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { identity } from "effect";
import { dual } from "effect/Function";
import {
  ArchitecturePackageRole,
  ArchitecturePlanTarget,
  ArchitectureSliceRolePlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "../Architecture.schemas.ts";
import { packageNameForRole, pathForRole } from "./RoleTopology.ts";
import type * as R from "effect/Record";

/**
 * Builds the synthetic target used for shell-only package plans.
 *
 * **Example** (Build an architecture package shell)
 *
 * ```ts
 * import { packageShellTargetFor } from "@beep/repo-cli/commands/Architecture/internal/PackageShell"
 *
 * console.log(packageShellTargetFor("research-lab").concept) // "PackageShell"
 * ```
 *
 * @param boundedContext - Slug of the slice the shell package belongs to.
 * @returns A synthetic plan target pinned to the `PackageShell` concept.
 * @category constructors
 * @since 0.0.0
 */
export const packageShellTargetFor = (boundedContext: string): ArchitecturePlanTarget =>
  ArchitecturePlanTarget.make({
    boundedContext,
    concept: "PackageShell",
    conceptPath: "aggregates/PackageShell",
    domainKind: "aggregates",
    stage: "core",
  });

const packageShellExportsForRole = ArchitecturePackageRole.$match({
  domain: () => [".", "./aggregates", "./entities", "./identity", "./values"],
  "use-cases": () => [".", "./public", "./server"],
  config: () => [".", "./public", "./server", "./secrets", "./layer", "./test"],
  server: () => [".", "./layer", "./test"],
  tables: () => [".", "./tables"],
  client: () => ["."],
  ui: () => ["."],
});

/**
 * Builds role metadata for a shell-only package plan.
 *
 * **Example** (Build an architecture package shell)
 *
 * ```ts
 * import { packageShellRolePlanFor, packageShellTargetFor } from "@beep/repo-cli/commands/Architecture/internal/PackageShell"
 *
 * const target = packageShellTargetFor("research-lab")
 * console.log(packageShellRolePlanFor(target, "domain").path)
 * ```
 *
 * @param target - Plan target describing the slice being scaffolded.
 * @param role - Package role whose name, path, and exports are resolved.
 * @returns Role plan metadata for files created by the shell-only package.
 * @category constructors
 * @since 0.0.0
 */
export const packageShellRolePlanFor: {
  (role: ArchitecturePackageRole): (target: ArchitecturePlanTarget) => ArchitectureSliceRolePlan;
  (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): ArchitectureSliceRolePlan;
} = dual(
  2,
  (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): ArchitectureSliceRolePlan =>
    ArchitectureSliceRolePlan.make({
      role,
      packageName: packageNameForRole(target, role),
      path: pathForRole(target, role),
      exports: packageShellExportsForRole(role),
    })
);

const packageShellDescriptionForRole = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => {
  const contextLabel = Str.replaceAll("-", " ")(Str.kebabCase(target.boundedContext));
  if (role === "domain") return `${contextLabel} domain package.`;
  if (role === "use-cases") return `${contextLabel} use-case contract package.`;
  if (role === "config") return `${contextLabel} typed configuration package.`;
  if (role === "server") return `${contextLabel} server adapter package.`;
  if (role === "tables") return `${contextLabel} table declaration package.`;
  if (role === "client") return `${contextLabel} client adapter package.`;
  return `${contextLabel} UI package.`;
};

const packageShellDependenciesForRole = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): R.ReadonlyRecord<string, string> => {
  if (role === "domain") {
    return {
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      "@beep/shared-domain": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "use-cases") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "config") {
    return {
      "@beep/identity": "workspace:^",
      "@beep/schema": "workspace:^",
      effect: "catalog:",
    };
  }
  if (role === "server") {
    return {
      [`@beep/${target.boundedContext}-config`]: "workspace:^",
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      [`@beep/${target.boundedContext}-tables`]: "workspace:^",
      [`@beep/${target.boundedContext}-use-cases`]: "workspace:^",
      "@beep/identity": "workspace:^",
      "@beep/postgres": "workspace:^",
      "@beep/schema": "workspace:^",
      "drizzle-orm": "catalog:",
      effect: "catalog:",
    };
  }
  if (role === "tables") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      "@beep/drizzle": "workspace:^",
      "drizzle-orm": "catalog:",
      effect: "catalog:",
    };
  }
  if (role === "client") {
    return {
      [`@beep/${target.boundedContext}-domain`]: "workspace:^",
      [`@beep/${target.boundedContext}-use-cases`]: "workspace:^",
      "@beep/identity": "workspace:^",
      effect: "catalog:",
    };
  }
  return {
    [`@beep/${target.boundedContext}-config`]: "workspace:^",
    [`@beep/${target.boundedContext}-domain`]: "workspace:^",
    "@beep/identity": "workspace:^",
    "@beep/schema": "workspace:^",
    "@beep/utils": "workspace:^",
    effect: "catalog:",
  };
};

const packageShellDevDependenciesForRole = (role: ArchitecturePackageRole): R.ReadonlyRecord<string, string> =>
  role === "server"
    ? {
        "@beep/test-utils": "workspace:^",
        "@effect/vitest": "catalog:",
        "@types/node": "catalog:",
      }
    : {
        "@effect/vitest": "catalog:",
        "@types/node": "catalog:",
      };

/**
 * Builds the package.json operation for a shell-only role package.
 *
 * **Example** (Build an architecture package shell)
 *
 * ```ts
 * import { packageShellTargetFor, shellPackageJsonOperationFor } from "@beep/repo-cli/commands/Architecture/internal/PackageShell"
 *
 * const operation = shellPackageJsonOperationFor(packageShellTargetFor("research-lab"), "domain")
 * console.log(operation.packageName)
 * ```
 *
 * @param target - Plan target describing the slice being scaffolded.
 * @param role - Package role whose manifest fields are derived.
 * @returns A write-package-json operation for the shell role package.
 * @category constructors
 * @since 0.0.0
 */
export const shellPackageJsonOperationFor: {
  (role: ArchitecturePackageRole): (target: ArchitecturePlanTarget) => WritePackageJsonOperation;
  (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): WritePackageJsonOperation;
} = dual(
  2,
  (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): WritePackageJsonOperation =>
    WritePackageJsonOperation.make({
      kind: "write-package-json",
      role,
      path: `${pathForRole(target, role)}/package.json`,
      packageName: packageNameForRole(target, role),
      packageDescription: packageShellDescriptionForRole(target, role),
      repositoryDirectory: pathForRole(target, role),
      exports: packageShellExportsForRole(role),
      dependencies: packageShellDependenciesForRole(target, role),
      devDependencies: packageShellDevDependenciesForRole(role),
      description: `Write structured ${role} package manifest for ${target.boundedContext}.`,
    })
);

const packageShellAgentsContent = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): string => `# ${packageNameForRole(target, role)} Agent Notes

- This package is the \`${role}\` role package for the \`${target.boundedContext}\` slice.
- Keep package-level wiring here and add concept-qualified modules through \`beep architecture add concept\` or \`beep architecture add role\`.
`;

const packageShellReadmeContent = (
  target: ArchitecturePlanTarget,
  role: ArchitecturePackageRole
): string => `# ${packageNameForRole(target, role)}

Shell-only ${role} package for the \`${target.boundedContext}\` slice.

Use \`beep architecture add concept\` or \`beep architecture add role\` to add concept-qualified modules.
`;

const packageShellDocgenContent = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => `{
  "$schema": "../../../packages/tooling/tool/docgen/schema.json",
  "exclude": ["src/internal/**/*.ts"],
  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/packages/${target.boundedContext}/${role}/src/"
}
`;

const packageShellTsconfigContent = (): string => `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../tsconfig.base.json",
  "include": ["src"],
  "compilerOptions": {
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src"
  }
}
`;

const packageShellTestTsconfigContent = (): string => `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "../../../tsconfig.base.json",
  "include": ["src", "test"],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "outDir": "dist-test",
    "rootDir": ".",
    "sourceMap": false,
    "types": ["node", "bun-types"]
  }
}
`;

const packageShellCheckTsconfigContent = (): string => `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "rootDir": "../../.."
  }
}
`;

const packageShellVitestContent = (): string => `import { defineConfig, mergeConfig } from "vitest/config";
import shared from "../../../vitest.shared.ts";

export default mergeConfig(
  shared,
  defineConfig({
    test: {
      // Package-specific overrides
    },
  })
);
`;

const categoryForRole = ArchitecturePackageRole.$match({
  domain: () => "aggregates",
  "use-cases": identity,
  config: () => "configuration",
  server: () => "handlers",
  tables: identity,
  client: () => "clients",
  ui: () => "models",
});

const extraExportForRole = ArchitecturePackageRole.$match({
  domain: () =>
    '\n/**\n * Aggregate namespace exports.\n *\n * @category aggregates\n * @since 0.0.0\n */\nexport * as Aggregates from "./aggregates/index.ts";\n/**\n * Entity namespace exports.\n *\n * @category entities\n * @since 0.0.0\n */\nexport * as Entities from "./entities/index.ts";\n/**\n * Identity namespace exports.\n *\n * @category entity-ids\n * @since 0.0.0\n */\nexport * as Identity from "./identity/index.ts";\n/**\n * Value-object namespace exports.\n *\n * @category value-objects\n * @since 0.0.0\n */\nexport * as Values from "./values/index.ts";\n',
  "use-cases": () =>
    '\n/**\n * Public use-case exports.\n *\n * @category use-cases\n * @since 0.0.0\n */\nexport * from "./public.ts";\n',
  config: () =>
    '\n/**\n * Browser-safe public configuration exports.\n *\n * @category configuration\n * @since 0.0.0\n */\nexport * from "./public.ts";\n',
  server: () =>
    '\n/**\n * Server layer exports.\n *\n * @category layers\n * @since 0.0.0\n */\nexport * from "./Layer.ts";\n',
  tables: () =>
    '\n/**\n * Table collection exports.\n *\n * @category tables\n * @since 0.0.0\n */\nexport * from "./tables.ts";\n',
  client: () => "",
  ui: () => "",
});

const packageShellIndexContent = (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): string => {
  const packageName = packageNameForRole(target, role);
  const category = categoryForRole(role);
  const extraExport = extraExportForRole(role);

  return `/**
 * Package entry point for \`${packageName}\`.
 *
 * @packageDocumentation
 * @category ${category}
 * @since 0.0.0
 */

/**
 * Package version for \`${packageName}\`.
 *
 * @category ${category}
 * @since 0.0.0
 */
export const VERSION = "0.0.0" as const;
${extraExport}`;
};

const packageShellEmptyModuleContent = (title: string, category: string): string => `/**
 * ${title}.
 *
 * @packageDocumentation
 * @category ${category}
 * @since 0.0.0
 */

export {};
`;

const packageShellLayerContent = (target: ArchitecturePlanTarget, role: "config" | "server"): string => {
  const contextPascal = Str.pascalCase(target.boundedContext);
  const exportName = role === "server" ? `${contextPascal}ServerLive` : `${contextPascal}ConfigLive`;
  return `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} ${role} layer.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import * as Layer from "effect/Layer";

/**
 * Shell ${role} layer for the ${target.boundedContext} slice.
 *
 * @category layers
 * @since 0.0.0
 */
export const ${exportName} = Layer.empty;
`;
};

const packageShellTestLayerContent = (target: ArchitecturePlanTarget, role: "config" | "server"): string => {
  const contextPascal = Str.pascalCase(target.boundedContext);
  const exportName = role === "server" ? `${contextPascal}ServerTest` : `${contextPascal}ConfigTest`;
  return `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} ${role} test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import * as Layer from "effect/Layer";

/**
 * Shell ${role} test layer for the ${target.boundedContext} slice.
 *
 * @category testing
 * @since 0.0.0
 */
export const ${exportName} = Layer.empty;
`;
};

const packageShellTablesContent = (target: ArchitecturePlanTarget): string => `/**
 * ${Str.replaceAll("-", " ")(target.boundedContext)} table collection.
 *
 * @packageDocumentation
 * @category tables
 * @since 0.0.0
 */

/**
 * Empty shell Drizzle schema for the ${target.boundedContext} slice.
 *
 * @category tables
 * @since 0.0.0
 */
export const DbSchema = {};

/**
 * Empty shell Drizzle schema type.
 *
 * @category tables
 * @since 0.0.0
 */
export type DbSchema = typeof DbSchema;
`;

/**
 * Builds file operations for a shell-only role package.
 *
 * **Example** (Build an architecture package shell)
 *
 * ```ts
 * import { packageShellFileOperationsFor, packageShellTargetFor } from "@beep/repo-cli/commands/Architecture/internal/PackageShell"
 *
 * const operations = packageShellFileOperationsFor(packageShellTargetFor("research-lab"), "domain")
 * console.log(operations.some((operation) => operation.path.endsWith("src/index.ts")))
 * ```
 *
 * @param target - Plan target describing the slice being scaffolded.
 * @param role - Package role whose file set is emitted.
 * @returns The ordered write-file operations that materialize the role package.
 * @category constructors
 * @since 0.0.0
 */
export const packageShellFileOperationsFor: {
  (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): ReadonlyArray<WriteFileOperation>;
  (role: ArchitecturePackageRole): (target: ArchitecturePlanTarget) => ReadonlyArray<WriteFileOperation>;
} = dual(2, (target: ArchitecturePlanTarget, role: ArchitecturePackageRole): ReadonlyArray<WriteFileOperation> => {
  const basePath = pathForRole(target, role);
  const commonFiles = [
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/AGENTS.md`,
      writer: "template",
      content: packageShellAgentsContent(target, role),
      description: `Write ${role} package agent guidance.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/LICENSE`,
      writer: "template",
      content: "MIT\n",
      description: `Write ${role} package license marker.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/README.md`,
      writer: "template",
      content: packageShellReadmeContent(target, role),
      description: `Write ${role} package README.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/docgen.json`,
      writer: "json",
      content: packageShellDocgenContent(target, role),
      description: `Write ${role} package docgen configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/tsconfig.json`,
      writer: "jsonc",
      content: packageShellTsconfigContent(),
      description: `Write ${role} package TypeScript configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/tsconfig.test.json`,
      writer: "jsonc",
      content: packageShellTestTsconfigContent(),
      description: `Write ${role} package test TypeScript configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/tsconfig.check.json`,
      writer: "jsonc",
      content: packageShellCheckTsconfigContent(),
      description: `Write ${role} package check TypeScript configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/vitest.config.ts`,
      writer: "template",
      content: packageShellVitestContent(),
      description: `Write ${role} package Vitest configuration.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/test/.gitkeep`,
      writer: "template",
      content: "",
      description: `Create ${role} package test directory.`,
    }),
    WriteFileOperation.make({
      kind: "write-file",
      role,
      path: `${basePath}/src/index.ts`,
      writer: "ts-morph",
      content: packageShellIndexContent(target, role),
      description: `Write ${role} package entry point.`,
    }),
  ] as const;

  if (role === "domain") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/aggregates/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} aggregate exports`, "aggregates"),
        description: "Write aggregate namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/entities/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} entity exports`, "entities"),
        description: "Write entity namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/identity/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} identity exports`, "entity-ids"),
        description: "Write identity namespace shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/values/index.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} value-object exports`, "value-objects"),
        description: "Write value namespace shell.",
      }),
    ];
  }

  if (role === "use-cases") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/public.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} public use-case exports`, "use-cases"),
        description: "Write public use-case shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/server.ts`,
        writer: "ts-morph",
        content: packageShellEmptyModuleContent(`${target.boundedContext} server use-case exports`, "repositories"),
        description: "Write server use-case shell.",
      }),
    ];
  }

  if (role === "config") {
    return [
      ...commonFiles,
      ...A.map(["public", "server", "secrets"] as const, (surface) =>
        WriteFileOperation.make({
          kind: "write-file",
          role,
          path: `${basePath}/src/${surface}.ts`,
          writer: "ts-morph",
          content: packageShellEmptyModuleContent(
            `${target.boundedContext} ${surface} config exports`,
            "configuration"
          ),
          description: `Write ${surface} config shell.`,
        })
      ),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/layer.ts`,
        writer: "ts-morph",
        content: packageShellLayerContent(target, "config"),
        description: "Write config layer shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/test.ts`,
        writer: "ts-morph",
        content: packageShellTestLayerContent(target, "config"),
        description: "Write config test layer shell.",
      }),
    ];
  }

  if (role === "server") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/Layer.ts`,
        writer: "ts-morph",
        content: packageShellLayerContent(target, "server"),
        description: "Write server layer shell.",
      }),
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/test.ts`,
        writer: "ts-morph",
        content: packageShellTestLayerContent(target, "server"),
        description: "Write server test layer shell.",
      }),
    ];
  }

  if (role === "tables") {
    return [
      ...commonFiles,
      WriteFileOperation.make({
        kind: "write-file",
        role,
        path: `${basePath}/src/tables.ts`,
        writer: "ts-morph",
        content: packageShellTablesContent(target),
        description: "Write tables collection shell.",
      }),
    ];
  }

  return commonFiles;
});
