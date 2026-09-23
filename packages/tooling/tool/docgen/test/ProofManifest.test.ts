import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Domain from "@beep/repo-docgen/Domain";
import * as ProofManifest from "@beep/repo-docgen/ProofManifest";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect, layer } from "@effect/vitest";
import { Cause, Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as Crypto from "effect/Crypto";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { defaultDocgenConfig } from "./helpers.ts";

const packageName = "@beep/proof-manifest-fixture";

const isDocgenError = S.is(Domain.DocgenError);

const encodeManifestJson = S.encodeUnknownEffect(S.fromJsonString(ProofManifest.DocgenProofManifest));

const testLayer = Layer.mergeAll(
  Configuration.Configuration.layer({ ...defaultDocgenConfig, projectName: packageName }),
  FsUtilsLive
).pipe(Layer.provideMerge(BunServices.layer));

const testProcess = (packagePath: string) =>
  Domain.Process.of({
    argv: Effect.succeed(["bun", "docgen"]),
    cwd: Effect.succeed(packagePath),
    platform: Effect.succeed("linux"),
  });

const failingCrypto = Crypto.make({
  randomBytes: (size) => new Uint8Array(size),
  digest: () =>
    Effect.fail(
      PlatformError.badArgument({
        module: "Crypto",
        method: "digest",
        description: "proof manifest digest refusal",
      })
    ),
});

const makeFixturePackage = Effect.fn("makeFixturePackage")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packagePath = yield* fs.makeTempDirectoryScoped({ prefix: "docgen-proof-" });

  yield* fs.makeDirectory(path.join(packagePath, "src"), { recursive: true });
  yield* fs.makeDirectory(path.join(packagePath, "docs"), { recursive: true });
  yield* fs.writeFileString(path.join(packagePath, "package.json"), `{"name":"${packageName}","version":"0.0.0"}\n`);
  yield* fs.writeFileString(path.join(packagePath, "src", "index.ts"), "export const value = 1\n");
  yield* fs.writeFileString(path.join(packagePath, "docs", "index.md"), "# docs\n");

  return packagePath;
});

layer(testLayer)("ProofManifest", (it) => {
  it.effect("writes a manifest whose fingerprint verifies as current", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const manifest = yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath))
      );

      expect(manifest.standard).toBe("docgen-proof-manifest");
      expect(manifest.schemaVersion).toBe("1");
      expect(manifest.packageName).toBe(packageName);
      expect(manifest.manifestPath).toBe(".beep/docgen/proof.json");
      expect(manifest.fingerprint.inputFileCount).toBe(manifest.inputs.length);
      expect(manifest.inputs.map((file) => file.path)).toEqual(["package.json", "src/index.ts"]);
      expect(manifest.outputs.map((file) => file.path)).toEqual(["docs/index.md"]);

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, packageName);
      expect(verification.status).toBe("current");
      expect(verification.packagePath).toBe(packagePath);
    })
  );

  it.effect("reports a missing manifest instead of failing", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, packageName);

      expect(verification.status).toBe("missing");
      expect(verification.reason).toBe("proof manifest is missing");
    })
  );

  it.effect("reports a stale manifest when the recorded package name differs", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath))
      );

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, "@beep/other-package");

      expect(verification.status).toBe("stale");
      expect(verification.reason).toBe("manifest package name does not match");
    })
  );

  it.effect("reports a stale manifest when package inputs change", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath))
      );
      yield* fs.writeFileString(path.join(packagePath, "src", "index.ts"), "export const value = 2\n");

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, packageName);

      expect(verification.status).toBe("stale");
      expect(verification.reason).toBe("package docgen inputs changed");
    })
  );

  it.effect("reports a stale manifest when generated docs change", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath))
      );
      yield* fs.writeFileString(path.join(packagePath, "docs", "index.md"), "# docs changed\n");

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, packageName);

      expect(verification.status).toBe("stale");
      expect(verification.reason).toBe("generated docs output changed");
    })
  );

  it.effect("reports a stale manifest when the docgen tool version changes", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const manifest = yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath))
      );
      const manifestPath = path.join(packagePath, ".beep", "docgen", "proof.json");
      const rewritten = ProofManifest.DocgenProofManifest.make({
        ...manifest,
        fingerprint: ProofManifest.DocgenProofManifestFingerprint.make({
          ...manifest.fingerprint,
          toolVersion: "0.0.0-stale",
        }),
      });
      yield* fs.writeFileString(manifestPath, yield* encodeManifestJson(rewritten));

      const verification = yield* ProofManifest.verifyDocgenProofManifest(packagePath, packageName);

      expect(verification.status).toBe("stale");
      expect(verification.reason).toBe("docgen tool version changed");
    })
  );

  it.effect("fails with a DocgenError when the platform digest refuses", () =>
    Effect.gen(function* () {
      const packagePath = yield* makeFixturePackage();

      const exit = yield* ProofManifest.writeDocgenProofManifest().pipe(
        Effect.provideService(Domain.Process, testProcess(packagePath)),
        Effect.provideService(Crypto.Crypto, failingCrypto),
        Effect.exit
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const failure = Cause.squash(exit.cause);
        expect(isDocgenError(failure)).toBe(true);
        if (isDocgenError(failure)) {
          expect(failure.message).toContain("[ProofManifest.sha256] Failed to hash proof identity");
        }
      }
    })
  );
});
