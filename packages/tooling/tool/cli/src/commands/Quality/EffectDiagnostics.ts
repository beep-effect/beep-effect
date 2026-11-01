/**
 * Workspace project-inventory helpers for Effect-rule coverage.
 *
 * **Details**
 * Effect rules now run inside the patched `tsrs` typecheck, so this module only
 * derives which check programs each workspace owns and which workspaces a change
 * affects. The standalone diagnostics lane it once served has been retired.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { TsconfigLoader } from "@beep/repo-tsconfig/TsconfigLoader";
import { readPackageJsonFile, toSortedRecord } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { workspaceManifests } from "../../internal/RepoWorkspaces.ts";
import { workspaceDependentOwners } from "./internal/CoverageScope.ts";
import { testTsgoPrograms } from "./internal/TestTsgoPrograms.ts";
import { QualityScriptCommandError } from "./Quality.errors.ts";
import type { CoverageScopeOwner } from "./internal/CoverageScope.ts";

/**
 * Select changed workspace owners and their transitive workspace dependents.
 *
 * **Details**
 * Reuses the coverage lane's workspace inventory and inverted dependency walk;
 * coverage capability never restricts diagnostics. Root compiler, lockfile and
 * runner changes invalidate all projects; docs outside workspaces select none.
 *
 * **Example** (Ignore repository prose)
 *
 * ```ts
 * import { effectDiagnosticsAffectedPackages } from "@beep/repo-cli/commands/Quality/EffectDiagnostics"
 * console.log(effectDiagnosticsAffectedPackages([], ["docs/note.md"])) // []
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const effectDiagnosticsAffectedPackages: {
  (files: ReadonlyArray<string>): (owners: ReadonlyArray<CoverageScopeOwner>) => ReadonlyArray<string>;
  (owners: ReadonlyArray<CoverageScopeOwner>, files: ReadonlyArray<string>): ReadonlyArray<string>;
} = dual(2, (owners: ReadonlyArray<CoverageScopeOwner>, files: ReadonlyArray<string>): ReadonlyArray<string> => {
  const global = A.some(
    files,
    (file) =>
      A.contains(["package.json", "bun.lock", "turbo.json"], file) ||
      Str.startsWith("tsconfig")(file) ||
      Str.startsWith(".github/")(file) ||
      Str.startsWith("packages/tooling/tool/cli/src/commands/Quality/")(file) ||
      Str.startsWith("packages/tooling/tool/cli/src/internal/")(file)
  );
  const direct = A.map(
    A.filter(
      owners,
      (owner) =>
        global ||
        A.some(files, (file) =>
          owner.packagePath === "."
            ? Str.endsWith(".ts")(file) ||
              Str.endsWith(".tsx")(file) ||
              A.some(
                owners,
                (workspace) => workspace.packagePath !== "." && Str.startsWith(`${workspace.packagePath}/`)(file)
              )
            : Str.startsWith(`${owner.packagePath}/`)(file)
        )
    ),
    (owner) => owner.packageName
  );
  return pipe(A.union(direct, workspaceDependentOwners(owners, direct)), A.sort(Order.String));
});

const checkCommands = (scripts: Readonly<Record<string, string>>, root: boolean) => {
  let pending = A.filter(
    R.keys(scripts),
    (name) => name === "check" || name === "beep:check" || (root && Str.startsWith("check:")(name))
  );
  let visited = HashSet.empty<string>();
  let commands = A.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [name, ...rest] = pending;
    pending = rest;
    if (HashSet.has(visited, name)) continue;
    visited = HashSet.add(visited, name);
    const script = pipe(
      scripts,
      R.get(name),
      O.getOrElse(() => "")
    );
    commands = A.appendAll(commands, Str.split(script, /&&|\|\||[;|]/u));
    pending = A.appendAll(
      pending,
      pipe(
        script,
        Str.matchAll(/\bbun\s+run\s+(?:--if-present\s+)?([\w:-]+)/gu),
        A.fromIterable,
        A.flatMap((match) => A.fromOption(O.fromUndefinedOr(match[1])))
      )
    );
  }
  return pipe(
    commands,
    A.map(Str.trim),
    A.filter((command) => O.isSome(Str.match(/^(?:tsrs|tsgo)\s/u)(command)))
  );
};

const scriptProjects = (commands: ReadonlyArray<string>, build: boolean) =>
  pipe(
    commands,
    A.flatMap((command) =>
      pipe(
        command,
        Str.matchAll(
          build
            ? /(?:^|\s)(?:-b|--build)(?:=|\s+)([^;&|]+)/gu
            : /(?:^|\s)(?:-p|--project)(?:=|\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/gu
        ),
        A.fromIterable,
        A.flatMap((match) =>
          pipe(
            O.fromUndefinedOr(match[1]),
            O.map((value) => (build ? Str.split(value, /\s+/u) : [value])),
            O.getOrElse(A.empty<string>)
          )
        ),
        A.filter((value) => !Str.startsWith("-")(value)),
        A.map(Str.replace(/^['"]|['"]$/gu, ""))
      )
    )
  );

type ResolveProject = (
  project: string
) => Effect.Effect<
  Effect.Success<ReturnType<typeof TsconfigLoader.resolve>>,
  Effect.Error<ReturnType<typeof TsconfigLoader.resolve>>,
  Effect.Services<ReturnType<typeof TsconfigLoader.resolve>>
>;

// One resolver per run: the inventory and every project run share each resolved
// extends chain, so a base config is read and decoded once instead of per project.
const makeProjectResolver = Effect.map(
  Cache.make({ lookup: TsconfigLoader.resolve, capacity: 4096 }),
  (cache): ResolveProject =>
    (project) =>
      Cache.get(cache, project)
);

const buildProjects = Effect.fn("EffectDiagnostics.buildProjects")(function* (
  initial: ReadonlyArray<string>,
  resolveProject: ResolveProject
) {
  const path = yield* Path.Path;
  let pending = initial;
  let visited = HashSet.empty<string>();
  while (A.isReadonlyArrayNonEmpty(pending)) {
    const [next, ...rest] = pending;
    pending = rest;
    const project = Str.endsWith(".json")(next) ? next : path.join(next, "tsconfig.json");
    if (HashSet.has(visited, project)) continue;
    visited = HashSet.add(visited, project);
    const config = yield* resolveProject(project).pipe(
      QualityScriptCommandError.mapError(`Failed to resolve build project ${project}.`)
    );
    pending = A.appendAll(
      pending,
      A.map(config.references ?? [], (ref) => path.resolve(path.dirname(project), ref.path))
    );
  }
  return A.fromIterable(visited);
});

const checkProjects = Effect.fn("EffectDiagnostics.checkProjects")(function* (
  dir: string,
  scripts: Readonly<Record<string, string>>,
  root: boolean,
  resolveProject: ResolveProject
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commands = checkCommands(scripts, root);
  const normalize = (project: string) => {
    const resolved = path.resolve(dir, project);
    return Str.endsWith(".json")(resolved) ? resolved : path.join(resolved, "tsconfig.json");
  };
  const builds = yield* buildProjects(A.map(scriptProjects(commands, true), normalize), resolveProject);
  const projects = pipe(
    A.appendAll(A.map(scriptProjects(commands, false), normalize), builds),
    A.dedupe,
    A.sort(Order.String)
  );
  yield* Effect.forEach(
    projects,
    Effect.fnUntraced(function* (project) {
      if (!(yield* fs.exists(project)))
        return yield* QualityScriptCommandError.make({
          message: `Missing check project ${project}.`,
          exitCode: 1,
        });
    }),
    { concurrency: 1 }
  );
  return projects;
});

// Derive each owner's check programs from its canonical check scripts, including the
// repository manifest and recursively expanded build-mode references. Missing declared
// projects fail instead of silently dropping rule coverage.
const collectDiagnosticsInventory = Effect.fn("EffectDiagnostics.inventory")(function* (
  repoRoot: string,
  resolveProject: ResolveProject
) {
  const path = yield* Path.Path;
  const workspaces = yield* workspaceManifests(repoRoot);
  const root = yield* readPackageJsonFile(path.join(repoRoot, "package.json"));
  const owners = A.append(
    A.map(
      HashMap.toEntries(workspaces),
      ([name, workspace]) => [name, workspace.dir, toSortedRecord(workspace.manifest.scripts)] as const
    ),
    [root.name, repoRoot, toSortedRecord(root.scripts)] as const
  );
  let inventory = HashMap.fromIterable(
    yield* Effect.forEach(
      owners,
      ([name, dir, scripts]) =>
        Effect.map(
          checkProjects(dir, scripts, dir === repoRoot, resolveProject),
          (projects) => [name, projects] as const
        ),
      { concurrency: 1 }
    )
  );
  const tests = yield* testTsgoPrograms.uncovered(repoRoot);
  for (const program of tests) {
    inventory = HashMap.set(
      inventory,
      program.packageName,
      pipe(
        O.getOrElse(HashMap.get(inventory, program.packageName), A.empty<string>),
        A.append(program.tsconfigPath),
        A.dedupe,
        A.sort(Order.String)
      )
    );
  }
  return inventory;
});

/**
 * Resolve compiler-script projects plus the shared fallback test-tsgo programs.
 *
 * **Example** (Inspect complete rule-gate discovery)
 * ```ts
 * import { effectDiagnosticsProjects } from "@beep/repo-cli/test/Quality"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(effectDiagnosticsProjects("."))) // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const effectDiagnosticsProjects = Effect.fn("EffectDiagnostics.projects")(function* (repoRoot: string) {
  return yield* collectDiagnosticsInventory(repoRoot, yield* makeProjectResolver);
});
