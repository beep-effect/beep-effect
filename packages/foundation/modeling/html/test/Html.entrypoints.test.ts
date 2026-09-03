import { Html } from "@beep/html/Html";
import { Input } from "@beep/html/Html.model";
import { VERSION } from "@beep/html/Version";
import { describe, expect, it } from "@effect/vitest";
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
      const [exitCode, stderr] = yield* Effect.all([
        Effect.promise(() => child.exited),
        Effect.promise(() => new Response(child.stderr).text()),
      ]);

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

  it("validates detailed autocomplete through the staged facade", () => {
    const root = Input.make({
      autocomplete: O.some("section-checkout shipping email"),
      type: O.some("email"),
    });

    expect(Html.Conformant.issues(root)).toStrictEqual([]);
    const conformant = Effect.runSync(Html.Conformant.decode(root));
    expect(Html.Safe.issues(conformant)[0]?.rule).toBe("deniedElement");
    expect(Exit.isFailure(Effect.runSyncExit(Html.Safe.decode(conformant)))).toBe(true);
  });
});
