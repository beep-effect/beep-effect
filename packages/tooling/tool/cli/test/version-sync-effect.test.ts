import {
  BunVersionState,
  buildBunReport,
  buildEffectReport,
  buildNodeReport,
  extractBunArchiveChecksum,
  resolveBunVersions,
  resolveEffectCatalog,
  resolveNodeVersions,
  UpdateApplierService,
  UpdateApplierServiceLive,
  updateCatalogEntry,
  updateVercelBunVersion,
  VersionSyncReport,
  VersionSyncResolution,
} from "@beep/repo-cli/test/VersionSync";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { FetchHttpClient } from "effect/unstable/http";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));
const VersionSyncTestLayer = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer, UpdateApplierServiceLive);

layer(VersionSyncTestLayer)("VersionSync Effect Catalog", (it) => {
  describe("resolveEffectCatalog", () => {
    it.effect(
      "detects drift for lockstep Effect packages while ignoring non-lockstep Effect tools",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${encodeJson({
            name: "@beep/test-root",
            catalog: {
              effect: "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
              "@effect/platform-bun": "^4.0.0-beta.28",
              "@effect/vitest": "^4.0.0-beta.26",
              "@effect/tsgo": "^0.5.0",
            },
          })}\n`
        );

        const state = yield* resolveEffectCatalog(tmpDir);
        const report = buildEffectReport(state);

        expect(report.status).toBe("drift");
        expect(O.isSome(report.latest)).toBe(true);
        if (O.isSome(report.latest)) {
          expect(report.latest.value).toBe("^4.0.0-beta.28");
        }
        expect(report.items).toHaveLength(2);
        expect(A.map(report.items, (item) => item.field)).toEqual([
          "catalog.@effect/opentelemetry",
          "catalog.@effect/vitest",
        ]);
        expect(A.map(report.items, (item) => item.expected)).toEqual(["^4.0.0-beta.28", "^4.0.0-beta.28"]);

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "parses package.json JSONC with comments and trailing commas through the shared schema module",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `{
            // root catalog comment
            "name": "@beep/test-root",
            "catalog": {
              "effect": "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
            },
          }\n`
        );

        const state = yield* resolveEffectCatalog(tmpDir);
        const report = buildEffectReport(state);

        expect(report.status).toBe("drift");
        expect(report.items).toHaveLength(1);
        expect(report.items[0]?.field).toBe("catalog.@effect/opentelemetry");
        expect(report.items[0]?.expected).toBe("^4.0.0-beta.28");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("updateCatalogEntry", () => {
    it.effect(
      "rewrites a root package.json catalog entry in place",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const packageJsonPath = path.join(tmpDir, "package.json");

        yield* fs.writeFileString(
          packageJsonPath,
          `${encodeJson({
            name: "@beep/test-root",
            catalog: {
              effect: "^4.0.0-beta.28",
              "@effect/opentelemetry": "^4.0.0-beta.27",
            },
          })}\n`
        );

        const changed = yield* updateCatalogEntry(packageJsonPath, "@effect/opentelemetry", {
          versionSpecifier: "^4.0.0-beta.28",
        });
        const updated = yield* fs.readFileString(packageJsonPath);
        const decodedUpdated = (yield* S.decodeEffect(S.fromJsonString(S.Unknown))(updated)) as {
          readonly catalog: Record<string, string>;
        };

        expect(changed).toBe(true);
        expect(decodedUpdated.catalog["@effect/opentelemetry"]).toBe("^4.0.0-beta.28");
        expect(decodedUpdated.catalog.effect).toBe("^4.0.0-beta.28");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("resolveNodeVersions", () => {
    it.effect(
      "parses GitHub workflow YAML through the shared schema codec after extraction to @beep/schema",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const workflowDir = path.join(tmpDir, ".github", "workflows");

        yield* fs.makeDirectory(workflowDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".nvmrc"), "20.11.1\n");
        yield* fs.writeFileString(
          path.join(workflowDir, "ci.yml"),
          A.join(
            [
              "jobs:",
              "  test:",
              "    steps:",
              "      - uses: actions/setup-node@v4",
              "        with:",
              "          node-version: 18.19.0",
            ],
            "\n"
          )
        );

        const state = yield* resolveNodeVersions(tmpDir);
        const report = buildNodeReport(state);

        expect(state.nvmrc).toBe("20.11.1");
        expect(state.workflowLocations).toHaveLength(1);
        expect(state.workflowLocations[0]?.file).toBe(".github/workflows/ci.yml");
        expect(state.workflowLocations[0]?.currentValue).toBe("18.19.0");
        expect(state.workflowLocations[0]?.yamlPath).toEqual(["jobs", "test", "steps", 0, "with", "node-version"]);
        expect(report.status).toBe("drift");
        expect(report.items).toHaveLength(1);
        expect(report.items[0]?.expected).toBe("20.11.1");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("buildBunReport", () => {
    it("round-trips schema-derived Bun version states", () => {
      const encode = S.encodeSync(BunVersionState);
      const decode = S.decodeSync(BunVersionState);
      const equivalent = S.toEquivalence(BunVersionState);

      fc.assert(
        fc.property(S.toArbitrary(BunVersionState)(fc), (state) => {
          expect(equivalent(decode(encode(state)), state)).toBe(true);
        })
      );
    });

    it.effect(
      "resolves the root, Vercel, and runner archive Bun pins without network access",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");
        const digest = "2d03fb5fb83ac8b567aca0a281b2ce1a1a19d488f56c2968d88c3f25e92fe452";

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(
          path.join(vercelDir, "vercel.json"),
          `${encodeJson({
            installCommand: "cd ../.. && npx --yes bun@1.3.14 install --frozen-lockfile",
            buildCommand: "cd ../.. && npx --yes bun@1.3.14 run --cwd apps/oip-web build:pwa",
          })}\n`
        );
        yield* fs.writeFileString(path.join(tmpDir, ".bun-linux-x64.sha256"), `${digest}\n`);

        const state = yield* resolveBunVersions(tmpDir, true);

        expect(state.bunVersionFile).toBe("1.4.0");
        expect(state.packageManagerField).toBe("1.4.0");
        expect(state.vercelInstallVersion).toEqual(O.some("1.3.14"));
        expect(state.vercelBuildVersion).toEqual(O.some("1.3.14"));
        expect(state.bunArchiveSha256).toEqual(O.some(digest));
        expect(state.expectedBunArchiveSha256).toEqual(O.none());

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "treats the Vercel and runner checksum files as optional",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();

        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );

        const state = yield* resolveBunVersions(tmpDir, true);

        expect(state.vercelInstallVersion).toEqual(O.none());
        expect(state.vercelBuildVersion).toEqual(O.none());
        expect(state.bunArchiveSha256).toEqual(O.none());

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it("uses semver precedence instead of lexicographic string ordering for local Bun pins", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.10.0",
          packageManagerField: "1.9.0",
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(report.items).toHaveLength(1);
      expect(report.items[0]?.file).toBe("package.json");
      expect(report.items[0]?.expected).toBe("bun@1.10.0");
    });

    it("treats stable releases as newer than prereleases with the same core version", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.10.0-beta.1",
          packageManagerField: "1.10.0",
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(report.items).toHaveLength(1);
      expect(report.items[0]?.file).toBe(".bun-version");
      expect(report.items[0]?.expected).toBe("1.10.0");
    });

    it("reports Vercel runtime pins and the runner archive checksum with Bun version drift", () => {
      const report = buildBunReport(
        BunVersionState.make({
          bunVersionFile: "1.4.0",
          packageManagerField: "1.4.0",
          vercelInstallVersion: O.some("1.3.14"),
          vercelBuildVersion: O.some("1.3.14"),
          bunArchiveSha256: O.some("old-digest"),
          expectedBunArchiveSha256: O.some("new-digest"),
          latest: O.none(),
        })
      );

      expect(report.status).toBe("drift");
      expect(A.map(report.items, (item) => [item.file, item.field, item.expected])).toEqual([
        ["apps/oip-web/vercel.json", "installCommand Bun version", "1.4.0"],
        ["apps/oip-web/vercel.json", "buildCommand Bun version", "1.4.0"],
        [".bun-linux-x64.sha256", "bun-linux-x64.zip sha256", "new-digest"],
      ]);
    });

    it("extracts the Linux x64 archive digest from Bun's checksum manifest", () => {
      const digest = "2d03fb5fb83ac8b567aca0a281b2ce1a1a19d488f56c2968d88c3f25e92fe452";
      expect(extractBunArchiveChecksum(`${digest}  bun-linux-x64.zip\n`)).toEqual(O.some(digest));
      expect(extractBunArchiveChecksum(`${digest}  bun-linux-aarch64.zip\n`)).toEqual(O.none());
    });
  });

  describe("updateVercelBunVersion", () => {
    it.effect(
      "updates install and build command pins while preserving the surrounding Vercel document",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const vercelJsonPath = path.join(tmpDir, "vercel.json");

        yield* fs.writeFileString(
          vercelJsonPath,
          `${encodeJson({
            $schema: "https://openapi.vercel.sh/vercel.json",
            installCommand: "cd ../.. && npx --yes bun@1.3.14 install --frozen-lockfile",
            buildCommand: "cd ../.. && npx --yes bun@1.3.14 run --cwd apps/oip-web build:pwa",
          })}\n`
        );

        expect(yield* updateVercelBunVersion(vercelJsonPath, "installCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(false);

        const updated = (yield* S.decodeEffect(S.fromJsonString(S.Unknown))(
          yield* fs.readFileString(vercelJsonPath)
        )) as Record<string, unknown>;
        expect(updated.installCommand).toBe("cd ../.. && npx --yes bun@1.4.0 install --frozen-lockfile");
        expect(updated.buildCommand).toBe("cd ../.. && npx --yes bun@1.4.0 run --cwd apps/oip-web build:pwa");
        expect(updated.$schema).toBe("https://openapi.vercel.sh/vercel.json");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );

    it.effect(
      "applies every Bun report update through the version-sync write service",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.4.0\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(path.join(tmpDir, ".bun-linux-x64.sha256"), "old-digest\n");
        yield* fs.writeFileString(
          path.join(vercelDir, "vercel.json"),
          `${encodeJson({
            installCommand: "npx --yes bun@1.3.14 install --frozen-lockfile",
            buildCommand: "npx --yes bun@1.3.14 run build:pwa",
          })}\n`
        );

        const bunReport = buildBunReport(
          BunVersionState.make({
            bunVersionFile: "1.4.0",
            packageManagerField: "1.4.0",
            vercelInstallVersion: O.some("1.3.14"),
            vercelBuildVersion: O.some("1.3.14"),
            bunArchiveSha256: O.some("old-digest"),
            expectedBunArchiveSha256: O.some("new-digest"),
            latest: O.none(),
          })
        );
        const resolution = VersionSyncResolution.make({
          report: VersionSyncReport.make({ categories: [bunReport], hasDrift: true }),
          nodeLocations: [],
        });
        const updater = yield* UpdateApplierService;
        const applied = yield* updater.apply(tmpDir, resolution);

        expect(applied).toBe(3);
        expect(yield* fs.readFileString(path.join(tmpDir, ".bun-linux-x64.sha256"))).toBe("new-digest\n");
        const updatedVercel = (yield* S.decodeEffect(S.fromJsonString(S.Unknown))(
          yield* fs.readFileString(path.join(vercelDir, "vercel.json"))
        )) as Record<string, unknown>;
        expect(updatedVercel.installCommand).toBe("npx --yes bun@1.4.0 install --frozen-lockfile");
        expect(updatedVercel.buildCommand).toBe("npx --yes bun@1.4.0 run build:pwa");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });
});
