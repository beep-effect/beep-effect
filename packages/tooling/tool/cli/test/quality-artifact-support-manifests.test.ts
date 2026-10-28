/**
 * Workspace discovery for the Quality artifact generators.
 *
 * Manifests are read through `LenientManifest` (3-A4): the retired projection
 * typed `workspaces` as unknown and kept whatever string entries it found, so a
 * malformed declaration silently discovered a different package set. A
 * malformed `workspaces` now fails the read.
 *
 * Member directories come from `@beep/repo-workspaces` `WorkspaceDiscovery`
 * (4-A1), post-filtered through `resolvePathWithinRoot` because the kit follows
 * links: a member whose real path leaves the root is skipped, and a kept member
 * is recorded at its canonical path.
 */
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { discoverWorkspacePackages } from "@beep/repo-cli/test/Quality";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe } from "@effect/vitest";
import { assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const writeManifest = Effect.fn(function* (directory: string, manifest: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(directory, { recursive: true });
  yield* fs.writeFileString(path.join(directory, "package.json"), yield* encodeJson(manifest));
});

const writeRepository = Effect.fn(function* (rootManifest: Record<string, unknown>) {
  const path = yield* Path.Path;
  const repoRoot = "/repo";
  yield* writeManifest(repoRoot, { name: "@beep/root", private: true, ...rootManifest });
  yield* writeManifest(path.join(repoRoot, "packages", "demo"), {
    name: "@beep/demo",
    scripts: { coverage: "vitest run --coverage" },
  });
  return { repoRoot, path };
});

const rows = (
  packages: Iterable<readonly [string, { readonly name: string; readonly path: string }]>
): ReadonlyArray<string> =>
  pipe(
    A.fromIterable(packages),
    A.map(([, info]) => `${info.name}=${info.path}`),
    A.sort(Order.String)
  );

it.layer(Layer.provideMerge(MemoryFileSystem.layer, NodeServices.layer), { timeout: "30 seconds" })(
  "QualityArtifactSupport workspace manifests",
  (it) => {
    describe("discoverWorkspacePackages", () => {
      it.effect("discovers the root and its workspace packages", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*"] });
          const packages = yield* discoverWorkspacePackages(repoRoot, path);

          deepStrictEqual(rows(packages), ["@beep/demo=packages/demo", "@beep/root=."]);
        })
      );

      it.effect("reads the object workspaces form", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository({ workspaces: { packages: ["packages/*"] } });

          deepStrictEqual(rows(yield* discoverWorkspacePackages(repoRoot, path)), [
            "@beep/demo=packages/demo",
            "@beep/root=.",
          ]);
        })
      );

      it.effect("reads a root without workspaces, or with a catalog-only object, as the root alone", () =>
        Effect.gen(function* () {
          const bare = yield* writeRepository({});
          deepStrictEqual(rows(yield* discoverWorkspacePackages(bare.repoRoot, bare.path)), ["@beep/root=."]);

          const catalogOnly = yield* writeRepository({ workspaces: { catalog: { effect: "4.0.0" } } });
          deepStrictEqual(rows(yield* discoverWorkspacePackages(catalogOnly.repoRoot, catalogOnly.path)), [
            "@beep/root=.",
          ]);
        })
      );

      it.effect("skips a missing literal member and fails a wildcard whose base directory is absent", () =>
        Effect.gen(function* () {
          const literal = yield* writeRepository({ workspaces: ["packages/*", "tools/absent"] });
          deepStrictEqual(rows(yield* discoverWorkspacePackages(literal.repoRoot, literal.path)), [
            "@beep/demo=packages/demo",
            "@beep/root=.",
          ]);

          const wildcard = yield* writeRepository({ workspaces: ["packages/*", "absent/*"] });
          const error = yield* Effect.flip(discoverWorkspacePackages(wildcard.repoRoot, wildcard.path));
          strictEqual(error._tag, "QualityArtifactGeneratorError");
          strictEqual(error.message, "Failed to expand workspace pattern absent/*.");
        })
      );

      it.effect("reads `!` patterns as exclusions, `**` as a descent, and skips dot directories under `*`", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository({
            workspaces: ["packages/*", "!packages/skip", "groups/**"],
          });
          yield* writeManifest(path.join(repoRoot, "packages", "skip"), { name: "@beep/skip" });
          yield* writeManifest(path.join(repoRoot, "packages", ".hidden"), { name: "@beep/hidden" });
          yield* writeManifest(path.join(repoRoot, "groups", "one", "nested"), { name: "@beep/nested" });

          deepStrictEqual(rows(yield* discoverWorkspacePackages(repoRoot, path)), [
            "@beep/demo=packages/demo",
            "@beep/nested=groups/one/nested",
            "@beep/root=.",
          ]);
        })
      );

      it.effect("fails on a workspaces array with a non-string entry instead of keeping its strings", () =>
        Effect.gen(function* () {
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*", 7] });
          const error = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));

          strictEqual(error._tag, "QualityArtifactGeneratorError");
          assertTrue(Str.startsWith("Failed to decode package manifest")(error.message));
        })
      );

      it.effect("fails a member manifest that is not JSON or has no name as its decode", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*"] });
          const badManifest = path.join(repoRoot, "packages", "demo", "package.json");

          yield* fs.writeFileString(badManifest, "{");
          const invalid = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));
          strictEqual(invalid.message, `Failed to decode package manifest ${badManifest}.`);

          yield* fs.writeFileString(badManifest, "{}");
          const unnamed = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));
          strictEqual(unnamed.message, `Failed to decode package manifest ${badManifest}.`);
        })
      );
    });
  }
);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("QualityArtifactSupport workspace symlinks", (it) => {
  it.effect("skips a member whose real path leaves the root and records an inside link at its target", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scratch = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "qas-discovery-links-" }));
      const repoRoot = path.join(scratch, "repo");
      yield* writeManifest(repoRoot, { name: "@beep/root", workspaces: ["packages/*", "linked/*", "escape"] });
      yield* writeManifest(path.join(repoRoot, "packages", "real"), { name: "@beep/real" });
      yield* writeManifest(path.join(scratch, "outside"), { name: "@beep/outside" });
      yield* fs.makeDirectory(path.join(repoRoot, "linked"));
      yield* fs.symlink(path.join(repoRoot, "packages", "real"), path.join(repoRoot, "linked", "alias"));
      yield* fs.symlink(path.join(scratch, "outside"), path.join(repoRoot, "packages", "out"));
      yield* fs.symlink(path.join(scratch, "outside"), path.join(repoRoot, "escape"));

      const packages = yield* discoverWorkspacePackages(repoRoot, path);

      deepStrictEqual(rows(packages), ["@beep/real=packages/real", "@beep/root=."]);
      assertSome(
        O.map(MutableHashMap.get(packages, "@beep/real"), (info) => info.absolutePath),
        path.join(repoRoot, "packages", "real")
      );
    })
  );

  it.effect("fails on an invalid manifest behind an escaping link, which the kit reads before the post-filter", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scratch = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "qas-discovery-links-" }));
      const repoRoot = path.join(scratch, "repo");
      yield* writeManifest(repoRoot, { name: "@beep/root", workspaces: ["packages/*"] });
      yield* fs.makeDirectory(path.join(scratch, "outside"));
      yield* fs.writeFileString(path.join(scratch, "outside", "package.json"), "{");
      yield* fs.makeDirectory(path.join(repoRoot, "packages"));
      yield* fs.symlink(path.join(scratch, "outside"), path.join(repoRoot, "packages", "out"));

      const error = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));

      strictEqual(
        error.message,
        `Failed to decode package manifest ${path.join(repoRoot, "packages", "out", "package.json")}.`
      );
    })
  );
});
