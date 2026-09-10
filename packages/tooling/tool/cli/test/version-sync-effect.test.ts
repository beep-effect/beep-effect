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
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const encodeJson = UnknownFromJsonString.encodeUnknownSync;

import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeUnknownJson = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeBunVersionStateSync = S.decodeSync(BunVersionState);
const encodeBunVersionStateSync = S.encodeSync(BunVersionState);

import { FetchHttpClient } from "effect/unstable/http";

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

  describe("snapshot catalog synchronization", () => {
    for (const repository of ["effect", "effect-smol"]) {
      it.effect(
        `normalizes ${repository} snapshots and preserves independently versioned tools`,
        Effect.fn(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const tmpDir = yield* fs.makeTempDirectoryScoped();
          const snapshot = (name: string) => `https://pkg.pr.new/Effect-TS/effect/${name}@c8349ed`;
          const independent = {
            "@effect/tsgo": "^0.5.0",
            "@effect/tsgo-linux-x64": "^0.5.0",
            "@effect/markdown-toc": "^0.1.0",
            "@effect/markdown-toc-cli": "^0.1.0",
            typescript: "^5.9.0",
          };
          const packageJsonPath = path.join(tmpDir, "package.json");
          yield* fs.writeFileString(
            packageJsonPath,
            encodeJson({
              catalog: {
                effect: `https://pkg.pr.new/Effect-TS/${repository}/effect@c8349ed`,
                "@effect/vitest": "https://pkg.pr.new/Effect-TS/effect-smol/@effect/vitest@abcdef0",
                "@effect/platform-node": snapshot("@effect/platform-node"),
                ...independent,
              },
            })
          );
          const state = yield* resolveEffectCatalog(tmpDir);
          expect(A.map(state.packages, (pkg) => pkg.name)).toEqual([
            "@effect/platform-node",
            "@effect/vitest",
            "effect",
          ]);
          const report = buildEffectReport(state);
          expect(report.status).toBe("drift");
          expect(A.map(report.items, (item) => [item.field, item.expected])).toEqual([
            ["catalog.@effect/vitest", snapshot("@effect/vitest")],
            ...(repository === "effect-smol" ? [["catalog.effect", snapshot("effect")]] : []),
          ]);
          const updater = yield* UpdateApplierService;
          expect(
            yield* updater.apply(
              tmpDir,
              VersionSyncResolution.make({
                report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
                nodeLocations: [],
              })
            )
          ).toBe(repository === "effect-smol" ? 2 : 1);
          const resolved = yield* resolveEffectCatalog(tmpDir);
          expect(buildEffectReport(resolved).status).toBe("ok");
          expect(A.map(resolved.packages, (pkg) => pkg.versionSpecifier)).toEqual([
            snapshot("@effect/platform-node"),
            snapshot("@effect/vitest"),
            snapshot("effect"),
          ]);
          const updated = yield* UnknownFromJsonString.decodeEffect(yield* fs.readFileString(packageJsonPath));
          expect(updated).toMatchObject({ catalog: independent });
        })
      );
    }
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
        const decodedUpdated = (yield* UnknownFromJsonString.decodeEffect(updated)) as {
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

    it.effect(
      "skips templated node-version values that fall back to .nvmrc at runtime",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectory();
        const workflowDir = path.join(tmpDir, ".github", "workflows");

        yield* fs.makeDirectory(workflowDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".nvmrc"), "20.11.1\n");
        yield* fs.writeFileString(
          path.join(workflowDir, "heavy.yml"),
          A.join(
            [
              "jobs:",
              "  lanes:",
              "    steps:",
              "      - uses: actions/setup-node@v4",
              "        with:",
              "          node-version: ${{ matrix.node_version || '' }}",
            ],
            "\n"
          )
        );

        const state = yield* resolveNodeVersions(tmpDir);
        const report = buildNodeReport(state);

        expect(state.workflowLocations).toHaveLength(0);
        expect(report.status).toBe("ok");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });

  describe("buildBunReport", () => {
    it("round-trips schema-derived Bun version states", () => {
      const equivalent = S.toEquivalence(BunVersionState);

      expect(
        Effect.runSync(
          Arbitrary.checkEffect(Arbitrary.all([Arbitrary.schema(BunVersionState)]), ([state]) => {
            expect(equivalent(decodeBunVersionStateSync(encodeBunVersionStateSync(state)), state)).toBe(true);

            return true;
          })
        )._tag
      ).toBe("Passed");
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
            installCommand: 'cd ../.. && npx --yes "bun@1.3.14" install --frozen-lockfile',
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
      "updates the canonical Bun version without rewriting derived deployment commands",
      Effect.fn(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tmpDir = yield* fs.makeTempDirectoryScoped();
        const vercelDir = path.join(tmpDir, "apps", "oip-web");
        const vercelJsonPath = path.join(vercelDir, "vercel.json");
        const document = `${encodeJson({
          installCommand: 'cd ../.. && npx --yes "bun@$(cat .bun-version)" install --frozen-lockfile',
          buildCommand: 'cd ../.. && npx --yes "bun@$(cat .bun-version)" run --cwd apps/oip-web build:pwa',
        })}\n`;

        yield* fs.makeDirectory(vercelDir, { recursive: true });
        yield* fs.writeFileString(path.join(tmpDir, ".bun-version"), "1.3.14\n");
        yield* fs.writeFileString(
          path.join(tmpDir, "package.json"),
          `${encodeJson({ packageManager: "bun@1.4.0" })}\n`
        );
        yield* fs.writeFileString(vercelJsonPath, document);

        const report = buildBunReport(yield* resolveBunVersions(tmpDir, true));
        expect(A.map(report.items, (item) => item.file)).toEqual([".bun-version"]);
        const updater = yield* UpdateApplierService;
        expect(
          yield* updater.apply(
            tmpDir,
            VersionSyncResolution.make({
              report: VersionSyncReport.make({ categories: [report], hasDrift: true }),
              nodeLocations: [],
            })
          )
        ).toBe(1);
        expect(yield* fs.readFileString(path.join(tmpDir, ".bun-version"))).toBe("1.4.0\n");
        expect(buildBunReport(yield* resolveBunVersions(tmpDir, true)).status).toBe("ok");
        expect(yield* updateVercelBunVersion(vercelJsonPath, "installCommand", "1.4.0")).toBe(false);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(false);
        expect(yield* fs.readFileString(vercelJsonPath)).toBe(document);
      })
    );

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
            installCommand: 'cd ../.. && npx --yes "bun@1.3.14" install --frozen-lockfile',
            buildCommand: "cd ../.. && npx --yes bun@1.3.14 run --cwd apps/oip-web build:pwa",
          })}\n`
        );

        expect(yield* updateVercelBunVersion(vercelJsonPath, "installCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(true);
        expect(yield* updateVercelBunVersion(vercelJsonPath, "buildCommand", "1.4.0")).toBe(false);

        const updated = (yield* decodeUnknownJson(yield* fs.readFileString(vercelJsonPath))) as Record<string, unknown>;
        expect(updated.installCommand).toBe('cd ../.. && npx --yes "bun@1.4.0" install --frozen-lockfile');
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
        const updatedVercel = (yield* decodeUnknownJson(
          yield* fs.readFileString(path.join(vercelDir, "vercel.json"))
        )) as Record<string, unknown>;
        expect(updatedVercel.installCommand).toBe("npx --yes bun@1.4.0 install --frozen-lockfile");
        expect(updatedVercel.buildCommand).toBe("npx --yes bun@1.4.0 run build:pwa");

        yield* fs.remove(tmpDir, { recursive: true });
      })
    );
  });
});
