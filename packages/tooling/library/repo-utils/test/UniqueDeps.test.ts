import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { collectUniqueNpmDependencies } from "@beep/repo-utils/UniqueDeps";
import { A } from "@beep/utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, layer } from "@effect/vitest";
import { Context, Effect, Layer, Order, Path } from "effect";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const TestLayer = FsUtilsLive.pipe(Layer.provideMerge(PlatformLayer));
const pathApi = Effect.runSync(Effect.scoped(Layer.build(NodePath.layer).pipe(Effect.map(Context.get(Path.Path)))));

const MOCK_ROOT = pathApi.resolve(__dirname, "fixtures/mock-monorepo");

layer(TestLayer)("UniqueDeps", (it) => {
  describe("collectUniqueNpmDependencies", () => {
    it.effect(
      "should collect all unique runtime npm dependencies",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        // From our mock monorepo:
        // Root: dependencies = { typescript }
        // pkg-a: dependencies = { effect }
        // pkg-b: dependencies = { effect }
        // pkg-c: dependencies = { zod }, peerDependencies = { effect },
        //        optionalDependencies = { fsevents }
        // Unique: effect, fsevents, typescript, zod (sorted)
        expect(result.dependencies).toContain("effect");
        expect(result.dependencies).toContain("fsevents");
        expect(result.dependencies).toContain("typescript");
        expect(result.dependencies).toContain("zod");
      })
    );

    it.effect(
      "should collect all unique dev npm dependencies",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        // Root: devDependencies = { vitest }
        // pkg-a: devDependencies = { @types/node }
        // pkg-b: devDependencies = { vitest }
        // pkg-c: no devDependencies
        // Unique: @types/node, vitest (sorted)
        expect(result.devDependencies).toContain("@types/node");
        expect(result.devDependencies).toContain("vitest");
      })
    );

    it.effect(
      "should deduplicate dependencies that appear in multiple packages",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        // "effect" appears in pkg-a deps, pkg-b deps, and pkg-c peerDeps
        // but should only appear once
        const effectCount = A.filter(result.dependencies, (d) => d === "effect").length;
        expect(effectCount).toBe(1);

        // "vitest" appears in root and pkg-b devDeps
        const vitestCount = A.filter(result.devDependencies, (d) => d === "vitest").length;
        expect(vitestCount).toBe(1);
      })
    );

    it.effect(
      "should return sorted arrays",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        const sortedDeps = A.sort(result.dependencies, Order.String);
        const sortedDevDeps = A.sort(result.devDependencies, Order.String);
        expect(result.dependencies).toEqual(sortedDeps);
        expect(result.devDependencies).toEqual(sortedDevDeps);
      })
    );

    it.effect(
      "should not include workspace package names in results",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        expect(result.dependencies).not.toContain("@mock/pkg-a");
        expect(result.dependencies).not.toContain("@mock/pkg-b");
        expect(result.dependencies).not.toContain("@mock/pkg-c");
        expect(result.devDependencies).not.toContain("@mock/pkg-a");
        expect(result.devDependencies).not.toContain("@mock/pkg-b");
        expect(result.devDependencies).not.toContain("@mock/pkg-c");
      })
    );

    it.effect(
      "should include peer dependencies as runtime dependencies",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        // pkg-c has effect as peerDependency, should appear in runtime deps
        expect(result.dependencies).toContain("effect");
      })
    );

    it.effect(
      "should include optional dependencies as runtime dependencies",
      Effect.fn(function* () {
        const result = yield* collectUniqueNpmDependencies(MOCK_ROOT);
        // pkg-c has fsevents as optionalDependency, should appear in runtime deps
        // and never in devDependencies
        expect(result.dependencies).toContain("fsevents");
        expect(result.devDependencies).not.toContain("fsevents");
      })
    );
  });
});
