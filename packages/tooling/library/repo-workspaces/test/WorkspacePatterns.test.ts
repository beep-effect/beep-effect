import { WorkspacePatternReadError, WorkspacePatterns } from "@beep/repo-workspaces/WorkspacePatterns";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertInstanceOf, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { platform, platformWith } from "./support/fixtures.ts";
import type { Tree } from "./support/fixtures.ts";

const UnknownJson = S.fromJsonString(S.Unknown);

const tree: Tree = {
  "/repo/pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
  "/repo/package.json": Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({ name: "root", workspaces: ["apps/*"] }),
    identity
  ),
};

describe("WorkspacePatterns.read — the happy paths", () => {
  layer(platform(tree), { timeout: "30 seconds" })((it) => {
    it.effect("prefers pnpm-workspace.yaml over the manifest workspaces field", () =>
      Effect.gen(function* () {
        const read1 = yield* WorkspacePatterns.read("/repo");
        assert.deepStrictEqual(read1, ["packages/*"]);
      })
    );
  });
});

describe("WorkspacePatterns.read — a pnpm-workspace.yaml with no packages key falls through", () => {
  layer(
    platform({
      "/repo/pnpm-workspace.yaml": "onlyBuiltDependencies:\n  - esbuild\n",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", workspaces: ["apps/*"] }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("reads the manifest workspaces field", () =>
      Effect.gen(function* () {
        const read2 = yield* WorkspacePatterns.read("/repo");
        assert.deepStrictEqual(read2, ["apps/*"]);
      })
    );
  });
});

describe("WorkspacePatterns.read — an absent config is not an error", () => {
  layer(platform({ "/repo/README.md": "no config here" }), { timeout: "30 seconds" })((it) => {
    it.effect("a standalone directory declares no patterns", () =>
      Effect.gen(function* () {
        const read3 = yield* WorkspacePatterns.read("/repo");
        assert.deepStrictEqual(read3, [], "absent is a real, distinguishable condition; only unreadable is the bug");
      })
    );
  });
});

describe("WorkspacePatterns.read — an unreadable pnpm-workspace.yaml", () => {
  layer(platformWith({ unreadableFiles: ["/repo/pnpm-workspace.yaml"] })(tree), { timeout: "30 seconds" })((it) => {
    it.effect("fails typed rather than reading as an empty document", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(WorkspacePatterns.read("/repo"));
        assert.strictEqual(
          failure.kind,
          "read",
          'substituting "" made an unreadable file and an empty one identical: no packages declared'
        );
        assert.strictEqual(failure.path, "/repo/pnpm-workspace.yaml");
      })
    );
  });
});

describe("WorkspacePatterns.read — an unreadable package.json", () => {
  layer(
    platformWith({ unreadableFiles: ["/repo/package.json"] })({
      "/repo/pnpm-workspace.yaml": "onlyBuiltDependencies:\n  - esbuild\n",
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", workspaces: ["apps/*"] }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("fails typed rather than reading as `{}`", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(WorkspacePatterns.read("/repo"));
        assert.strictEqual(
          failure.kind,
          "read",
          "read is tested directly: discovery re-reads package.json and fails the same way whether read swallows or not"
        );
        assert.strictEqual(
          failure.path,
          "/repo/package.json",
          "the pnpm config declares no packages:, so reading falls through to the unreadable manifest"
        );
      })
    );
  });
});

describe("WorkspacePatterns.read — a malformed config still fails typed", () => {
  layer(platform({ "/repo/pnpm-workspace.yaml": "packages:\n  - [unclosed\n" }), { timeout: "30 seconds" })((it) => {
    it.effect("invalid YAML is invalidYaml, not a defect", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(WorkspacePatterns.read("/repo"));
        assert.strictEqual(failure.kind, "invalidYaml");
      })
    );
  });
});

describe("WorkspacePatterns — the public leaf's failure is the kit's tagged error", () => {
  layer(platform({ "/repo/package.json": "{" }), { timeout: "30 seconds" })((it) => {
    it.effect("fails with WorkspacePatternReadError and renders the path and kind", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip(WorkspacePatterns.read("/repo"));
        assertInstanceOf(failure, WorkspacePatternReadError);
        strictEqual(failure._tag, "WorkspacePatternReadError");
        strictEqual(failure.message, "Workspace patterns could not be read from /repo/package.json (invalidJson)");
      })
    );
  });
});

describe("WorkspacePatterns — a malformed `workspaces` field reads as no patterns", () => {
  layer(
    platform({
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", workspaces: 7 }),
        identity
      ),
    }),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("a scalar `workspaces` is an empty list, not a failure", () =>
      Effect.gen(function* () {
        const read4 = yield* WorkspacePatterns.read("/repo");
        deepStrictEqual(
          read4,
          [],
          "inverted pin (4-A2): the retired repo-cli readers rejected this; the kit reads it as WorkspaceDiscovery does"
        );
      })
    );
  });

  layer(
    platform({
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({
          name: "root",
          workspaces: { catalog: { effect: "4.0.0" } },
        }),
        identity
      ),
    }),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a catalog-only object form declares no workspace packages", () =>
      Effect.gen(function* () {
        const read5 = yield* WorkspacePatterns.read("/repo");
        deepStrictEqual(read5, []);
      })
    );
  });

  layer(
    platform({
      "/repo/package.json": Result.getOrThrowWith(
        S.encodeUnknownResult(UnknownJson)({ name: "root", workspaces: ["packages/*", 42, null] }),
        identity
      ),
    }),
    {
      timeout: "30 seconds",
    }
  )((it) => {
    it.effect("non-string entries are dropped, not rejected", () =>
      Effect.gen(function* () {
        const read6 = yield* WorkspacePatterns.read("/repo");
        deepStrictEqual(read6, ["packages/*"]);
      })
    );
  });
});

describe("WorkspacePatterns.forMatching — the declared text as the enumerators match it", () => {
  it("strips trailing slashes and leading ./ segments, after the ! of an exclusion", () => {
    deepStrictEqual(
      WorkspacePatterns.forMatching(["packages/*/", "./tools/cli", "././apps/web/", "!./packages/core"]),
      ["packages/*", "tools/cli", "apps/web", "!packages/core"]
    );
  });

  it("follows a trailing /** with its base, for an include and an exclusion", () => {
    deepStrictEqual(WorkspacePatterns.forMatching(["packages/core/**", "!./packages/legacy/**/", "**"]), [
      "packages/core/**",
      "packages/core",
      "!packages/legacy/**",
      "!packages/legacy",
      "**",
    ]);
  });

  it("keeps a pattern that normalizes to nothing as declared", () => {
    deepStrictEqual(WorkspacePatterns.forMatching(["/", "!/", "./", "!"]), ["/", "!/", "./", "!"]);
  });
});
