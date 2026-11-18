/**
 * Package shells, manifests and role metadata for a model-first context.
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import {
  ArchitectureContextRole,
  ArchitecturePlanTarget,
  ArchitectureSliceRolePlan,
  WriteFileOperation,
  WritePackageJsonOperation,
} from "../Architecture.schemas.ts";
import { modelFirstSourceFilesFor } from "./ModelFirstTemplates.ts";
import { packageNameForRole, pathForRole } from "./RoleTopology.ts";
import type * as R from "effect/Record";
import type { ModelFirstContextNames, ModelFirstSourceFile } from "./ModelFirstTemplates.ts";

/**
 * The context roles generated today. `web` waits for the bindings generator.
 *
 * **Example** (The generated roles)
 *
 * ```ts
 * import { generatedContextRoles } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext"
 *
 * console.log(generatedContextRoles) // ["contract", "model", "host"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const generatedContextRoles: ReadonlyArray<ArchitectureContextRole> = ["contract", "model", "host"];

/**
 * The plan target of a model-first context: the context and its first Module.
 *
 * **Example** (The notes target)
 *
 * ```ts
 * import { modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 * import { modelFirstTargetFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext"
 *
 * console.log(modelFirstTargetFor(modelFirstContextNamesFor({ context: "notes", module: "Note" })).conceptPath) // "Note"
 * ```
 *
 * @param names - The names the context is generated from.
 * @returns The plan target.
 * @category constructors
 * @since 0.0.0
 */
export const modelFirstTargetFor = (names: ModelFirstContextNames): ArchitecturePlanTarget =>
  ArchitecturePlanTarget.make({
    boundedContext: names.context,
    concept: names.module,
    domainKind: "aggregates",
    conceptPath: names.module,
    stage: "full",
  });

const isSourceEntry = (file: ModelFirstSourceFile): boolean => Str.startsWith("src/")(file.path);

const exportSubpathOf = (file: ModelFirstSourceFile): string =>
  pipe(file.path, Str.replace(/^src\//u, "./"), Str.replace(/\.ts$/u, ""));

const filesForRole = (
  files: ReadonlyArray<ModelFirstSourceFile>,
  role: ArchitectureContextRole
): ReadonlyArray<ModelFirstSourceFile> => A.filter(files, (file) => file.role === role);

/**
 * The exact exports of one context package: one entry per `src/` file, no
 * wildcard and no root barrel.
 *
 * **Example** (The host's exports)
 *
 * ```ts
 * import { modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 * import { modelFirstExportsFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext"
 *
 * console.log(modelFirstExportsFor(modelFirstContextNamesFor({ context: "notes", module: "Note" }), "host")) // ["./Adapters", "./Host"]
 * ```
 *
 * @param names - The names the context is generated from.
 * @param role - The context role.
 * @returns The export subpaths, in file order.
 * @category getters
 * @since 0.0.0
 */
export const modelFirstExportsFor: {
  (names: ModelFirstContextNames, role: ArchitectureContextRole): ReadonlyArray<string>;
  (role: ArchitectureContextRole): (names: ModelFirstContextNames) => ReadonlyArray<string>;
} = dual(
  2,
  (names: ModelFirstContextNames, role: ArchitectureContextRole): ReadonlyArray<string> =>
    pipe(filesForRole(modelFirstSourceFilesFor(names), role), A.filter(isSourceEntry), A.map(exportSubpathOf))
);

/**
 * Role metadata for every generated package of a model-first context.
 *
 * **Example** (The notes role plans)
 *
 * ```ts
 * import { modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 * import { modelFirstRolePlansFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext"
 *
 * const plans = modelFirstRolePlansFor(modelFirstContextNamesFor({ context: "notes", module: "Note" }))
 * console.log(plans.map((plan) => plan.packageName)) // ["@beep/notes-contract", "@beep/notes-model", "@beep/notes-host"]
 * ```
 *
 * @param names - The names the context is generated from.
 * @returns One role plan per generated package.
 * @category constructors
 * @since 0.0.0
 */
export const modelFirstRolePlansFor = (names: ModelFirstContextNames): ReadonlyArray<ArchitectureSliceRolePlan> => {
  const target = modelFirstTargetFor(names);
  return A.map(generatedContextRoles, (role) =>
    ArchitectureSliceRolePlan.make({
      role,
      packageName: packageNameForRole(target, role),
      path: pathForRole(target, role),
      exports: modelFirstExportsFor(names, role),
    })
  );
};

const devDependencies: R.ReadonlyRecord<string, string> = {
  "@effect/vitest": "catalog:",
  "@types/node": "catalog:",
  "bun-types": "catalog:",
};

const dependenciesFor = ArchitectureContextRole.match({
  contract: (): R.ReadonlyRecord<string, string> => ({
    "@alchemy.run/domain": "catalog:",
    "@beep/contract-kit": "workspace:^",
    "@beep/identity": "workspace:^",
    effect: "catalog:",
  }),
  model: (): R.ReadonlyRecord<string, string> => ({
    "@alchemy.run/domain": "catalog:",
    "@beep/identity": "workspace:^",
    effect: "catalog:",
  }),
  host: (): R.ReadonlyRecord<string, string> => ({ "@alchemy.run/domain": "catalog:", effect: "catalog:" }),
  web: (): R.ReadonlyRecord<string, string> => ({ effect: "catalog:" }),
});

const contextDependenciesFor = (
  names: ModelFirstContextNames,
  role: ArchitectureContextRole
): R.ReadonlyRecord<string, string> =>
  ArchitectureContextRole.match(role, {
    contract: () => dependenciesFor(role),
    model: () => ({ ...dependenciesFor(role), [names.contractPackage]: "workspace:^" }),
    host: () => ({ ...dependenciesFor(role), [names.modelPackage]: "workspace:^" }),
    web: () => ({ ...dependenciesFor(role), [names.contractPackage]: "workspace:^" }),
  });

const contextDevDependenciesFor = ArchitectureContextRole.match({
  contract: (): R.ReadonlyRecord<string, string> => ({ ...devDependencies, "@effect/platform-node": "catalog:" }),
  model: (): R.ReadonlyRecord<string, string> => ({ ...devDependencies, "@beep/contract-kit": "workspace:^" }),
  host: (): R.ReadonlyRecord<string, string> => devDependencies,
  web: (): R.ReadonlyRecord<string, string> => devDependencies,
});

const packageDescriptionFor = (names: ModelFirstContextNames, role: ArchitectureContextRole): string =>
  ArchitectureContextRole.match(role, {
    contract: () => `The ${names.contextLabel} context's contract: what clients and other contexts import.`,
    model: () => `The ${names.contextLabel} context's write and reaction model.`,
    host: () => `The ${names.contextLabel} context's host: server adapters and hosting.`,
    web: () => `The ${names.contextLabel} context's screens over generated bindings.`,
  });

const packageJsonOperationFor = (
  names: ModelFirstContextNames,
  role: ArchitectureContextRole
): WritePackageJsonOperation => {
  const target = modelFirstTargetFor(names);
  return WritePackageJsonOperation.make({
    kind: "write-package-json",
    role,
    path: `${pathForRole(target, role)}/package.json`,
    packageName: packageNameForRole(target, role),
    packageDescription: packageDescriptionFor(names, role),
    repositoryDirectory: pathForRole(target, role),
    exports: modelFirstExportsFor(names, role),
    dependencies: contextDependenciesFor(names, role),
    devDependencies: contextDevDependenciesFor(role),
    description: `Write the ${role} package manifest for ${names.context}.`,
  });
};

const agentsContent = (names: ModelFirstContextNames, role: ArchitectureContextRole, packageName: string): string =>
  `# ${packageName}

${packageDescriptionFor(names, role)}

## Laws

- Root \`AGENTS.md\` and \`standards/ARCHITECTURE.md\` ("Model-First Slice Topology") govern this package.
- Every entry point is an exact \`exports\` entry; add one when you add a \`src/\` file.
- Before handing back a change, run \`bun run beep quality package-verify ${packageName}\` from the repository root.
`;

const readmeContent = (names: ModelFirstContextNames, role: ArchitectureContextRole, packageName: string): string =>
  `# ${packageName}

${packageDescriptionFor(names, role)}

Generated by \`bun run beep architecture create context ${names.context} ${names.module}\`.

## License

MIT
`;

const docgenContent = (path: string): string => `{
  "$schema": "../../../packages/tooling/tool/docgen/schema.json",
  "exclude": ["src/internal/**/*.ts"],
  "srcLink": "https://github.com/beep-effect/beep-effect/tree/main/${path}/src/",
  "examplesCompilerOptions": {
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "module": "es2022",
    "target": "es2022",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "rewriteRelativeImportExtensions": true,
    "allowImportingTsExtensions": true,
    "moduleDetection": "force",
    "verbatimModuleSyntax": true,
    "allowJs": false,
    "erasableSyntaxOnly": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "stripInternal": false,
    "noErrorTruncation": true,
    "types": [],
    "jsx": "react-jsx"
  }
}
`;

const tsconfigContent = `{
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

const tsconfigTestContent = `{
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

const tsconfigCheckContent = `{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./tsconfig.json",
  "references": [],
  "compilerOptions": {
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "incremental": false,
    "noEmit": true,
    "rootDir": "../../.."
  }
}
`;

const vitestContent = `import { defineConfig, mergeConfig } from "vitest/config";
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

const shellFile = (
  role: ArchitectureContextRole,
  path: string,
  writer: WriteFileOperation["writer"],
  content: string,
  description: string
): WriteFileOperation => WriteFileOperation.make({ kind: "write-file", role, path, writer, content, description });

const shellFilesFor = (
  names: ModelFirstContextNames,
  role: ArchitectureContextRole
): ReadonlyArray<WriteFileOperation> => {
  const target = modelFirstTargetFor(names);
  const base = pathForRole(target, role);
  const packageName = packageNameForRole(target, role);
  return [
    shellFile(
      role,
      `${base}/AGENTS.md`,
      "template",
      agentsContent(names, role, packageName),
      `Write ${role} agent notes.`
    ),
    shellFile(role, `${base}/LICENSE`, "template", "MIT\n", `Write ${role} package license marker.`),
    shellFile(role, `${base}/README.md`, "template", readmeContent(names, role, packageName), `Write ${role} README.`),
    shellFile(role, `${base}/docgen.json`, "json", docgenContent(base), `Write ${role} docgen configuration.`),
    shellFile(role, `${base}/tsconfig.json`, "jsonc", tsconfigContent, `Write ${role} TypeScript configuration.`),
    shellFile(
      role,
      `${base}/tsconfig.test.json`,
      "jsonc",
      tsconfigTestContent,
      `Write ${role} test TypeScript configuration.`
    ),
    shellFile(
      role,
      `${base}/tsconfig.check.json`,
      "jsonc",
      tsconfigCheckContent,
      `Write ${role} check TypeScript configuration.`
    ),
    shellFile(role, `${base}/vitest.config.ts`, "template", vitestContent, `Write ${role} Vitest configuration.`),
  ];
};

const sourceOperationFor = (names: ModelFirstContextNames, file: ModelFirstSourceFile): WriteFileOperation =>
  WriteFileOperation.make({
    kind: "write-file",
    role: file.role,
    path: `${pathForRole(modelFirstTargetFor(names), file.role)}/${file.path}`,
    writer: "template",
    content: file.content,
    description: file.description,
  });

/**
 * Every operation of a model-first context, before plan metadata: for each
 * generated package its manifest and shell files, then the context's sources.
 *
 * **Example** (Count the notes source files)
 *
 * ```ts
 * import { modelFirstContextNamesFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstTemplates"
 * import { modelFirstOperationsFor } from "@beep/repo-cli/commands/Architecture/internal/ModelFirstContext"
 *
 * const operations = modelFirstOperationsFor(modelFirstContextNamesFor({ context: "notes", module: "Note" }))
 * console.log(operations.some((operation) => operation.path === "packages/notes/host/src/Host.ts")) // true
 * ```
 *
 * @param names - The names the context is generated from.
 * @returns The package and source operations, in plan order.
 * @category constructors
 * @since 0.0.0
 */
export const modelFirstOperationsFor = (
  names: ModelFirstContextNames
): ReadonlyArray<WritePackageJsonOperation | WriteFileOperation> => {
  const files = modelFirstSourceFilesFor(names);
  return A.flatMap(generatedContextRoles, (role) => [
    packageJsonOperationFor(names, role),
    ...shellFilesFor(names, role),
    ...A.map(filesForRole(files, role), (file) => sourceOperationFor(names, file)),
  ]);
};
