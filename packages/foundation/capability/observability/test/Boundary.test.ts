import { redactString } from "@beep/observability";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const pathFromUrl = (url: URL): string => Str.replace(/\/$/u, "")(decodeURIComponent(url.pathname));
const joinPath = (base: string, ...segments: ReadonlyArray<string>): string =>
  pipe(
    [Str.replace(/\/+$/u, "")(base), ...A.map(segments, Str.replaceAll(/^\/+|\/+$/gu, ""))],
    A.filter((segment) => segment.length > 0),
    A.join("/")
  );

const packageRoot = pathFromUrl(new URL("..", import.meta.url));
const repoRoot = pathFromUrl(new URL("../../../../..", import.meta.url));
const boundaryTypecheckTimeout = 600_000;
const PackageJson = S.Struct({
  exports: S.Record(S.String, S.NullOr(S.String)),
  version: S.String,
});
const decodePackageJson = S.decodeUnknownEffect(S.fromJsonString(PackageJson));
const readText = (relativePath: string) => Effect.promise(() => Bun.file(joinPath(packageRoot, relativePath)).text());
const compilerOutputLimit = 4_096;
const collectCompilerOutput = Stream.runFold(
  () => "",
  (output: string, chunk: string) => Str.slice(0, compilerOutputLimit)(output + chunk)
);
const safeCompilerDiagnostic = (output: string): string =>
  redactString(Str.replaceAll(repoRoot, "<repo>")(output), compilerOutputLimit);
const runTypecheck = Effect.fn("BoundaryTest.runTypecheck")(function* (tscPath: string, tsconfigPath: string) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const child = yield* spawner.spawn(
    ChildProcess.make(tscPath, ["--pretty", "false", "--noEmit", "-p", tsconfigPath], {
      cwd: repoRoot,
      stdin: "ignore",
      stderr: "pipe",
      stdout: "pipe",
    })
  );
  const [exitCode, stdout, stderr] = yield* Effect.all(
    [
      child.exitCode,
      child.stdout.pipe(Stream.decodeText(), collectCompilerOutput),
      child.stderr.pipe(Stream.decodeText(), collectCompilerOutput),
    ],
    { concurrency: "unbounded" }
  );
  return yield* exitCode === 0
    ? Effect.void
    : Effect.die(
        new Error(
          `tsc failed for ${safeCompilerDiagnostic(tsconfigPath)} with exit code ${exitCode}\nstdout:\n${safeCompilerDiagnostic(stdout)}\nstderr:\n${safeCompilerDiagnostic(stderr)}`
        )
      );
}, Effect.scoped);

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
          "./strict": "./src/strict/index.ts",
          "./web": "./src/web/index.ts",
        });
        expect(packageJson.exports).not.toHaveProperty("./*");
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

  it.effect(
    "keeps the strict entrypoint free from server, SDK and platform imports",
    () =>
      Effect.gen(function* () {
        const strictSources = yield* Effect.forEach(
          [
            "src/strict/index.ts",
            "src/strict/StrictGate.layer.ts",
            "src/strict/StrictGate.schemas.ts",
            "src/strict/StrictGate.service.ts",
            "src/strict/StrictSpool.errors.ts",
            "src/strict/StrictSpool.layer.ts",
            "src/strict/StrictSpool.schemas.ts",
            "src/strict/StrictSpool.service.ts",
            "src/strict/StrictTier.behavior.ts",
            "src/strict/StrictTier.schemas.ts",
          ],
          readText,
          { concurrency: 1 }
        );

        for (const source of strictSources) {
          expect(source).not.toContain("../server");
          expect(source).not.toContain("../experimental");
          expect(source).not.toContain("../web");
          expect(source).not.toContain("@effect/opentelemetry");
          expect(source).not.toContain("@opentelemetry/");
          expect(source).not.toContain("@effect/platform-");
          expect(source).not.toContain("node:");
        }
      }),
    { timeout: 60_000 }
  );

  it.layer(NodeServices.layer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "typechecks browser-safe, server-safe, experimental-server and strict-safe fixtures",
      () => {
        const program = Effect.gen(function* () {
          const tscPath = joinPath(repoRoot, "node_modules/.bin/tsc");
          const fixtureTsconfigs = [
            joinPath(packageRoot, "test/fixtures/tsconfig.browser.json"),
            joinPath(packageRoot, "test/fixtures/tsconfig.server.json"),
            joinPath(packageRoot, "test/fixtures/tsconfig.experimental-server.json"),
            joinPath(packageRoot, "test/fixtures/tsconfig.strict.json"),
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
