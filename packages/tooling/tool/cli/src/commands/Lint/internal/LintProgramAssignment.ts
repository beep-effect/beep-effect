/**
 * Proves ownership of Oxlint's selected TypeScript inputs using tsrs config parsing.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { API } from "tsrs/async";
import { LintProgramAssignmentError } from "../Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/internal/LintProgramAssignment");
const ParsedLintConfig = S.Struct({
  fileNames: S.Array(S.String),
  options: S.Struct({
    disableSolutionSearching: S.optionalKey(S.Boolean),
    composite: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
  }),
  projectReferences: S.Array(S.Struct({ path: S.String })).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  errors: S.Array(S.Unknown),
}).pipe(
  $I.annoteSchema("ParsedLintConfig", { description: "Compiler-parsed file membership and solution references." })
);

/**
 * Rejects lint subjects that cannot be assigned to a configured TypeScript project.
 *
 * **Details**
 * Follows tsrs-lint's ancestor/solution-reference search, but delegates all config
 * parsing, extends, include and exclude semantics to the same installed compiler.
 * Configs are parsed once per invocation; no type checking or program creation occurs.
 *
 * **Example** (Create a coverage validation effect)
 * ```ts
 * import { validateLintProgramAssignment } from "@beep/repo-cli/test/Lint"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(validateLintProgramAssignment("/repo", ["src/index.ts"])))
 * ```
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const validateLintProgramAssignment = Effect.fn("Lint.validateProgramAssignment")(function* (
  root: string,
  selectedFiles: ReadonlyArray<string>
) {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const protocol = <T>(operation: string, run: () => Promise<T>) =>
    Effect.tryPromise({
      try: run,
      catch: () =>
        LintProgramAssignmentError.make({
          files: [],
          message: `lint deprecated-apis: ${operation} failed; cannot prove TypeScript coverage.`,
        }),
    });
  const api = yield* Effect.acquireRelease(
    Effect.try({
      try: () => new API({ cwd: root }),
      catch: () =>
        LintProgramAssignmentError.make({
          files: [],
          message: "lint deprecated-apis: cannot start tsrs config parser.",
        }),
    }),
    (api) => protocol("close config parser", () => api.close()).pipe(Effect.orDie)
  );
  const configs = yield* Cache.make({
    capacity: 4096,
    lookup: Effect.fnUntraced(function* (config: string) {
      const result = yield* protocol("parse tsconfig", () => api.parseConfigFile(config));
      const parsed = yield* S.decodeUnknownEffect(ParsedLintConfig)(result).pipe(
        Effect.mapError(() =>
          LintProgramAssignmentError.make({
            files: [],
            message: `lint deprecated-apis: malformed config response for ${path.relative(root, config)}.`,
          })
        )
      );
      if (A.isReadonlyArrayNonEmpty(parsed.errors)) {
        return yield* LintProgramAssignmentError.make({
          files: [],
          message: `lint deprecated-apis: invalid tsconfig ${path.relative(root, config)}; cannot prove TypeScript coverage.`,
        });
      }
      return {
        ...parsed,
        members: HashSet.fromIterable(A.map(parsed.fileNames, (file) => api.getCanonicalFileName(file))),
      };
    }),
  });
  const assigned = Effect.fnUntraced(function* (file: string) {
    let directory = path.dirname(file);
    let visited = HashSet.empty<string>();
    while (path.basename(directory) !== "node_modules") {
      for (const name of ["tsconfig.json", "jsconfig.json"]) {
        const candidate = path.join(directory, name);
        if (!(yield* fs.exists(candidate))) continue;
        let queue: ReadonlyArray<string> = [candidate];
        let disableSolutionSearching = false;
        while (A.isReadonlyArrayNonEmpty(queue)) {
          const [config, ...rest] = queue;
          queue = rest;
          if (HashSet.has(visited, config)) continue;
          visited = HashSet.add(visited, config);
          const parsed = yield* Cache.get(configs, config);
          if (config === candidate) disableSolutionSearching = parsed.options.disableSolutionSearching === true;
          if (HashSet.has(parsed.members, api.getCanonicalFileName(file))) return true;
          // tsrs prunes composite projects before visiting their references. Be
          // conservative when the API cannot expose its possibly-matches predicate:
          // require an ancestor solution to prove ownership instead of over-assigning.
          if (parsed.options.composite && A.isReadonlyArrayNonEmpty(parsed.fileNames)) continue;
          queue = A.appendAll(
            queue,
            A.map(parsed.projectReferences, (reference) =>
              path.extname(reference.path) === ".json" ? reference.path : path.join(reference.path, "tsconfig.json")
            )
          );
        }
        if (disableSolutionSearching) return false;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    return false;
  });
  const files = A.filter(selectedFiles, (file) => /\.(?:ts|tsx|mts|cts)$/.test(file));
  const unmatched = yield* Effect.filter(files, (file) =>
    assigned(path.resolve(root, file)).pipe(Effect.map((matched) => !matched))
  );
  if (A.isReadonlyArrayNonEmpty(unmatched)) {
    return yield* LintProgramAssignmentError.make({
      files: unmatched,
      message: `lint deprecated-apis: TypeScript files have no tsconfig owner:\n${A.join(unmatched, "\n")}`,
    });
  }
});
