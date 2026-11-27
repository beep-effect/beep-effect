import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PlatformError } from "effect/PlatformError";

const PackageManifest = S.fromJsonString(
  S.Struct({
    sideEffects: S.optionalKey(S.Unknown),
    dependencies: S.optionalKey(S.Record(S.String, S.String)),
    peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
  })
);

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/g;
const TYPE_ONLY_CLAUSE = /^\s*type\b/;

const LINE_COMMENT = /(^|\n)\s*\/\/.*/g;
const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g;
const stripLineThenBlockComments = (source: string): string =>
  pipe(source, Str.replace(LINE_COMMENT, "$1"), Str.replace(BLOCK_COMMENT, ""));

const runtimeSpecifiers = (source: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(IMPORT_PATTERN)(stripLineThenBlockComments(source))), (match) => {
    const specifier = match[2];
    return specifier === undefined || TYPE_ONLY_CLAUSE.test(match[1] ?? "") ? [] : [specifier];
  });

const packageOf = (specifier: string): string => (Str.startsWith("effect/")(specifier) ? "effect" : specifier);

const sorted = (values: Iterable<string>): ReadonlyArray<string> => A.sort(A.fromIterable(values), Order.String);

const visit = (
  file: string,
  seen: MutableHashSet.MutableHashSet<string>,
  bare: MutableHashSet.MutableHashSet<string>
): Effect.Effect<void, PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    if (MutableHashSet.has(seen, file)) return;
    MutableHashSet.add(seen, file);
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const source = yield* fs.readFileString(file);
    yield* Effect.forEach(
      runtimeSpecifiers(source),
      (specifier) =>
        Str.startsWith(".")(specifier)
          ? visit(path.resolve(path.dirname(file), Str.replace(/\.js$/, ".ts")(specifier)), seen, bare)
          : Effect.sync(() => MutableHashSet.add(bare, packageOf(specifier))),
      { concurrency: 1, discard: true }
    );
  });

const reachableBareImports = Effect.fn("reachableBareImports")(function* (src: string, entry: string) {
  const path = yield* Path.Path;
  const bare = MutableHashSet.empty<string>();
  yield* visit(path.resolve(src, entry), MutableHashSet.empty<string>(), bare);
  return bare;
});

const sourceModules = Effect.fn("sourceModules")(function* (src: string) {
  const fs = yield* FileSystem.FileSystem;
  const readDirectory1 = yield* fs.readDirectory(src);
  return A.sort(A.filter(readDirectory1, Str.endsWith(".ts")), Order.String);
});

const readManifest = Effect.fn("readManifest")(function* (packageRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const argument = S.decodeEffect(PackageManifest);
  const readFileString1 = yield* fs.readFileString(path.resolve(packageRoot, "package.json"));
  return yield* argument(readFileString1);
});

const SIGNER = "universal-github-app-jwt";
const SEALED_BOX = ["tweetnacl", "@noble/hashes/blake2.js"] as const;

describe("bundle reachability: the tree-shaking invariant over the runtime import graph of src", () => {
  it("the walker does not lose imports after a /*-bearing token in prose", () => {
    const fixture = A.join(
      [
        "// Prose naming a scope like @octokit/* and a glob like src/* here.",
        'import { Octokit } from "@octokit/core";',
        "/** A real doc comment, whose close is the phantom's close. */",
        'import { sign } from "universal-github-app-jwt";',
        "export const x = [Octokit, sign];",
      ],
      "\n"
    );
    assert.deepStrictEqual(
      runtimeSpecifiers(fixture),
      ["@octokit/core", "universal-github-app-jwt"],
      "only a line-comment /* opens a phantom block (a block comment swallows it), so line comments are stripped first"
    );
  });

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    const packageRoot = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fromFileUrl2 = yield* path.fromFileUrl(new URL(import.meta.url));
      const testDirectory = path.dirname(fromFileUrl2);
      return yield* fs.realPath(path.resolve(testDirectory, ".."));
    });
    const sourceRoot = Effect.flatMap(packageRoot, (root) =>
      Effect.map(Path.Path, (path) => path.resolve(root, "src"))
    );
    const reachableFrom = (entry: string) => Effect.flatMap(sourceRoot, (src) => reachableBareImports(src, entry));

    it.effect("the App module DOES reach the JWT signer", () =>
      Effect.gen(function* () {
        const reachableFrom3 = yield* reachableFrom("GitHubApp.ts");
        assert.isTrue(MutableHashSet.has(reachableFrom3, SIGNER), "the control proves the walker finds a real edge");
      })
    );

    it.effect("the secret writer DOES reach the sealed-box pair", () =>
      Effect.gen(function* () {
        const reachable = yield* reachableFrom("RepositorySecret.ts");
        for (const dep of SEALED_BOX) {
          assert.isTrue(MutableHashSet.has(reachable, dep), `RepositorySecret should reach ${dep}`);
        }
      })
    );

    it.effect("nothing but the secret writer reaches the sealed-box pair", () =>
      Effect.gen(function* () {
        const sourceRoot11 = yield* sourceRoot;
        const sourceModules4 = yield* sourceModules(sourceRoot11);
        const everyOtherSourceModule = A.filter(
          sourceModules4,
          (name) => name !== "index.ts" && name !== "RepositorySecret.ts"
        );
        for (const entry of everyOtherSourceModule) {
          const reachable = yield* reachableFrom(entry);
          for (const dep of SEALED_BOX) {
            assert.isFalse(
              MutableHashSet.has(reachable, dep),
              `${entry} reaches ${dep}; the sealed box has leaked out of RepositorySecret into every consumer`
            );
          }
        }
      })
    );

    it.effect("a token-only client does NOT reach the JWT signer", () =>
      Effect.gen(function* () {
        const reachable = yield* reachableFrom("GitHubClient.ts");
        assert.isFalse(
          MutableHashSet.has(reachable, SIGNER),
          `GitHubClient reaches ${SIGNER}; layerFromApp's dependency has leaked into the token path`
        );
        assert.isTrue(MutableHashSet.has(reachable, "@octokit/core"), "but it does reach the transport it needs");
      })
    );

    it.effect("the octokit type packages are reachable only as types", () =>
      Effect.gen(function* () {
        const reachableFrom5 = yield* reachableFrom("Rest.ts");
        assert.deepStrictEqual(
          sorted(reachableFrom5),
          ["@beep/identity/packages", "effect"],
          "@octokit/types and the paginate route map ship no JavaScript, so typing every endpoint is free"
        );
      })
    );

    it.effect("the pure classes reach nothing but effect and the schema literal kit", () =>
      Effect.gen(function* () {
        const reachableFrom6 = yield* reachableFrom("Resilience.ts");
        assert.deepStrictEqual(
          sorted(reachableFrom6),
          ["@beep/identity/packages", "@beep/schema/LiteralKit", "effect"],
          "Resilience.ts"
        );
        const reachableFrom7 = yield* reachableFrom("GraphQL.ts");
        assert.deepStrictEqual(
          sorted(reachableFrom7),
          ["@beep/identity/packages", "@beep/utils/Option", "effect"],
          "GraphQL.ts"
        );
      })
    );

    it.effect("the package declares itself side-effect free", () =>
      Effect.gen(function* () {
        const packageRoot8 = yield* packageRoot;
        const manifest = yield* readManifest(packageRoot8);
        assert.deepStrictEqual(manifest.sideEffects, [], "otherwise a bundler keeps every unreferenced module");
      })
    );

    it.effect("reaches no node: builtin, and a future one fails HERE rather than as a fake missing dependency", () =>
      Effect.gen(function* () {
        const reachable = [...(yield* reachableFrom("index.ts")), ...(yield* reachableFrom("GitHubApp.ts"))];
        assert.deepStrictEqual(
          sorted(A.filter(reachable, Str.startsWith("node:"))),
          [],
          "the declared-dependency check skips builtins, so a new node: import is caught only here"
        );
      })
    );

    it.effect("every module in src/ is reachable from the entrypoint", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const src = yield* sourceRoot;
        const entry = yield* fs.readFileString(path.resolve(src, "index.ts"));
        const sourceModules9 = yield* sourceModules(src);
        const unreachable = A.filter(
          sourceModules9,
          (name) => name !== "index.ts" && !Str.includes(`"./${name}"`)(entry)
        );
        assert.deepStrictEqual(
          unreachable,
          [],
          "module(s) in src/ the entrypoint never re-exports, though their own tests import them"
        );
      })
    );

    it.effect("every runtime dependency is declared", () =>
      Effect.gen(function* () {
        const packageRoot10 = yield* packageRoot;
        const manifest = yield* readManifest(packageRoot10);
        const declared = [...R.keys(manifest.dependencies ?? {}), ...R.keys(manifest.peerDependencies ?? {})];
        const used = [...(yield* reachableFrom("index.ts")), ...(yield* reachableFrom("GitHubApp.ts"))];
        const packageSpecifiers = A.filter(used, (value) => !Str.startsWith("node:")(value));
        for (const specifier of packageSpecifiers) {
          const segments = Str.split("/")(specifier);
          const packageName = A.join(A.take(segments, Str.startsWith("@")(specifier) ? 2 : 1), "/");
          assert.isTrue(
            A.contains(declared, packageName),
            `${specifier} is imported but not declared, which rots the peer closure`
          );
        }
      })
    );
  });
});
