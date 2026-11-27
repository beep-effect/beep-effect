import { MemoryFileSystem } from "@beep/memfs";
import { FindNearestOptions, TsconfigDiscovery } from "@beep/repo-tsconfig/TsconfigDiscovery";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Tracer from "effect/Tracer";
import { fixtureLayer, tree } from "./support/fixtures.ts";
import type { FixtureTree } from "./support/fixtures.ts";

describe("FindNearestOptions runtime model", () => {
  it("decodes plain options and preserves exact optional-key semantics", () => {
    const options: FindNearestOptions.Encoded = { filename: "tsconfig.build.json", stopAt: "/a/b" };
    assertSome(S.decodeOption(FindNearestOptions)(options), options);
    assertSome(S.decodeOption(FindNearestOptions)({}), FindNearestOptions.make({}));
    assert.isFalse(S.is(FindNearestOptions)({ filename: undefined }));
    assert.isFalse(S.is(FindNearestOptions)({ stopAt: undefined }));
    assert.isFalse(S.is(FindNearestOptions)({ filename: 1 }));
  });
});

const EMPTY = "{}";

layer(fixtureLayer(tree(["/a/b/tsconfig.json", EMPTY], ["/a/tsconfig.json", EMPTY])), { timeout: "30 seconds" })(
  "TsconfigDiscovery.findNearest, nearest wins",
  (it) => {
    it.effect("prefers the nearer ancestor's config", () =>
      Effect.gen(function* () {
        const found = yield* TsconfigDiscovery.findNearest("/a/b/c");
        assertSome(found, "/a/b/tsconfig.json");
      })
    );
  }
);

layer(fixtureLayer(tree(["/a/tsconfig.json", EMPTY])), { timeout: "30 seconds" })(
  "TsconfigDiscovery.findNearest, tracing",
  (it) => {
    it.effect("names its span TsconfigDiscovery.findNearest, never the bare findNearest", () =>
      Effect.gen(function* () {
        let spanNames = A.empty<string>();
        const tracer = Tracer.make({
          span(options) {
            spanNames = A.append(spanNames, options.name);
            return new Tracer.NativeSpan(options);
          },
        });
        const found = yield* TsconfigDiscovery.findNearest("/a/b").pipe(Effect.withTracer(tracer));
        assertSome(found, "/a/tsconfig.json");
        assert.isTrue(A.contains(spanNames, "TsconfigDiscovery.findNearest"));
        assert.isFalse(A.contains(spanNames, "findNearest"));
      })
    );
  }
);

layer(fixtureLayer(tree()), { timeout: "30 seconds" })("TsconfigDiscovery.findNearest, none anywhere", (it) => {
  it.effect("returns Option.none() when no ancestor has a config", () =>
    Effect.gen(function* () {
      const found = yield* TsconfigDiscovery.findNearest("/a/b/c");
      assertNone(found);
    })
  );
});

layer(fixtureLayer(tree(["/a/b/tsconfig.build.json", EMPTY], ["/a/b/tsconfig.json", EMPTY])), {
  timeout: "30 seconds",
})("TsconfigDiscovery.findNearest, filename option", (it) => {
  it.effect("finds only the named filename, ignoring tsconfig.json in the same directory", () =>
    Effect.gen(function* () {
      const found = yield* TsconfigDiscovery.findNearest("/a/b/c", { filename: "tsconfig.build.json" });
      assertSome(found, "/a/b/tsconfig.build.json");
    })
  );
});

layer(fixtureLayer(tree(["/a/tsconfig.json", EMPTY])), { timeout: "30 seconds" })(
  "TsconfigDiscovery.findNearest, stopAt bounds the walk",
  (it) => {
    it.effect("does not ascend past stopAt", () =>
      Effect.gen(function* () {
        const found = yield* TsconfigDiscovery.findNearest("/a/b/c", { stopAt: "/a/b" });
        assertNone(found);
      })
    );
  }
);

layer(fixtureLayer(tree(["/a/b/tsconfig.json", EMPTY], ["/a/tsconfig.json", EMPTY])), { timeout: "30 seconds" })(
  "TsconfigDiscovery.findNearest, stopAt boundary is inclusive",
  (it) => {
    it.effect("finds a config exactly at the stopAt directory, never the decoy above it", () =>
      Effect.gen(function* () {
        const found = yield* TsconfigDiscovery.findNearest("/a/b/c", { stopAt: "/a/b" });
        assertSome(found, "/a/b/tsconfig.json");
      })
    );
  }
);

const FsDenying = (denied: string, tree: FixtureTree) =>
  MemoryFileSystem.layerWith(tree, {
    faults: {
      exists: (path: string) =>
        path === denied
          ? Effect.fail(
              PlatformError.systemError({
                _tag: "PermissionDenied",
                module: "FileSystem",
                method: "exists",
                pathOrDescriptor: path,
              })
            )
          : undefined,
    },
  });

layer(
  Layer.mergeAll(
    FsDenying("/a/b/tsconfig.json", tree(["/a/b/tsconfig.json", EMPTY], ["/a/tsconfig.json", EMPTY])),
    Path.layer
  ),
  { timeout: "30 seconds" }
)("TsconfigDiscovery.findNearest, permission denied on a nearer candidate that genuinely exists", (it) => {
  it.effect("absorbs the denied probe and keeps ascending to the further config", () =>
    Effect.gen(function* () {
      const found = yield* TsconfigDiscovery.findNearest("/a/b/c");
      assertSome(found, "/a/tsconfig.json");
    })
  );
});
