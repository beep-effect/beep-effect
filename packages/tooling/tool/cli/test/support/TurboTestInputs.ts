import { GlobSet } from "@beep/glob";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

export const TEST_TASKS: ReadonlyArray<string> = ["test", "test:integration", "test:integration:parallel"];

const TURBO_ROOT_INPUT = /^(!?)\$TURBO_ROOT\$\//u;

const decodePackageTurbo = S.decodeUnknownEffect(
  S.fromJsonString(
    S.Struct({
      tasks: S.Record(S.String, S.Struct({ inputs: S.Array(S.String).pipe(S.optionalKey) })),
    })
  )
);

const decodePackageScripts = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ scripts: S.Record(S.String, S.String).pipe(S.optionalKey) }))
);

export const testTasksOf = Effect.fnUntraced(function* (root: string, directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* fs.readFileString(path.join(root, directory, "package.json"));
  const manifest = yield* decodePackageScripts(text);
  const scripts = manifest.scripts ?? R.empty<string, string>();
  return A.filter(TEST_TASKS, (task) => R.has(scripts, task));
});

const declaredTaskInputs = Effect.fnUntraced(function* (turboPath: string, task: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(turboPath);
  const turbo = yield* decodePackageTurbo(text);
  return pipe(
    R.get(turbo.tasks, task),
    O.flatMapNullishOr((entry) => entry.inputs),
    O.getOrElse(A.empty<string>)
  );
});

export const testInputGlobs = Effect.fnUntraced(function* (root: string, directory: string, task: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const turboPath = path.join(root, directory, "turbo.json");
  const present = yield* fs.exists(turboPath);
  const inputs = present ? yield* declaredTaskInputs(turboPath, task) : A.empty<string>();
  const rootInputs = A.filterMap(inputs, (input) =>
    TURBO_ROOT_INPUT.test(input) ? Result.succeed(Str.replace(TURBO_ROOT_INPUT, "$1")(input)) : Result.failVoid
  );
  return yield* GlobSet.compile(A.isReadonlyArrayNonEmpty(rootInputs) ? rootInputs : ["!**"]);
});

export const undeclaredTestTasks = Effect.fnUntraced(function* (root: string, directory: string, consumed: string) {
  const tasks = yield* testTasksOf(root, directory);
  return yield* Effect.filter(
    tasks,
    (task) => Effect.map(testInputGlobs(root, directory, task), (globs) => !globs.matches(consumed)),
    { concurrency: 1 }
  );
});
