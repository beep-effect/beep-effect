import { WorkspaceSnapshots, Workspaces } from "@beep/repo-workspaces";
import { dirname, join } from "@beep/utils/Path";
import { afterAll, assert, beforeAll, describe, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import { gitIn, makeNodeFixture, nodeHost } from "./utils/nodeFixture.ts";

let outerGitRepoRoot: string;
let inner: string;

const write = Effect.fnUntraced(function* (path: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(dirname(path), { recursive: true });
  yield* fs.writeFileString(path, content);
});

const fixture = makeNodeFixture();

beforeAll(() =>
  fixture.runtime.runPromise(
    Effect.gen(function* () {
      outerGitRepoRoot = yield* fixture.tempDirectory("effected-nested-snapshot-");
      inner = join(outerGitRepoRoot, "inner");

      yield* write(
        join(outerGitRepoRoot, "pnpm-workspace.yaml"),
        A.join(["packages:", "  - packages/*", "catalog:", "  effect: ^3.0.0", ""], "\n")
      );
      yield* write(join(outerGitRepoRoot, "package.json"), '{"name":"outer-root","version":"0.0.0","private":true}');
      yield* write(
        join(outerGitRepoRoot, "packages", "outer-a", "package.json"),
        '{"name":"@outer/a","version":"9.9.9"}'
      );

      yield* write(
        join(inner, "pnpm-workspace.yaml"),
        A.join(["packages:", "  - packages/*", "catalog:", "  effect: ^4.0.0", ""], "\n")
      );
      yield* write(join(inner, "package.json"), '{"name":"inner-root","version":"1.0.0","private":true}');
      yield* write(
        join(inner, "packages", "inner-a", "package.json"),
        '{"name":"@inner/a","version":"1.1.0","dependencies":{"effect":"catalog:"}}'
      );
      yield* write(
        join(inner, "packages", "inner-b", "package.json"),
        '{"name":"@inner/b","version":"1.2.0","dependencies":{"@inner/a":"workspace:*"}}'
      );

      const git = gitIn(outerGitRepoRoot);
      yield* git("init", "-q");
      yield* git("config", "user.email", "test@example.com");
      yield* git("config", "user.name", "Test");
      yield* git("add", "-A");
      yield* git("commit", "-q", "-m", "fixture");
    })
  )
);

afterAll(() => fixture.close());

const Live = Layer.unwrap(
  Effect.sync(() => Workspaces.layerWithGit({ cwd: inner }).pipe(Layer.provideMerge(nodeHost)))
);

describe("WorkspaceSnapshots.at — a workspace root nested inside a larger git repo, which a scripted Git mock cannot tell apart", () => {
  it.layer(Live, { timeout: "30 seconds" })((it) => {
    it.effect("reads the INNER workspace's manifest, members and catalog — not the outer root's", () =>
      Effect.gen(function* () {
        const snapshots = yield* WorkspaceSnapshots;
        const snapshot = yield* snapshots.at("HEAD");

        const names = [...HashMap.keys(snapshot.versions)].sort();
        assert.deepStrictEqual(
          names,
          ["@inner/a", "@inner/b", "inner-root"],
          "git ls-tree (cwd = the workspace root) emits cwd-relative paths but git show <ref>:<path> resolves against the repo top-level, and .git is not a workspace marker, so at(ref) must ./-anchor every read to inner/; the un-prefixed reader collapses to just [outer-root], not @outer/a either, and carries the outer catalog ^3.0.0"
        );

        const innerCatalogEffectRange = snapshot.resolve("effect", "catalog:");
        assertSome(innerCatalogEffectRange, "^4.0.0");

        const innerMemberWorkspaceRange = snapshot.resolve("@inner/a", "workspace:*");
        assertSome(innerMemberWorkspaceRange, "1.1.0");
      })
    );
  });
});
