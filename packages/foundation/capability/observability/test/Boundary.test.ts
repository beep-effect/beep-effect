import { VERSION } from "@beep/observability";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";

const pathFromUrl = (url: URL): string => Str.replace(/\/$/u, "")(decodeURIComponent(url.pathname));
const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  [Str.replace(/\/+$/u, "")(base), ...segments.map((segment) => Str.replaceAll(/^\/+|\/+$/gu, "")(segment))]
    .filter((segment) => segment.length > 0)
    .join("/");

const packageRoot = pathFromUrl(new URL("..", import.meta.url));
const repoRoot = pathFromUrl(new URL("../../../../..", import.meta.url));
const boundaryTypecheckTimeout = 600_000;
const PackageJson = S.Struct({
  exports: S.Record(S.String, S.NullOr(S.String)),
  version: S.String,
});
const decodePackageJson = S.decodeUnknownEffect(S.fromJsonString(PackageJson));
const readText = (relativePath: string) => Effect.promise(() => Bun.file(joinPath(packageRoot, relativePath)).text());
const runTypecheck = Effect.fn("BoundaryTest.runTypecheck")(function* (tscPath: string, tsconfigPath: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  // exitCode owns a shorter child scope, closing each real compiler before the next fixture.
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make(tscPath, ["--pretty", "false", "--noEmit", "-p", tsconfigPath], {
      cwd: repoRoot,
      stdin: "ignore",
      stderr: "ignore",
      stdout: "ignore",
    })
  );
  return yield* exitCode === 0
    ? Effect.void
    : Effect.die(new Error(`tsc failed for ${tsconfigPath} with exit code ${exitCode}`));
});

describe("Boundary", () => {
  it.effect(
    "keeps package exports explicit and removes root node ambient types",
    () =>
      Effect.gen(function* () {
        const packageJson = yield* readText("package.json").pipe(Effect.flatMap(decodePackageJson));
        const tsconfigSource = yield* readText("tsconfig.json");

        expect(packageJson.exports).toMatchObject({
          ".": "./src/index.ts",
          "./experimental/server": "./src/experimental/server/index.ts",
          "./server": "./src/server/index.ts",
          "./web": "./src/web/index.ts",
        });
        expect(packageJson.exports).not.toHaveProperty("./*");
        expect(VERSION).toBe(packageJson.version);
        expect(tsconfigSource).not.toMatch(/"types"\s*:\s*\[[^\]]*"node"/m);
      }),
    { timeout: 60_000 }
  );

  it.effect(
    "keeps the root and web entrypoints free from server-only imports",
    () =>
      Effect.gen(function* () {
        const indexSource = yield* readText("src/index.ts");
        const webLayerSource = yield* readText("src/web/Layer.ts");

        expect(indexSource).not.toContain("./server");
        expect(indexSource).not.toContain("./web");
        expect(indexSource).not.toContain("./experimental");
        expect(webLayerSource).not.toContain("effect/devtools");
        expect(webLayerSource).not.toContain("effect/observability");
        expect(webLayerSource).not.toContain("@effect/platform-");
        expect(webLayerSource).not.toContain("node:");
      }),
    { timeout: 60_000 }
  );

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "typechecks browser-safe, server-safe, and experimental-server fixtures",
      () => {
        const program = Effect.gen(function* () {
          const tscPath = joinPath(repoRoot, "node_modules/.bin/tsc");
          const fixtureTsconfigs = [
            joinPath(packageRoot, "test/fixtures/tsconfig.browser.json"),
            joinPath(packageRoot, "test/fixtures/tsconfig.server.json"),
            joinPath(packageRoot, "test/fixtures/tsconfig.experimental-server.json"),
          ];

          for (const tsconfigPath of fixtureTsconfigs) {
            yield* runTypecheck(tscPath, tsconfigPath);
          }
        });

        return program;
      },
      { timeout: boundaryTypecheckTimeout }
    );
  });
});
