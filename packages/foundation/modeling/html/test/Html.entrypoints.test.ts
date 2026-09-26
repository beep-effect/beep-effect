import { Html } from "@beep/html/Html";
import { Input } from "@beep/html/Html.model";
import { VERSION } from "@beep/html/Version";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const packageRoot = new URL("..", import.meta.url).pathname;
const PackageJson = S.Struct({
  exports: S.Record(S.String, S.NullOr(S.String)),
  publishConfig: S.Struct({
    exports: S.Record(S.String, S.NullOr(S.String)),
  }),
  version: S.String,
});
const decodePackageJson = S.decodeUnknownEffect(S.fromJsonString(PackageJson));

describe("@beep/html per-module entry points", () => {
  it.effect("resolves the explicit subpaths through the package export map", () =>
    Effect.gen(function* () {
      const { child, stderr: readStderr } = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const child = Bun.spawn(
            [
              process.execPath,
              "-e",
              'const { Html } = await import("@beep/html/Html"); const { VERSION } = await import("@beep/html/Version"); if (typeof Html.Conformant.decode !== "function" || typeof VERSION !== "string") process.exit(1)',
            ],
            {
              cwd: packageRoot,
              stderr: "pipe",
              stdout: "ignore",
            }
          );
          return { child, stderr: new Response(child.stderr).text() };
        }).pipe(Effect.withSpan("Html.entrypointsImport.spawn")),
        ({ child, stderr }) =>
          Effect.promise(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
            return Promise.allSettled([child.exited, stderr]);
          }).pipe(Effect.withSpan("Html.entrypointsImport.cleanup"))
      );
      const [exitCode, stderr] = yield* Effect.all([
        Effect.promise(() => child.exited).pipe(Effect.withSpan("Html.entrypointsImport.exit")),
        Effect.promise(() => readStderr).pipe(Effect.withSpan("Html.entrypointsImport.drain")),
      ]).pipe(Effect.withSpan("Html.entrypointsImport.import"));

      expect({ exitCode, stderr }).toStrictEqual({ exitCode: 0, stderr: "" });
    })
  );

  it.effect("keeps the source and published exports aligned with the package version", () =>
    Effect.gen(function* () {
      const packageJson = yield* Effect.promise(() =>
        Bun.file(new URL("../package.json", import.meta.url)).text()
      ).pipe(Effect.flatMap(decodePackageJson));

      expect(packageJson.exports).toMatchObject({
        "./Html": "./src/Html.ts",
        "./Version": "./src/Version.ts",
      });
      expect(packageJson.publishConfig.exports).toMatchObject({
        "./Html": "./dist/Html.js",
        "./Version": "./dist/Version.js",
      });
      expect(VERSION).toBe(packageJson.version);
    })
  );

  it.effect("validates detailed autocomplete through the staged facade", () =>
    Effect.gen(function* () {
      const root = Input.make({
        autocomplete: O.some("section-checkout shipping email"),
        type: O.some("email"),
      });

      expect(Html.Conformant.issues(root)).toStrictEqual([]);
      const conformant = yield* Html.Conformant.decode(root);
      expect(Html.Safe.issues(conformant)[0]?.rule).toBe("deniedElement");
      const safeExit = yield* Effect.exit(Html.Safe.decode(conformant));
      safeExit.pipe(Exit.isFailure, assertTrue);
    })
  );
});
