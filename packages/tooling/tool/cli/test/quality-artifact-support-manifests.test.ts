/**
 * Workspace discovery for the Quality artifact generators.
 *
 * Manifests are read through `LenientManifest` (3-A4): the retired projection
 * typed `workspaces` as unknown and kept whatever string entries it found, so a
 * malformed declaration silently discovered a different package set. A
 * malformed `workspaces` now fails the read.
 *
 * Members come from `@beep/repo-workspaces` `WorkspaceDiscovery` (4-A1), run
 * with `containWithinRoot`: a member directory, wildcard base or `**` descent
 * whose real path leaves the root is skipped before its manifest is read, as
 * the retired expander skipped an escaping `*` entry unread (CSF-018). A kept
 * member is recorded at its repo-relative path as enumerated, lexically under
 * the root as given. The kit's tolerant projection (a non-empty string `name`,
 * a non-empty string `version` when present) must accept a member before the
 * strict reader runs, and a non-empty `pnpm-workspace.yaml` `packages` list
 * takes precedence over `workspaces`.
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
import * as PlatformError from "effect/PlatformError";
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

      it.effect("fails a member the kit's projection rejects: a numeric or empty version, or an empty name", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*"] });
          const memberManifest = path.join(repoRoot, "packages", "demo", "package.json");

          for (const manifest of [
            { name: "@beep/demo", version: 1 },
            { name: "@beep/demo", version: "" },
            { name: "" },
          ]) {
            yield* fs.writeFileString(memberManifest, yield* encodeJson(manifest));
            const error = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));
            strictEqual(error.message, `Failed to decode package manifest ${memberManifest}.`);
          }
        })
      );

      it.effect("reads a non-empty pnpm-workspace.yaml packages list before workspaces", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*"] });
          yield* writeManifest(path.join(repoRoot, "tools", "lint"), { name: "@beep/lint" });
          yield* fs.writeFileString(path.join(repoRoot, "pnpm-workspace.yaml"), "packages:\n  - tools/*\n");

          deepStrictEqual(rows(yield* discoverWorkspacePackages(repoRoot, path)), [
            "@beep/lint=tools/lint",
            "@beep/root=.",
          ]);
        })
      );

      it.effect("fails a malformed pnpm-workspace.yaml as a workspace config decode", () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const { repoRoot, path } = yield* writeRepository({ workspaces: ["packages/*"] });
          const config = path.join(repoRoot, "pnpm-workspace.yaml");
          yield* fs.writeFileString(config, "packages: [\n");

          const error = yield* Effect.flip(discoverWorkspacePackages(repoRoot, path));
          strictEqual(error.message, `Failed to decode workspace config ${config}.`);
        })
      );
    });
  }
);

const manifestReads: Array<string> = [];
const CountedFileSystem = MemoryFileSystem.layerWith(
  {
    "/repo/package.json": JSON.stringify({ name: "@beep/root", workspaces: ["packages/*"] }),
    "/repo/packages/a/package.json": JSON.stringify({ name: "@beep/a" }),
    "/repo/packages/b/package.json": JSON.stringify({ name: "@beep/b" }),
  },
  {
    // A spy, not a stub: every read is recorded, then answered by the volume.
    faults: (base) => ({
      readFileString: (path: string, encoding?: string) => {
        manifestReads.push(path);
        return base.readFileString(path, encoding);
      },
    }),
  }
);

it.layer(Layer.mergeAll(CountedFileSystem, Path.layer), { timeout: "30 seconds" })(
  "QualityArtifactSupport workspace manifest reads",
  (it) => {
    it.effect("reads each member manifest once: the strict reader decodes the kit's as-read record", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        manifestReads.length = 0;

        deepStrictEqual(rows(yield* discoverWorkspacePackages("/repo", path)), [
          "@beep/a=packages/a",
          "@beep/b=packages/b",
          "@beep/root=.",
        ]);
        strictEqual(A.filter(manifestReads, (read) => read === "/repo/packages/a/package.json").length, 1);
        strictEqual(A.filter(manifestReads, (read) => read === "/repo/packages/b/package.json").length, 1);
      })
    );
  }
);

const denied = (method: string, path: string) =>
  Effect.fail(
    PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method, pathOrDescriptor: path })
  );

const faultedRepository = {
  "/repo/package.json": JSON.stringify({ name: "@beep/root", workspaces: ["packages/*"] }),
  "/repo/packages/a/package.json": JSON.stringify({ name: "@beep/a" }),
};

// The member manifest exists but cannot be read.
const UnreadableMember = MemoryFileSystem.layerWith(faultedRepository, {
  faults: {
    readFileString: (path: string) =>
      path === "/repo/packages/a/package.json" ? denied("readFileString", path) : undefined,
  },
});

it.layer(Layer.mergeAll(UnreadableMember, Path.layer), { timeout: "30 seconds" })(
  "QualityArtifactSupport unreadable member manifest",
  (it) => {
    it.effect("fails a member manifest the kit cannot read as its read", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const error = yield* Effect.flip(discoverWorkspacePackages("/repo", path));
        strictEqual(error.message, "Failed to read /repo/packages/a/package.json.");
      })
    );
  }
);

// The root manifest reads once for the strict reader, then stops reading, so
// the kit's root ascent finds no workspace root.
let rootReads = 0;
const VanishingRoot = MemoryFileSystem.layerWith(faultedRepository, {
  faults: (base) => ({
    readFileString: (path: string, encoding?: string) => {
      if (path !== "/repo/package.json") return base.readFileString(path, encoding);
      rootReads += 1;
      return rootReads === 1 ? base.readFileString(path, encoding) : denied("readFileString", path);
    },
  }),
});

it.layer(Layer.mergeAll(VanishingRoot, Path.layer), { timeout: "30 seconds" })(
  "QualityArtifactSupport vanishing workspace root",
  (it) => {
    it.effect("fails as the root's resolution when the kit finds no workspace root", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        rootReads = 0;
        const error = yield* Effect.flip(discoverWorkspacePackages("/repo", path));
        strictEqual(error.message, "Failed to resolve workspace root /repo.");
      })
    );
  }
);

const scratchRepository = Effect.fn(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const scratch = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix }));
  return { fs, path, scratch, repoRoot: path.join(scratch, "repo") };
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("QualityArtifactSupport workspace symlinks", (it) => {
  it.effect("skips a member whose real path leaves the root and keeps a member behind an in-root link", () =>
    Effect.gen(function* () {
      const { fs, path, scratch, repoRoot } = yield* scratchRepository("qas-discovery-links-");
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

  it.effect("records a member reached through an in-root link at its link path", () =>
    Effect.gen(function* () {
      const { fs, path, repoRoot } = yield* scratchRepository("qas-discovery-links-");
      yield* writeManifest(repoRoot, { name: "@beep/root", workspaces: ["linked/*"] });
      yield* writeManifest(path.join(repoRoot, "packages", "real"), { name: "@beep/real" });
      yield* fs.makeDirectory(path.join(repoRoot, "linked"));
      yield* fs.symlink(path.join(repoRoot, "packages", "real"), path.join(repoRoot, "linked", "alias"));

      const packages = yield* discoverWorkspacePackages(repoRoot, path);

      deepStrictEqual(rows(packages), ["@beep/real=linked/alias", "@beep/root=."]);
      assertSome(
        O.map(MutableHashMap.get(packages, "@beep/real"), (info) => info.absolutePath),
        path.join(repoRoot, "linked", "alias")
      );
    })
  );

  it.effect("skips an invalid manifest behind an escaping link unread, under `*` and under `**`", () =>
    Effect.gen(function* () {
      const { fs, path, scratch, repoRoot } = yield* scratchRepository("qas-discovery-links-");
      yield* writeManifest(repoRoot, { name: "@beep/root", workspaces: ["packages/*", "groups/**"] });
      yield* fs.makeDirectory(path.join(scratch, "outside"));
      yield* fs.writeFileString(path.join(scratch, "outside", "package.json"), "{");
      yield* writeManifest(path.join(scratch, "outside", "deep"), { name: "@beep/deep" });
      yield* writeManifest(path.join(repoRoot, "groups", "local"), { name: "@beep/local" });
      yield* fs.makeDirectory(path.join(repoRoot, "packages"));
      yield* fs.symlink(path.join(scratch, "outside"), path.join(repoRoot, "packages", "out"));
      yield* fs.symlink(path.join(scratch, "outside"), path.join(repoRoot, "groups", "away"));

      deepStrictEqual(rows(yield* discoverWorkspacePackages(repoRoot, path)), [
        "@beep/local=groups/local",
        "@beep/root=.",
      ]);
    })
  );

  it.effect("keeps plain repo-relative paths for a root behind a symlinked ancestor", () =>
    Effect.gen(function* () {
      const { fs, path, scratch } = yield* scratchRepository("qas-discovery-links-");
      const realRoot = path.join(scratch, "real", "repo");
      yield* writeManifest(realRoot, { name: "@beep/root", workspaces: ["packages/*", "tools/x"] });
      yield* writeManifest(path.join(realRoot, "packages", "a"), { name: "@beep/a" });
      yield* writeManifest(path.join(realRoot, "tools", "x"), { name: "@beep/x" });
      yield* fs.symlink(path.join(scratch, "real"), path.join(scratch, "alias"));
      const repoRoot = path.join(scratch, "alias", "repo");

      const packages = yield* discoverWorkspacePackages(repoRoot, path);

      deepStrictEqual(rows(packages), ["@beep/a=packages/a", "@beep/root=.", "@beep/x=tools/x"]);
      assertSome(
        O.map(MutableHashMap.get(packages, "@beep/a"), (info) => info.absolutePath),
        path.join(repoRoot, "packages", "a")
      );
    })
  );
});
