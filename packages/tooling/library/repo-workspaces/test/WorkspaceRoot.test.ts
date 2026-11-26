import { MemoryFileSystem } from "@beep/memfs";
import {
  WORKSPACE_MARKERS,
  WorkspaceDiscovery,
  WorkspacePackage,
  WorkspaceRoot,
  WorkspaceRootNotFoundError,
} from "@beep/repo-workspaces";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertExitFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { manifest, platform, rootManifest } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const rootsOver = (tree: Tree) => {
  const base = platform(tree);
  return WorkspaceRoot.layer.pipe(Layer.provide(base));
};

const unmarkedFixtureInsideHost: Tree = {
  "/host/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
  "/host/package.json": manifest("@host/root"),
  "/host/fixtures/wsp/packages/a/package.json": manifest("@fixture/a"),
};

describe("WorkspaceRoot.find — ascent bounds", () => {
  layer(rootsOver(unmarkedFixtureInsideHost), { timeout: "30 seconds" })((it) => {
    it.effect("unbounded, it escapes the fixture and resolves the host root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found1 = yield* roots.find("/host/fixtures/wsp/packages/a");
        assert.strictEqual(
          found1,
          "/host",
          "the documented unbounded default, and the control proving stopAt does work"
        );
      })
    );

    it.effect("stopAt refuses the escape and fails typed", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/host/fixtures/wsp/packages/a", { stopAt: "/host/fixtures/wsp" }));
        assert.instanceOf(
          error,
          WorkspaceRootNotFoundError,
          "the downstream regression: an unmarked fixture inside a host workspace must not escape to the host"
        );
        assert.strictEqual(error.stopAt, "/host/fixtures/wsp");
        assert.include(error.message, "up to /host/fixtures/wsp");
      })
    );

    it.effect("stopAt is inclusive — a marked ceiling is itself probed", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found2 = yield* roots.find("/host/packages", { stopAt: "/host" });
        assert.strictEqual(found2, "/host");
      })
    );

    it.effect("a non-normalized stopAt still bounds the ascent", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(
          roots.find("/host/fixtures/wsp/packages/a", { stopAt: "/host/fixtures/wsp/packages/../" })
        );
        assert.strictEqual(
          error.stopAt,
          "/host/fixtures/wsp",
          "the walker compares the ceiling by string equality, so find must resolve it or run unbounded"
        );
      })
    );

    it.effect("an unbounded failure records no ceiling", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/host/fixtures/wsp/packages/a", { maxDepth: 2 }));
        assert.instanceOf(error, WorkspaceRootNotFoundError);
        assert.strictEqual(
          error.stopAt,
          undefined,
          "stopAt's absence tells no root anywhere above from none below the ceiling"
        );
      })
    );

    it.effect("an invalid maxDepth is a defect, not a typed failure", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const exit = yield* Effect.exit(roots.find("/host/packages", { maxDepth: 2.5 }));
        assertExitFailure(
          exit,
          O.getOrElse(Exit.getCause(exit), () => Cause.empty)
        );
        assert.isTrue(
          Cause.hasDies(exit.cause),
          "developer wiring: find passes 2.5 to the walker's guard rather than reading it as a legitimate not-found"
        );
        assert.isFalse(A.some(exit.cause.reasons, Cause.isFailReason));
      })
    );
  });
});

describe("WorkspaceRoot.find — malformed ancestor manifest", () => {
  layer(
    rootsOver({
      "/ws/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
      "/ws/packages/a/package.json": "null",
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("continues past a null manifest to the valid workspace root above it", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found3 = yield* roots.find("/ws/packages/a/src");
        assert.strictEqual(found3, "/ws");
      })
    );
  });
});

describe("WorkspaceRoot.find — pnpm marker files", () => {
  for (const [label, tree, expected] of [
    [
      "ascends past a directory named pnpm-workspace.yaml",
      {
        "/repo/package.json": rootManifest(["packages/*"]),
        "/repo/packages/a/pnpm-workspace.yaml/child": "",
      },
      "/repo",
    ],
    [
      "selects a real marker file before an ancestor workspace",
      {
        "/repo/package.json": rootManifest(["packages/*"]),
        "/repo/packages/a/pnpm-workspace.yaml": "packages:\n  - children/*\n",
      },
      "/repo/packages/a",
    ],
    [
      "ascends past an ordinary directory to an ancestor manifest",
      {
        "/repo/package.json": rootManifest(["packages/*"]),
        "/repo/packages/a/ordinary/child": "",
      },
      "/repo",
    ],
    [
      "checks the same directory's manifest after rejecting a marker directory",
      {
        "/repo/package.json": rootManifest(["packages/*"]),
        "/repo/packages/a/package.json": rootManifest(["children/*"]),
        "/repo/packages/a/pnpm-workspace.yaml/child": "",
      },
      "/repo/packages/a",
    ],
    [
      "ascends past a marker directory to a real ancestor marker file",
      {
        "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "/repo/packages/a/pnpm-workspace.yaml/child": "",
      },
      "/repo",
    ],
  ] as const) {
    layer(rootsOver(tree), { timeout: "30 seconds" })((it) => {
      it.effect(label, () =>
        Effect.gen(function* () {
          const roots = yield* WorkspaceRoot;
          const found4 = yield* roots.find("/repo/packages/a");
          assert.strictEqual(found4, expected);
        })
      );
    });
  }
});

describe("WorkspaceRoot.find — marker stat failures", () => {
  const base = Layer.merge(
    Path.layer,
    MemoryFileSystem.layerWith(
      {
        "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
        "/repo/packages/a/package.json": rootManifest(["children/*"]),
        "/repo/packages/b/ordinary/child": "",
      },
      {
        faults: {
          stat: (path) =>
            path === "/repo/pnpm-workspace.yaml"
              ? undefined
              : Effect.fail(
                  PlatformError.systemError({
                    _tag: "PermissionDenied",
                    module: "FileSystem",
                    method: "stat",
                    pathOrDescriptor: path,
                  })
                ),
        },
      }
    )
  );

  layer(WorkspaceRoot.layer.pipe(Layer.provide(base)), { timeout: "30 seconds" })((it) => {
    it.effect("checks the same directory's manifest after a marker stat failure", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found5 = yield* roots.find("/repo/packages/a");
        assert.strictEqual(found5, "/repo/packages/a");
      })
    );

    it.effect("continues past marker stat failures to a valid ancestor", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found6 = yield* roots.find("/repo/packages/b");
        assert.strictEqual(found6, "/repo");
      })
    );
  });
});

const discovered: Tree = {
  "/repo/package.json": rootManifest(["packages/*", "apps/nested/*"]),
  "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  "/repo/packages/beta/package.json": manifest("@x/beta"),
  "/repo/apps/nested/web/package.json": manifest("@x/web"),
};

const discoveryOver = (tree: Tree) => {
  const base = platform(tree);
  const roots = WorkspaceRoot.layer.pipe(Layer.provide(base));
  return Layer.mergeAll(
    roots,
    WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(roots), Layer.provide(base))
  ).pipe(Layer.provideMerge(base));
};

describe("WorkspacePackage.workspaceRoot — carried by discovery", () => {
  layer(discoveryOver(discovered), { timeout: "30 seconds" })((it) => {
    it.effect("every discovered package carries the root the ascent found", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        const info = yield* discovery.info;

        assert.strictEqual(packages.length, 4, "root plus three members, so the loop below cannot pass vacuously");
        for (const pkg of packages) {
          assert.strictEqual(pkg.workspaceRoot, info.root, `${pkg.name} disagreed`);
        }
      })
    );

    it.effect("the root package carries a root equal to its own path", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const packages = yield* discovery.listPackages;
        const root = O.getOrUndefined(A.findFirst(packages, (pkg) => pkg.isRootWorkspace));
        assert.isDefined(root);
        assert.strictEqual(root?.workspaceRoot, root?.path);
      })
    );

    it.effect("a nested member carries the workspace root, NOT its parent directory", () =>
      Effect.gen(function* () {
        const discovery = yield* WorkspaceDiscovery;
        const web = yield* discovery.getPackage("@x/web");
        assert.strictEqual(web.path, "/repo/apps/nested/web");
        assert.strictEqual(
          web.workspaceRoot,
          "/repo",
          "apps/nested/web is three segments deep; a one-level walk-up lands on /repo/apps/nested's config"
        );
      })
    );
  });
});

const TestRoot = WorkspaceRoot.layerTest("/repo");

describe("WorkspaceRoot.layerTest", () => {
  layer(TestRoot, { timeout: "30 seconds" })((it) => {
    it.effect("resolves any cwd to the configured root, with no filesystem", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found7 = yield* roots.find("/repo/packages/utils/src");
        assert.strictEqual(found7, "/repo");
        const found8 = yield* roots.find("/somewhere/else");
        assert.strictEqual(found8, "/repo");
      })
    );

    it.effect("honours a stopAt that contains the root", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const found9 = yield* roots.find("/repo/packages/a", { stopAt: "/repo" });
        assert.strictEqual(found9, "/repo");
      })
    );

    it.effect("fails typed when the root lies ABOVE the ceiling", () =>
      Effect.gen(function* () {
        const roots = yield* WorkspaceRoot;
        const error = yield* Effect.flip(roots.find("/repo/packages/a", { stopAt: "/repo/packages" }));
        assert.instanceOf(
          error,
          WorkspaceRootNotFoundError,
          "a hand-rolled find that ignores the ceiling passes a bounded call under test and fails it live"
        );
        assert.strictEqual(error.stopAt, "/repo/packages");
        assert.deepStrictEqual([...error.markers], [...WORKSPACE_MARKERS]);
      })
    );
  });
});

describe("WorkspaceRoot.makeTest — ceiling containment", () => {
  layer(Path.layer, { timeout: "30 seconds" })((it) => {
    it.effect("treats the ceiling itself as containing the root", () =>
      Effect.gen(function* () {
        const double = yield* WorkspaceRoot.makeTest("/repo");
        const found10 = yield* double.find("/repo", { stopAt: "/repo" });
        assert.strictEqual(found10, "/repo");
      })
    );

    it.effect("does not treat a sibling with a shared prefix as containing the root, as a raw startsWith would", () =>
      Effect.gen(function* () {
        const double = yield* WorkspaceRoot.makeTest("/repo-other");
        const exit = yield* Effect.exit(double.find("/repo-other/packages/a", { stopAt: "/repo" }));
        assertExitFailure(
          exit,
          O.getOrElse(Exit.getCause(exit), () => Cause.empty)
        );
      })
    );

    it.effect("normalizes a stopAt carrying `..` before comparing, matching the live path", () =>
      Effect.gen(function* () {
        const double = yield* WorkspaceRoot.makeTest("/repo/packages/a");
        const found11 = yield* double.find("/repo/packages/a", { stopAt: "/repo/packages/../packages" });
        assert.strictEqual(
          found11,
          "/repo/packages/a",
          "the spelling resolves to an ancestor; a raw string compare would fail here and diverge from live"
        );
      })
    );
  });
});

describe("WorkspaceRoot.layerTest — agrees with the live service", () => {
  const marked: Tree = {
    "/repo/pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "/repo/packages/alpha/package.json": manifest("@x/alpha"),
  };

  layer(Layer.merge(rootsOver(marked), Path.layer), { timeout: "30 seconds" })((it) => {
    it.effect("both resolve the same root, and both refuse the same ceiling", () =>
      Effect.gen(function* () {
        const live = yield* WorkspaceRoot;
        const double = yield* WorkspaceRoot.makeTest("/repo");

        const found12 = yield* live.find("/repo/packages/alpha");
        const found13 = yield* double.find("/repo/packages/alpha");
        assert.strictEqual(
          found12,
          found13,
          "the double and the live service must agree, or the double is a liability"
        );

        const liveError = yield* Effect.flip(live.find("/repo/packages/alpha", { stopAt: "/repo/packages" }));
        const doubleError = yield* Effect.flip(double.find("/repo/packages/alpha", { stopAt: "/repo/packages" }));
        assert.strictEqual(liveError._tag, doubleError._tag);
        assert.strictEqual(liveError.stopAt, doubleError.stopAt);
      })
    );
  });
});

describe("WorkspacePackage.workspaceRoot — hand-built", () => {
  it("is carried verbatim, not re-derived from path arithmetic", () => {
    const pkg = WorkspacePackage.make({
      name: "@x/utils",
      version: "1.0.0",
      path: "/repo/packages/utils",
      packageJsonPath: "/repo/packages/utils/package.json",
      relativePath: "packages/utils",
      workspaceRoot: "/repo",
    });
    assert.strictEqual(pkg.workspaceRoot, "/repo", "a hand-built value still states its root: the field is required");
  });
});

describe("WorkspaceRootNotFoundError — message", () => {
  it("words the package.json marker as the field it requires, keeping `markers` raw", () => {
    const error = WorkspaceRootNotFoundError.make({ searchPath: "/solo", markers: WORKSPACE_MARKERS });
    assert.strictEqual(
      error.message,
      'No workspace root above /solo (looked for pnpm-workspace.yaml, package.json with a "workspaces" field)',
      "a single-package repo HAS a package.json; a bare package.json here claims the probe missed it"
    );
    assert.deepStrictEqual([...error.markers], ["pnpm-workspace.yaml", "package.json"]);
  });

  it("renders the ceiling alongside the reworded marker", () => {
    const error = WorkspaceRootNotFoundError.make({
      searchPath: "/outer/checkout",
      markers: WORKSPACE_MARKERS,
      stopAt: "/outer/checkout",
    });
    assert.strictEqual(
      error.message,
      'No workspace root above /outer/checkout up to /outer/checkout (looked for pnpm-workspace.yaml, package.json with a "workspaces" field)'
    );
  });
});
