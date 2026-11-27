import { Git } from "@beep/git/Git";
import { planCoverageAffectedScope, workspaceCoverageScopeOwners } from "@beep/repo-cli/test/Quality";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { undeclaredTestTasks } from "./support/TurboTestInputs.ts";

const TEST_CODE = /^(?:packages|apps|infra)\/.+\/test\/.+\.(?:[cm]?[jt]sx?)$/u;
const PACKAGE_MANIFEST = /^((?:packages|apps|infra)\/.+)\/package\.json$/u;
const COMMENT_LINE = /^\s*(?:\*|\/\/|\/\*)/u;
const MODULE_LINE = /^\s*(?:import|export)\b|\bfrom\s+["'`]|\bimport\(/u;
const RELATIVE_READ = /["'`]((?:\.\.\/)+[^"'`\s),$]*)/gu;
const INTEGRATION_SOURCE = /\/test\/integration\//u;
const DRIZZLE = "packages/_internal/db-admin/drizzle";
const DRIZZLE_READERS: ReadonlyArray<string> = [
  "packages/architecture-lab/server",
  "packages/documents/server",
  "packages/epistemic/server",
  "packages/execution-authority/server",
  "packages/law-practice/server",
  "packages/workspace/server",
];

class CrossPackageRead extends S.Opaque<CrossPackageRead, { readonly brand: unique symbol }>()(
  S.Struct({
    reference: S.NonEmptyString,
    target: S.NonEmptyString,
    source: S.NonEmptyString,
    reader: S.NonEmptyString,
    owner: S.NonEmptyString,
    paths: S.NonEmptyArray(S.NonEmptyString),
  })
) {}

const nearestPackage = (packages: HashSet.HashSet<string>, file: string): O.Option<string> => {
  const segments = Str.split("/")(file);
  return A.findFirst(
    A.makeBy(A.length(segments), (index) => A.join(A.take(segments, A.length(segments) - index), "/")),
    (directory) => HashSet.has(packages, directory)
  );
};

const resolveRelative = (source: string, reference: string): O.Option<string> =>
  pipe(
    A.reduce(
      Str.split("/")(reference),
      O.some<ReadonlyArray<string>>(A.dropRight(Str.split("/")(source), 1)),
      (state, segment) =>
        O.flatMap(state, (segments) =>
          segment === ".."
            ? A.isReadonlyArrayNonEmpty(segments)
              ? O.some(A.dropRight(segments, 1))
              : O.none()
            : O.some(segment === "" || segment === "." ? segments : A.append(segments, segment))
        )
    ),
    O.filter(A.isReadonlyArrayNonEmpty),
    O.map(A.join("/"))
  );

const readsOf = (
  source: string,
  text: string,
  packages: HashSet.HashSet<string>,
  paths: ReadonlyArray<string>
): ReadonlyArray<CrossPackageRead> =>
  pipe(
    Str.split("\n")(text),
    A.filter((line) => !COMMENT_LINE.test(line) && !MODULE_LINE.test(line)),
    A.flatMap((line) => A.map(A.fromIterable(Str.matchAll(RELATIVE_READ)(line)), (match) => match[1] ?? "")),
    A.dedupe,
    A.filterMap((reference) => {
      const reader = nearestPackage(packages, source);
      const target = O.map(resolveRelative(source, reference), Str.replace(/\/$/u, ""));
      const owner = O.flatMap(target, (resolved) => nearestPackage(packages, resolved));
      if (O.isNone(reader) || O.isNone(target) || O.isNone(owner)) return Result.failVoid;
      if (owner.value === reader.value || owner.value === target.value) return Result.failVoid;
      const prefix = `${target.value}/`;
      const consumed = A.filter(paths, (file) => file === target.value || Str.startsWith(prefix)(file));
      return A.isReadonlyArrayNonEmpty(consumed)
        ? Result.succeed(
            CrossPackageRead.make({
              reference,
              target: target.value,
              source,
              reader: reader.value,
              owner: owner.value,
              paths: consumed,
            })
          )
        : Result.failVoid;
    })
  );

class CrossPackageFacts extends Context.Service<
  CrossPackageFacts,
  { readonly root: string; readonly reads: ReadonlyArray<CrossPackageRead> }
>()("@beep/repo-cli/test/cross-package-read-census.test/CrossPackageFacts") {}

const CrossPackageFactsLive = Layer.effect(
  CrossPackageFacts,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const git = yield* Git;
    const root = yield* findRepoRoot();
    const entries = yield* git.lsFiles(root);
    const paths = A.dedupe(A.map(entries, (entry) => entry.path));
    const packages = HashSet.fromIterable(
      A.filterMap(paths, (file) => Result.fromNullishOr(PACKAGE_MANIFEST.exec(file)?.[1], () => file))
    );
    const perSource = yield* Effect.forEach(
      A.filter(paths, (file) => TEST_CODE.test(file)),
      (source) =>
        Effect.map(fs.readFileString(path.join(root, source)), (text) => readsOf(source, text, packages, paths)),
      { concurrency: 32 }
    );
    return { root, reads: A.flatten(perSource) };
  })
);

it.layer(Layer.provideMerge(CrossPackageFactsLive, Layer.provideMerge(Git.layer, NodeServices.layer)), {
  timeout: "120 seconds",
})("cross-package test read census", (it) => {
  it.effect("finds the db-admin migration folder read from every server package that replays it", () =>
    Effect.gen(function* () {
      const { reads } = yield* CrossPackageFacts;
      const readers = pipe(
        A.filter(reads, (read) => read.target === DRIZZLE),
        A.map((read) => read.reader),
        A.dedupe,
        A.sort(Str.Order)
      );
      expect(readers).toEqual(DRIZZLE_READERS);
    })
  );

  it.effect(
    "declares every file a test reads from another package as an input of each test task its reader runs",
    Effect.fnUntraced(function* () {
      const { root, reads } = yield* CrossPackageFacts;
      const undeclared = yield* Effect.forEach(
        reads,
        Effect.fnUntraced(function* (read) {
          const missing = yield* Effect.filter(
            read.paths,
            (consumed) => Effect.map(undeclaredTestTasks(root, read.reader, consumed), A.isReadonlyArrayNonEmpty),
            { concurrency: 1 }
          );
          return A.isReadonlyArrayNonEmpty(missing)
            ? O.some(
                `${read.target} <- ${read.source} (${read.reference}); declare "$TURBO_ROOT$/${read.target}/**" (or the file) on every test task in ${read.reader}/turbo.json; ${A.length(missing)} file(s) undeclared, first ${missing[0]}`
              )
            : O.none<string>();
        }),
        { concurrency: 8 }
      );
      expect(A.getSomes(undeclared)).toEqual([]);
    })
  );

  it.effect("selects the reader in the coverage plan for each read outside its integration tests", () =>
    Effect.gen(function* () {
      const { root, reads } = yield* CrossPackageFacts;
      const workspace = yield* workspaceCoverageScopeOwners(root);
      const unselected = A.filterMap(
        A.filter(reads, (read) => !INTEGRATION_SOURCE.test(read.source)),
        (read) => {
          const owner = A.findFirst(workspace, (entry) => entry.packagePath === read.reader);
          if (O.isNone(owner) || !owner.value.hasCoverage) return Result.failVoid;
          const sample = read.paths[0];
          const scope = planCoverageAffectedScope(workspace, [sample]);
          const selected =
            scope._tag === "full" ||
            (scope._tag === "selected" &&
              (A.contains(scope.packageNames, owner.value.packageName) ||
                A.contains(scope.dependentPackageNames, owner.value.packageName)));
          return selected
            ? Result.failVoid
            : Result.succeed(
                `${sample} <- ${read.source}: coverage plans ${scope._tag} without ${owner.value.packageName}; map ${read.target}/ to it in CoverageScope`
              );
        }
      );
      expect(A.dedupe(unselected)).toEqual([]);
    })
  );
});
