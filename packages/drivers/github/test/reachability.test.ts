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

/*
 * The tree-shaking invariant, as a test rather than a promise.
 *
 * The package this replaces put octokit, `@octokit/auth-app`'s OAuth arm,
 * CycloneDX and Sigstore behind one entry point, and the cost was real and
 * measured: one consumer whose only GitHub dependency was that package shipped
 * an eleven-line bundler ignore list for XML libraries it never invoked. The
 * failure was invisible until somebody measured a bundle.
 *
 * So the claim "a token-only consumer cannot reach the GitHub App JWT signer" is
 * checked here, structurally, by walking the runtime import graph of `src`.
 * `import type` is skipped because it is erased, which is also what makes the
 * generous use of `@octokit/types` free, and that is asserted too.
 *
 * What this does not prove is that a downstream bundler drops the unreferenced
 * module; that rests on `"sideEffects": []` (asserted below) plus the
 * module-per-file output the builder emits. What it does prove is the part we
 * control: no edge exists.
 */

const PackageManifest = S.fromJsonString(
  S.Struct({
    sideEffects: S.optionalKey(S.Unknown),
    dependencies: S.optionalKey(S.Record(S.String, S.String)),
    peerDependencies: S.optionalKey(S.Record(S.String, S.String)),
  })
);

const IMPORT_PATTERN = /(?:^|\n)\s*(?:import|export)\b([^;]*?)\bfrom\s*["']([^"']+)["']/g;
const TYPE_ONLY_CLAUSE = /^\s*type\b/;

// Doc comments carry example blocks with real import statements in them, so
// comments are stripped before matching. LINE comments must go FIRST: prose
// containing a `/*`-bearing token (a glob like `src/*`, a scope like
// `@octokit/*`) opens a phantom block comment as far as a regex is concerned,
// and stripping blocks first deletes everything up to the close of the NEXT doc
// comment, imports included. That fails silently in the permissive direction,
// which for a confinement test means passing for the wrong reason.
const stripComments = (source: string): string =>
  pipe(source, Str.replace(/(^|\n)\s*\/\/.*/g, "$1"), Str.replace(/\/\*[\s\S]*?\*\//g, ""));

/** Every `from "..."` specifier in a module, ignoring type-only imports and exports. */
const runtimeSpecifiers = (source: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(IMPORT_PATTERN)(stripComments(source))), (match) => {
    const specifier = match[2];
    return specifier === undefined || TYPE_ONLY_CLAUSE.test(match[1] ?? "") ? [] : [specifier];
  });

/** Effect's leaf modules all count as the one `effect` package. */
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
      { discard: true }
    );
  });

/** Every bare (non-relative) specifier reachable at runtime from `entry` in `src`. */
const reachableBareImports = Effect.fn("reachableBareImports")(function* (src: string, entry: string) {
  const path = yield* Path.Path;
  const bare = MutableHashSet.empty<string>();
  yield* visit(path.resolve(src, entry), MutableHashSet.empty<string>(), bare);
  return bare;
});

/** The modules in `src`, by file name. */
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

describe("bundle reachability", () => {
  it("the walker does not lose imports after a /*-bearing token in prose", () => {
    // The discriminating case for the comment stripper, and the reason LINE
    // comments are removed first. The token must sit in a LINE comment: inside
    // a block comment a `/*` is swallowed by its own comment and is harmless,
    // so a fixture built that way passes with or without the fix.
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
    assert.deepStrictEqual(runtimeSpecifiers(fixture), ["@octokit/core", "universal-github-app-jwt"]);
  });

  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    // The package root, canonicalised so a symlinked checkout walks the same files.
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
        // The control. Without it, the assertion below could pass because the
        // walker is broken rather than because the edge is absent.
        const reachableFrom3 = yield* reachableFrom("GitHubApp.ts");
        assert.isTrue(MutableHashSet.has(reachableFrom3, SIGNER));
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
        // `tweetnacl` and `@noble/hashes` exist for one member: encrypting a
        // secret before PUT. Every other resource service must stay clear of
        // them, or a consumer who never writes a secret still pays for the
        // crypto. The module list is derived from the directory, so a NEW module
        // that imports the crypto fails here without anyone updating a list.
        const sourceRoot11 = yield* sourceRoot;
        const sourceModules4 = yield* sourceModules(sourceRoot11);
        const others = A.filter(sourceModules4, (name) => name !== "index.ts" && name !== "RepositorySecret.ts");
        for (const entry of others) {
          const reachable = yield* reachableFrom(entry);
          for (const dep of SEALED_BOX) {
            assert.isFalse(
              MutableHashSet.has(reachable, dep),
              `${entry} reaches ${dep}; the sealed box has leaked out of RepositorySecret`
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
        // `@octokit/types` ships no JavaScript at all, and `plugin-paginate-rest`'s
        // generated route map is likewise types. Leaning on them costs zero
        // runtime bytes, which is why this package types every endpoint.
        const reachableFrom5 = yield* reachableFrom("Rest.ts");
        assert.deepStrictEqual(sorted(reachableFrom5), ["@beep/identity/packages", "effect"]);
      })
    );

    it.effect("the pure classes reach nothing but effect", () =>
      Effect.gen(function* () {
        const reachableFrom6 = yield* reachableFrom("Resilience.ts");
        assert.deepStrictEqual(sorted(reachableFrom6), ["@beep/identity/packages", "effect"], "Resilience.ts");
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
        // Without this a bundler must assume evaluating an unreferenced module
        // matters, and keeps it.
        const packageRoot8 = yield* packageRoot;
        const manifest = yield* readManifest(packageRoot8);
        assert.deepStrictEqual(manifest.sideEffects, []);
      })
    );

    it.effect("reaches no node: builtin, and a future one fails HERE rather than as a fake missing dependency", () =>
      Effect.gen(function* () {
        // A `node:` import is the smell the consolidated-core rule warns about,
        // so a new one should be a deliberate edit to this line. The
        // declared-dependency check below skips builtins, so without this
        // assertion a builtin would pass unnoticed.
        const reachable = [...(yield* reachableFrom("index.ts")), ...(yield* reachableFrom("GitHubApp.ts"))];
        assert.deepStrictEqual(sorted(A.filter(reachable, Str.startsWith("node:"))), []);
      })
    );

    it.effect("every module in src/ is reachable from the entrypoint", () =>
      Effect.gen(function* () {
        // A module can exist, compile and pass its own tests while being
        // importable by nobody, because most test files import their module
        // directly. A ported `RepositorySettings` module was once never added to
        // the entrypoint, because a type of that name was already exported there
        // and the collision was silent.
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const src = yield* sourceRoot;
        const entry = yield* fs.readFileString(path.resolve(src, "index.ts"));
        const sourceModules9 = yield* sourceModules(src);
        const unreachable = A.filter(
          sourceModules9,
          (name) => name !== "index.ts" && !Str.includes(`"./${name}"`)(entry)
        );
        assert.deepStrictEqual(unreachable, [], "module(s) in src/ that the entrypoint never re-exports");
      })
    );

    it.effect("every runtime dependency is declared", () =>
      Effect.gen(function* () {
        // A package you import but do not declare is how a peer closure rots;
        // the classifier in GitHubError reads octokit's throwables structurally
        // rather than importing `@octokit/request-error` for exactly this reason.
        const packageRoot10 = yield* packageRoot;
        const manifest = yield* readManifest(packageRoot10);
        const declared = [...R.keys(manifest.dependencies ?? {}), ...R.keys(manifest.peerDependencies ?? {})];
        const used = [...(yield* reachableFrom("index.ts")), ...(yield* reachableFrom("GitHubApp.ts"))];
        // A `node:` builtin is not a package and can never appear in a manifest.
        for (const specifier of A.filter(used, (value) => !Str.startsWith("node:")(value))) {
          const segments = Str.split("/")(specifier);
          const packageName = A.join(A.take(segments, Str.startsWith("@")(specifier) ? 2 : 1), "/");
          assert.isTrue(A.contains(declared, packageName), `${specifier} is imported but not declared`);
        }
      })
    );
  });
});
