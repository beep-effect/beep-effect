/**
 * Shared ts-morph project factories for repo-cli scanners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { getCompilerOptionsFromTsConfig, Project } from "ts-morph";

type RepoTsMorphProjectInput = {
  readonly tsConfigFilePath: string;
  readonly sourceFileGlobs: ReadonlyArray<string>;
};

/**
 * Create a semantic ts-morph project and load the requested source globs.
 *
 * **Example** (Load project from source globs)
 *
 * ```ts
 * import { createRepoTsMorphProject } from "@beep/repo-cli/internal/tsmorph/ProjectFactory"
 *
 * const project = createRepoTsMorphProject({
 *   tsConfigFilePath: "tsconfig.json",
 *   sourceFileGlobs: ["packages/tooling/tool/cli/src/index.ts"]
 * })
 * console.log(project.getSourceFiles().length >= 0)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const createRepoTsMorphProject = (input: RepoTsMorphProjectInput): Project => {
  const project = new Project();
  const fileSystem = project.getFileSystem();
  const readDirSync = fileSystem.readDirSync;

  // Only compiler options are needed from tsconfig. Even skipAddingFilesFromTsConfig
  // enumerates its include paths, which can race with generated-docs cleanup.
  fileSystem.readDirSync = A.empty;
  const { options } = getCompilerOptionsFromTsConfig(input.tsConfigFilePath, { fileSystem });
  fileSystem.readDirSync = readDirSync;
  project.compilerOptions.set(options);

  // addSourceFilesAtPaths also recursively registers parent directories, including
  // excluded docs. Load only the glob matches so excluded directories stay unread.
  for (const filePath of fileSystem.globSync(input.sourceFileGlobs)) {
    project.addSourceFileAtPathIfExists(filePath);
  }

  return project;
};

/**
 * Create an in-memory ts-morph project for single-source fixtures.
 *
 * **Example** (Build in-memory fixture project)
 *
 * ```ts
 * import { createInMemoryTsMorphProject } from "@beep/repo-cli/internal/tsmorph/ProjectFactory"
 *
 * const project = createInMemoryTsMorphProject()
 * project.createSourceFile("fixture.ts", "export const value = 1")
 * console.log(project.getSourceFileOrThrow("fixture.ts").getBaseName())
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const createInMemoryTsMorphProject = (): Project => new Project({ skipAddingFilesFromTsConfig: true });
