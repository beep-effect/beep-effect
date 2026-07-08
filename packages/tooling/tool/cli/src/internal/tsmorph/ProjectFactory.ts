/**
 * Shared ts-morph project factories for repo-cli scanners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Project } from "ts-morph";

type RepoTsMorphProjectInput = {
  readonly tsConfigFilePath: string;
  readonly sourceFileGlobs: ReadonlyArray<string>;
};

/**
 * Create a semantic ts-morph project and load the requested source globs.
 *
 * @example
 * ```ts
 * import { createRepoTsMorphProject } from "@beep/repo-cli/internal/tsmorph/ProjectFactory"
 *
 * const project = createRepoTsMorphProject({
 *   tsConfigFilePath: "tsconfig.json",
 *   sourceFileGlobs: ["packages/tooling/tool/cli/src/index.ts"]
 * })
 * console.log(project.getSourceFiles().length >= 0)
 * ```
 * @category factories
 * @since 0.0.0
 */
export const createRepoTsMorphProject = (input: RepoTsMorphProjectInput): Project => {
  const project = new Project({
    tsConfigFilePath: input.tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
  });

  project.addSourceFilesAtPaths(input.sourceFileGlobs);

  return project;
};

/**
 * Create an in-memory ts-morph project for single-source fixtures.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject } from "@beep/repo-cli/internal/tsmorph/ProjectFactory"
 *
 * const project = createInMemoryTsMorphProject()
 * project.createSourceFile("fixture.ts", "export const value = 1")
 * console.log(project.getSourceFileOrThrow("fixture.ts").getBaseName())
 * ```
 * @category factories
 * @since 0.0.0
 */
export const createInMemoryTsMorphProject = (): Project => new Project({ skipAddingFilesFromTsConfig: true });
