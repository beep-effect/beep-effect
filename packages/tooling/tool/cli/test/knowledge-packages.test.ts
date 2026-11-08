import { KnowledgeOperationalError, KnowledgeTrackedEntry } from "@beep/repo-cli/commands/Knowledge";
import {
  deriveKnowledgePackages,
  knowledgeTreeFacts,
  matchKnowledgeEntrypoint,
} from "@beep/repo-cli/commands/Knowledge/Knowledge.packages";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type { KnowledgeTreeOracle } from "@beep/repo-cli/commands/Knowledge";

const textEncoder = new TextEncoder();

const fixtureOracle = (files: Readonly<Record<string, string>>): KnowledgeTreeOracle => ({
  treeish: "fixture",
  commit: "0000000000000000000000000000000000000000",
  trackedEntries: A.map(R.keys(files), (path) =>
    KnowledgeTrackedEntry.make({ path, mode: "100644", objectId: `oid:${path}` })
  ),
  readBytes: (repoPath) =>
    O.match(R.get(files, repoPath), {
      onNone: () => Effect.fail(KnowledgeOperationalError.make({ message: `missing ${repoPath}` })),
      onSome: (text) => Effect.succeed(textEncoder.encode(text)),
    }),
});

const derive = (files: Readonly<Record<string, string>>) =>
  deriveKnowledgePackages(fixtureOracle(files), HashSet.fromIterable(R.keys(files)));

const targets = (files: Readonly<Record<string, string>>, name: string) =>
  Effect.map(derive(files), (packages) =>
    O.match(
      A.findFirst(packages, (pkg) => pkg.name === name),
      {
        onNone: () => A.empty<readonly [string, string | null]>(),
        onSome: (pkg) => A.map(pkg.entrypoints, (entry) => [entry.key, O.getOrNull(entry.target)] as const),
      }
    )
  );

describe("knowledge workspace package derivation", () => {
  it("joins repository paths through parent segments and refuses escaping above the root", () => {
    assertSome(knowledgeTreeFacts.joinRepoPath("packages/a", "../b/src"), "packages/b/src");
    assertNone(knowledgeTreeFacts.joinRepoPath("", "../b"));
  });

  it.effect("resolves a string exports value and an array exports value as the root entrypoint", () =>
    Effect.gen(function* () {
      const files = {
        "package.json": '{"name":"root","workspaces":["packages/*"]}',
        "packages/str/package.json": '{"name":"@beep/str","exports":"./src/index.ts"}',
        "packages/arr/package.json": '{"name":"@beep/arr","exports":[42,"./src/main.ts"]}',
      };
      const str = yield* targets(files, "@beep/str");
      const arr = yield* targets(files, "@beep/arr");
      expect(str).toStrictEqual([[".", "packages/str/src/index.ts"]]);
      expect(arr).toStrictEqual([[".", "packages/arr/src/main.ts"]]);
    })
  );

  it.effect("reads workspace globs from the { packages } spelling", () =>
    Effect.gen(function* () {
      const files = {
        "package.json": '{"name":"root","workspaces":{"packages":["libs/*"]}}',
        "libs/kept/package.json": '{"name":"@beep/kept","exports":"./index.ts"}',
        "other/dropped/package.json": '{"name":"@beep/dropped","exports":"./index.ts"}',
      };
      const packages = yield* derive(files);
      const names = A.map(packages, (pkg) => pkg.name);
      expect(names).toStrictEqual(["@beep/kept"]);
    })
  );

  it.effect("treats every manifest as a workspace when the root declares no usable globs", () =>
    Effect.gen(function* () {
      const noGlobs = {
        "package.json": '{"name":"root","workspaces":"packages/*"}',
        "anywhere/pkg/package.json": '{"name":"@beep/anywhere","exports":"./index.ts"}',
      };
      const missingPackages = {
        "package.json": '{"name":"root","workspaces":{"packages":"libs/*"}}',
        "deep/pkg/package.json": '{"name":"@beep/deep","exports":"./index.ts"}',
      };
      const fromNoGlobs = yield* derive(noGlobs);
      const fromMissingPackages = yield* derive(missingPackages);
      expect(A.map(fromNoGlobs, (pkg) => pkg.name)).toStrictEqual(["@beep/anywhere"]);
      expect(A.map(fromMissingPackages, (pkg) => pkg.name)).toStrictEqual(["@beep/deep"]);
    })
  );

  it.effect("prefers the longest wildcard subpath pattern that fits a specifier", () =>
    Effect.gen(function* () {
      const files = {
        "package.json": '{"name":"root","workspaces":["packages/*"]}',
        "packages/wild/package.json":
          '{"name":"@beep/wild","exports":{"./*":"./src/*.ts","./commands/*":"./src/commands/*.ts"}}',
      };
      const packages = yield* derive(files);
      const entrypoints = O.match(A.head(packages), { onNone: A.empty, onSome: (pkg) => pkg.entrypoints });
      const matched = matchKnowledgeEntrypoint(entrypoints, "./commands/Knowledge");
      assertSome(
        O.map(matched, (entry) => entry.key),
        "./commands/*"
      );
      assertSome(
        O.flatMap(matched, (entry) => entry.target),
        "packages/wild/src/commands/Knowledge.ts"
      );
    })
  );
});
