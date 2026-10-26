import * as Version from "@beep/repo-docgen/Version";
import { it } from "@beep/test-runner";
import { Str } from "@beep/utils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const decodeManifestVersion = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ version: S.String })));

it.layer(BunServices.layer)("Version", (it) => {
  it.effect("reads the docgen package version from its manifest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const manifest = yield* decodeManifestVersion(yield* fs.readFileString("package.json"));
      const version = yield* Version.readModuleVersion();
      expect(version).toBe(manifest.version);
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    })
  );
});

// No file system entry exists, so the manifest read fails and maps to a
// `DocgenError` naming the manifest.
it.layer(Layer.mergeAll(Path.layer, FileSystem.layerNoop({})), { timeout: "30 seconds" })(
  "Version without a manifest",
  (it) => {
    it.effect("fails with a DocgenError when the manifest cannot be read", () =>
      Effect.gen(function* () {
        const error = yield* Version.readModuleVersion().pipe(Effect.flip);
        assertTrue(Str.includes("[Version.readModuleVersion] Failed to read")(error.message));
        expect(error.cause).toBeDefined();
      })
    );
  }
);

const rejectedManifestUrl = Effect.fail(
  new PlatformError.BadArgument({ module: "VersionTest", method: "fromFileUrl" })
);

const rejectingPath = Layer.effect(
  Path.Path,
  Effect.gen(function* () {
    const path = yield* Path.Path;
    return {
      ...path,
      fromFileUrl: Effect.fn("VersionTest.fromFileUrl")(function* () {
        return yield* rejectedManifestUrl;
      }),
    };
  })
).pipe(Layer.provide(Path.layer));

it.layer(Layer.mergeAll(rejectingPath, FileSystem.layerNoop({})), { timeout: "30 seconds" })(
  "Version with a rejected manifest URL",
  (it) => {
    it.effect("fails with a DocgenError when the manifest URL does not resolve", () =>
      Effect.gen(function* () {
        const error = yield* Version.readModuleVersion().pipe(Effect.flip);
        assertTrue(Str.includes("[Version.readModuleVersion] Failed to resolve manifest path")(error.message));
      })
    );
  }
);

// `readManifestVersion` reads through the presence-lenient `PackageManifest`
// tier and requires `version`: unrelated absent fields are fine, a present
// `version` must be strict semver, and the text must be JSON.
it.layer(BunServices.layer)("Version.readManifestVersion", (it) => {
  const readFrom = Effect.fn("VersionTest.readFrom")(function* (text: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(yield* fs.makeTempDirectoryScoped(), "package.json");
    yield* fs.writeFileString(file, text);
    return yield* Version.readManifestVersion(file);
  });

  it.effect("reads the version of a manifest without other fields", () =>
    Effect.gen(function* () {
      expect(yield* readFrom('{"version":"1.2.3"}')).toBe("1.2.3");
    })
  );

  it.effect("requires a version", () =>
    Effect.gen(function* () {
      const error = yield* readFrom('{"name":"@beep/demo"}').pipe(Effect.flip);
      assertTrue(Str.includes("must declare `version`")(error.message));
    })
  );

  it.effect("rejects a version that is not semver", () =>
    Effect.gen(function* () {
      const error = yield* readFrom('{"version":"1.0"}').pipe(Effect.flip);
      assertTrue(Str.includes("[Version.readModuleVersion] Failed to read")(error.message));
    })
  );

  it.effect("rejects JSONC text", () =>
    Effect.gen(function* () {
      const error = yield* readFrom('{\n  // comment\n  "version": "1.2.3",\n}\n').pipe(Effect.flip);
      assertTrue(Str.includes("[Version.readModuleVersion] Failed to read")(error.message));
    })
  );
});
