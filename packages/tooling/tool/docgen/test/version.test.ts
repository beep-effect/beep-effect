import * as Version from "@beep/repo-docgen/Version";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
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
