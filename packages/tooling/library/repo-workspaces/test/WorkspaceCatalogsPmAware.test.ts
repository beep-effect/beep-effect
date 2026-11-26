import { Lockfile } from "@beep/lockfiles";
import { CatalogAssemblyError } from "@beep/npm-spec/CatalogAssemblyError";
import { CatalogSet, WorkspaceCatalogs, Workspaces } from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertSome, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { manifest, platform } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const JsonValue = S.fromJsonString(S.Unknown);

const workspacesOver = (tree: Tree) => Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(platform(tree)));

describe("CatalogSet.fromManifestWorkspaces", () => {
  it.effect("reads Bun top-level default and named catalogs with array workspaces", () =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(JsonValue)({
        workspaces: ["packages/*"],
        catalog: { effect: "^4.0.0" },
        catalogs: { build: { typescript: "^6.0.0" } },
      });
      const set = yield* CatalogSet.fromManifestWorkspaces(text);
      assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
      assertSome(set.rangeOf("typescript", O.some("build")), "^6.0.0");
    })
  );

  it.effect("rejects malformed top-level catalogs rather than silently dropping them", () =>
    Effect.gen(function* () {
      const text = yield* S.encodeEffect(JsonValue)({ workspaces: ["packages/*"], catalog: { effect: 42 } });
      const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(text));
      assert.strictEqual(error.source, "catalog");
      assert.strictEqual(error.path, "catalog");
    })
  );

  it.effect("an absent workspaces field yields the empty set", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromManifestWorkspaces(
        Result.getOrThrow(S.encodeResult(JsonValue)({ name: "root" }))
      );
      assert.isTrue(set.isEmpty);
    })
  );

  it.effect("an explicitly null workspaces field yields the empty set", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromManifestWorkspaces(
        Result.getOrThrow(S.encodeResult(JsonValue)({ workspaces: null }))
      );
      assert.isTrue(set.isEmpty);
    })
  );

  it.effect("the plain array (npm/yarn) form carries no catalogs", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromManifestWorkspaces(
        Result.getOrThrow(S.encodeResult(JsonValue)({ workspaces: ["packages/*"] }))
      );
      assert.isTrue(set.isEmpty);
    })
  );

  it.effect("bun's workspaces.catalog and workspaces.catalogs assemble", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromManifestWorkspaces(
        Result.getOrThrow(
          S.encodeResult(JsonValue)({
            workspaces: {
              packages: ["packages/*"],
              catalog: { effect: "^4.0.0" },
              catalogs: { build: { typescript: "^6.0.0" } },
            },
          })
        )
      );
      assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
      const namedCatalogRange = set.rangeOf("typescript", O.some("build"));
      assertSome(namedCatalogRange, "^6.0.0");
    })
  );

  it.effect("a number workspaces field fails typed, never as a defect", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        CatalogSet.fromManifestWorkspaces(Result.getOrThrow(S.encodeResult(JsonValue)({ workspaces: 42 })))
      );
      const error = yield* Effect.flip(
        CatalogSet.fromManifestWorkspaces(Result.getOrThrow(S.encodeResult(JsonValue)({ workspaces: 42 })))
      );
      assertSuccess(Exit.findError(exit), error);
      assert.instanceOf(error, CatalogAssemblyError);
      assert.strictEqual(error.source, "manifest");
    })
  );

  it.effect("a malformed workspaces.catalog fails typed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        CatalogSet.fromManifestWorkspaces(
          Result.getOrThrow(S.encodeResult(JsonValue)({ workspaces: { catalog: "not-an-object" } }))
        )
      );
      assert.instanceOf(error, CatalogAssemblyError);
      assert.strictEqual(error.source, "catalog");
      assert.strictEqual(error.path, "workspaces.catalog");
    })
  );

  it.effect("the default catalog declared twice is rejected — even when empty (structural)", () =>
    Effect.gen(function* () {
      const text = Result.getOrThrow(
        S.encodeResult(JsonValue)({ workspaces: { catalog: {}, catalogs: { default: {} } } })
      );
      const error = yield* Effect.flip(CatalogSet.fromManifestWorkspaces(text));
      assert.instanceOf(error, CatalogAssemblyError);
      assert.strictEqual(error.source, "catalog");
      assert.strictEqual(error.path, "default");
    })
  );
});

describe("CatalogSet.fromLockfile", () => {
  it.effect("assembles a bun lockfile's BunExtension catalogs", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(
        Result.getOrThrow(
          S.encodeResult(JsonValue)({
            lockfileVersion: 1,
            catalog: { react: "^18.0.0" },
            catalogs: { build: { typescript: "^5.0.0" } },
          })
        ),
        { format: "bun" }
      );
      const set = CatalogSet.fromLockfile(lockfile);
      const bunDefaultCatalogRange = set.rangeOf("react", O.none());
      assertSome(bunDefaultCatalogRange, "^18.0.0");
      assertSome(set.rangeOf("typescript", O.some("build")), "^5.0.0");
    })
  );

  it.effect("assembles a pnpm lockfile's catalogs", () =>
    Effect.gen(function* () {
      const lockfile = yield* Lockfile.parse(
        A.join(
          ["lockfileVersion: '9.0'", "catalogs:", "  default:", "    effect: ^4.0.0", "importers:", "  .: {}", ""],
          "\n"
        ),
        { format: "pnpm" }
      );
      const set = CatalogSet.fromLockfile(lockfile);
      assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
    })
  );
});

const doubleDefaultTree: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      name: "root",
      version: "0.0.0",
      workspaces: {
        packages: ["packages/*"],
        catalog: { effect: "^4.0.0" },
        catalogs: { default: { effect: "^3.0.0" } },
      },
    }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceCatalogs.set — the double-default rejection through the stack", () => {
  it.layer(workspacesOver(doubleDefaultTree), { timeout: "30 seconds" })((it) => {
    it.effect("the default catalog declared twice fails set() typed", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const exit = yield* Effect.exit(catalogs.set);
        const error = yield* Effect.flip(catalogs.set);
        assertSuccess(Exit.findError(exit), error);
        assert.instanceOf(error, CatalogAssemblyError);
        assert.strictEqual(error.path, "default");
      })
    );
  });
});

const malformedTree: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      name: "root",
      version: "0.0.0",
      workspaces: { packages: ["packages/*"], catalog: "not-an-object" },
    }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a"),
};

describe("WorkspaceCatalogs.set — a malformed workspaces shape through the stack", () => {
  it.layer(workspacesOver(malformedTree), { timeout: "30 seconds" })((it) => {
    it.effect("a malformed workspaces.catalog fails set() typed", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const error = yield* Effect.flip(catalogs.set);
        assert.instanceOf(error, CatalogAssemblyError);
        assert.strictEqual(error.source, "catalog");
      })
    );
  });
});

const bunWorkspaceStaleLockfile: Tree = {
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      name: "root",
      version: "0.0.0",
      private: true,
      packageManager: "bun@1.2.0",
      workspaces: {
        packages: ["packages/*"],
        catalog: { effect: "^4.0.0" },
        catalogs: { build: { typescript: "^6.0.0" } },
      },
    }),
    identity
  ),
  "/repo/packages/a/package.json": manifest("@x/a", { dependencies: { effect: "catalog:" } }),
  "/repo/bun.lock": Result.getOrThrowWith(
    S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
      lockfileVersion: 1,
      catalog: { react: "^18.0.0" },
      catalogs: { build: { typescript: "^5.0.0" } },
    }),
    identity
  ),
};

describe("WorkspaceCatalogs.set — a bun workspace with no pnpm-workspace.yaml", () => {
  it.layer(workspacesOver(bunWorkspaceStaleLockfile), { timeout: "30 seconds" })((it) => {
    it.effect("reads inline catalogs from the package.json workspaces block", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assertSome(set.rangeOf("effect", O.none()), "^4.0.0");
      })
    );

    it.effect("assembles the bun lockfile's BunExtension catalogs", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        const reactOnlyInBunLock = set.rangeOf("react", O.none());
        assertSome(reactOnlyInBunLock, "^18.0.0");
      })
    );

    it.effect("the inline block beats the lockfile within a named catalog", () =>
      Effect.gen(function* () {
        const catalogs = yield* WorkspaceCatalogs;
        const set = yield* catalogs.set;
        assertSome(set.rangeOf("typescript", O.some("build")), "^6.0.0");
      })
    );
  });
});

describe("CatalogSet — validated hostile catalog names", () => {
  it.effect("retains own __proto__ catalog and dependency keys through manifest validation", () =>
    Effect.gen(function* () {
      const set = yield* CatalogSet.fromManifestWorkspaces(
        '{"workspaces":{"catalogs":{"__proto__":{"__proto__":"^1.0.0","constructor":"^2.0.0"}}}}'
      );
      assertSome(set.rangeOf("__proto__", O.some("__proto__")), "^1.0.0");
      assertSome(set.rangeOf("constructor", O.some("__proto__")), "^2.0.0");
    })
  );
});
