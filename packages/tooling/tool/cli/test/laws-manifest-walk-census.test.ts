// LINT-04 P28 parity gate (goals/heavy-pool-diet): the pruned lint:laws manifest walk reads exactly
// the workspace manifests the lint-laws seal hashes, including manifests seven to nine directories
// deep, and its module still carries the marker that routes those manifests onto the seal.
import { inspectPackageTestImports, WORKSPACE_MANIFEST_WALK } from "@beep/repo-cli/commands/Lint/PackageTestImports";
import { moduleRootFileReads, POLICY_ROOT_FILE_ROUTES } from "@beep/repo-cli/test/Lint";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Str from "effect/String";

const MANIFEST = "package.json";
const NEGATION_SUFFIX = `/**/${MANIFEST}`;

// The workspace-manifest route of the policy fingerprint: the seal family the walk's marker selects.
const manifestRoute = O.getOrThrow(
  A.findFirst(POLICY_ROOT_FILE_ROUTES, (route) => A.contains(route.names, WORKSPACE_MANIFEST_WALK))
);

// `!**/<name>/**/package.json` negations name the directories whose manifests the seal never hashes.
const negatedDirectories = A.getSomes(
  A.map(manifestRoute.files, (glob) =>
    pipe(
      O.liftPredicate(glob, Str.startsWith("!**/")),
      O.map(Str.slice(4)),
      O.filter(Str.endsWith(NEGATION_SUFFIX)),
      O.map(Str.slice(0, -NEGATION_SUFFIX.length))
    )
  )
);

// Manifests the walk must read: every depth, every unpruned directory name, non-`@beep` names too.
const visibleManifests = [
  "packages/a",
  "packages/a/docs/fixtures",
  "packages/group/b",
  "packages/plain",
  "packages/x1/x2/x3/x4/x5/x6/x7",
  "packages/x1/x2/x3/x4/x5/x6/x7/x8",
  "packages/x1/x2/x3/x4/x5/x6/x7/x8/x9",
];

const writeManifest = Effect.fnUntraced(function* (root: string, directory: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(root, directory), { recursive: true });
  yield* fs.writeFileString(path.join(root, directory, MANIFEST), `{"name":"${name}"}\n`);
});

// The pre-#3019 walk as an oracle: descend into every directory, prune nothing.
const unprunedManifests = Effect.fn("unprunedManifests")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const walk = (directory: string): Effect.Effect<ReadonlyArray<string>> =>
    Effect.gen(function* () {
      const entries = yield* fs.readDirectoryEntries(path.join(root, directory)).pipe(Effect.orDie);
      const own = A.some(entries, (entry) => entry.type === "File" && entry.name === MANIFEST)
        ? [path.join(directory, MANIFEST)]
        : [];
      const nested = yield* Effect.forEach(
        A.filter(entries, (entry) => entry.type === "Directory"),
        (entry) => walk(path.join(directory, entry.name))
      );
      return A.appendAll(own, A.flatten(nested));
    });
  const manifests = yield* walk("packages");
  return A.sort(manifests, Order.String);
});

describe("lint:laws manifest walk census", () => {
  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "reads exactly the manifests the lint-laws seal hashes, at every depth",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "laws-manifest-census-" });
        expect(A.sort(negatedDirectories, Order.String)).toEqual([
          ".beep",
          ".next",
          ".turbo",
          "build",
          "coverage",
          "dist",
          "node_modules",
          "storybook-static",
        ]);
        yield* Effect.forEach(visibleManifests, (directory, index) =>
          writeManifest(root, directory, directory === "packages/plain" ? "plain" : `@beep/visible-${index}`)
        );
        // One manifest under every directory the seal negates, nested below a real package.
        yield* Effect.forEach(negatedDirectories, (directory) =>
          writeManifest(root, `packages/a/${directory}/inner`, `@beep/pruned-${directory}`)
        );

        const read = A.empty<string>();
        const recording = FileSystem.makeNoop({
          ...fs,
          readFileString: (file, encoding) => {
            if (Str.endsWith(`/${MANIFEST}`)(file)) read.push(path.relative(root, file));
            return fs.readFileString(file, encoding);
          },
        });
        const violations = yield* inspectPackageTestImports(root, []).pipe(
          Effect.provideService(FileSystem.FileSystem, recording)
        );
        expect(violations).toEqual([]);

        const census = A.sort(read, Order.String);
        const reference = yield* unprunedManifests(root);
        const sealed = A.filter(
          reference,
          (manifest) => !A.some(Str.split("/")(manifest), (segment) => A.contains(negatedDirectories, segment))
        );
        // The census: seven manifests read once each, against fifteen in the unpruned tree.
        expect(census).toEqual(
          A.sort(
            A.map(visibleManifests, (directory) => `${directory}/${MANIFEST}`),
            Order.String
          )
        );
        expect(A.length(census)).toBe(7);
        expect(A.length(reference)).toBe(15);
        expect(census).toEqual(sealed);
        expect(A.difference(reference, census)).toEqual(
          A.map(A.sort(negatedDirectories, Order.String), (directory) => `packages/a/${directory}/inner/${MANIFEST}`)
        );
        // The deep fixtures sit seven, eight and nine directories below packages/.
        expect(
          A.map(A.filter(census, Str.startsWith("packages/x1/")), (manifest) => A.length(Str.split("/")(manifest)) - 2)
        ).toEqual([7, 8, 9]);
      })
    );

    it.effect(
      "keeps the seal route marker on the module that walks the manifests",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const module = "packages/tooling/tool/cli/src/commands/Lint/PackageTestImports.ts";
        const source = yield* fs.readFileString(path.join(repoRoot, module));
        // The walk is named by the marker, so the policy fingerprint routes the manifest family to
        // every seal whose closure reaches this module; renaming or moving the walk off the marker
        // would drop the manifests from the lint-laws seal.
        expect(source).toContain("Effect.fn(WORKSPACE_MANIFEST_WALK)");
        expect(moduleRootFileReads(module, source)).toEqual(A.sort(manifestRoute.files, Order.String));
      })
    );
  });
});
