import { Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

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
});
const decodePackageJson = S.decodeUnknownEffect(S.fromJsonString(PackageJson));
const readText = (relativePath: string) => Effect.promise(() => Bun.file(joinPath(packageRoot, relativePath)).text());
const runTypecheck = (tscPath: string, tsconfigPath: string) =>
  Effect.promise(
    () =>
      Bun.spawn([tscPath, "--pretty", "false", "--noEmit", "-p", tsconfigPath], {
        cwd: repoRoot,
        stderr: "ignore",
        stdout: "ignore",
      }).exited
  ).pipe(
    Effect.flatMap((exitCode) =>
      exitCode === 0 ? Effect.void : Effect.die(new Error(`tsc failed for ${tsconfigPath} with exit code ${exitCode}`))
    )
  );

describe("Boundary", () => {
  it("keeps package exports explicit and removes root node ambient types", { timeout: 60_000 }, () =>
    Effect.runPromise(
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
        expect(tsconfigSource).not.toMatch(/"types"\s*:\s*\[[^\]]*"node"/m);
      })
    )
  );

  it("keeps the root and web entrypoints free from server-only imports", { timeout: 60_000 }, () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const indexSource = yield* readText("src/index.ts");
        const webLayerSource = yield* readText("src/web/Layer.ts");

        expect(indexSource).not.toContain("./server");
        expect(indexSource).not.toContain("./web");
        expect(indexSource).not.toContain("./experimental");
        expect(webLayerSource).not.toContain("effect/unstable/devtools");
        expect(webLayerSource).not.toContain("effect/unstable/observability");
        expect(webLayerSource).not.toContain("@effect/platform-");
        expect(webLayerSource).not.toContain("node:");
      })
    )
  );

  it("typechecks browser-safe, server-safe, and experimental-server fixtures", {
    timeout: boundaryTypecheckTimeout,
  }, () => {
    const program: Effect.Effect<void> = Effect.gen(function* () {
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

    return Effect.runPromise(program);
  });
});
